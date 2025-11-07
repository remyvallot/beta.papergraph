/**
 * App Configuration
 * 
 * Centralized configuration for domain, paths, and environment
 * Change PRODUCTION_URL to switch between domains
 */

// ===== DOMAIN CONFIGURATION =====
// Change this single line to update the entire app's domain
const PRODUCTION_URL = 'https://remyvallot.github.io/beta.papergraph';
// Future options:
// const PRODUCTION_URL = 'https://remyvallot.github.io/papergraph';
// const PRODUCTION_URL = 'https://papergraph.net';

// ===== AUTO-DETECT ENVIRONMENT =====
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

const isGitHubPages = window.location.hostname.includes('github.io');

// ===== BASE URL & PATH =====
export const APP_CONFIG = {
    // Full base URL (with protocol and domain)
    baseUrl: isLocalhost ? window.location.origin : PRODUCTION_URL,
    
    // Base path only (/beta.papergraph/ or /)
    basePath: isLocalhost ? '/' : new URL(PRODUCTION_URL).pathname,
    
    // Environment flags
    isProduction: !isLocalhost,
    isLocalhost: isLocalhost,
    isGitHubPages: isGitHubPages,
    
    // Share link prefix
    shareBaseUrl: isLocalhost ? window.location.origin : PRODUCTION_URL
};

/**
 * Get full URL for a page
 * @param {string} page - Page name (e.g., 'projects.html' or 'editor.html?id=123')
 * @returns {string} Full URL
 */
export function getAppUrl(page) {
    // Remove leading slash if present
    page = page.replace(/^\//, '');
    
    // Combine base URL with page
    return `${APP_CONFIG.baseUrl}${APP_CONFIG.basePath === '/' ? '/' : APP_CONFIG.basePath + '/'}${page}`;
}

/**
 * Get share link for a project
 * @param {string} shareToken - Project share token
 * @returns {string} Full share URL
 */
export function getShareUrl(shareToken) {
    return getAppUrl(`editor.html?share=${shareToken}`);
}

/**
 * Navigate to a page
 * @param {string} page - Page name
 */
export function navigateTo(page) {
    window.location.href = getAppUrl(page);
}

// Log configuration for debugging
console.log('📱 App Configuration:', {
    baseUrl: APP_CONFIG.baseUrl,
    basePath: APP_CONFIG.basePath,
    isProduction: APP_CONFIG.isProduction,
    environment: isLocalhost ? 'LOCAL' : 'PRODUCTION'
});

export default APP_CONFIG;
