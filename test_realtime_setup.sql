-- Script de test pour vérifier la configuration Realtime Authorization

-- 1. Vérifier que la table realtime.messages a RLS activé
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'realtime' 
AND tablename = 'messages';
-- Attendu: rowsecurity = true

-- 2. Lister les policies RLS sur realtime.messages
SELECT 
    policyname AS "Policy Name",
    cmd AS "Command",
    qual AS "USING Expression",
    with_check AS "WITH CHECK Expression"
FROM pg_policies 
WHERE schemaname = 'realtime' 
AND tablename = 'messages'
ORDER BY policyname;
-- Attendu: 2 policies (SELECT et INSERT pour presence)

-- 3. Vérifier que la table profiles existe et a des données
SELECT 
    COUNT(*) AS "Total Users",
    COUNT(CASE WHEN avatar_url IS NOT NULL THEN 1 END) AS "Users with Avatar",
    COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) AS "Users with Name"
FROM public.profiles;

-- 4. Vérifier que la table project_members existe
SELECT 
    COUNT(*) AS "Total Memberships",
    COUNT(DISTINCT project_id) AS "Projects with Members",
    COUNT(DISTINCT user_id) AS "Users with Projects"
FROM public.project_members;

-- 5. Lister les projets avec leurs membres
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    pm.role,
    prof.email,
    prof.full_name
FROM public.projects p
JOIN public.project_members pm ON p.id = pm.project_id
JOIN public.profiles prof ON pm.user_id = prof.id
ORDER BY p.name, pm.role;

-- 6. Vérifier les triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND (trigger_name = 'on_auth_user_created' OR trigger_name = 'on_project_created')
ORDER BY trigger_name;
-- Attendu: 2 triggers (handle_new_user et add_project_owner)

-- 7. Test de la fonction realtime.topic() (simule un topic)
-- Note: Cette fonction ne peut être testée que dans le contexte d'une connexion Realtime
-- Mais on peut vérifier qu'elle existe
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'realtime'
AND routine_name = 'topic';
-- Attendu: 1 ligne avec routine_type = 'FUNCTION'

-- 8. Vérifier que les indexes existent
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE '%profiles%'
    OR indexname LIKE '%project_members%'
)
ORDER BY tablename, indexname;
-- Attendu: profiles_email_idx, project_members_project_id_idx, project_members_user_id_idx

-- 9. Test de création d'un profil (simulation)
-- ATTENTION: Ne pas exécuter en production si tu as déjà des utilisateurs
-- DO $$
-- DECLARE
--     test_user_id UUID := gen_random_uuid();
-- BEGIN
--     -- Simule l'insertion d'un nouvel utilisateur
--     INSERT INTO public.profiles (id, email, full_name)
--     VALUES (test_user_id, 'test@example.com', 'Test User');
--     
--     -- Vérifie que le profil a été créé
--     IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
--         RAISE NOTICE 'Profile created successfully';
--     END IF;
--     
--     -- Nettoie
--     DELETE FROM public.profiles WHERE id = test_user_id;
-- END $$;

-- 10. Résumé de la configuration
SELECT 
    '✅ Configuration Summary' AS status,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages') AS "Realtime Policies",
    (SELECT COUNT(*) FROM public.profiles) AS "Total Profiles",
    (SELECT COUNT(*) FROM public.project_members) AS "Total Memberships",
    (SELECT COUNT(*) FROM public.projects) AS "Total Projects";

-- 11. Vérifier les permissions RLS sur projects
SELECT 
    policyname AS "Policy Name",
    cmd AS "Command"
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'projects'
ORDER BY policyname;
-- Attendu: Policies pour SELECT et UPDATE incluant les projets partagés

-- Si tout est OK, tu devrais voir :
-- ✅ RLS activé sur realtime.messages
-- ✅ 2 policies sur realtime.messages (SELECT + INSERT)
-- ✅ Table profiles avec données
-- ✅ Table project_members avec relations
-- ✅ 2 triggers fonctionnels
-- ✅ 3+ indexes créés
-- ✅ Policies sur projects incluant les projets partagés
