# 🚀 Implémentation des Fonctionnalités de Partage

## ✅ FAIT (Complété)

### 1. Centralisation BASE_URL ✅
- **Fichier** : `js/auth/config.js`
- **Changement** : Ajout de `PRODUCTION_BASE_URL = 'https://remyvallot.github.io/beta.papergraph'`
- **Usage** : Modifier cette seule variable pour changer le domaine (ex: `https://papergraph.net`)
- **Impact** : `js/auth/sharing.js` utilise maintenant `config.baseUrl` pour les liens de partage

### 2. Texte "view" → "edit" ✅  
- **Fichier** : `editor.html` ligne 1809
- **Changement** : "Anyone with the link can view" → "Anyone with the link can edit"
- **Raison** : Le toggle public donne l'accès en écriture, pas juste lecture

### 3. Permissions Read-Only (EN COURS) ⚙️
- **Fichiers créés** :
  - `js/utils/permissions.js` - Helpers pour vérifier permissions
  - Variables globales dans `js/core/state.js` : `currentUserRole`, `isReadOnly`
- **Fichiers modifiés** :
  - `js/data/cloud-storage.js` - Fonction `setUserRole()` pour définir le rôle
  
**À FAIRE** :
- [ ] Importer `permissions.js` dans `editor.html`
- [ ] Bloquer les actions d'édition si `isReadOnly === true` :
  - Bouton "Add Node" → Désactiver si viewer
  - Radial menu → Masquer options d'édition
  - Drag & drop nodes → Bloquer si viewer
  - Delete article/connection → Bloquer si viewer
  - Add/edit tags → Bloquer si viewer
  - Connection mode → Bloquer si viewer

---

## 📋 TODO (Fonctionnalités restantes)

### 4. Real-time Sync Sans F5 🔄
**Objectif** : Voir les modifications des collaborateurs en temps réel

**Plan d'implémentation** :
1. Activer Supabase Realtime sur table `projects`
2. Dans `js/data/cloud-storage.js`, ajouter :
   ```javascript
   const channel = supabase
     .channel('project-changes')
     .on('postgres_changes', 
       { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
       (payload) => {
         // Reload appData and refresh graph
         loadProjectData(payload.new.data);
         network.setData({ nodes, edges });
       }
     )
     .subscribe();
   ```

**Fichiers à modifier** :
- `js/data/cloud-storage.js` : Ajouter subscription
- `js/core/init.js` : Cleanup subscription on page unload

---

### 5. Avatars Collaborateurs Actifs 👥
**Objectif** : Afficher avatars des users connectés à gauche du bouton Share

**Plan d'implémentation** :
1. Utiliser Supabase Presence (déjà dans `js/auth/collaboration.js`)
2. Créer composant HTML avatars :
   ```html
   <div class="collaborators-avatars" id="collaboratorsAvatars">
     <!-- Avatars générés dynamiquement -->
   </div>
   ```
3. CSS : Avatars overlap, max 5 visible, "+N" pour plus

**Fichiers à modifier** :
- `editor.html` : Ajouter div avatars avant bouton Share
- `js/auth/collaboration.js` : Fonction `updateCollaboratorAvatars()`
- `css/components/toolbar.css` : Styles avatars overlap

---

### 6. Bouton Share Sur Projets Partagés 🔗
**Objectif** : Afficher bouton Share même si c'est un projet partagé (pour owners/editors)

**Plan d'implémentation** :
1. Vérifier `currentUserRole` dans `editor.html`
2. Afficher bouton Share si `role === 'owner' || role === 'editor'`
3. Masquer si `role === 'viewer'`

**Fichiers à modifier** :
- `editor.html` : Conditional rendering du bouton Share
- Ou utiliser `style.display = (isEditorOrOwner() ? 'block' : 'none')`

---

### 7. Autocomplete @ Pour Usernames 🏷️
**Objectif** : Recherche username avec @ comme Slack/Discord

**Plan d'implémentation** :
1. Ajouter input dans share modal avec listener `oninput`
2. Si input commence par `@`, faire requête :
   ```javascript
   const { data } = await supabase
     .from('profiles')
     .select('username, full_name, avatar_url')
     .ilike('username', `${query}%`)
     .limit(10);
   ```
3. Afficher dropdown suggestions sous l'input
4. Click sur suggestion → Ajouter au projet

**Fichiers à modifier** :
- `editor.html` : Ajouter input autocomplete dans share modal
- `js/auth/sharing.js` : Fonction `searchUsersByUsername(query)`
- `css/components/modals.css` : Styles dropdown autocomplete

---

### 8. Email Notification Pour Nouveaux Membres 📧
**Objectif** : Envoyer email quand on ajoute quelqu'un à un projet

**Plan d'implémentation** :
1. Créer Supabase Edge Function :
   ```bash
   supabase functions new send-invite-email
   ```
2. Utiliser Resend.com (gratuit 3000 emails/mois) ou SendGrid
3. Trigger sur insert dans `pending_invites` et `project_members`
4. Email contient : Nom inviteur, nom projet, lien direct, rôle

**Fichiers à créer** :
- `supabase/functions/send-invite-email/index.ts`
- Template HTML email

**Configuration requise** :
- API Key Resend/SendGrid dans Supabase Secrets
- Database Webhook sur insert

---

### 9. Projets Partagés Dans Dashboard 📊
**Objectif** : Afficher section "Shared with me" dans projects.html

**Plan d'implémentation** :
1. `get_user_projects()` retourne déjà `is_owner`
2. Filtrer projets : `is_owner === false`
3. Créer section séparée avec badge "Shared"
4. CSS : Badge coloré différent des projets perso

**Fichiers à modifier** :
- `projects.html` : Ajouter section "Shared Projects"
- `js/auth/projects.js` : Fonction `renderSharedProjects()`
- `css/views/projects-view.css` : Badge "Shared"

---

### 10. Système de Notifications In-App 🔔
**Objectif** : Badge notification + dropdown dans avatar menu

**Plan d'implémentation** :
1. Ajouter icône bell avec badge count dans user avatar
2. Click → Dropdown liste notifications
3. Requête :
   ```javascript
   const { data } = await supabase.rpc('get_notifications', { unread_only: true });
   ```
4. Types notifications :
   - project_invite
   - project_share
   - mention (futur)

**Fichiers à modifier** :
- `editor.html` + `projects.html` : Icon bell dans user dropdown
- `js/auth/notifications.js` : NOUVEAU - Gestion notifications
- `css/components/notifications.css` : NOUVEAU - Styles dropdown

---

## 🎯 Ordre d'Implémentation Recommandé

1. **Permissions Read-Only** (critique UX) ⚙️ EN COURS
2. **Real-time Sync** (expérience collaborative clé) 🔄
3. **Avatars Collaborateurs** (feedback visuel important) 👥
4. **Bouton Share** (quick win) 🔗
5. **Projets Partagés Dashboard** (découvrabilité) 📊
6. **Autocomplete @** (UX amélioration) 🏷️
7. **Notifications In-App** (engagement) 🔔
8. **Email Notifications** (nécessite setup externe) 📧

---

## 📝 Notes Techniques

### Supabase Realtime
- Déjà activé sur table `projects` (voir `supabase_clean_setup.sql` ligne 694)
- Pas besoin de migration SQL
- Juste subscribe dans le code

### Permissions
- `owner` : Full control
- `editor` : Peut modifier data, pas inviter
- `viewer` : Read-only, ne peut rien modifier

### Collaboration.js
- Déjà configuré pour Presence
- Il faut juste afficher les avatars au lieu de juste logger

### Performance
- Real-time : Throttle updates (max 1/seconde)
- Autocomplete : Debounce 300ms
- Notifications : Poll toutes les 30s ou utiliser Realtime
