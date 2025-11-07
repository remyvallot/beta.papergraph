# Sharing System Fixes

## Issues Fixed

### 1. **406 Not Acceptable Error**
**Problem**: Supabase query `GET /rest/v1/profiles?...` returned 406 error
**Root Cause**: Using `.single()` when profile might not exist caused Postgres to reject the query
**Solution**: Changed to `.maybeSingle()` in `js/auth/sharing.js` line ~135

```javascript
// BEFORE (causing 406 error)
const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, avatar_url, username')
    .eq('id', member.user_id)
    .single();  // ❌ Fails if no profile found

// AFTER (fixed)
const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, full_name, avatar_url, username')
    .eq('id', member.user_id)
    .maybeSingle();  // ✅ Returns null if not found, no error

if (profileError) {
    console.warn('Error fetching profile for user:', member.user_id, profileError);
}
```

### 2. **Share Link Not Working (Empty Project)**
**Problem**: Clicking share link (e.g., `editor.html?share=abc123`) showed empty editor
**Root Cause**: 
- Editor only checked for `?id=` parameter, not `?share=` parameter
- `initCloudStorage()` didn't handle share tokens
- No function to load project from share token

**Solution**: Added complete share token support

#### A. Updated `editor.html` (line ~1051)
```javascript
// Check for both project ID and share token
const projectId = urlParams.get('id');
const shareToken = urlParams.get('share');  // ✅ Now checks share token

// Initialize cloud storage for either case
if ((projectId || shareToken) && !importFromGallery) {
    cloudLoaded = await window.initCloudStorage();
}
```

#### B. Updated `js/data/cloud-storage.js` (line ~14)
```javascript
export async function initCloudStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentProjectId = urlParams.get('id');
    const shareToken = urlParams.get('share');  // ✅ Extract share token
    
    // Handle share token (works without authentication)
    if (shareToken) {
        console.log('Loading project via share token:', shareToken);
        try {
            await loadProjectFromShareToken(shareToken);
            return true;
        } catch (error) {
            showNotification('Failed to load shared project', 'error');
            return false;
        }
    }
    
    // ... rest of function
}
```

#### C. Added `loadProjectFromShareToken()` function (new, line ~161)
```javascript
/**
 * Load project data from share token (works without authentication)
 */
async function loadProjectFromShareToken(token) {
    const { loadProjectByShareToken } = await import('../auth/sharing.js');
    
    const project = await loadProjectByShareToken(token);
    
    if (!project) {
        throw new Error('Shared project not found');
    }
    
    // Set currentProjectId for reference
    currentProjectId = project.id;
    
    // Update page title
    document.title = `${project.name} - Papergraph (Shared)`;
    
    // Load project data into appData
    if (project.data) {
        // Load nodes and edges
        appData.articles = project.data.nodes || [];
        appData.connections = project.data.edges || [];
        
        // Update next IDs
        if (appData.articles.length > 0) {
            const maxId = Math.max(...appData.articles.map(a => parseInt(a.id) || 0));
            appData.nextArticleId = maxId + 1;
        }
        
        // Load tag zones
        const zones = project.data.zones || project.data.tagZones || [];
        if (zones.length > 0 && typeof tagZones !== 'undefined') {
            tagZones.length = 0;
            tagZones.push(...zones);
        }
        
        // Load positions
        const positions = project.data.positions || project.data.nodePositions || {};
        if (Object.keys(positions).length > 0) {
            window.savedNodePositions = positions;
        }
        
        console.log('✓ Shared project loaded:', project.name);
        showNotification(`Viewing shared project: ${project.name}`, 'info');
    }
    
    return project;
}
```

### 3. **Pending Invites Not Showing**
**Status**: Partially working
**Current Behavior**: 
- When inviting email that doesn't have account: Creates pending invite in database ✅
- Pending invites are **not displayed** in share modal ❌
- Email notifications are **not sent** ❌ (requires Supabase Edge Function)

**What Works**:
- Database function `share_project_by_email()` creates pending_invites record
- Returns invite token and URL: `/invite/{token}`

**What's Missing**:
1. **UI to display pending invites** in share modal
2. **Email delivery** via Supabase Edge Function (requires setup)
3. **Invite acceptance flow** (landing page for `/invite/{token}` URL)

## Testing Checklist

### ✅ Test Share Link
1. Open project in editor
2. Click share button (top-right)
3. Click "Generate Share Link"
4. Copy the link (should be: `https://yourdomain.com/editor.html?share=abc123`)
5. Open link in **incognito window** (no auth)
6. **Expected**: Project loads with all nodes, edges, zones, and positions
7. **Expected**: Notification says "Viewing shared project: [name]"

### ✅ Test Member Invitation (Existing User)
1. Create test user account (email: test@example.com)
2. Open project in your main account
3. Click share → Invite by email
4. Enter `test@example.com`, role = "Viewer"
5. Click "Invite"
6. **Expected**: 
   - Success notification: "Invitation sent to test@example.com"
   - Member appears in members list immediately
   - Test user should see notification (if logged in)

### ⚠️ Test Pending Invite (Non-Existent User)
1. Open project → Share modal
2. Invite email that **doesn't have account**: `newuser@example.com`
3. Click "Invite"
4. **Expected**: Success notification
5. **Known Issue**: Pending invite created in database but:
   - ❌ Not displayed in modal UI
   - ❌ No email sent (requires Edge Function setup)
   - ⚠️ User can't accept invite (no `/invite/{token}` page yet)

### ✅ Test 406 Error Fix
1. Open browser DevTools → Network tab
2. Open share modal for any project
3. Look for `GET /rest/v1/profiles` requests
4. **Expected**: All return 200 OK (no 406 errors)
5. **Expected**: Members list loads without errors

## Database Verification

Run these queries in Supabase SQL Editor to verify data:

```sql
-- Check pending invites
SELECT 
    pi.email,
    pi.role,
    pi.invite_token,
    pi.created_at,
    pi.expires_at,
    p.name as project_name
FROM pending_invites pi
JOIN projects p ON p.id = pi.project_id
WHERE pi.expires_at > NOW()
ORDER BY pi.created_at DESC;

-- Check project members
SELECT 
    pm.role,
    pr.email,
    pr.full_name,
    p.name as project_name,
    pm.added_at
FROM project_members pm
JOIN profiles pr ON pr.id = pm.user_id
JOIN projects p ON p.id = pm.project_id
ORDER BY p.name, pm.role;

-- Check share tokens
SELECT 
    id,
    name,
    share_token,
    is_public,
    user_id
FROM projects
WHERE share_token IS NOT NULL;
```

## Next Steps (Not Yet Implemented)

### 1. Display Pending Invites in UI
Add to share modal (after members list):
```html
<div class="pending-invites-section">
    <h4>Pending Invitations</h4>
    <div id="pendingInvitesList">
        <!-- List pending invites with email, role, expiry, and cancel button -->
    </div>
</div>
```

### 2. Email Notifications (Requires Supabase Edge Function)
Create `supabase/functions/send-invite-email/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { email, projectName, inviterName, inviteUrl } = await req.json()
  
  // Use SendGrid/Resend/etc to send email
  const emailBody = `
    ${inviterName} invited you to collaborate on "${projectName}"
    
    Click here to accept: ${inviteUrl}
  `
  
  // Send email...
  
  return new Response(JSON.stringify({ success: true }))
})
```

### 3. Invite Acceptance Page
Create `invite.html`:
- Parse token from URL: `/invite.html?token=abc123`
- If user logged in: Auto-accept invite
- If not: Show signup form → accept after signup
- Database trigger: Move from `pending_invites` to `project_members` on acceptance

## Files Modified

1. ✅ `js/auth/sharing.js` (line ~135) - Fixed 406 error with `.maybeSingle()`
2. ✅ `js/data/cloud-storage.js` (line ~14-80) - Added share token support + `loadProjectFromShareToken()`
3. ✅ `editor.html` (line ~1051) - Check for `?share=` parameter

## Files Not Modified (But May Need Updates)

1. ❌ `editor.html` (share modal HTML) - No pending invites section
2. ❌ `projects.html` (share modal HTML) - No pending invites section
3. ❌ No `invite.html` page exists yet
4. ❌ No Supabase Edge Function for email sending

## Summary

**Working**:
- ✅ Share links now load projects correctly
- ✅ 406 error fixed (profiles query uses `.maybeSingle()`)
- ✅ Members can be invited by email (if they have accounts)
- ✅ Database properly stores pending invites

**Partially Working**:
- ⚠️ Pending invites created but not displayed in UI
- ⚠️ No email notifications sent (needs Edge Function)
- ⚠️ No invite acceptance flow (needs `/invite` page)

**Recommendation**: Test share links first (most critical fix). Pending invite UI and email notifications are lower priority and require additional development.
