# Correctifs Authentification et Synchronisation

## Problèmes corrigés

### ✅ 1. Liens de partage nécessitent maintenant l'authentification

**Avant** : Les liens `?share=token` chargeaient le projet sans authentification
**Maintenant** : L'utilisateur est redirigé vers la page de connexion s'il n'est pas authentifié

#### Flux de redirection
```
1. Utilisateur clique sur lien partagé: editor.html?share=abc123
2. Si NON authentifié → Redirige vers: index.html?redirect=share&token=abc123
3. Utilisateur se connecte
4. Après connexion → Redirige vers: editor.html?share=abc123
5. Projet chargé avec les bonnes permissions
```

#### Fichiers modifiés

**`js/data/cloud-storage.js`** (ligne ~20)
```javascript
// Vérifie l'authentification pour les tokens de partage
if (shareToken) {
    if (!isCloudEnabled) {
        // Stocke le token et redirige vers login
        localStorage.setItem('pending_share_token', shareToken);
        window.location.href = 'index.html?redirect=share&token=' + shareToken;
        return false;
    }
    // Charge le projet si authentifié
    await loadProjectFromShareToken(shareToken);
}
```

**`index.html`** (ligne ~217)
```javascript
// Vérifie les paramètres de redirection
const redirect = urlParams.get('redirect');
const token = urlParams.get('token');

if (session) {
    // Utilisateur connecté
    if (redirect === 'share' && token) {
        window.location.href = `editor.html?share=${token}`;
    } else {
        window.location.href = 'projects.html';
    }
}
```

### ✅ 2. Modifications synchronisées avec le projet original

**Avant** : Les modifications sur un projet partagé n'étaient pas sauvegardées
**Maintenant** : Toutes les modifications sont synchronisées en temps réel avec le cloud

#### Changements clés

**`js/data/cloud-storage.js`** - Fonction `loadProjectFromShareToken()` (ligne ~161)
```javascript
// Active la synchronisation cloud pour TOUS les utilisateurs authentifiés
isCloudEnabled = true;

// Le projectId est défini correctement pour permettre la sauvegarde
currentProjectId = project.id;

// Utilise les clés localStorage spécifiques au projet
const projectKey = `papermap_project_${currentProjectId}`;
localStorage.setItem(`${projectKey}_data`, JSON.stringify(appData));
localStorage.setItem(`${projectKey}_zones`, JSON.stringify(zones));
localStorage.setItem(`${projectKey}_positions`, JSON.stringify(positions));
localStorage.setItem(`${projectKey}_edge_control_points`, JSON.stringify(edgeControlPoints));
```

#### Vérification du rôle
```javascript
// Vérifie si l'utilisateur est propriétaire ou membre
const isOwner = project.user_id === user.id;

// Récupère le rôle de l'utilisateur
const members = await getProjectMembers(project.id);
const userMember = members.find(m => m.user_id === user.id);
const userRole = userMember?.role || null;

// Affiche le rôle dans le titre
if (isOwner) {
    document.title = `${project.name} - Papergraph`;
} else if (userRole === 'editor') {
    document.title = `${project.name} - Papergraph (editor)`;
} else {
    document.title = `${project.name} - Papergraph (viewer)`;
}
```

### ✅ 3. Policies Supabase mises à jour

Nouvelles policies RLS permettant aux membres de modifier les projets partagés :

```sql
-- Membres peuvent voir les projets partagés
CREATE POLICY "Project members can view shared projects"
    ON public.projects FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = projects.id 
            AND pm.user_id = auth.uid()
        )
    );

-- Éditeurs peuvent modifier les projets partagés
CREATE POLICY "Project editors can update shared projects"
    ON public.projects FOR UPDATE TO authenticated
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

-- Membres peuvent voir les autres membres du projet
CREATE POLICY "Project members can view other members"
    ON public.project_members FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = project_members.project_id 
            AND pm.user_id = auth.uid()
        )
    );
```

## Tests à effectuer

### ✅ Test 1: Redirection vers login
1. Se déconnecter complètement
2. Ouvrir un lien de partage: `editor.html?share=abc123`
3. **Attendu**: Redirection automatique vers `index.html?redirect=share&token=abc123`
4. **Attendu**: Message "Please sign in to view this shared project"
5. Se connecter avec n'importe quelle méthode (email/GitHub/Google)
6. **Attendu**: Redirection automatique vers `editor.html?share=abc123`
7. **Attendu**: Projet chargé avec tous les nœuds et connexions

### ✅ Test 2: Synchronisation des modifications (Owner)
1. Créer un projet et générer un lien de partage
2. Ouvrir le lien de partage dans le même compte (propriétaire)
3. Ajouter un nœud
4. Retourner au dashboard
5. Rouvrir le projet normalement (sans lien de partage)
6. **Attendu**: Le nouveau nœud est visible ✅

### ✅ Test 3: Synchronisation des modifications (Editor)
1. Inviter un utilisateur en tant qu'**editor**
2. L'utilisateur invité clique sur le lien de partage
3. Se connecte (redirection automatique)
4. Ajoute un nœud au projet
5. Propriétaire rafraîchit son projet
6. **Attendu**: Le nouveau nœud est visible pour le propriétaire ✅

### ⚠️ Test 4: Lecture seule (Viewer)
1. Inviter un utilisateur en tant qu'**viewer**
2. L'utilisateur invité clique sur le lien de partage
3. Tente de modifier le projet
4. **Attendu**: Modifications sauvegardées mais pas synchronisées (comportement actuel)
5. **Future amélioration**: Bloquer les modifications pour les viewers avec message UI

## Différences par rôle

| Rôle | Voir projet | Modifier | Sauvegarder cloud | Gérer membres |
|------|-------------|----------|-------------------|---------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | ✅ | ✅* | ❌ | ❌ |

*Note: Les viewers peuvent actuellement modifier localement, mais ces modifications ne sont pas synchronisées. Prochaine amélioration: Bloquer l'édition pour les viewers.

## Amélioration future: Mode lecture seule pour Viewers

Pour implémenter un vrai mode lecture seule :

```javascript
// Dans cloud-storage.js après chargement du projet
if (userRole === 'viewer') {
    // Désactiver tous les boutons d'édition
    document.querySelectorAll('.btn-add-article, .btn-add-connection').forEach(btn => {
        btn.disabled = true;
        btn.title = 'View-only access';
    });
    
    // Désactiver le drag & drop
    if (network) {
        network.setOptions({
            interaction: {
                dragNodes: false,
                dragView: true,
                zoomView: true
            }
        });
    }
    
    // Afficher un badge "READ-ONLY"
    showNotification('You have view-only access to this project', 'info');
}
```

## Fichiers modifiés

1. ✅ `js/data/cloud-storage.js` 
   - Vérification authentification pour share tokens
   - Synchronisation cloud activée pour tous les membres
   - Vérification du rôle utilisateur

2. ✅ `index.html`
   - Gestion des paramètres de redirection
   - Support OAuth avec redirection vers projets partagés

3. ✅ `supabase_clean_setup.sql`
   - Nouvelles policies RLS pour membres
   - Permissions de lecture/écriture selon rôle

## Résumé

**Authentification requise** : ✅ Les liens de partage nécessitent maintenant une connexion
**Synchronisation temps réel** : ✅ Les modifications sont sauvegardées dans le cloud
**Permissions par rôle** : ✅ Owner et Editor peuvent modifier, Viewer peut voir
**Redirection automatique** : ✅ L'utilisateur est redirigé vers le projet après connexion

**Prochaine étape** : Implémenter le mode lecture seule strict pour les viewers (désactiver l'interface d'édition).
