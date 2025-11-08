/**
 * Gallery Module
 * Handles loading and displaying projects from the gallery
 */

/**
 * Load and display gallery projects
 */
export async function loadGalleryProjects() {
    const galleryGrid = document.getElementById('galleryGrid');
    const galleryEmpty = document.getElementById('galleryEmpty');
    
    try {
        // Scan projects folder for all subdirectories
        const projects = await scanProjectsFolder();
        
        // Clear loading state
        galleryGrid.innerHTML = '';
        
        if (!projects || projects.length === 0) {
            galleryEmpty.style.display = 'flex';
            return;
        }
        
        // Display projects
        projects.forEach(project => {
            const card = createProjectCard(project);
            galleryGrid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading gallery:', error);
        
        // Show empty state or error
        galleryGrid.innerHTML = '';
        galleryEmpty.style.display = 'flex';
        galleryEmpty.querySelector('h3').textContent = 'Failed to load gallery';
        galleryEmpty.querySelector('p').textContent = 'Please try again later.';
    }
}

/**
 * Scan the projects folder for all project directories
 * Each project folder should contain a metadata.json file
 */
async function scanProjectsFolder() {
    const projects = [];
    
    // Try multiple methods to discover projects
    
    // Method 1: Try GitHub API first (works from anywhere)
    try {
        const githubResponse = await fetch(
            'https://api.github.com/repos/remyvallot/beta.papergraph/contents/projects',
            {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (githubResponse.ok) {
            const contents = await githubResponse.json();
            const folders = contents.filter(item => 
                item.type === 'dir' && 
                !item.name.startsWith('.') && 
                item.name !== 'README.md'
            );
            
            console.log(`Found ${folders.length} projects via GitHub API`);
            
            // Load metadata for each folder in parallel
            const metadataPromises = folders.map(async (folder) => {
                try {
                    const metadataResponse = await fetch(`projects/${folder.name}/metadata.json`);
                    if (metadataResponse.ok) {
                        return await metadataResponse.json();
                    }
                } catch (err) {
                    console.warn(`Failed to load metadata for ${folder.name}:`, err);
                }
                return null;
            });
            
            const results = await Promise.all(metadataPromises);
            projects.push(...results.filter(p => p !== null));
            
            if (projects.length > 0) {
                console.log(`Successfully loaded ${projects.length} projects`);
                // Sort and return
                projects.sort((a, b) => {
                    const dateA = new Date(a.submittedAt || 0);
                    const dateB = new Date(b.submittedAt || 0);
                    return dateB - dateA;
                });
                return projects;
            }
        }
    } catch (error) {
        console.warn('GitHub API failed:', error);
    }
    
    // Method 2: Try known project folders (for localhost/development)
    console.log('Trying to load known projects...');
    const knownFolders = ['remyvallot_2025-11-08'];
    
    for (const folderName of knownFolders) {
        try {
            const metadataResponse = await fetch(`projects/${folderName}/metadata.json`);
            if (metadataResponse.ok) {
                const metadata = await metadataResponse.json();
                projects.push(metadata);
                console.log(`Loaded project: ${metadata.title}`);
            }
        } catch (err) {
            console.warn(`Failed to load ${folderName}:`, err);
        }
    }
    
    // Sort by submission date (newest first)
    projects.sort((a, b) => {
        const dateA = new Date(a.submittedAt || 0);
        const dateB = new Date(b.submittedAt || 0);
        return dateB - dateA;
    });
    
    return projects;
}

/**
 * Create a project card element
 */
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.date = project.submittedAt || '';
    
    // Thumbnail
    const thumbnailDiv = document.createElement('div');
    thumbnailDiv.className = 'gallery-card-thumbnail';
    
    if (project.thumbnail) {
        const img = document.createElement('img');
        img.src = `projects/${project.path}/preview.png`;
        img.alt = project.title;
        img.onerror = () => {
            // Fallback to gradient with first letter
            thumbnailDiv.innerHTML = project.title.charAt(0).toUpperCase();
        };
        thumbnailDiv.appendChild(img);
    } else {
        // Default gradient with first letter
        thumbnailDiv.textContent = project.title.charAt(0).toUpperCase();
    }
    
    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'gallery-card-content';
    
    const title = document.createElement('h3');
    title.className = 'gallery-card-title';
    title.textContent = project.title;
    
    const description = document.createElement('p');
    description.className = 'gallery-card-description';
    description.textContent = project.description;
    
    const meta = document.createElement('div');
    meta.className = 'gallery-card-meta';
    
    const author = document.createElement('div');
    author.className = 'gallery-card-author';
    author.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        ${project.author}
    `;
    
    const affiliation = document.createElement('div');
    affiliation.className = 'gallery-card-affiliation';
    affiliation.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        ${project.affiliation}
    `;
    
    meta.appendChild(author);
    meta.appendChild(affiliation);
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(description);
    contentDiv.appendChild(meta);
    
    card.appendChild(thumbnailDiv);
    card.appendChild(contentDiv);
    
    // Click to open project
    card.addEventListener('click', () => openGalleryProject(project));
    
    return card;
}

/**
 * Open a gallery project in read-only mode
 */
export async function openGalleryProject(project) {
    try {
        // Load project data
        const response = await fetch(`projects/${project.path}/project.papergraph`);
        
        if (!response.ok) {
            throw new Error('Failed to load project');
        }
        
        const projectData = await response.json();
        
        // Store project data in sessionStorage for the viewer
        sessionStorage.setItem('galleryProject', JSON.stringify({
            data: projectData,
            metadata: {
                title: project.title,
                description: project.description,
                author: project.author,
                affiliation: project.affiliation,
                path: project.path
            }
        }));
        
        // Navigate to viewer (read-only mode)
        window.location.href = 'viewer.html';
        
    } catch (error) {
        console.error('Error opening project:', error);
        alert('Failed to open project. Please try again.');
    }
}

/**
 * Copy a gallery project to user's workspace
 */
export async function copyProjectToWorkspace(projectData, metadata) {
    try {
        // Import required modules
        const { supabase } = await import('../auth/config.js');
        const { getCurrentUser } = await import('../auth/auth.js');
        const { createProject } = await import('../auth/projects.js');
        
        // Check if user is logged in
        const user = await getCurrentUser();
        
        if (!user) {
            // Redirect to sign in
            if (confirm('You need to sign in to copy this project to your workspace.\n\nSign in now?')) {
                window.location.href = 'index.html#auth';
            }
            return;
        }
        
        // Create a copy of the project
        const projectName = `${metadata.title} (from gallery)`;
        const newProject = await createProject(projectName, projectData);
        
        // Show success message
        alert(`✅ Project copied to your workspace!\n\nOpening in editor...`);
        
        // Navigate to the new project
        window.location.href = `editor.html?id=${newProject.id}`;
        
    } catch (error) {
        console.error('Error copying project:', error);
        alert('Failed to copy project to workspace: ' + error.message);
    }
}

/**
 * Check if user has GitHub authentication
 */
export async function checkGitHubAuth() {
    try {
        const { supabase } = await import('../auth/config.js');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
            return false;
        }
        
        // Check if user has GitHub provider
        const provider = session.user.app_metadata?.provider;
        return provider === 'github';
        
    } catch (error) {
        console.error('Error checking GitHub auth:', error);
        return false;
    }
}

/**
 * Prompt user to connect with GitHub
 */
export async function promptGitHubLogin() {
    if (confirm('GitHub authentication is required to submit projects.\n\nSign in with GitHub now?')) {
        const { supabase } = await import('../auth/config.js');
        
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${window.location.origin}/gallery.html`,
                scopes: 'repo' // Need repo scope to create pull requests
            }
        });
    }
}
