# 🚀 COLLABORATION & SHARING - Plan d'implémentation complet

## ✅ Fichiers créés

1. **`js/config/app-config.js`** - Configuration centralisée du domaine
2. **`js/core/permissions.js`** - Système de permissions et collaboration temps réel
3. **`css/components/collaboration.css`** - Styles pour avatars et notifications

---

## 📋 Modifications à faire

### 1. ✅ Domaine centralisé (`app-config.js`)

**Status:** ✅ FAIT

**Utilisation:**
```javascript
import { APP_CONFIG, getAppUrl, getShareUrl } from './js/config/app-config.js';

// Changer le domaine en UN SEUL ENDROIT:
const PRODUCTION_URL = 'https://remyvallot.github.io/beta.papergraph';
// Future: 'https://papergraph.net'
```

**Fichiers à mettre à jour:**
- ✅ `js/auth/config.js` - Utiliser `APP_CONFIG.baseUrl`
- ✅ `js/auth/sharing.js` - Utiliser `getShareUrl()`
- ✅ `index.html` - Utiliser `getAppUrl()`
- ✅ `projects.html` - Utiliser `getAppUrl()`
- ✅ `editor.html` - Utiliser `getAppUrl()`

---

### 2. 🔐 Permissions viewer vs editor

**Status:** ⏳ À intégrer

**Changements nécessaires:**

#### A. Mettre à jour `editor.html`
```html
<!-- Ajouter import -->
<script type="module">
import { initPermissions, hasPermission, isReadOnlyMode } from './js/core/permissions.js';

// Lors du chargement du projet
const userRole = projectData.role || 'owner';
initPermissions(projectId, projectData.user_id, userRole);

// Vérifier avant chaque action
if (!hasPermission('edit')) {
    alert('You can only view this project');
    return;
}
</script>
```

#### B. Mettre à jour le modal de partage (`js/auth/sharing.js`)
```javascript
// Changer "Anyone with the link can view" → "Anyone with the link can edit"
<select id="shareRoleSelect">
    <option value="viewer">Can view</option>
    <option value="editor" selected>Can edit</option>
</select>
```

#### C. Bloquer les actions en mode view-only
```javascript
// Dans chaque fonction d'édition:
function addArticle() {
    if (isReadOnlyMode()) {
        showNotification('View-only mode', 'error');
        return;
    }
    // ... reste du code
}
```

---

### 3. 🔄 Synchronisation temps réel

**Status:** ⏳ À intégrer

**Fichiers à modifier:**

#### `js/data/cloud-storage.js`
```javascript
import { hasPermission } from '../core/permissions.js';

// Désactiver l'auto-save pour les viewers
export function autoSaveProject() {
    if (!hasPermission('edit')) {
        console.log('⏭️ Skipping auto-save (view-only)');
        return;
    }
    // ... reste du code
}
```

#### Activer Realtime dans Supabase
```sql
-- Déjà fait dans supabase_clean_setup.sql ligne 691
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
```

---

### 4. 👥 Avatars des collaborateurs

**Status:** ✅ Code prêt dans `permissions.js`

**Intégration dans `editor.html`:**
```html
<!-- Ajouter avant le bouton share -->
<div id="collaboratorAvatars" class="collaborator-avatars"></div>
<button id="shareBtn">Share</button>
```

**CSS:** ✅ Déjà créé dans `css/components/collaboration.css`

---

### 5. 🚫 Masquer bouton Share pour viewers

**Status:** ✅ Code prêt dans `permissions.js`

Automatiquement géré par `updateUIForPermissions()`.

---

### 6. 🔍 Recherche de membres avec @

**Status:** ⏳ À créer

**Nouveau fichier:** `js/ui/member-search.js`
```javascript
export async function searchMembers(query) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, full_name')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
    
    return data || [];
}

// Dans le modal de partage
document.getElementById('shareEmailInput').addEventListener('input', async (e) => {
    const value = e.target.value;
    if (value.startsWith('@')) {
        const query = value.substring(1);
        const members = await searchMembers(query);
        showMemberDropdown(members);
    }
});
```

---

### 7. 📧 Email d'invitation

**Status:** ⏳ Nécessite Supabase Edge Function

**Créer:** `supabase/functions/send-invite-email/index.ts`
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
    const { email, projectName, inviterName, inviteUrl } = await req.json();
    
    // Utiliser un service d'email (Resend, SendGrid, etc.)
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'noreply@papergraph.app',
            to: email,
            subject: `${inviterName} invited you to ${projectName}`,
            html: `<p>Join the project: <a href="${inviteUrl}">${inviteUrl}</a></p>`
        })
    });
    
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
```

**Appeler depuis `sharing.js`:**
```javascript
await supabase.functions.invoke('send-invite-email', {
    body: { email, projectName, inviterName, inviteUrl }
});
```

---

### 8. 📊 Projets partagés dans le dashboard

**Status:** ⏳ À implémenter

**Modifier `projects.html`:**
```javascript
// Récupérer tous les projets (owned + shared)
const { data: projects } = await supabase.rpc('get_user_projects', {
    user_uuid: user.id
});

projects.forEach(project => {
    const badge = project.is_owner ? 
        '<span class="badge-owner">Owner</span>' : 
        '<span class="badge-shared">Shared</span>';
    
    // Afficher le badge dans la carte
});
```

**CSS:**
```css
.badge-shared {
    background: #dbeafe;
    color: #1e40af;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}
```

---

### 9. 🔔 Système de notifications

**Status:** ⏳ À créer

**Nouveau fichier:** `js/ui/notifications.js`
```javascript
export async function loadNotifications() {
    const { data } = await supabase.rpc('get_notifications');
    return data || [];
}

export async function markAsRead(notificationId) {
    await supabase.rpc('mark_notification_read', { notif_id: notificationId });
}

// Afficher le badge avec le nombre
export function updateNotificationBadge() {
    const count = unreadNotifications.length;
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}
```

**Ajouter dans `editor.html` et `projects.html`:**
```html
<div class="user-menu">
    <button id="notificationBtn" style="position: relative;">
        🔔
        <span class="notification-badge">3</span>
    </button>
    <button id="avatarBtn">👤</button>
</div>
```

---

### 10. 🔒 Chiffrement des données JSON

**Status:** ⏳ À implémenter

**Option A: Chiffrement côté client (avant envoi)**
```javascript
import CryptoJS from 'crypto-js';

// Chiffrer avant save
const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(projectData),
    ENCRYPTION_KEY
).toString();

await supabase.from('projects').update({
    data: encrypted
});

// Déchiffrer après load
const decrypted = CryptoJS.AES.decrypt(
    encryptedData,
    ENCRYPTION_KEY
).toString(CryptoJS.enc.Utf8);
```

**Option B: Chiffrement côté serveur (Supabase Vault)**
```sql
-- Créer une clé de chiffrement
SELECT vault.create_secret('project_encryption_key');

-- Fonction de chiffrement automatique
CREATE FUNCTION encrypt_project_data()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data = vault.encrypt(NEW.data::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER encrypt_before_insert
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_project_data();
```

---

## 🎯 Ordre d'implémentation recommandé

### Phase 1: Configuration & Permissions (1-2h)
1. ✅ Centraliser le domaine (`app-config.js`)
2. ✅ Intégrer le système de permissions
3. ✅ Ajouter le mode read-only
4. ✅ Ajouter le CSS de collaboration

### Phase 2: Collaboration temps réel (2-3h)
5. Intégrer les avatars des collaborateurs
6. Activer la synchronisation temps réel
7. Masquer le bouton Share pour non-owners

### Phase 3: Partage avancé (3-4h)
8. Recherche de membres avec @
9. Email d'invitation (Edge Function)
10. Badge "Shared" dans le dashboard

### Phase 4: Notifications (2-3h)
11. Système de notifications
12. Badge de notification
13. Dropdown de notifications

### Phase 5: Sécurité (2-3h)
14. Chiffrement des données JSON
15. Tests de sécurité

---

## 🚀 Commandes de déploiement

Après chaque modification:
```cmd
git add .
git commit -m "Add collaboration features: [description]"
git push origin main
```

Configuration Supabase (une seule fois):
```
Dashboard → Authentication → URL Configuration
Site URL: https://remyvallot.github.io/beta.papergraph
Redirect URLs: https://remyvallot.github.io/beta.papergraph/*
```

---

## ✅ Checklist finale

- [ ] Domaine centralisé
- [ ] Mode read-only pour viewers
- [ ] "Can edit" par défaut au lieu de "can view"
- [ ] Sync temps réel activée
- [ ] Avatars des collaborateurs
- [ ] Bouton Share masqué pour viewers
- [ ] Recherche @ pour membres
- [ ] Email d'invitation
- [ ] Badge "Shared" dans dashboard
- [ ] Système de notifications
- [ ] Chiffrement JSON

---

**Total estimé: 12-15 heures de développement**

Voulez-vous que je commence à implémenter chaque partie ? Par quelle phase commencer ?
