# Correction de la Récursion Infinie RLS

## Problème

```
Failed to import project: infinite recursion detected in policy for relation "projects"
POST /rest/v1/projects 500 (Internal Server Error)
```

### Cause
Les policies RLS créaient une **boucle de récursion** :
1. Policy `projects` → vérifie `project_members`
2. Policy `project_members` → vérifie `projects`
3. ♾️ Récursion infinie

## Solution

### ✅ Stratégie adoptée : **SECURITY DEFINER Functions**

Au lieu d'utiliser des policies RLS complexes, j'ai créé des **fonctions PostgreSQL avec `SECURITY DEFINER`** qui contournent RLS.

## Modifications apportées

### 1. **Policies RLS simplifiées** (supabase_clean_setup.sql)

#### Projects (AVANT - ❌ Récursion)
```sql
-- ❌ Causait une récursion
CREATE POLICY "Project members can view shared projects"
    ON public.projects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id 
            AND pm.user_id = auth.uid()
        )
    );
```

#### Projects (APRÈS - ✅ Simple)
```sql
-- ✅ Pas de récursion - juste propriétaire + projets publics
CREATE POLICY "Users can view and manage own projects"
    ON public.projects
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view public projects"
    ON public.projects FOR SELECT TO authenticated
    USING (is_public = true);
```

#### Project Members (APRÈS - ✅ Simple)
```sql
-- ✅ Propriétaires seulement, pas de récursion
CREATE POLICY "Project owners can manage members"
    ON public.project_members
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_members.project_id 
            AND p.user_id = auth.uid()
        )
    );
```

### 2. **Nouvelles fonctions SECURITY DEFINER**

#### A. `get_project_if_member(proj_id UUID)`
Récupère un projet si l'utilisateur est propriétaire OU membre.

```sql
CREATE OR REPLACE FUNCTION public.get_project_if_member(proj_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    data JSONB,
    is_public BOOLEAN,
    share_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Vérifie propriétaire OU membre
    IF EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = proj_id AND p.user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = proj_id AND pm.user_id = auth.uid()
    ) THEN
        RETURN QUERY SELECT ... FROM public.projects WHERE id = proj_id;
    ELSE
        RETURN; -- Accès refusé
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Avantage** : Contourne RLS, pas de récursion possible.

#### B. `update_project_if_member(proj_id, project_name, project_data)`
Met à jour un projet si l'utilisateur est propriétaire OU editor.

```sql
CREATE OR REPLACE FUNCTION public.update_project_if_member(
    proj_id UUID,
    project_name TEXT DEFAULT NULL,
    project_data JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Détermine le rôle (owner, editor, viewer)
    SELECT ... INTO user_role;
    
    -- Vérifie les permissions
    IF user_role NOT IN ('owner', 'editor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;
    
    -- Met à jour
    UPDATE public.projects SET ... WHERE id = proj_id;
    
    RETURN jsonb_build_object('success', true, 'role', user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Avantage** : Gère les permissions en interne, pas de dépendance RLS.

#### C. `get_project_members(proj_id UUID)`
Récupère les membres d'un projet si l'utilisateur a accès.

```sql
CREATE OR REPLACE FUNCTION public.get_project_members(proj_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    user_id UUID,
    role TEXT,
    added_at TIMESTAMP WITH TIME ZONE,
    added_by UUID
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = proj_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = proj_id AND pm.user_id = auth.uid())
    THEN
        RETURN QUERY SELECT ... FROM public.project_members WHERE project_id = proj_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. **Modifications JavaScript**

#### `js/auth/projects.js`

**AVANT** (accès direct avec RLS - ❌ Récursion)
```javascript
export async function loadProject(projectId) {
    const { data } = await supabase
        .from('projects')  // ❌ RLS recursion
        .select('*')
        .eq('id', projectId)
        .single();
    return data;
}
```

**APRÈS** (fonction RPC - ✅ Pas de récursion)
```javascript
export async function loadProject(projectId) {
    const { data } = await supabase
        .rpc('get_project_if_member', { proj_id: projectId });  // ✅
    
    if (!data || data.length === 0) {
        throw new Error('Project not found or access denied');
    }
    return data[0];
}
```

**AVANT** (update direct - ❌)
```javascript
export async function updateProject(projectId, projectData) {
    const { data } = await supabase
        .from('projects')  // ❌ Échouerait pour les members
        .update({ data: projectData })
        .eq('id', projectId)
        .eq('user_id', user.id);  // ❌ Seulement pour owner
    return data;
}
```

**APRÈS** (fonction RPC - ✅)
```javascript
export async function updateProject(projectId, projectData) {
    const { data } = await supabase
        .rpc('update_project_if_member', {  // ✅ Gère owner + editor
            proj_id: projectId,
            project_data: projectData
        });
    
    if (!data.success) {
        throw new Error(data.error || 'Failed to update project');
    }
    return { success: true, role: data.role };
}
```

#### `js/auth/sharing.js`

**APRÈS** (fonction RPC)
```javascript
export async function getProjectMembers(projectId) {
    const { data } = await supabase
        .rpc('get_project_members', { proj_id: projectId });  // ✅
    
    // Puis fetch les profils séparément
    const members = await Promise.all(
        data.map(async (member) => {
            const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name, avatar_url, username')
                .eq('id', member.user_id)
                .maybeSingle();
            return { ...member, ...profile };
        })
    );
    return members;
}
```

## Architecture finale

```
┌─────────────────────────────────────────────────────────┐
│                     RLS Policies                         │
│  (Simples, sans récursion)                              │
│                                                          │
│  • Projects: user_id = auth.uid() OR is_public         │
│  • Project Members: via project owner check            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│            SECURITY DEFINER Functions                    │
│  (Contournent RLS, gèrent permissions)                  │
│                                                          │
│  • get_project_if_member(proj_id)                      │
│  • update_project_if_member(proj_id, data)             │
│  • get_project_members(proj_id)                        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              JavaScript (Client)                         │
│                                                          │
│  • loadProject() → RPC get_project_if_member()         │
│  • updateProject() → RPC update_project_if_member()    │
│  • getProjectMembers() → RPC get_project_members()     │
└─────────────────────────────────────────────────────────┘
```

## Fichiers modifiés

1. ✅ **`supabase_clean_setup.sql`**
   - Policies RLS simplifiées (pas de récursion)
   - 3 nouvelles fonctions SECURITY DEFINER

2. ✅ **`js/auth/projects.js`**
   - `loadProject()` utilise RPC
   - `updateProject()` utilise RPC
   - `renameProject()` utilise RPC

3. ✅ **`js/auth/sharing.js`**
   - `getProjectMembers()` utilise RPC

## Tests recommandés

### ✅ Test 1: Importer un projet
```javascript
// Dans projects.html
await createProject("Test Import", { nodes: [...], edges: [...] });
```
**Attendu** : Pas d'erreur de récursion ✅

### ✅ Test 2: Charger un projet partagé
```javascript
// Utilisateur "editor" charge un projet partagé
await loadProject(projectId);
```
**Attendu** : Projet chargé avec succès ✅

### ✅ Test 3: Modifier un projet en tant qu'editor
```javascript
// Editor modifie le projet
await updateProject(projectId, newData);
```
**Attendu** : Modification sauvegardée ✅

### ✅ Test 4: Viewer ne peut pas modifier
```javascript
// Viewer tente de modifier
await updateProject(projectId, newData);
```
**Attendu** : Erreur "Permission denied" ✅

## Important

**Vous DEVEZ relancer le script SQL complet dans Supabase** :

1. Supabase Dashboard → SQL Editor
2. Coller `supabase_clean_setup.sql` complet
3. Cliquer "Run"
4. Vérifier les fonctions créées dans Database → Functions

Les nouvelles fonctions RPC doivent apparaître :
- ✅ `get_project_if_member`
- ✅ `update_project_if_member`
- ✅ `get_project_members`

## Résumé

**Problème** : Récursion infinie dans RLS policies  
**Solution** : Fonctions SECURITY DEFINER qui contournent RLS  
**Résultat** : Pas de récursion + permissions correctes (owner/editor/viewer)  
**Bonus** : Les editors peuvent maintenant modifier les projets partagés ✅
