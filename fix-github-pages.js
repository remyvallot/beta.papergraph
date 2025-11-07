/**
 * GitHub Pages Fix - Quick Deploy Script
 * 
 * This script fixes all navigation URLs for GitHub Pages deployment.
 * Run with: node fix-github-pages.js
 */

const fs = require('fs');
const path = require('path');

// Files to update
const files = [
    'index.html',
    'projects.html',
    'editor.html',
    'js/auth/auth.js',
    'js/data/cloud-storage.js',
    'js/core/init.js'
];

// Replace window.location.href = 'page.html' with window.navigateTo('page.html')
function fixFile(filePath) {
    console.log(`Fixing ${filePath}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    // Replace window.location.href = 'xxx.html' with window.navigateTo('xxx.html')
    const regex = /window\.location\.href\s*=\s*(['"`])((?:index|projects|editor)\.html(?:\?[^'"`]*)?)\1/g;
    content = content.replace(regex, (match, quote, url) => {
        changes++;
        return `window.navigateTo(${quote}${url}${quote})`;
    });
    
    if (changes > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ ${changes} changes made`);
    } else {
        console.log(`  ⏭️  No changes needed`);
    }
}

// Add navigateTo import to HTML files
function addNavigateToHTML(filePath) {
    console.log(`Adding navigateTo to ${filePath}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already added
    if (content.includes('window.navigateTo')) {
        console.log(`  ⏭️  Already has navigateTo`);
        return;
    }
    
    // Add script after <title>
    const titleRegex = /(<title>.*?<\/title>)/;
    const inject = `
    
    <!-- Base path helper for GitHub Pages -->
    <script type="module">
        import { navigateTo } from './js/utils/base-path.js';
        window.navigateTo = navigateTo;
    </script>`;
    
    content = content.replace(titleRegex, `$1${inject}`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Added navigateTo`);
}

// Main execution
console.log('🚀 Fixing navigation for GitHub Pages...\n');

// Add helper script to HTML files
['index.html', 'projects.html', 'editor.html'].forEach(addNavigateToHTML);

console.log('\n📝 Fixing navigation calls...\n');

// Fix all files
files.forEach(fixFile);

console.log('\n✅ All files updated!');
console.log('\n📦 Next steps:');
console.log('1. git add .');
console.log('2. git commit -m "Fix navigation for GitHub Pages"');
console.log('3. git push origin main');
console.log('\n🌐 Your site will be live at:');
console.log('   https://remyvallot.github.io/beta-papergraph/');
