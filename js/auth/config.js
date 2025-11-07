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

// ============================================================================
// 🌐 DEPLOYMENT CONFIGURATION - CHANGE THIS FOR DIFFERENT DOMAINS
// ============================================================================
// For GitHub Pages: 'https://remyvallot.github.io/beta.papergraph'
// For custom domain: 'https://papergraph.net'
// For localhost: 'http://localhost' (or leave empty for auto-detection)
// ============================================================================
const PRODUCTION_DOMAIN = 'https://remyvallot.github.io/beta.papergraph';

// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://lqbcatqdfsgvbwenqupq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYmNhdHFkZnNndmJ3ZW5xdXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMzIzNzcsImV4cCI6MjA3NzYwODM3N30.Ub5dYZG_N9MScPugiYlwNlKhDl_Y6L9F4YMFsXtgvp8";

// Detect environment and build URLs
const isGitHubPages = window.location.hostname.includes('github.io');
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Extract base path: /beta.papergraph/ or /
function getBasePath() {
    if (isLocalhost) return '/';
    if (!isGitHubPages) return '/';
    
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)\//);
    return match ? `/${match[1]}/` : '/';
}

const basePath = getBasePath();

// Build full app URL
function getAppUrl() {
    if (PRODUCTION_DOMAIN) {
        return PRODUCTION_DOMAIN;
    }
    return window.location.origin + (basePath !== '/' ? basePath.slice(0, -1) : '');
}

export const APP_URL = getAppUrl();

// Initialize Supabase client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuration constants
export const config = {
    appUrl: APP_URL,
    redirectUrl: APP_URL + '/',
    basePath: basePath,
    isProduction: !isLocalhost,
    isGitHubPages: isGitHubPages,
    providers: {
        github: 'github',
        google: 'google'
    }
};

console.log('🔧 Supabase Config:', {
    appUrl: config.appUrl,
    redirectUrl: config.redirectUrl,
    basePath: config.basePath,
    isProduction: config.isProduction
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
