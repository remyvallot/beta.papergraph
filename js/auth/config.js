/**
 * Supabase Configuration
 * 
 * Setup Instructions:
 * 1. Create a project at https://supabase.com
 * 2. Go to Project Settings > API
 * 3. Copy your Project URL and anon/public key
 * 4. Replace the placeholders below with your actual credentials
 * 5. Enable GitHub and Google OAuth providers in Authentication > Providers
 * 6. Set up redirect URLs in your OAuth app settings
 */

import { APP_CONFIG } from '../config/app-config.js';

// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://lqbcatqdfsgvbwenqupq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYmNhdHFkZnNndmJ3ZW5xdXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMzIzNzcsImV4cCI6MjA3NzYwODM3N30.Ub5dYZG_N9MScPugiYlwNlKhDl_Y6L9F4YMFsXtgvp8";

// Initialize Supabase client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuration constants (use centralized app config)
export const config = {
    redirectUrl: APP_CONFIG.baseUrl,
    basePath: APP_CONFIG.basePath,
    shareBaseUrl: APP_CONFIG.shareBaseUrl,
    providers: {
        github: 'github',
        google: 'google'
    }
};

console.log('🔧 Supabase Config:', {
    redirectUrl: config.redirectUrl,
    basePath: config.basePath,
    shareBaseUrl: config.shareBaseUrl
});

/**
 * Check if Supabase is properly configured
 */
export function isConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
           SUPABASE_URL.includes('supabase.co');
}

/**
 * Get configuration status message
 */
export function getConfigStatus() {
    if (!isConfigured()) {
        return {
            configured: false,
            message: 'Supabase is not configured. Please update js/auth/config.js with your credentials.'
        };
    }
    
    return {
        configured: true,
        message: 'Supabase is configured and ready.'
    };
}
