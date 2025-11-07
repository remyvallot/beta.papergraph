-- 🚨 NETTOYAGE COMPLET - Retour à la configuration de base

-- ========================================
-- 1. SUPPRIMER TOUT CE QUI EST LIÉ À LA COLLABORATION
-- ========================================

-- Supprimer les triggers
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS public.add_project_owner();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Supprimer toutes les policies sur realtime.messages
DROP POLICY IF EXISTS "Users can receive presence on their projects" ON realtime.messages;
DROP POLICY IF EXISTS "Users can send presence on their projects" ON realtime.messages;

-- Désactiver RLS sur realtime.messages
ALTER TABLE IF EXISTS realtime.messages DISABLE ROW LEVEL SECURITY;

-- Supprimer les tables de collaboration
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ========================================
-- 2. NETTOYER LES POLICIES SUR PROJECTS
-- ========================================

-- Supprimer TOUTES les policies existantes
DROP POLICY IF EXISTS "Users can view own and shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own and shared projects (if editor)" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update shared projects as editor" ON public.projects;

-- ========================================
-- 3. RECRÉER LES POLICIES DE BASE (ORIGINALES)
-- ========================================

-- Policy: Users can view their own projects
CREATE POLICY "Users can view own projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can create their own projects
CREATE POLICY "Users can insert own projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON public.projects
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ========================================
-- 4. VÉRIFICATION
-- ========================================

-- Lister toutes les policies sur projects (devrait montrer 4 policies)
SELECT 
    policyname,
    cmd AS operation
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'projects'
ORDER BY policyname;

-- Tester l'accès à tes projets
SELECT 
    id, 
    name, 
    created_at
FROM public.projects
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- RÉSULTAT
-- ========================================
-- ✅ Configuration de base restaurée
-- ✅ Toute la collaboration supprimée
-- ✅ 4 policies simples sur projects (SELECT, INSERT, UPDATE, DELETE)
-- ✅ Pas de tables ou triggers supplémentaires
