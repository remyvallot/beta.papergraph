-- Create user_profiles table to store usernames
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles (for username uniqueness checks)
CREATE POLICY "Users can read all profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if username is provided in metadata
    IF NEW.raw_user_meta_data->>'username' IS NOT NULL THEN
        INSERT INTO public.user_profiles (id, username, email, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'username',
            NEW.email,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
