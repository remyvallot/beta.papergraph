# Papergraph Authentication & Cloud Sync Guide

## 🎯 Overview

Papergraph now supports optional cloud synchronization, allowing you to:
- Access your projects from any device
- Never lose your research organization
- Collaborate across multiple machines
- Keep your data backed up automatically

**Important**: Papergraph still works 100% offline without an account. Cloud sync is entirely optional.

---

## 🔑 Authentication Options

### 1. Anonymous Mode (Default)
- No account needed
- Works completely offline
- Data saved in browser localStorage
- Best for: Quick experiments, single-device usage

**How to use**: Click "Try without account" on the landing page.

### 2. Email/Password
- Create account with email
- Email verification required
- Secure password authentication
- Best for: Users without GitHub/Google accounts

**How to use**: 
1. Click "Get started" on landing page
2. Enter email and password
3. Click "Sign up"
4. Check email for verification link
5. Click link to activate account

### 3. GitHub OAuth
- Sign in with your GitHub account
- No password needed
- Instant access (no email verification)
- Best for: Developers, GitHub users

**How to use**: Click "Continue with GitHub" button

### 4. Google OAuth
- Sign in with your Google account
- No password needed
- Instant access (no email verification)
- Best for: Gmail users, Google Workspace

**How to use**: Click "Continue with Google" button

---

## 📁 Project Management

### Creating Projects

1. Sign in to your account
2. You'll be redirected to the projects dashboard
3. Click **"New Project"** button
4. Enter a project name
5. Click **"Create"**
6. You'll be taken to the editor with your new project

### Opening Projects

**From Dashboard**:
1. Go to projects dashboard (`projects.html`)
2. Click any project card
3. Or click the "Open" button on a project

**Direct URL**:
Each project has a unique URL: `editor.html?id=<project-uuid>`
- Bookmark this URL to access directly
- Share with yourself across devices
- Copy from browser address bar

### Renaming Projects

1. Go to projects dashboard
2. Click **"Rename"** on the project card
3. Enter new name
4. Press Enter or click OK

### Deleting Projects

1. Go to projects dashboard
2. Click **"Delete"** on the project card
3. Confirm deletion
4. ⚠️ **This cannot be undone!**

---

## ☁️ Cloud Synchronization

### How It Works

1. **Auto-save**: Every change is automatically saved to localStorage
2. **Cloud sync**: If you're signed in and have a project ID, changes also sync to cloud
3. **Throttled**: Cloud saves are batched (every 2 seconds) to avoid excessive API calls
4. **Offline-first**: Always works offline; syncs when back online

### Sync Indicator

When cloud sync is active, you'll see a blue indicator in the top-right:
```
[💾] Cloud Sync
```

### Sync Behavior

| Action | Local Storage | Cloud Storage |
|--------|--------------|---------------|
| Add article | ✅ Immediate | ✅ After 2s |
| Edit node | ✅ Immediate | ✅ After 2s |
| Move node | ✅ Immediate | ✅ After 2s |
| Delete article | ✅ Immediate | ✅ After 2s |
| Add connection | ✅ Immediate | ✅ After 2s |
| Create tag zone | ✅ Immediate | ✅ After 2s |

### Loading Projects

**First load**:
- Project data loaded from cloud
- Saved to localStorage for offline access
- Network graph rendered with saved positions

**Subsequent loads**:
- Checks cloud for latest version
- Merges with any local changes
- Always keeps most recent data

---

## 🔄 Switching Between Modes

### From Anonymous to Cloud

1. Export your current project:
   - Click menu → Export → JSON
2. Sign up for an account
3. Create a new project
4. Import your saved JSON:
   - Click menu → Import → JSON

### From Cloud to Anonymous

1. Open project with `?id=` parameter
2. Export to JSON
3. Open `editor.html` (without `?id=`)
4. Import JSON

---

## 🛡️ Security & Privacy

### Data Security

- **Row Level Security**: You can only access your own projects
- **End-to-end**: Data encrypted in transit (HTTPS)
- **No tracking**: No analytics or third-party cookies
- **Open source**: Audit the code yourself

### What's Stored

**Supabase Database**:
- Project name
- Graph data (articles, connections, zones)
- Node positions
- Your user ID (from authentication)

**Not Stored**:
- Browsing history
- Personal information beyond email
- File uploads (everything is JSON)

### OAuth Providers

When you sign in with GitHub or Google:
- Only email and public profile info is accessed
- No access to repositories or private data
- No posting on your behalf
- You can revoke access anytime

---

## 🚨 Troubleshooting

### "Failed to load project"

**Possible causes**:
- Project ID is invalid
- Project belongs to another user
- Network connection issue

**Solutions**:
1. Check the URL is correct
2. Ensure you're signed in with the correct account
3. Check your internet connection
4. Try accessing from projects dashboard

### Projects not syncing

**Check**:
1. Are you signed in? (Look for Cloud Sync indicator)
2. Is there a project ID in the URL?
3. Browser console for errors (F12 → Console)

**Solutions**:
1. Refresh the page
2. Sign out and back in
3. Check Supabase configuration in `js/auth/config.js`

### Email verification not working

**Check**:
1. Spam/junk folder
2. Correct email address entered

**Solutions**:
1. Request new verification email (Supabase dashboard)
2. Contact your Supabase project admin

### OAuth redirect errors

**Common issue**: Misconfigured redirect URLs

**Solutions**:
1. Check OAuth app settings (GitHub/Google)
2. Ensure callback URL matches: `https://your-project.supabase.co/auth/v1/callback`
3. Try incognito/private browsing mode

---

## 💡 Best Practices

### Backup Strategy

Even with cloud sync, it's good to have backups:
1. Regularly export to JSON (File → Export → JSON)
2. Save exported files to cloud storage (Dropbox, Drive, etc.)
3. Consider version control for important projects

### Project Organization

1. Use descriptive project names
2. One project per research topic
3. Don't mix unrelated articles in same project
4. Create new projects freely (they're lightweight)

### Performance

1. Cloud sync adds ~100-200ms latency
2. Still responsive for projects with hundreds of nodes
3. Auto-save batching prevents API rate limits
4. Offline mode is always faster

---

## 📖 Related Documentation

- [SETUP.md](./SETUP.md) - Complete Supabase setup guide
- [README.md](./README.md) - Project overview
- [USER_MANUAL.md](./USER_MANUAL.md) - Full feature documentation

---

## 🆘 Getting Help

1. Check [SETUP.md](./SETUP.md) for configuration issues
2. Check browser console for error messages (F12)
3. Open an issue on GitHub with:
   - Your browser and version
   - Steps to reproduce the problem
   - Any error messages (with sensitive data removed)

---

**Happy organizing! 🎓📚**
