/**
 * Permissions Management
 * 
 * Handles user roles and permissions for project editing
 */

import { supabase } from './config.js';

// Current user's role in the project
let currentUserRole = null;
let isShareTokenAccess = false;

/**
 * Set the current user's role
 * @param {string} role - 'owner', 'editor', 'viewer', or null
 * @param {boolean} isShareAccess - True if accessed via share token
 */
export function setUserRole(role, isShareAccess = false) {
    currentUserRole = role;
    isShareTokenAccess = isShareAccess;
    
    console.log('👤 User Role:', {
        role: currentUserRole,
        shareAccess: isShareTokenAccess,
        canEdit: canEdit(),
        canView: canView()
    });
    
    // Update UI based on permissions
    updateUIPermissions();
}

/**
 * Get current user role
 */
export function getUserRole() {
    return currentUserRole;
}

/**
 * Check if user can edit the project
 */
export function canEdit() {
    return currentUserRole === 'owner' || currentUserRole === 'editor';
}

/**
 * Check if user can view the project
 */
export function canView() {
    return currentUserRole !== null;
}

/**
 * Check if user can delete the project
 */
export function canDelete() {
    return currentUserRole === 'owner';
}

/**
 * Check if user can share the project
 */
export function canShare() {
    return currentUserRole === 'owner' && !isShareTokenAccess;
}

/**
 * Check if user can manage members
 */
export function canManageMembers() {
    return currentUserRole === 'owner';
}

/**
 * Update UI elements based on permissions
 */
function updateUIPermissions() {
    const readOnly = !canEdit();
    
    if (readOnly) {
        console.log('🔒 Read-only mode activated');
        
        // Disable all editing buttons
        disableElement('addNodeBtn');
        disableElement('connectionModeBtn');
        disableElement('createZoneBtn');
        disableElement('importBtn');
        disableElement('deleteNodeBtn');
        disableElement('deleteConnectionBtn');
        disableElement('deleteZoneBtn');
        
        // Disable toolbar buttons
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            const editButtons = toolbar.querySelectorAll('button:not([data-allow-viewer])');
            editButtons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Read-only access';
            });
        }
        
        // Disable graph interactions
        if (window.network) {
            window.network.setOptions({
                interaction: {
                    dragNodes: false,
                    zoomView: true,
                    dragView: true,
                    selectable: true
                }
            });
        }
        
        // Show read-only badge
        showReadOnlyBadge();
    }
    
    // Hide share button if accessed via share token
    if (!canShare()) {
        hideElement('shareBtn');
        hideElement('shareBtnMobile');
    }
}

/**
 * Disable a button or element
 */
function disableElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.disabled = true;
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
        element.title = 'Read-only access - You need editor permissions';
    }
}

/**
 * Hide an element
 */
function hideElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Show read-only badge in toolbar
 */
function showReadOnlyBadge() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    
    // Check if badge already exists
    if (document.getElementById('readOnlyBadge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'readOnlyBadge';
    badge.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #f59e0b;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    badge.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Read-only access</span>
    `;
    
    document.body.appendChild(badge);
}

/**
 * Get user's role for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<string|null>} Role or null
 */
export async function getUserRoleForProject(projectId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        // Check if user is owner
        const { data: project } = await supabase
            .from('projects')
            .select('user_id')
            .eq('id', projectId)
            .single();
        
        if (project && project.user_id === user.id) {
            return 'owner';
        }
        
        // Check project_members
        const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();
        
        return member ? member.role : null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

/**
 * Prevent editing action if user doesn't have permission
 * @param {Function} action - Action to perform
 * @param {string} message - Custom error message
 */
export function requireEditPermission(action, message = 'You need editor permissions to perform this action') {
    if (!canEdit()) {
        showPermissionDeniedNotification(message);
        return false;
    }
    
    action();
    return true;
}

/**
 * Show permission denied notification
 */
function showPermissionDeniedNotification(message) {
    // Use existing notification system if available
    if (window.showNotification) {
        window.showNotification(message, 'error');
    } else {
        alert(message);
    }
}
