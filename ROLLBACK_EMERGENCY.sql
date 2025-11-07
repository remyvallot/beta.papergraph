-- 🚨 ROLLBACK D'URGENCE - Si tu ne peux plus fetch les projects

-- ========================================
-- OPTION 1 : Restaurer les policies PROJECTS originales
-- ========================================

-- 1. Supprimer les nouvelles policies
DROP POLICY IF EXISTS "Users can view own and shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own and shared projects (if editor)" ON public.projects;

-- 2. Recréer les policies originales simples
CREATE POLICY "Users can view own projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
    ON public.projects
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ========================================
-- OPTION 2 : Supprimer les policies REALTIME (si elles causent problème)
-- ========================================

-- Supprimer les policies sur realtime.messages
DROP POLICY IF EXISTS "Users can receive presence on their projects" ON realtime.messages;
DROP POLICY IF EXISTS "Users can send presence on their projects" ON realtime.messages;

-- Désactiver RLS sur realtime.messages (temporaire)
ALTER TABLE realtime.messages DISABLE ROW LEVEL SECURITY;

-- ========================================
-- OPTION 3 : Vérifier l'état actuel
-- ========================================

-- Voir toutes les policies sur projects
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'projects';

-- Voir si RLS est activé sur projects
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'projects';

-- ========================================
-- OPTION 4 : Test rapide de connexion
-- ========================================

-- Teste si tu peux voir tes propres projets
SELECT 
    id,
    name,
    user_id,
    created_at
FROM public.projects
WHERE user_id = auth.uid()
LIMIT 5;

-- ========================================
-- INSTRUCTIONS
-- ========================================

-- 1. Essaie d'abord OPTION 3 pour voir l'état actuel
-- 2. Si les policies existent mais sont cassées, utilise OPTION 1
-- 3. Si realtime.messages cause des problèmes, utilise OPTION 2
-- 4. Vérifie avec OPTION 4 si ça fonctionne

-- ⚠️ NOTE IMPORTANTE :
-- Les policies sur realtime.messages ne devraient PAS affecter 
-- l'accès aux projets. Le problème vient probablement de la 
-- section 3 (policies projects) qui a peut-être été mal appliquée.
