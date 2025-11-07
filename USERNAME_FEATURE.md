# Username Feature Implementation

## Overview

Added username support to Papergraph authentication system. Users now have unique @usernames displayed in the avatar dropdown menu.

## Changes Made

### 1. Sign-up Form (index.html)
- Added username input field (hidden by default, shown only during sign-up)
- Username validation: 3-20 characters, alphanumeric + underscore only
- Pattern validation with HTML5 form validation
- Toggle logic updated to show/hide username field

### 2. Username Generation Logic

**Email Sign-up (index.html):**
- User enters username manually
- Checks for uniqueness before creating account
- Stores username in Supabase user metadata

**OAuth Sign-up (projects.html):**
- Auto-generates username from OAuth provider data:
  - **GitHub**: Uses `user_name` from metadata
  - **Google**: Converts full name to username format
  - **Fallback**: Uses email prefix if no other data available
- Adds numeric suffixes for collision avoidance (e.g., john_doe1, john_doe2)
- Creates user profile record in `user_profiles` table

### 3. Database Schema

**New Table: `user_profiles`**
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

**Features:**
- Row Level Security (RLS) enabled
- Read policy: All users can read (for uniqueness checks)
- Write policy: Users can only modify their own profile
- Auto-trigger on user signup to create profile
- Automatic `updated_at` timestamp updates

### 4. User Interface

**Avatar Dropdown Updates:**
- Added `@username` display (styled in blue/monospace)
- Shows above the display name
- Visible in both projects.html and editor.html
- Dark theme support

**Display Hierarchy:**
1. `@username` (if available)
2. Full name / Display name
3. Email address
4. Provider info

### 5. Files Modified

**Frontend:**
- `index.html` - Sign-up form and OAuth handlers
- `projects.html` - Username generation and display
- `editor.html` - Username display in editor
- `js/core/init.js` - Editor username display logic

**Styling:**
- `css/components/onboarding.css` - Username styles
- `css/base/dark-theme.css` - Dark mode username styles

**Database:**
- `supabase/migrations/create_user_profiles.sql` - Migration script
- `supabase/migrations/README.md` - Migration documentation

## Setup Instructions

### 1. Apply Database Migration

Go to Supabase Dashboard → SQL Editor, then run:
```sql
-- Copy and paste the entire content from:
-- supabase/migrations/create_user_profiles.sql
```

Or use Supabase CLI:
```bash
supabase migration new create_user_profiles
# Copy SQL content
supabase db push
```

### 2. No Code Changes Needed

All frontend code is already deployed. The username feature will work automatically after the migration is applied.

## Username Rules

- **Length**: 3-20 characters
- **Format**: Letters, numbers, underscore only (a-z, A-Z, 0-9, _)
- **Uniqueness**: System-enforced at database level
- **Case-insensitive**: Stored and compared in lowercase

## Username Generation Examples

### GitHub OAuth
```
GitHub username: "john-doe-123"
→ Generated: "johndoe123"
```

### Google OAuth
```
Google name: "John Doe"
→ Generated: "john_doe"
```

### Email Signup
```
Email: "researcher@university.edu"
→ User enters: "researcher2024"
```

### Collision Handling
```
Attempt 1: "john_doe" (taken)
Attempt 2: "john_doe1" (taken)
Attempt 3: "john_doe2" (available) ✓
```

## Testing

1. **Email Signup**: Create account with custom username
2. **GitHub Login**: Check auto-generated username from GitHub username
3. **Google Login**: Check auto-generated username from Google name
4. **Uniqueness**: Try creating duplicate usernames
5. **Display**: Verify @username appears in dropdown on both projects and editor pages

## Security

- RLS policies ensure users can only modify their own profiles
- Username uniqueness enforced at database level
- Pattern validation prevents injection attacks
- OAuth usernames sanitized before storage

## Future Enhancements

Potential additions:
- Username editing (change your username)
- Username search/discovery
- Profile pages with @username URLs
- Username mentions in comments/notes
- Username display on shared projects
