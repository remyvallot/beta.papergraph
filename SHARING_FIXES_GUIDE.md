# 🚀 Corrections Sharing & Permissions - Guide d'Implémentation

## ✅ Modifications Appliquées

### 1. Centralisation du Domaine (config.js)
**Statut : ✅ TERMINÉ**

Ajout d'une variable `PRODUCTION_DOMAIN` unique :
```javascript
const PRODUCTION_DOMAIN = 'https://remyvallot.github.io/beta.papergraph';
```

**Pour changer le domaine plus tard** :
- GitHub Pages → `https://remyvallot.github.io/papergraph'`
- Custom domain → `https://papergraph.net`
- Localhost → `''` (vide pour auto-détection)

### 2. Système de Permissions (permissions.js)
**Statut : ✅ TERMINÉ**

Nouveau module `js/auth/permissions.js` qui gère :
- Rôles : `owner`, `editor`, `viewer`
- Permissions : `canEdit()`, `canView()`, `canShare()`, `canDelete()`
- UI read-only automatique pour les `viewer`

**Désactivé pour les viewers** :
- ❌ Ajouter des nœuds
- ❌ Ajouter des connexions
- ❌ Créer des zones
- ❌ Déplacer des nœuds
- ❌ Supprimer quoi que ce soit
- ❌ Modifier les tags
- ✅ Voir le graph
- ✅ Zoomer/Dézoomer
- ✅ Sélectionner des nœuds

---

## 🚧 Modifications À Faire (Par Priorité)

### Priority 1 : Corriger les Share Links avec APP_URL

**Fichiers à modifier :**

#### `js/auth/sharing.js`
```javascript
// AVANT (ligne ~50)
const shareUrl = `${window.location.origin}/editor.html?share=${token}`;

// APRÈS
import { APP_URL } from './config.js';
const shareUrl = `${APP_URL}/editor.html?share=${token}`;
```

#### `js/auth/projects.js`
```javascript
// AVANT
const shareUrl = `${window.location.origin}/editor.html?share=${token}`;

// APRÈS
import { APP_URL } from './config.js';
const shareUrl = `${APP_URL}/editor.html?share=${token}`;
```

---

### Priority 2 : Masquer le bouton Share pour les Share Links

**Fichier : `editor.html`**

Trouver le bouton Share et ajouter l'import :
```html
<script type="module">
import { canShare } from './js/auth/permissions.js';

window.addEventListener('DOMContentLoaded', () => {
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn && !canShare()) {
        shareBtn.style.display = 'none';
    }
});
</script>
```

---

### Priority 3 : Implémenter Supabase Realtime

**Fichier : `js/data/cloud-storage.js`**

Ajouter l'abonnement aux changements :
```javascript
let realtimeChannel = null;

export function initRealtimeSync(projectId) {
    if (realtimeChannel) {
        realtimeChannel.unsubscribe();
    }
    
    realtimeChannel = supabase
        .channel(`project:${projectId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${projectId}`
        }, (payload) => {
            console.log('🔄 Project updated by collaborator:', payload);
            
            // Reload project data
            if (payload.new && payload.new.data) {
                reloadProjectData(payload.new.data);
            }
        })
        .subscribe();
    
    console.log('✅ Realtime sync enabled for project:', projectId);
}

function reloadProjectData(data) {
    // Update appData without full page reload
    appData.articles = data.nodes || [];
    appData.connections = data.edges || [];
    window.savedNodePositions = data.positions || {};
    window.tagZones = data.zones || [];
    
    // Refresh the graph
    if (window.network) {
        window.network.setData({
            nodes: new vis.DataSet(appData.articles),
            edges: new vis.DataSet(appData.connections)
        });
        
        // Restore positions
        Object.entries(window.savedNodePositions).forEach(([nodeId, pos]) => {
            window.network.moveNode(nodeId, pos.x, pos.y);
        });
    }
    
    showNotification('Project updated by collaborator', 'info');
}
```

**Appeler dans `initCloudStorage()` :**
```javascript
if (currentProjectId && isCloudEnabled) {
    await loadProjectFromCloud();
    initRealtimeSync(currentProjectId); // ADD THIS LINE
}
```

---

### Priority 4 : Afficher les Avatars des Collaborateurs

**Fichier : Nouveau `js/auth/presence.js`**

```javascript
import { supabase } from './config.js';

let presenceChannel = null;
let onlineUsers = [];

export function initPresence(projectId, userId, userEmail) {
    if (presenceChannel) {
        presenceChannel.unsubscribe();
    }
    
    presenceChannel = supabase.channel(`presence:project:${projectId}`)
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onlineUsers = Object.values(state).flat();
            
            updatePresenceUI();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', leftPresences);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({
                    user_id: userId,
                    email: userEmail,
                    online_at: new Date().toISOString()
                });
            }
        });
}

function updatePresenceUI() {
    const container = document.getElementById('presenceAvatars');
    if (!container) return;
    
    container.innerHTML = '';
    
    onlineUsers.forEach(user => {
        const avatar = document.createElement('div');
        avatar.className = 'presence-avatar';
        avatar.title = user.email;
        avatar.textContent = user.email[0].toUpperCase();
        avatar.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-left: -8px;
            border: 2px solid white;
        `;
        
        container.appendChild(avatar);
    });
}
```

**Dans `editor.html`, ajouter avant le bouton Share :**
```html
<div id="presenceAvatars" style="display: flex; margin-right: 12px;"></div>
```

---

### Priority 5 : Système de Notifications

**Fichier : Nouveau `js/ui/notifications-menu.js`**

```javascript
import { supabase } from '../auth/config.js';

export async function loadNotifications() {
    const { data, error } = await supabase.rpc('get_notifications', { 
        unread_only: false 
    });
    
    if (error) {
        console.error('Error loading notifications:', error);
        return [];
    }
    
    return data || [];
}

export async function markAsRead(notificationId) {
    const { error } = await supabase.rpc('mark_notification_read', {
        notif_id: notificationId
    });
    
    if (error) {
        console.error('Error marking notification as read:', error);
    }
}

export function showNotificationsMenu() {
    // Create dropdown UI
    const menu = document.createElement('div');
    menu.id = 'notificationsMenu';
    menu.className = 'notifications-dropdown';
    menu.innerHTML = `
        <div class="notifications-header">
            <h3>Notifications</h3>
            <button onclick="markAllAsRead()">Mark all as read</button>
        </div>
        <div class="notifications-list" id="notificationsList">
            <div class="loading">Loading...</div>
        </div>
    `;
    
    document.body.appendChild(menu);
    
    loadNotifications().then(notifications => {
        renderNotifications(notifications);
    });
}

function renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty">No notifications</div>';
        return;
    }
    
    list.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.read ? 'read' : 'unread'}" 
             data-id="${notif.id}">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-message">${notif.message}</div>
            <div class="notification-time">${formatTime(notif.created_at)}</div>
        </div>
    `).join('');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}
```

---

## 📦 Prochaines Étapes

1. **Appliquer Priority 1** (Share Links avec APP_URL)
2. **Tester le déploiement**
3. **Appliquer Priority 2** (Masquer Share button)
4. **Appliquer Priority 3** (Realtime sync)
5. **Appliquer Priorities 4-5** (Presence + Notifications)

---

## ⚡ Déploiement Rapide

```cmd
cd c:\Users\e095403\Documents\CODE\PAPERGRAPH PROJECT\papergraph
git add .
git commit -m "Add centralized domain config and permissions system"
git push origin main
```

**Voulez-vous que je continue avec les autres modifications ?**
