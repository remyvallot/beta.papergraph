/**
 * Cloud Storage Module
 * Handles synchronization between localStorage and Supabase
 */

import { loadProject, updateProject, autoSaveProject } from '../auth/projects.js';
import { getCurrentUser } from '../auth/auth.js';

// Current project ID (from URL parameter)
let currentProjectId = null;
let isCloudEnabled = false;
let realtimeChannel = null; // Store channel for cleanup
let presenceChannel = null; // Store presence channel for cleanup
let currentPresenceState = {}; // Track active collaborators

// Helper function to set user role
export function setUserRole(role) {
    if (typeof window.currentUserRole !== 'undefined') {
        window.currentUserRole = role;
        window.isReadOnly = (role === 'viewer');
        console.log(`🔒 User role set: ${role} (read-only: ${window.isReadOnly})`);
        
        // Update share button visibility based on role
        updateShareButtonVisibility(role);
    }
}

/**
 * Update share button visibility based on user role
 */
function updateShareButtonVisibility(role) {
    const shareBtn = document.getElementById('shareProjectBtn');
    if (shareBtn) {
        if (role !== 'viewer') {
            shareBtn.style.display = 'flex';
            console.log('✅ Share button visible for role:', role);
        } else {
            shareBtn.style.display = 'none';
            console.log('🚫 Share button hidden for viewer role');
        }
    }
}

/**
 * Initialize cloud storage
 * Checks URL parameters and loads project if ID or share token is present
 */
export async function initCloudStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    currentProjectId = urlParams.get('id');
    const shareToken = urlParams.get('share');
    
    // Check if user is authenticated
    const user = await getCurrentUser();
    isCloudEnabled = user !== null;
    
    // Handle share token (requires authentication)
    if (shareToken) {
        console.log('Loading project via share token:', shareToken);
        
        // Check if user is authenticated
        if (!isCloudEnabled) {
            console.warn('Share token requires authentication');
            // Store share token for after login
            localStorage.setItem('pending_share_token', shareToken);
            // Redirect to login
            window.location.href = 'index.html?redirect=share&token=' + shareToken;
            return false;
        }
        
        try {
            await loadProjectFromShareToken(shareToken);
            return true;
        } catch (error) {
            console.error('Failed to load shared project:', error);
            showNotification('Failed to load shared project', 'error');
            return false;
        }
    }
    
    // Handle normal project ID (requires authentication)
    if (currentProjectId && isCloudEnabled) {
        console.log('Cloud storage enabled for project:', currentProjectId);
        
        // Clear any existing localStorage data from previous sessions
        // This prevents mixing data between projects
        localStorage.removeItem('papermap_data');
        localStorage.removeItem('papermap_positions');
        localStorage.removeItem('papermap_zones');
        localStorage.removeItem('papermap_edge_control_points');
        localStorage.removeItem('papermap_next_control_point_id');
        
        // Clear global variables
        if (typeof appData !== 'undefined') {
            appData.articles = [];
            appData.connections = [];
            appData.nextArticleId = 1;
            appData.nextConnectionId = 1;
        }
        if (typeof tagZones !== 'undefined') {
            tagZones.length = 0;
        }
        if (typeof window.savedNodePositions !== 'undefined') {
            window.savedNodePositions = {};
        }
        
        // Try to load project from cloud
        try {
            await loadProjectFromCloud();
            return true;
        } catch (error) {
            console.error('Failed to load project from cloud:', error);
            showNotification('Failed to load project. Using local data.', 'error');
            return false;
        }
    } else if (currentProjectId && !isCloudEnabled) {
        console.warn('Project ID in URL but user not authenticated');
        showNotification('Sign in to access cloud projects', 'info');
        return false;
    }
    
    return false;
}

/**
 * Load project data from Supabase
 */
async function loadProjectFromCloud() {
    if (!currentProjectId) {
        throw new Error('No project ID specified');
    }
    
    const project = await loadProject(currentProjectId);
    
    if (!project) {
        throw new Error('Project not found');
    }
    
    // Update page title
    document.title = `${project.name} - Papergraph`;
    
    // Store project name for title input
    localStorage.setItem('currentProjectTitle', project.name);
    
    // Load project data into appData
    if (project.data) {
        if (typeof appData !== 'undefined') {
            // Load nodes and edges
            appData.articles = project.data.nodes || [];
            appData.connections = project.data.edges || [];
            
            // Update next IDs based on existing data
            if (appData.articles.length > 0) {
                const maxId = Math.max(...appData.articles.map(a => parseInt(a.id) || 0));
                appData.nextArticleId = maxId + 1;
            } else {
                appData.nextArticleId = 1;
            }
            
            if (appData.connections.length > 0) {
                const maxId = Math.max(...appData.connections.map(c => parseInt(c.id) || 0));
                appData.nextConnectionId = maxId + 1;
            } else {
                appData.nextConnectionId = 1;
            }
            
            // For cloud projects, use project-specific localStorage keys
            const projectKey = `papermap_project_${currentProjectId}`;
            localStorage.setItem(`${projectKey}_data`, JSON.stringify(appData));
            
            // Load tag zones if available (check both 'zones' and 'tagZones' for compatibility)
            const zones = project.data.zones || project.data.tagZones || [];
            if (zones.length > 0) {
                if (typeof tagZones !== 'undefined') {
                    tagZones.length = 0;
                    tagZones.push(...zones);
                }
                localStorage.setItem(`${projectKey}_zones`, JSON.stringify(zones));
                console.log('🏷️ Loaded', zones.length, 'tag zones from cloud');
            }
            
            // Load positions if available (check both 'positions' and 'nodePositions' for compatibility)
            const positions = project.data.positions || project.data.nodePositions || {};
            if (Object.keys(positions).length > 0) {
                localStorage.setItem(`${projectKey}_positions`, JSON.stringify(positions));
                // Also set the global savedNodePositions variable
                window.savedNodePositions = positions;
                console.log('📍 Loaded', Object.keys(positions).length, 'node positions from cloud');
            } else {
                window.savedNodePositions = {};
            }
            
            console.log('✓ Project loaded from cloud:', project.name, 
                       `(${appData.articles.length} nodes, ${appData.connections.length} edges)`);
            showNotification(`Loaded: ${project.name}`, 'success');
        }
    }
    
    return project;
}

/**
 * Load project data from share token (requires authentication)
 */
async function loadProjectFromShareToken(token) {
    const { loadProjectByShareToken } = await import('../auth/sharing.js');
    
    const project = await loadProjectByShareToken(token);
    
    if (!project) {
        throw new Error('Shared project not found');
    }
    
    // Set currentProjectId for reference - this allows cloud sync to work
    currentProjectId = project.id;
    
    // Check if user is the owner or a member to determine access level
    const user = await getCurrentUser();
    const isOwner = project.user_id === user.id;
    
    // Check if user is a member
    const { getProjectMembers } = await import('../auth/sharing.js');
    let userRole = null;
    try {
        const members = await getProjectMembers(project.id);
        const userMember = members.find(m => m.user_id === user.id);
        userRole = userMember?.role || null;
    } catch (error) {
        console.warn('Could not check membership:', error);
    }
    
    // Update page title based on role
    if (isOwner) {
        document.title = `${project.name} - Papergraph`;
        setUserRole('owner');
    } else if (userRole) {
        document.title = `${project.name} - Papergraph (${userRole})`;
        setUserRole(userRole);
    } else {
        document.title = `${project.name} - Papergraph (Viewer)`;
        setUserRole('viewer');
    }
    
    // Apply read-only mode if viewer
    if (typeof window.setGraphInteractionMode === 'function') {
        const isReadOnlyMode = (userRole === 'viewer') || (!isOwner && !userRole);
        window.setGraphInteractionMode(isReadOnlyMode);
        console.log(`📋 Graph interaction mode set: ${isReadOnlyMode ? 'READ-ONLY' : 'EDIT'}`);
    }
    
    // Store project name
    localStorage.setItem('currentProjectTitle', project.name);
    
    // Load project data into appData
    if (project.data) {
        if (typeof appData !== 'undefined') {
            // Load nodes and edges
            appData.articles = project.data.nodes || [];
            appData.connections = project.data.edges || [];
            
            // Update next IDs
            if (appData.articles.length > 0) {
                const maxId = Math.max(...appData.articles.map(a => parseInt(a.id) || 0));
                appData.nextArticleId = maxId + 1;
            } else {
                appData.nextArticleId = 1;
            }
            
            if (appData.connections.length > 0) {
                const maxId = Math.max(...appData.connections.map(c => parseInt(c.id) || 0));
                appData.nextConnectionId = maxId + 1;
            } else {
                appData.nextConnectionId = 1;
            }
            
            // For cloud projects, use project-specific localStorage keys
            const projectKey = `papermap_project_${currentProjectId}`;
            localStorage.setItem(`${projectKey}_data`, JSON.stringify(appData));
            
            // Load tag zones
            const zones = project.data.zones || project.data.tagZones || [];
            if (zones.length > 0 && typeof tagZones !== 'undefined') {
                tagZones.length = 0;
                tagZones.push(...zones);
                localStorage.setItem(`${projectKey}_zones`, JSON.stringify(zones));
            }
            
            // Load positions
            const positions = project.data.positions || project.data.nodePositions || {};
            if (Object.keys(positions).length > 0) {
                window.savedNodePositions = positions;
                localStorage.setItem(`${projectKey}_positions`, JSON.stringify(positions));
            } else {
                window.savedNodePositions = {};
            }
            
            // Load edge control points
            const edgeControlPoints = project.data.edgeControlPoints || {};
            if (Object.keys(edgeControlPoints).length > 0 && typeof window.edgeControlPoints !== 'undefined') {
                window.edgeControlPoints = edgeControlPoints;
                localStorage.setItem(`${projectKey}_edge_control_points`, JSON.stringify(edgeControlPoints));
            }
            
            console.log('✓ Shared project loaded:', project.name, 
                       `(${appData.articles.length} nodes, ${appData.connections.length} edges)`);
            
            // Show appropriate message based on role
            if (isOwner) {
                showNotification(`Loaded: ${project.name}`, 'success');
            } else if (userRole === 'editor') {
                showNotification(`Editing shared project: ${project.name}`, 'info');
            } else {
                showNotification(`Viewing shared project: ${project.name} (${userRole || 'viewer'})`, 'info');
            }
        }
    }
    
    // Enable cloud sync for all authenticated users (owner, editors, viewers)
    // Changes will be saved back to the original project
    isCloudEnabled = true;
    
    return project;
}

/**
 * Generate preview image for project (direct PNG export from canvas)
 */
async function generatePreviewImage() {
    const network = window.network;
    console.log('🔍 generatePreviewImage called:', {
        networkExists: !!network
    });
    
    if (!network) {
        console.warn('❌ No network available for preview generation');
        return null;
    }
    
    try {
        // Use the same routine as exportToImage - direct canvas export
        const canvas = network.canvas.frame.canvas;
        
        console.log('✓ Canvas found, dimensions:', canvas.width, 'x', canvas.height);
        
        // Create smaller canvas for preview (max 600px width)
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / canvas.width);
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = canvas.width * scale;
        previewCanvas.height = canvas.height * scale;
        const previewCtx = previewCanvas.getContext('2d');
        
        console.log('✓ Preview canvas created:', previewCanvas.width, 'x', previewCanvas.height);
        
        // Draw with high quality
        previewCtx.imageSmoothingEnabled = true;
        previewCtx.imageSmoothingQuality = 'high';
        previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
        
        // Convert to PNG with compression
        const preview = previewCanvas.toDataURL('image/png', 0.7);
        
        console.log('📸 Generated preview from canvas, size:', Math.round(preview.length / 1024), 'KB');
        return preview;
        
    } catch (e) {
        console.warn('Could not generate preview image:', e);
        return null;
    }
}

/**
 * Save current state to cloud (without preview image - for auto-save)
 */
export async function saveToCloud(silent = false) {
    if (!isCloudEnabled || !currentProjectId) {
        return false;
    }
    
    try {
        // Get current positions from network or localStorage
        let positions = {};
        const network = window.network;
        if (network) {
            positions = network.getPositions();
        } else {
            // Fallback to project-specific localStorage if network not available
            const projectKey = `papermap_project_${currentProjectId}`;
            const savedPositions = localStorage.getItem(`${projectKey}_positions`);
            if (savedPositions) {
                positions = JSON.parse(savedPositions);
            }
        }
        
        // Gather current state (no preview image during auto-save to avoid flash)
        const projectData = {
            nodes: appData?.articles || [],
            edges: appData?.connections || [],
            zones: tagZones || [],
            positions: positions
        };
        
        // Save to cloud with auto-save (throttled)
        autoSaveProject(currentProjectId, projectData);
        
        if (!silent) {
            console.log('✓ Project queued for cloud save with', Object.keys(positions).length, 'positions');
        }
        
        return true;
    } catch (error) {
        console.error('Error saving to cloud:', error);
        if (!silent) {
            showNotification('Cloud save failed. Data saved locally.', 'warning');
        }
        return false;
    }
}

/**
 * Save with preview image (for closing/returning to dashboard)
 */
export async function saveToCloudWithPreview(silent = false) {
    if (!isCloudEnabled || !currentProjectId) {
        return false;
    }
    
    try {
        // Get current positions
        let positions = {};
        const network = window.network;
        if (network) {
            positions = network.getPositions();
        } else {
            const projectKey = `papermap_project_${currentProjectId}`;
            const savedPositions = localStorage.getItem(`${projectKey}_positions`);
            if (savedPositions) {
                positions = JSON.parse(savedPositions);
            }
        }
        
        // Generate preview image
        const previewImage = await generatePreviewImage();
        
        // Gather current state with preview
        const projectData = {
            nodes: appData?.articles || [],
            edges: appData?.connections || [],
            zones: tagZones || [],
            positions: positions,
            previewImage: previewImage
        };
        
        // Force immediate save (no throttling)
        await updateProject(currentProjectId, projectData);
        
        if (!silent) {
            console.log('✓ Project saved to cloud with preview');
        }
        
        return true;
    } catch (error) {
        console.error('Error saving to cloud with preview:', error);
        if (!silent) {
            showNotification('Cloud save failed', 'error');
        }
        return false;
    }
}

/**
 * Enhanced save function that saves to both local and cloud
 */
export function saveToStorage(silent = false) {
    // Always save to localStorage first
    if (typeof saveToLocalStorage === 'function') {
        saveToLocalStorage(silent);
    }
    
    // Then save to cloud if enabled
    if (isCloudEnabled && currentProjectId) {
        saveToCloud(true); // Silent cloud save
    }
}

/**
 * Force immediate cloud save (for critical operations, no preview image)
 */
export async function forceSaveToCloud() {
    if (!isCloudEnabled || !currentProjectId) {
        return false;
    }
    
    try {
        // Get current positions
        let positions = {};
        const network = window.network;
        if (network) {
            positions = network.getPositions();
        } else {
            // Fallback to project-specific localStorage if network not available
            const projectKey = `papermap_project_${currentProjectId}`;
            const savedPositions = localStorage.getItem(`${projectKey}_positions`);
            if (savedPositions) {
                positions = JSON.parse(savedPositions);
            }
        }
        
        // No preview image generation during force save (to avoid flash)
        const projectData = {
            nodes: appData?.articles || [],
            edges: appData?.connections || [],
            zones: tagZones || [],
            positions: positions
        };
        
        await updateProject(currentProjectId, projectData);
        console.log('✓ Project force-saved to cloud with', Object.keys(positions).length, 'positions');
        return true;
    } catch (error) {
        console.error('Error force-saving to cloud:', error);
        return false;
    }
}

/**
 * Check if cloud storage is enabled
 */
export function isCloudStorageEnabled() {
    return isCloudEnabled && currentProjectId !== null;
}

/**
 * Subscribe to real-time updates for the current project
 * Automatically reloads graph when collaborators make changes
 */
export async function subscribeToRealtimeUpdates() {
    if (!isCloudEnabled || !currentProjectId) {
        console.log('⚠️ Real-time: Not enabled (no cloud or project ID)');
        return null;
    }
    
    // Import supabase
    const { supabase } = await import('../auth/config.js');
    
    if (!supabase) {
        console.error('❌ Supabase not available for real-time');
        return null;
    }
    
    // Clean up existing channel if any
    if (realtimeChannel) {
        console.log('🧹 Cleaning up existing realtime channel');
        await realtimeChannel.unsubscribe();
        realtimeChannel = null;
    }
    
    console.log('📡 Setting up real-time subscription for project:', currentProjectId);
    
    // Create channel for this specific project
    realtimeChannel = supabase
        .channel(`project-${currentProjectId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'projects',
                filter: `id=eq.${currentProjectId}`
            },
            async (payload) => {
                console.log('🔄 Real-time update received:', payload);
                
                // Get current user to avoid reloading our own changes
                const user = await getCurrentUser();
                if (!user) return;
                
                // Check if this update was made by current user
                // (we can add a 'last_modified_by' column to projects table later)
                // For now, just reload the data
                
                const updatedProject = payload.new;
                
                if (!updatedProject || !updatedProject.data) {
                    console.warn('⚠️ Update payload missing data');
                    return;
                }
                
                console.log('✨ Applying remote changes...');
                
                // Update appData
                if (typeof appData !== 'undefined' && updatedProject.data) {
                    appData.articles = updatedProject.data.nodes || [];
                    appData.connections = updatedProject.data.edges || [];
                    
                    // Update tag zones
                    const zones = updatedProject.data.zones || updatedProject.data.tagZones || [];
                    if (typeof tagZones !== 'undefined') {
                        tagZones.length = 0;
                        tagZones.push(...zones);
                    }
                    
                    // Update positions
                    const positions = updatedProject.data.positions || updatedProject.data.nodePositions || {};
                    if (Object.keys(positions).length > 0) {
                        window.savedNodePositions = positions;
                    }
                    
                    // Update edge control points
                    const edgeControlPoints = updatedProject.data.edgeControlPoints || {};
                    if (typeof window.edgeControlPoints !== 'undefined') {
                        window.edgeControlPoints = edgeControlPoints;
                    }
                    
                    // Refresh the graph display
                    if (typeof updateGraph === 'function') {
                        updateGraph();
                    } else if (window.network) {
                        // Fallback: manual network update
                        const graphData = getGraphData();
                        window.network.setData(graphData);
                        
                        // Restore positions
                        if (window.savedNodePositions && Object.keys(window.savedNodePositions).length > 0) {
                            window.network.setPositions(window.savedNodePositions);
                        }
                    }
                    
                    showNotification('Project updated by collaborator', 'info');
                    console.log('✅ Remote changes applied successfully');
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time updates active for project:', currentProjectId);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Real-time subscription failed:', status);
                showNotification('Real-time sync unavailable', 'warning');
            }
        });
    
    return realtimeChannel;
}

/**
 * Unsubscribe from real-time updates
 * Call this when leaving the editor or changing projects
 */
export async function unsubscribeFromRealtimeUpdates() {
    if (realtimeChannel) {
        console.log('🛑 Unsubscribing from real-time updates');
        await realtimeChannel.unsubscribe();
        realtimeChannel = null;
    }
}

// Auto-subscribe when project loads
// This is called automatically after loadProjectFromCloud() or loadProjectFromShareToken()
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Wait a bit for project to fully load
        setTimeout(() => {
            if (isCloudStorageEnabled()) {
                subscribeToRealtimeUpdates();
                subscribeToPresence(); // Also subscribe to presence
            }
        }, 1000);
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        unsubscribeFromRealtimeUpdates();
        unsubscribeFromPresence();
    });
}

/**
 * Generate avatar color from email
 */
function generateAvatarColor(email) {
    if (!email) return '#4a90e2';
    
    // Hash the email to get a consistent color
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate hue from hash (0-360)
    const hue = Math.abs(hash % 360);
    
    // Use high saturation and medium lightness for vibrant colors
    return `hsl(${hue}, 70%, 55%)`;
}

/**
 * Get initials from email or name
 */
function getInitials(email, fullName = null) {
    if (fullName && fullName.trim()) {
        const names = fullName.trim().split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return names[0].substring(0, 2).toUpperCase();
    }
    
    if (email) {
        const name = email.split('@')[0];
        return name.substring(0, 2).toUpperCase();
    }
    
    return '??';
}

/**
 * Update collaborators UI with current presence state
 */
function updateCollaboratorsUI() {
    const container = document.getElementById('activeCollaborators');
    const list = document.getElementById('collaboratorsList');
    
    if (!container || !list) return;
    
    const collaborators = Object.values(currentPresenceState);
    
    // Filter out current user
    const currentUser = window.currentUser || {};
    const otherCollaborators = collaborators.filter(c => c.email !== currentUser.email);
    
    if (otherCollaborators.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    
    // Show max 3 avatars, then +N for overflow
    const maxVisible = 3;
    const visibleCollaborators = otherCollaborators.slice(0, maxVisible);
    const overflowCount = otherCollaborators.length - maxVisible;
    
    list.innerHTML = '';
    
    // Add visible avatars
    visibleCollaborators.forEach(collab => {
        const avatar = document.createElement('div');
        avatar.className = 'collaborator-avatar';
        avatar.style.backgroundColor = generateAvatarColor(collab.email);
        avatar.textContent = getInitials(collab.email, collab.full_name);
        avatar.title = collab.full_name || collab.email;
        list.appendChild(avatar);
    });
    
    // Add overflow indicator
    if (overflowCount > 0) {
        const overflow = document.createElement('div');
        overflow.className = 'collaborator-avatar collaborator-overflow';
        overflow.style.backgroundColor = '#e0e0e0';
        overflow.style.color = '#666';
        overflow.textContent = `+${overflowCount}`;
        overflow.title = `${overflowCount} more collaborator${overflowCount > 1 ? 's' : ''}`;
        list.appendChild(overflow);
    }
    
    console.log('👥 Updated collaborators UI:', otherCollaborators.length, 'active');
}

/**
 * Subscribe to presence tracking for active collaborators
 */
export async function subscribeToPresence() {
    if (!isCloudEnabled || !currentProjectId) {
        console.log('⚠️ Presence: Not enabled (no cloud or project ID)');
        return null;
    }
    
    // Import supabase
    const { supabase } = await import('../auth/config.js');
    
    if (!supabase) {
        console.error('❌ Supabase not available for presence');
        return null;
    }
    
    // Get current user info
    const user = await getCurrentUser();
    if (!user) {
        console.warn('⚠️ No user for presence tracking');
        return null;
    }
    
    // Store current user globally for filtering
    window.currentUser = user;
    
    // Clean up existing presence channel if any
    if (presenceChannel) {
        console.log('🧹 Cleaning up existing presence channel');
        await presenceChannel.unsubscribe();
        presenceChannel = null;
    }
    
    console.log('👥 Setting up presence tracking for project:', currentProjectId);
    
    // Get user profile for display name
    let fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
    
    // Create presence channel
    presenceChannel = supabase.channel(`presence-${currentProjectId}`, {
        config: {
            presence: {
                key: user.id
            }
        }
    });
    
    // Track presence state
    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            console.log('👥 Presence sync:', Object.keys(state).length, 'users');
            
            // Flatten presence state
            currentPresenceState = {};
            Object.keys(state).forEach(userId => {
                const presences = state[userId];
                if (presences && presences.length > 0) {
                    currentPresenceState[userId] = presences[0];
                }
            });
            
            updateCollaboratorsUI();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('👤 User joined:', newPresences);
            updateCollaboratorsUI();
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('👋 User left:', leftPresences);
            updateCollaboratorsUI();
        });
    
    // Subscribe and track this user's presence
    await presenceChannel.subscribe(async (status) => {
        console.log('👥 Presence subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
            // Track current user
            await presenceChannel.track({
                user_id: user.id,
                email: user.email,
                full_name: fullName,
                online_at: new Date().toISOString()
            });
            
            console.log('✅ Presence tracking active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('❌ Presence subscription failed:', status);
        }
    });
    
    return presenceChannel;
}

/**
 * Unsubscribe from presence tracking
 */
export async function unsubscribeFromPresence() {
    if (presenceChannel) {
        console.log('🛑 Unsubscribing from presence');
        
        // Untrack before unsubscribing
        try {
            await presenceChannel.untrack();
        } catch (error) {
            console.warn('Error untracking presence:', error);
        }
        
        await presenceChannel.unsubscribe();
        presenceChannel = null;
        currentPresenceState = {};
        
        // Hide collaborators UI
        const container = document.getElementById('activeCollaborators');
        if (container) {
            container.style.display = 'none';
        }
    }
}



/**
 * Get current project ID
 */
export function getCurrentProjectId() {
    return currentProjectId;
}