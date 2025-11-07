-- ============================================================================
-- Papergraph - Supabase Database Setup
-- ============================================================================
-- This script sets up the complete database schema for Papergraph
-- including tables, indexes, Row Level Security policies, and triggers.
--
-- Run this script in your Supabase SQL Editor:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Click "New Query"
-- 4. Copy and paste this entire file
-- 5. Click "Run" to execute
--
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Projects table - stores user research projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB DEFAULT '{"nodes": [], "edges": [], "zones": [], "positions": {}}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE projects IS 'Stores user research projects with graph data';
COMMENT ON COLUMN projects.id IS 'Unique project identifier';
COMMENT ON COLUMN projects.user_id IS 'Reference to auth.users - project owner';
COMMENT ON COLUMN projects.name IS 'User-defined project name';
COMMENT ON COLUMN projects.data IS 'JSON containing nodes (articles), edges (connections), zones (tag areas), and positions';
COMMENT ON COLUMN projects.created_at IS 'Project creation timestamp';
COMMENT ON COLUMN projects.updated_at IS 'Last modification timestamp (auto-updated)';


-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Index on user_id for fast project lookup by user
CREATE INDEX IF NOT EXISTS idx_projects_user_id 
    ON projects(user_id);

-- Index on created_at for sorting projects by date (descending)
CREATE INDEX IF NOT EXISTS idx_projects_created_at 
    ON projects(created_at DESC);

-- Index on updated_at for finding recently modified projects
CREATE INDEX IF NOT EXISTS idx_projects_updated_at 
    ON projects(updated_at DESC);

-- Composite index for user + date queries
CREATE INDEX IF NOT EXISTS idx_projects_user_created 
    ON projects(user_id, created_at DESC);

-- GIN index on data JSONB for fast JSON queries (optional, for advanced queries)
CREATE INDEX IF NOT EXISTS idx_projects_data_gin 
    ON projects USING GIN (data);


-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- Policy: Users can only SELECT their own projects
CREATE POLICY "Users can view own projects"
    ON projects
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only INSERT projects with their own user_id
CREATE POLICY "Users can create own projects"
    ON projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own projects
CREATE POLICY "Users can update own projects"
    ON projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own projects
CREATE POLICY "Users can delete own projects"
    ON projects
    FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row modification';


-- Function to get project statistics for a user
CREATE OR REPLACE FUNCTION get_user_project_stats(user_uuid UUID)
RETURNS TABLE (
    total_projects BIGINT,
    total_nodes BIGINT,
    total_edges BIGINT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_projects,
        COALESCE(SUM(jsonb_array_length(data->'nodes')), 0)::BIGINT as total_nodes,
        COALESCE(SUM(jsonb_array_length(data->'edges')), 0)::BIGINT as total_edges,
        MAX(updated_at) as last_updated
    FROM projects
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_user_project_stats(UUID) IS 'Returns aggregate statistics for a user (total projects, nodes, edges)';


-- Function to search projects by name
CREATE OR REPLACE FUNCTION search_projects(
    user_uuid UUID,
    search_term TEXT
)
RETURNS SETOF projects AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM projects
    WHERE user_id = user_uuid
      AND name ILIKE '%' || search_term || '%'
    ORDER BY updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION search_projects(UUID, TEXT) IS 'Searches user projects by name (case-insensitive)';


-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;

-- Trigger to automatically update updated_at column
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 6. GRANTS (Optional - for fine-grained access control)
-- ============================================================================

-- Grant SELECT on projects to authenticated users (RLS handles row-level access)
GRANT SELECT ON projects TO authenticated;

-- Grant INSERT on projects to authenticated users
GRANT INSERT ON projects TO authenticated;

-- Grant UPDATE on projects to authenticated users
GRANT UPDATE ON projects TO authenticated;

-- Grant DELETE on projects to authenticated users
GRANT DELETE ON projects TO authenticated;

-- Grant USAGE on the sequence for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ============================================================================
-- 7. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment the section below to insert sample data for testing
-- Note: Replace 'your-user-uuid-here' with an actual user UUID from auth.users

/*
-- Insert sample project (replace user_id with your test user UUID)
INSERT INTO projects (user_id, name, data) VALUES
(
    'your-user-uuid-here'::UUID,
    'Machine Learning Research',
    '{
        "nodes": [
            {
                "id": "1",
                "title": "Attention Is All You Need",
                "authors": ["Vaswani et al."],
                "year": 2017,
                "tags": ["Deep Learning", "Transformers"]
            },
            {
                "id": "2",
                "title": "BERT: Pre-training of Deep Bidirectional Transformers",
                "authors": ["Devlin et al."],
                "year": 2018,
                "tags": ["NLP", "Transformers"]
            }
        ],
        "edges": [
            {
                "from": "1",
                "to": "2",
                "label": "Inspired by"
            }
        ],
        "zones": [],
        "positions": {
            "1": {"x": 0, "y": 0},
            "2": {"x": 200, "y": 100}
        }
    }'::jsonb
);
*/


-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after setup to verify everything is working

-- Check if table exists and has correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- Check if indexes were created
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename = 'projects';

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'projects';

-- Check if policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'projects';

-- Check if triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'projects';


-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- 
-- Next steps:
-- 1. Verify all queries above show expected results
-- 2. Update js/auth/config.js with your Supabase URL and anon key
-- 3. Configure authentication providers (GitHub, Google) in Supabase dashboard
-- 4. Test the application by creating a project
--
-- For detailed setup instructions, see SETUP.md
--
-- ============================================================================
