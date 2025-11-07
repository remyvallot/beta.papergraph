# Papergraph Setup Guide

This guide will help you set up Papergraph with cloud synchronization using Supabase.

## 🚀 Quick Start (No Setup Required)

Papergraph works out of the box without any configuration:

1. Open `editor.html` in your browser
2. Start adding articles and building your research graph
3. Data is saved locally in your browser's localStorage

**No account needed for basic usage!**

---

## ☁️ Cloud Sync Setup (Optional)

To enable cloud synchronization across devices, you'll need to set up Supabase.

### Prerequisites

- A [Supabase](https://supabase.com) account (free tier available)
- GitHub and/or Google OAuth apps (for social login)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **"New Project"**
3. Fill in:
   - **Name**: `papergraph` (or any name you prefer)
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest to your users
4. Click **"Create new project"**
5. Wait for the project to finish setting up (1-2 minutes)

### Step 2: Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste this SQL:

```sql
-- Create projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own projects
CREATE POLICY "Users can view own projects"
    ON projects
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own projects
CREATE POLICY "Users can create own projects"
    ON projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON projects
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

4. Click **"Run"** to execute the SQL
5. You should see "Success. No rows returned"

### Step 3: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Find these two values:
   - **Project URL** (e.g., `https://abcdefghij.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)
3. Copy both values

### Step 4: Configure Papergraph

1. Open `js/auth/config.js` in your code editor
2. Replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your Project URL
const SUPABASE_ANON_KEY = 'eyJ...'; // Replace with your anon public key
```

3. Save the file

### Step 5: Enable Authentication Providers

#### Email/Password (Already Enabled)

Email authentication is enabled by default. Users can sign up and receive confirmation emails.

#### GitHub OAuth (Optional)

1. Go to [GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Papergraph`
   - **Homepage URL**: `https://yourdomain.com` (or `http://localhost` for testing)
   - **Authorization callback URL**: `https://your-project.supabase.co/auth/v1/callback`
4. Click **"Register application"**
5. Copy the **Client ID** and **Client Secret**
6. In Supabase dashboard, go to **Authentication** → **Providers**
7. Find **GitHub**, enable it, and paste your Client ID and Secret
8. Save

#### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. Configure consent screen if prompted
6. Choose **"Web application"**
7. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
8. Copy the **Client ID** and **Client Secret**
9. In Supabase dashboard, go to **Authentication** → **Providers**
10. Find **Google**, enable it, and paste your Client ID and Secret
11. Save

### Step 6: Configure Email Settings (Recommended)

1. In Supabase dashboard, go to **Authentication** → **Email Templates**
2. Customize the confirmation email template if desired
3. Go to **Settings** → **Auth** → **SMTP Settings**
4. (Optional) Configure your own SMTP server for branded emails

---

## 🧪 Testing Your Setup

1. Open `index.html` in your browser
2. Click **"Get started"**
3. Sign up with email or use GitHub/Google
4. Check your email for confirmation (if using email signup)
5. After confirming, you'll be redirected to the projects dashboard
6. Create a new project
7. Open the project and add some articles
8. Close and reopen the browser - your data should persist
9. Open the same project URL on another device - you should see your data synced!

---

## 📁 Project Structure

```
papergraph/
├── index.html              # Landing page with authentication
├── projects.html           # Project dashboard
├── editor.html            # Main graph editor
├── js/
│   ├── auth/
│   │   ├── config.js      # ⚠️ Configure your Supabase credentials here
│   │   ├── auth.js        # Authentication functions
│   │   └── projects.js    # Project CRUD operations
│   ├── data/
│   │   ├── cloud-storage.js  # Cloud sync logic
│   │   └── storage.js     # Local storage (enhanced with cloud)
│   └── ...
└── css/
    └── ...
```

---

## 🔐 Security Notes

### Row Level Security (RLS)

Papergraph uses Supabase's Row Level Security to ensure:
- Users can only see their own projects
- Users cannot modify or delete other users' projects
- All data access is validated at the database level

### API Keys

- The **anon public key** is safe to expose in client-side code
- Never commit your `.env` file if you use environment variables
- The key only allows authenticated operations defined by RLS policies

### Authentication

- Email confirmation is required by default (configurable in Supabase)
- OAuth providers (GitHub, Google) are secure and don't expose passwords
- Sessions are managed securely by Supabase

---

## 🌐 Deployment

### GitHub Pages

1. Push your code to a GitHub repository
2. Configure your Supabase credentials in `js/auth/config.js`
3. Go to repository **Settings** → **Pages**
4. Choose source: **main** branch, **root** folder
5. Click **Save**
6. Your site will be available at `https://username.github.io/papergraph`

**Important**: Update OAuth redirect URLs in GitHub/Google settings to match your GitHub Pages URL.

### Custom Domain

1. Follow GitHub Pages setup above
2. Add a `CNAME` file with your domain
3. Configure DNS records as per [GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
4. Update OAuth redirect URLs to your custom domain

### Netlify / Vercel

1. Connect your repository
2. No build command needed (static site)
3. Deploy
4. Update OAuth redirect URLs

---

## 🛠️ Troubleshooting

### "Supabase is not configured" error

- Check that you've updated `js/auth/config.js` with your actual credentials
- Ensure the URL includes `.supabase.co`
- Clear browser cache and reload

### Authentication not working

- Verify your OAuth apps are configured correctly
- Check redirect URLs match exactly
- Look at browser console for specific error messages
- Ensure email confirmation is complete (check spam folder)

### Projects not syncing

- Check browser console for errors
- Verify you're signed in (check for "Cloud Sync" indicator in editor)
- Test your Supabase connection in the SQL Editor
- Ensure RLS policies are properly set up

### "Failed to load project" error

- The project may not exist or belong to another user
- Check the project ID in the URL is correct
- Try accessing from the projects dashboard instead

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [GitHub OAuth Setup](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)

---

## 💡 Tips

- **Offline Mode**: Papergraph always saves to localStorage first, so it works offline
- **Local-Only Mode**: Just use `editor.html` directly without the `?id=` parameter
- **Import/Export**: Use the built-in import/export features as backup
- **Testing**: Use Supabase's free tier for development (50,000 monthly active users)

---

## 🤝 Support

If you encounter issues:

1. Check this guide thoroughly
2. Look at browser console errors
3. Check Supabase logs in your dashboard
4. Open an issue on GitHub with:
   - Browser and version
   - Error messages (with sensitive data removed)
   - Steps to reproduce

---

**Enjoy organizing your research with Papergraph! 🎓📚**
