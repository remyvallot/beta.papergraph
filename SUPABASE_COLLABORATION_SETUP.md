# Supabase Database Modifications pour la Collaboration

> ⚠️ **Note Importante** : Ce guide utilise la **nouvelle méthode d'authorization Realtime** de Supabase (Nov 2025) avec RLS policies sur `realtime.messages`. Cette méthode remplace l'ancienne configuration basée sur la réplication.

## 1. Créer la table `profiles`

Cette table stocke les informations utilisateurs étendues.

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all profiles
CREATE POLICY "Profiles are viewable by all authenticated users"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

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
```

---

## 2. Créer la table `project_members`

Cette table gère les permissions et partages de projets.

```sql
-- Create project_members table
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

-- Enable Row Level Security
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members(user_id);

-- Function to automatically add creator as owner
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
```

---

## 3. Mettre à jour les RLS policies de `projects`

⚠️ **IMPORTANT** : Cette section modifie les policies existantes. Si tu rencontres des problèmes pour accéder aux projets après cette modification, utilise le fichier `ROLLBACK_EMERGENCY.sql` pour restaurer les policies originales.

Il faut modifier les policies pour permettre l'accès aux projets partagés.

```sql
-- ⚠️ Sauvegarde d'abord les policies existantes
-- Si besoin de rollback, tu peux les restaurer

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

-- New policy: Users can view their own projects AND shared projects
CREATE POLICY "Users can view own and shared projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
        )
    );

-- Update UPDATE policy to include editors
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;

CREATE POLICY "Users can update own and shared projects (if editor)"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
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

-- Vérifier que les policies sont bien créées
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'projects';
```

> 🔍 **Test après modification** : Va dans ton application et essaie de charger tes projets. Si ça ne fonctionne pas, exécute `ROLLBACK_EMERGENCY.sql` pour restaurer.

---

## 3.1. Alternative SAFE : Garder l'accès actuel + Ajouter les projets partagés

Si tu veux être plus prudent et ne pas risquer de casser l'accès existant, utilise cette version alternative :

```sql
-- Alternative SAFE : Ne modifie PAS les policies existantes
-- Ajoute simplement de NOUVELLES policies pour les projets partagés

-- Policy additionnelle : Voir les projets partagés (EN PLUS des siens)
CREATE POLICY "Users can view shared projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
        )
    );

-- Policy additionnelle : Modifier les projets partagés en tant qu'editor
CREATE POLICY "Users can update shared projects as editor"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    );
```

> ✅ **Avantage** : Cette méthode garde tes policies existantes intactes et ajoute juste de nouvelles règles pour les projets partagés. Aucun risque de casser l'accès actuel !

---

## 4. Configurer Realtime Authorization (Nouvelle Méthode)

Supabase utilise maintenant la table `realtime.messages` pour l'authorization des channels.

### 4.1. Créer les RLS policies sur `realtime.messages`

```sql
-- Enable RLS on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to receive presence messages on projects they're members of
CREATE POLICY "Users can receive presence on their projects"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
        -- Check if topic matches format: project:{projectId}
        realtime.topic() ~ '^project:[0-9a-f-]+$'
        AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = (
                -- Extract project ID from topic (format: project:{uuid})
                substring(realtime.topic() from 9)
            )::uuid
            AND pm.user_id = auth.uid()
        )
        AND realtime.messages.extension = 'presence'
    );

-- Policy: Allow users to send presence messages on projects they're members of
CREATE POLICY "Users can send presence on their projects"
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Check if topic matches format: project:{projectId}
        realtime.topic() ~ '^project:[0-9a-f-]+$'
        AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = (
                -- Extract project ID from topic (format: project:{uuid})
                substring(realtime.topic() from 9)
            )::uuid
            AND pm.user_id = auth.uid()
        )
        AND realtime.messages.extension = 'presence'
    );
```

### 4.2. Désactiver l'accès public

Dans le dashboard Supabase :

1. Va dans **Settings > Realtime**
2. **Désactive** "Allow public access" (obligatoire pour l'authorization)
3. Sauvegarde

---

## 5. Activer Postgres Changes (Optionnel)

Si tu veux sync les modifications de données en temps réel :

Dans le dashboard Supabase, va dans **Database > Replication** et active la réplication pour :

- ✅ `public.projects` (pour sync des modifications)
- ✅ `public.project_members` (pour sync des membres)

**Note** : Postgres Changes utilise ses propres RLS policies (pas `realtime.messages`)

---

## Résumé des modifications

### Tables créées :
1. **`profiles`** : Informations utilisateur étendues
2. **`project_members`** : Gestion des partages et permissions

### RLS Policies créées :
1. **`public.profiles`** : Accès aux profils utilisateurs
2. **`public.project_members`** : Gestion des membres par owners
3. **`public.projects`** : Accès aux projets propres + partagés
4. **`realtime.messages`** : **NOUVEAU** - Authorization des channels Realtime

### Fonctionnalités activées :
- ✅ **Presence tracking** : Voir qui est connecté en temps réel avec authorization
- ✅ **Partage de projets** : Inviter par email avec rôles (owner/editor/viewer)
- ✅ **Permissions granulaires** : Contrôle d'accès via RLS sur realtime.messages
- ✅ **Auto-création** : Profile et owner automatiques lors de la création
- ✅ **Private channels** : Seuls les membres autorisés peuvent rejoindre

### Rôles disponibles :
- **owner** : Contrôle total, peut partager et supprimer
- **editor** : Peut modifier le contenu
- **viewer** : Lecture seule (pour futur usage)

---

## Instructions pour appliquer

1. Va dans **Supabase Dashboard > SQL Editor**
2. Copie-colle et exécute **dans l'ordre** :
   - Section 1 : Table `profiles` + trigger
   - Section 2 : Table `project_members` + trigger
   - Section 3 : Policies `projects` (UPDATE)
   - Section 4.1 : Policies `realtime.messages` ⭐ **IMPORTANT**
3. Va dans **Settings > Realtime** et désactive "Allow public access" (section 4.2)
4. (Optionnel) Active Postgres Changes replication (section 5)

⚠️ **Important** : La désactivation de "Allow public access" est obligatoire pour que l'authorization fonctionne !

Tout est prêt ! 🚀
