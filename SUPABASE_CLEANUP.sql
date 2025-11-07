-- ============================================================================
-- Papergraph - Complete Database Cleanup Script
-- ============================================================================
-- This script removes ALL Papergraph tables, functions, triggers, and policies.
-- ⚠️ WARNING: This will DELETE ALL DATA! Use with caution.
-- 
-- Run this in Supabase SQL Editor BEFORE running supabase_clean_setup.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop all triggers
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS on_project_created ON public.projects;

-- ============================================================================
-- STEP 2: Drop all functions
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.add_project_owner() CASCADE;
DROP FUNCTION IF EXISTS public.generate_share_token() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_projects(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_project_by_share_token(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.share_project_by_email(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.share_project_by_username(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_notifications(BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.mark_notification_read(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_all_notifications_read() CASCADE;

-- ============================================================================
-- STEP 3: Drop all tables (CASCADE removes all foreign keys automatically)
-- ============================================================================
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.pending_invites CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- STEP 4: Remove from realtime publication (ignore errors if not exists)
-- ============================================================================
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.projects;
EXCEPTION 
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- ✅ CLEANUP COMPLETE!
-- ============================================================================
-- All Papergraph tables, functions, triggers, and policies have been removed.
-- You can now run supabase_clean_setup.sql for a fresh installation.
-- ============================================================================

-- Verification query - should return 0 rows
SELECT 'Tables remaining:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'projects', 'project_members', 'pending_invites', 'notifications');
