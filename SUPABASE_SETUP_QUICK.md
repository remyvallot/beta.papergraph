# 🚀 Papergraph Supabase Setup Guide

## Quick Start (5 minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `papergraph`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to you
4. Click **"Create new project"** and wait ~2 minutes

### Step 2: Run the SQL Setup
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy the entire contents of `supabase_complete_setup.sql`
4. Paste into the editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. Wait for success message ✅

### Step 3: Enable Authentication Providers
1. Go to **Authentication** > **Providers** (left sidebar)
2. Enable **GitHub**:
   - Create GitHub OAuth app at [github.com/settings/developers](https://github.com/settings/developers)
   - Set **Homepage URL**: `http://localhost` (or your domain)
   - Set **Authorization callback URL**: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase
3. Enable **Google**:
   - Create OAuth app at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
   - Add authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase
4. (Optional) Enable **Email** authentication if you want email/password login

### Step 4: Configure Your App
1. In Supabase dashboard, go to **Project Settings** > **API**
2. Copy your:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)
3. Open `js/auth/config.js` in your project
4. Replace:
   ```javascript
   const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-key-here";
   ```

### Step 5: Test It!
1. Open `index.html` in your browser
2. Click **"Get started"**
3. Sign in with GitHub or Google
4. Create a new project
5. Start adding articles!

---

## 🔗 Shareable Links Feature

### How Shareable Links Work

1. **Create a share link**:
   ```javascript
   // Generate share token for project
   const { data, error } = await supabase
     .from('projects')
     .update({ 
       share_token: await generateShareToken(),
       is_public: true 
     })
     .eq('id', projectId);
   
   // Share link: https://yoursite.com/share/abc123xyz
   ```

2. **Access shared project**:
   - User clicks link: `/share/abc123xyz`
   - App loads project by token
   - If user is authenticated, project is added to their shared list
   - If not authenticated, they see read-only preview

3. **Share with specific users** (via email):
   ```javascript
   // Share with editor access
   await supabase.rpc('share_project_by_email', {
     proj_id: projectId,
     target_email: 'friend@example.com',
     target_role: 'editor'  // or 'viewer'
   });
   ```

### Share Link Flow

```
User A (Owner)                  User B (Recipient)
──────────────                  ──────────────────
1. Create project
2. Click "Share" button
3. Generate share link
4. Send to User B           →   5. Click link
                                6. See project preview
                                7. Sign in (optional)
                                8. Project added to "Shared with me"
```

---

## 📋 Database Schema

### Tables Created

#### `profiles`
- Stores extended user info (email, username, avatar)
- Auto-created on user signup

#### `projects`
- Main project table with graph data
- **New fields**:
  - `share_token`: Unique token for shareable links
  - `is_public`: If true, anyone with link can view

#### `project_members`
- Manages sharing and permissions
- **Roles**:
  - `owner`: Full control (can delete, share)
  - `editor`: Can edit project data
  - `viewer`: Read-only access

---

## 🔒 Security (Row Level Security)

### Who Can See What?

- **Own projects**: Always visible
- **Shared projects**: Visible if you're in `project_members` table
- **Public projects**: Visible to anyone with the share link

### Who Can Edit?

- **Own projects**: Always editable
- **Shared projects**: Only if role is `owner` or `editor`
- **Public projects**: Read-only unless you're a member

### Sharing Permissions

- Only **owners** can:
  - Add/remove members
  - Change member roles
  - Delete project
  - Generate share links

---

## 🛠️ Useful SQL Queries

### Get all shared projects for a user
```sql
SELECT * FROM get_user_projects('USER_UUID_HERE');
```

### Find project by share token
```sql
SELECT * FROM get_project_by_share_token('abc123xyz');
```

### Share project with someone
```sql
SELECT share_project_by_email(
  'PROJECT_UUID',
  'friend@example.com',
  'editor'
);
```

### Check who has access to a project
```sql
SELECT 
  pm.role,
  p.email,
  p.full_name,
  pm.added_at
FROM project_members pm
JOIN profiles p ON p.id = pm.user_id
WHERE pm.project_id = 'PROJECT_UUID_HERE';
```

---

## 🐛 Troubleshooting

### "Can't see my projects"
- Check RLS policies are enabled:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE schemaname = 'public';
  ```
- Verify you're authenticated:
  ```javascript
  const user = await supabase.auth.getUser();
  console.log(user);
  ```

### "Can't share projects"
- Verify `project_members` table exists
- Check you're the owner:
  ```sql
  SELECT * FROM project_members 
  WHERE project_id = 'YOUR_PROJECT_ID' 
  AND user_id = auth.uid();
  ```

### "Shared projects not appearing"
- Check the `get_user_projects()` function returns data
- Verify RLS policies allow access to shared projects

---

## 📚 Next Steps

1. **Implement share UI** in `editor.html`:
   - Add "Share" button in toolbar
   - Modal to generate share link
   - Show list of current members

2. **Create share route**:
   - Add `/share/:token` page
   - Load project by token
   - Show "Add to my projects" button

3. **Add to projects.html**:
   - Section for "Shared with me"
   - Show who owns each shared project
   - Display your role (editor/viewer)

4. **Real-time presence** (already setup):
   - Show who's currently viewing/editing
   - Live cursors/avatars
   - Uses Supabase Realtime

---

## 🔄 Migration from Old Setup

If you already have projects in the database:

```sql
-- Add share_token and is_public columns (already in setup)
-- No data loss, existing projects remain private by default

-- Optionally, add existing collaborators
-- (if you had a different collaboration system)
```

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] SQL script executed successfully
- [ ] 3 tables exist: `profiles`, `projects`, `project_members`
- [ ] RLS enabled on all tables
- [ ] GitHub/Google OAuth configured
- [ ] `js/auth/config.js` updated with credentials
- [ ] Can sign in and create projects
- [ ] Can share projects via share link
- [ ] Shared projects appear in dashboard

---

**Need help?** Check the console for errors or run the verification queries at the end of `supabase_complete_setup.sql`.
