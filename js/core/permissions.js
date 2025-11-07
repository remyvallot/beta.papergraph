/**
 * Collaboration & Permissions System
 * 
 * Handles:
 * - Real-time presence (who's viewing)
 * - Role-based permissions (owner/editor/viewer)
 * - Read-only mode enforcement
 * - Real-time updates via Supabase Realtime
 */

import { supabase } from '../auth/config.js';
import { loadFromLocalStorage } from '../data/storage.js';

// Current user's role in the project
let userRole = null;
let projectOwnerId = null;
let currentProjectId = null;
let isReadOnly = false;

// Active collaborators (presence)
let activeCollaborators = new Map();

// Realtime subscription
let realtimeSubscription = null;

/**
 * Initialize permissions for a project
 * @param {string} projectId 
 * @param {string} ownerId 
 * @param {string} role - 'owner', 'editor', or 'viewer'
 */
export function initPermissions(projectId, ownerId, role) {
    currentProjectId = projectId;
    projectOwnerId = ownerId;
    userRole = role;
    isReadOnly = (role === 'viewer');
    
    console.log('🔐 Permissions initialized:', { projectId, role, isReadOnly });
    
    // Update UI based on permissions
    updateUIForPermissions();
    
    // Initialize real-time presence
    initPresence(projectId);
    
    // Subscribe to project updates
    subscribeToProjectUpdates(projectId);
}

/**
 * Check if user has permission to perform an action
 * @param {string} action - 'view', 'edit', 'manage', 'share'
 * @returns {boolean}
 */
export function hasPermission(action) {
    if (!userRole) return false;
    
    switch (action) {
        case 'view':
            return ['owner', 'editor', 'viewer'].includes(userRole);
        case 'edit':
            return ['owner', 'editor'].includes(userRole);
        case 'manage':
        case 'share':
        case 'delete':
            return userRole === 'owner';
        default:
            return false;
    }
}

/**
 * Get current user role
 */
export function getUserRole() {
    return userRole;
}

/**
 * Check if current mode is read-only
 */
export function isReadOnlyMode() {
    return isReadOnly;
}

/**
 * Update UI elements based on permissions
 */
function updateUIForPermissions() {
    if (isReadOnly) {
        // Hide edit controls
        const editButtons = [
            'addArticleBtn',
            'addConnectionBtn',
            'createZoneBtn',
            'deleteNodeBtn',
            'deleteEdgeBtn',
            'deleteZoneBtn',
            'importBtn',
            'clearAllBtn'
        ];
        
        editButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'none';
            }
        });
        
        // Show read-only badge
        showReadOnlyBadge();
        
        // Disable graph interactions
        disableGraphEditing();
    }
    
    // Hide share button for non-owners
    if (userRole !== 'owner') {
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.style.display = 'none';
        }
    }
}

/**
 * Show read-only mode badge
 */
function showReadOnlyBadge() {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && !document.getElementById('readOnlyBadge')) {
        const badge = document.createElement('div');
        badge.id = 'readOnlyBadge';
        badge.className = 'read-only-badge';
        badge.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1zm2 6V4.5a2 2 0 1 0-4 0V7h4z"/>
            </svg>
            <span>View Only</span>
        `;
        toolbar.prepend(badge);
    }
}

/**
 * Disable graph editing interactions
 */
function disableGraphEditing() {
    // Store original functions
    window._originalAddArticle = window.addArticle;
    window._originalDeleteNode = window.deleteNode;
    window._originalStartConnection = window.startConnection;
    
    // Override with no-ops
    window.addArticle = () => alert('View-only mode: You cannot edit this project');
    window.deleteNode = () => alert('View-only mode: You cannot edit this project');
    window.startConnection = () => alert('View-only mode: You cannot edit this project');
    
    // Disable drag
    if (window.network) {
        window.network.setOptions({
            interaction: {
                dragNodes: false,
                dragView: true,
                zoomView: true
            }
        });
    }
}

/**
 * Initialize real-time presence (show active collaborators)
 */
async function initPresence(projectId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Join presence channel
    const channel = supabase.channel(`presence:${projectId}`, {
        config: {
            presence: {
                key: user.id
            }
        }
    });
    
    // Track presence
    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            updateCollaboratorAvatars(state);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('👤 User joined:', key);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('👋 User left:', key);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Track current user
                await channel.track({
                    user_id: user.id,
                    email: user.email,
                    online_at: new Date().toISOString()
                });
            }
        });
    
    realtimeSubscription = channel;
}

/**
 * Subscribe to project updates (real-time sync)
 */
function subscribeToProjectUpdates(projectId) {
    const channel = supabase
        .channel(`project:${projectId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'projects',
                filter: `id=eq.${projectId}`
            },
            (payload) => {
                console.log('🔄 Project updated by collaborator:', payload);
                handleProjectUpdate(payload.new);
            }
        )
        .subscribe();
}

/**
 * Handle real-time project update from collaborator
 */
function handleProjectUpdate(newData) {
    if (isReadOnly) {
        // Viewers can see updates
        console.log('📥 Applying update from collaborator...');
        
        // Update graph data
        if (window.appData && newData.data) {
            window.appData.articles = newData.data.nodes || [];
            window.appData.connections = newData.data.edges || [];
            window.tagZones = newData.data.zones || [];
            
            // Refresh graph
            if (window.refreshGraph) {
                window.refreshGraph();
            }
        }
        
        // Show notification
        showUpdateNotification();
    }
}

/**
 * Show notification when project is updated by collaborator
 */
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'collab-notification';
    notification.textContent = '✨ Project updated by collaborator';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Update collaborator avatars in UI
 */
function updateCollaboratorAvatars(presenceState) {
    const avatarContainer = document.getElementById('collaboratorAvatars');
    if (!avatarContainer) {
        createAvatarContainer();
        return updateCollaboratorAvatars(presenceState);
    }
    
    avatarContainer.innerHTML = '';
    
    Object.values(presenceState).forEach(presences => {
        presences.forEach(presence => {
            const avatar = createAvatar(presence);
            avatarContainer.appendChild(avatar);
        });
    });
}

/**
 * Create avatar container next to share button
 */
function createAvatarContainer() {
    const shareBtn = document.getElementById('shareBtn');
    if (!shareBtn) return;
    
    const container = document.createElement('div');
    container.id = 'collaboratorAvatars';
    container.className = 'collaborator-avatars';
    shareBtn.parentElement.insertBefore(container, shareBtn);
}

/**
 * Create avatar element
 */
function createAvatar(presence) {
    const avatar = document.createElement('div');
    avatar.className = 'collaborator-avatar';
    avatar.title = presence.email || 'Anonymous';
    
    // Generate color from email
    const color = generateColorFromString(presence.email || presence.user_id);
    avatar.style.backgroundColor = color;
    
    // Use first letter of email
    const initial = (presence.email || '?').charAt(0).toUpperCase();
    avatar.textContent = initial;
    
    return avatar;
}

/**
 * Generate consistent color from string
 */
function generateColorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Cleanup on page unload
 */
export function cleanupCollaboration() {
    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
    }
}

window.addEventListener('beforeunload', cleanupCollaboration);
