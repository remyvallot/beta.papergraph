# Database Migration: User Profiles

This migration adds username support to Papergraph.

## What it does

1. Creates a `user_profiles` table to store usernames
2. Adds username validation (3-20 characters, alphanumeric + underscore only)
3. Sets up Row Level Security policies
4. Creates triggers to automatically handle new user signups
5. Creates indexes for performance

## How to apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `create_user_profiles.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase migration new create_user_profiles
# Copy the SQL content to the new migration file
supabase db push
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check if table exists
SELECT * FROM public.user_profiles LIMIT 1;

-- Check if policies are active
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

## Features

- **Unique usernames**: Each user has a unique @username
- **Auto-generation**: Usernames are automatically generated from:
  - GitHub: Uses GitHub username
  - Google: Uses name (converted to username format)
  - Email: Uses email prefix if nothing else available
- **Collision handling**: Adds numeric suffixes if username is taken
- **Display**: Username shown as @username in avatar dropdown menu

## Schema

```
user_profiles
├── id (UUID, FK to auth.users)
├── username (TEXT, UNIQUE)
├── email (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```
