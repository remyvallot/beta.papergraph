# 🎯 Papergraph Collaboration Setup - Summary

## What You Now Have

### ✅ Complete SQL Setup (`supabase_complete_setup.sql`)

**3 Main Tables:**
1. **`profiles`** - Extended user info (auto-created on signup)
2. **`projects`** - Your research projects with shareable links
3. **`project_members`** - Who has access to what (roles: owner/editor/viewer)

**Key Features Enabled:**
- ✅ Shareable project links with unique tokens (`/share/abc123`)
- ✅ Public/private project control (`is_public` flag)
- ✅ Role-based access (owner/editor/viewer)
- ✅ Email-based sharing (invite by email address)
- ✅ Real-time presence ready (Supabase Realtime enabled)
- ✅ Row Level Security (users only see their own + shared projects)
- ✅ Auto-triggers (profile creation, project ownership)

---

## 🚀 Quick Setup Steps

### 1. Run SQL (5 minutes)
```bash
# In Supabase Dashboard > SQL Editor
# Paste entire supabase_complete_setup.sql
# Click "Run"
```

### 2. Enable OAuth (10 minutes)
- GitHub OAuth app setup
- Google OAuth app setup
- Copy credentials to Supabase

### 3. Configure App
```javascript
// js/auth/config.js
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbG...";
```

---

## 🔗 How Shareable Links Work

### Scenario 1: Public Share Link
```javascript
// 1. Owner generates share link
const shareToken = await generateShareToken();
await supabase
  .from('projects')
  .update({ share_token: shareToken, is_public: true })
  .eq('id', projectId);

// Share URL: https://yoursite.com/share/abc123xyz

// 2. Recipient clicks link
// - Sees read-only preview (no login required)
// - Can sign in to add to "Shared with me"
```

### Scenario 2: Email Invitation
```javascript
// Owner invites by email
await supabase.rpc('share_project_by_email', {
  proj_id: projectId,
  target_email: 'colleague@university.edu',
  target_role: 'editor'  // Can edit!
});

// Recipient sees project in their dashboard immediately
```

---

## 📋 Implementation Checklist

### Backend (✅ Done)
- [x] SQL tables created
- [x] RLS policies configured
- [x] Share token generation
- [x] Helper functions (get_user_projects, share_project_by_email)
- [x] Triggers (auto-add owner, auto-create profile)

### Frontend (To Do)
- [ ] **Share button** in `editor.html` toolbar
- [ ] **Share modal** with:
  - Generate link button
  - Copy to clipboard
  - Email invitation form
  - Current members list
- [ ] **Share route** (`/share/:token` or `editor.html?share=token`)
  - Load project by token
  - Show "Add to my projects" button
  - Handle anonymous vs authenticated users
- [ ] **Projects dashboard** updates:
  - "Shared with me" section
  - Show owner name on shared projects
  - Display role badge (editor/viewer)
  - Filter by owned/shared

---

## 🎨 Recommended UI Flow

### In `editor.html`

**Add Share Button to Toolbar:**
```html
<button id="shareBtn" class="toolbar-btn">
  <svg>...</svg>
  Share
</button>
```

**Share Modal:**
```html
<div class="modal-overlay" id="shareModal">
  <div class="modal-container">
    <h2>Share Project</h2>
    
    <!-- Shareable Link Section -->
    <div class="share-section">
      <h3>Shareable Link</h3>
      <input type="text" id="shareLink" readonly />
      <button id="copyLinkBtn">Copy Link</button>
      <label>
        <input type="checkbox" id="publicToggle" />
        Allow anyone with link to view (read-only)
      </label>
    </div>
    
    <!-- Email Invitation Section -->
    <div class="share-section">
      <h3>Invite by Email</h3>
      <input type="email" id="inviteEmail" placeholder="colleague@university.edu" />
      <select id="inviteRole">
        <option value="editor">Can edit</option>
        <option value="viewer">View only</option>
      </select>
      <button id="sendInviteBtn">Send Invite</button>
    </div>
    
    <!-- Current Members Section -->
    <div class="share-section">
      <h3>Who has access</h3>
      <div id="membersList">
        <!-- Populated dynamically -->
      </div>
    </div>
  </div>
</div>
```

### In `projects.html`

**Add "Shared with me" Section:**
```html
<section class="projects-section">
  <h2>Shared with me</h2>
  <div id="sharedProjectsGrid" class="projects-grid">
    <!-- Project cards with owner info -->
  </div>
</section>
```

**Project Card Template:**
```html
<div class="project-card">
  <div class="project-badge" data-role="editor">Editor</div>
  <h3>Research Project Title</h3>
  <p class="project-owner">Shared by: colleague@university.edu</p>
  <p class="project-meta">Updated 2 days ago</p>
  <button>Open</button>
</div>
```

---

## 🔧 JavaScript Functions to Implement

### 1. Generate Share Link
```javascript
// js/auth/projects.js or new js/auth/sharing.js
export async function generateShareLink(projectId) {
  const token = generateRandomToken(12);
  
  const { error } = await supabase
    .from('projects')
    .update({ share_token: token, is_public: true })
    .eq('id', projectId);
  
  if (error) throw error;
  
  return `${window.location.origin}/share/${token}`;
}

function generateRandomToken(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```

### 2. Share by Email
```javascript
export async function shareProjectByEmail(projectId, email, role = 'viewer') {
  const { data, error } = await supabase.rpc('share_project_by_email', {
    proj_id: projectId,
    target_email: email,
    target_role: role
  });
  
  if (error) throw error;
  return data;
}
```

### 3. Get Current Members
```javascript
export async function getProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select(`
      id,
      role,
      added_at,
      profiles:user_id (
        email,
        full_name,
        avatar_url
      )
    `)
    .eq('project_id', projectId);
  
  if (error) throw error;
  return data;
}
```

### 4. Load Project by Share Token
```javascript
export async function loadProjectByShareToken(token) {
  const { data, error } = await supabase.rpc('get_project_by_share_token', {
    token
  });
  
  if (error) throw error;
  return data?.[0] || null;
}
```

### 5. Add Shared Project to User's List
```javascript
export async function acceptSharedProject(projectId, role = 'viewer') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: user.id,
      role: role
    });
  
  if (error) throw error;
}
```

---

## 🎯 Implementation Priority

### Phase 1: Basic Sharing (MVP)
1. Share button in editor
2. Generate share link
3. Copy to clipboard
4. Load project by share token
5. Read-only mode for shared viewers

### Phase 2: Collaboration
1. Email invitations
2. Role management (editor/viewer)
3. "Shared with me" in dashboard
4. Show current members

### Phase 3: Real-time
1. Live presence indicators
2. Concurrent editing
3. Conflict resolution
4. Activity feed

---

## 📚 SQL Helpers You Can Use

```javascript
// Get all user projects (owned + shared)
const { data } = await supabase.rpc('get_user_projects', {
  user_uuid: user.id
});

// Results include:
// - id, name, is_owner, role
// - node_count, edge_count
// - owner_email, created_at, updated_at
```

---

## 🐛 Common Issues & Solutions

### Issue: "Can't see shared projects"
**Solution:** Check RLS policies are correctly set
```sql
-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'projects';
```

### Issue: "Share token not unique"
**Solution:** Use `generate_share_token()` function (handles collisions)

### Issue: "Unauthorized to share"
**Solution:** Verify user is owner or has 'owner' role in project_members

---

## ✅ Testing Checklist

- [ ] Create new project
- [ ] Generate share link
- [ ] Copy link works
- [ ] Open share link in incognito (should work without login)
- [ ] Sign in from share link adds project to dashboard
- [ ] Invite user by email
- [ ] Invited user sees project in "Shared with me"
- [ ] Editor can modify project
- [ ] Viewer cannot modify (read-only)
- [ ] Owner can remove members
- [ ] Real-time presence shows active users

---

## 📖 Files You Have

1. **`supabase_complete_setup.sql`** - Complete database setup
2. **`SUPABASE_SETUP_QUICK.md`** - Step-by-step guide
3. **`.github/copilot-instructions.md`** - Updated with sharing info
4. **This file** - Implementation roadmap

---

## 🚀 Next Steps

1. **Run the SQL** in Supabase (5 min)
2. **Configure OAuth** providers (10 min)
3. **Test database** with verification queries
4. **Implement share UI** (frontend work)
5. **Test end-to-end** sharing flow

**Ready to start?** Begin with `SUPABASE_SETUP_QUICK.md` and run the SQL! 🎉
