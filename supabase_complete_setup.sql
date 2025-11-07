-- ============================================================================
-- Papergraph - Complete Supabase Setup for Collaborative Projects
-- ============================================================================
-- This script sets up the complete database schema for Papergraph with:
-- - User profiles
-- - Projects with shareable links
-- - Project members with role-based access (owner/editor/viewer)
-- - Real-time presence for collaboration
--
-- Run this script in your Supabase SQL Editor:
-- 1. Go to your Supabase Dashboard > SQL Editor
-- 2. Click "New Query"
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
--
-- ============================================================================

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================

-- Create profiles table for extended user information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments
COMMENT ON TABLE public.profiles IS 'Extended user profile information';
COMMENT ON COLUMN public.profiles.username IS 'Unique username for sharing projects (e.g., @username)';

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by all authenticated users (for collaboration)
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile when new user signs up';


-- ============================================================================
-- 2. PROJECTS TABLE
-- ============================================================================

-- Create projects table with share_token for shareable links
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB DEFAULT '{"nodes": [], "edges": [], "zones": [], "positions": {}, "edgeControlPoints": {}}'::jsonb,
    share_token TEXT UNIQUE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments
COMMENT ON TABLE public.projects IS 'User research projects with graph data';
COMMENT ON COLUMN public.projects.share_token IS 'Unique token for shareable links (e.g., /share/abc123)';
COMMENT ON COLUMN public.projects.is_public IS 'If true, anyone with the link can view (read-only)';
COMMENT ON COLUMN public.projects.data IS 'JSONB containing nodes, edges, zones, positions, edgeControlPoints';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(share_token);
CREATE INDEX IF NOT EXISTS idx_projects_data_gin ON public.projects USING GIN (data);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (for clean setup)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own and shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own and shared projects (if editor)" ON public.projects;

-- Policy: Users can view their own projects, shared projects, and public projects
CREATE POLICY "Users can view own and shared projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()  -- Own projects
        OR EXISTS (           -- Shared projects
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
        )
        OR is_public = true   -- Public projects (anyone with link)
    );

-- Policy: Users can create their own projects
CREATE POLICY "Users can create own projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own projects or shared projects (if owner/editor)
CREATE POLICY "Users can update own and shared projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()  -- Own projects
        OR EXISTS (           -- Shared projects with editor/owner role
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    );

-- Policy: Users can delete only their own projects
CREATE POLICY "Users can delete own projects"
    ON public.projects
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 12-character alphanumeric token
        token := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
        
        -- Check if token already exists
        SELECT EXISTS(SELECT 1 FROM public.projects WHERE share_token = token) INTO exists;
        
        EXIT WHEN NOT exists;
    END LOOP;
    
    RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_share_token() IS 'Generates unique 12-char token for shareable project links';


-- ============================================================================
-- 3. PROJECT MEMBERS TABLE (Role-based Access)
-- ============================================================================
-- NOTE: Must be created BEFORE the trigger on projects table

-- Create project_members table for sharing and permissions
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Unique constraint: one user can only have one role per project
    UNIQUE(project_id, user_id)
);

-- Add comments
COMMENT ON TABLE public.project_members IS 'Manages project sharing and role-based access';
COMMENT ON COLUMN public.project_members.role IS 'owner: full control | editor: can edit | viewer: read-only';

-- Create indexes
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS project_members_role_idx ON public.project_members(role);

-- Enable Row Level Security
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can update member roles" ON public.project_members;

-- Policy: Project members can view other members of projects they're part of
CREATE POLICY "Members can view project members"
    ON public.project_members
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- Policy: Project owners can add members
CREATE POLICY "Owners can add members"
    ON public.project_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'owner'
        )
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id
            AND p.user_id = auth.uid()
        )
    );

-- Policy: Project owners can remove members
CREATE POLICY "Owners can remove members"
    ON public.project_members
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'owner'
        )
    );

-- Policy: Project owners can update member roles
CREATE POLICY "Owners can update member roles"
    ON public.project_members
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'owner'
        )
    );

-- ============================================================================
-- 4. PROJECT OWNER TRIGGER (Add after project_members table exists)
-- ============================================================================

-- Function to automatically add project creator as owner
CREATE OR REPLACE FUNCTION public.add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, added_by)
    VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add owner on project creation
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.add_project_owner();

COMMENT ON FUNCTION public.add_project_owner() IS 'Automatically adds project creator as owner in project_members';


-- ============================================================================
-- 5. REALTIME PRESENCE (For Collaboration)
-- ============================================================================

-- Enable Realtime for presence tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Grant necessary permissions for Realtime
GRANT SELECT ON public.projects TO authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;


-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get all projects for a user (owned + shared)
CREATE OR REPLACE FUNCTION public.get_user_projects(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    is_owner BOOLEAN,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    node_count INTEGER,
    edge_count INTEGER,
    owner_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        (p.user_id = user_uuid) as is_owner,
        COALESCE(pm.role, 'owner') as role,
        p.created_at,
        p.updated_at,
        COALESCE(jsonb_array_length(p.data->'nodes'), 0)::INTEGER as node_count,
        COALESCE(jsonb_array_length(p.data->'edges'), 0)::INTEGER as edge_count,
        profiles.email as owner_email
    FROM public.projects p
    LEFT JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = user_uuid
    LEFT JOIN public.profiles ON profiles.id = p.user_id
    WHERE p.user_id = user_uuid  -- Owned projects
       OR pm.user_id = user_uuid  -- Shared projects
    ORDER BY p.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_projects(UUID) IS 'Returns all projects for a user (owned + shared) with metadata';


-- Function to get project by share token
CREATE OR REPLACE FUNCTION public.get_project_by_share_token(token TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    data JSONB,
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.name,
        p.data,
        p.is_public,
        p.created_at,
        p.updated_at
    FROM public.projects p
    WHERE p.share_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_project_by_share_token(TEXT) IS 'Retrieves project by share token for public access';


-- Function to share project via email
CREATE OR REPLACE FUNCTION public.share_project_by_email(
    proj_id UUID,
    target_email TEXT,
    target_role TEXT DEFAULT 'viewer'
)
RETURNS JSONB AS $$
DECLARE
    target_user_id UUID;
    result JSONB;
BEGIN
    -- Find user by email
    SELECT id INTO target_user_id
    FROM public.profiles
    WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Check if requester has permission (is owner)
    IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = proj_id AND p.user_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = proj_id AND pm.user_id = auth.uid() AND pm.role = 'owner'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;
    
    -- Add or update member
    INSERT INTO public.project_members (project_id, user_id, role, added_by)
    VALUES (proj_id, target_user_id, target_role, auth.uid())
    ON CONFLICT (project_id, user_id) 
    DO UPDATE SET role = EXCLUDED.role, added_at = timezone('utc'::text, now());
    
    RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.share_project_by_email(UUID, TEXT, TEXT) IS 'Shares project with user by email address';


-- ============================================================================
-- 7. GRANTS (Permissions)
-- ============================================================================

-- Grant access to authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.project_members TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

-- Verify tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'projects', 'project_members')
ORDER BY table_name;

-- Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'projects', 'project_members')
ORDER BY tablename;

-- Verify policies exist
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- SETUP COMPLETE! 
-- ============================================================================
-- Next steps:
-- 1. Enable GitHub/Google OAuth in Authentication > Providers
-- 2. Set redirect URLs in your OAuth apps
-- 3. Update js/auth/config.js with your Supabase credentials
-- 4. Test by creating a new project and sharing it
-- ============================================================================
