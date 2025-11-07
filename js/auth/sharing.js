/**
 * Sharing Module
 * Handles project sharing functionality
 */

import { supabase } from './config.js';
import { getCurrentUser } from './auth.js';

/**
 * Generate a unique share token for a project
 */
export async function generateShareToken(projectId) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    // Generate token using the database function
    const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_share_token');
    
    if (tokenError) {
        console.error('Error generating token:', tokenError);
        throw tokenError;
    }

    // Update project with the new token
    const { data, error } = await supabase
        .from('projects')
        .update({ 
            share_token: tokenData,
            is_public: true 
        })
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating project with share token:', error);
        throw error;
    }

    return tokenData;
}

/**
 * Get the shareable link for a project
 */
export async function getShareLink(projectId) {
    const { data, error } = await supabase
        .from('projects')
        .select('share_token, is_public')
        .eq('id', projectId)
        .single();

    if (error) throw error;

    if (!data.share_token) {
        // Generate token if it doesn't exist
        const token = await generateShareToken(projectId);
        return `${window.location.origin}/editor.html?share=${token}`;
    }

    return `${window.location.origin}/editor.html?share=${data.share_token}`;
}

/**
 * Toggle project public/private status
 */
export async function togglePublicAccess(projectId, isPublic) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .from('projects')
        .update({ is_public: isPublic })
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Share project with a user by email
 */
export async function shareProjectByEmail(projectId, email, role = 'viewer') {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .rpc('share_project_by_email', {
            proj_id: projectId,
            target_email: email,
            target_role: role
        });

    if (error) {
        console.error('Error sharing project:', error);
        throw error;
    }

    if (!data.success) {
        throw new Error(data.error || 'Failed to share project');
    }

    return data;
}

/**
 * Get project members
 * Uses SECURITY DEFINER function to avoid RLS recursion
 */
export async function getProjectMembers(projectId) {
    // Use RPC function to get members (bypasses RLS)
    const { data, error } = await supabase
        .rpc('get_project_members', { proj_id: projectId });

    if (error) {
        console.error('Error loading project members:', error);
        throw error;
    }

    // Fetch profiles separately to avoid foreign key issues
    const members = await Promise.all((data || []).map(async (member) => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, full_name, avatar_url, username')
            .eq('id', member.user_id)
            .maybeSingle();

        if (profileError) {
            console.warn('Error fetching profile for user:', member.user_id, profileError);
        }

        return {
            id: member.id,
            role: member.role,
            added_at: member.added_at,
            user_id: member.user_id,
            email: profile?.email || '',
            full_name: profile?.full_name || '',
            avatar_url: profile?.avatar_url || '',
            username: profile?.username || ''
        };
    }));

    return members;
}

/**
 * Remove a member from a project
 */
export async function removeMember(projectId, memberId) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId);

    if (error) {
        console.error('Error removing member:', error);
        throw error;
    }
}

/**
 * Update member role
 */
export async function updateMemberRole(memberId, newRole) {
    const { data, error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()
        .single();

    if (error) {
        console.error('Error updating member role:', error);
        throw error;
    }

    return data;
}

/**
 * Load project by share token
 */
export async function loadProjectByShareToken(token) {
    const { data, error } = await supabase
        .rpc('get_project_by_share_token', { token });

    if (error) {
        console.error('Error loading project by share token:', error);
        throw error;
    }

    if (!data || data.length === 0) {
        throw new Error('Project not found or not accessible');
    }

    return data[0];
}

/**
 * Share project with a user by username
 */
export async function shareProjectByUsername(projectId, username, role = 'viewer') {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .rpc('share_project_by_username', {
            proj_id: projectId,
            target_username: username,
            target_role: role
        });

    if (error) {
        console.error('Error sharing project by username:', error);
        throw error;
    }

    if (!data.success) {
        throw new Error(data.error || 'Failed to share project');
    }

    return data;
}

/**
 * Get user notifications
 */
export async function getNotifications(unreadOnly = false) {
    const { data, error } = await supabase
        .rpc('get_notifications', { unread_only: unreadOnly });

    if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }

    return data || [];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
    const { data, error } = await supabase
        .rpc('mark_notification_read', { notif_id: notificationId });

    if (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }

    return data;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
    const { data, error } = await supabase
        .rpc('mark_all_notifications_read');

    if (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }

    return data;
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return Promise.resolve();
        } catch (err) {
            document.body.removeChild(textarea);
            return Promise.reject(err);
        }
    }
}
