# Papergraph AI Agent Instructions

## Project Overview
Papergraph is a **browser-native research organization tool** for visualizing academic literature as an interactive network graph. Pure vanilla JavaScript (ES6+) with no build step—all files run directly in the browser with optional Supabase cloud sync.

## Architecture Principles

### 1. **Dual Storage Strategy (Local-First + Cloud)**
- **Primary**: localStorage API for immediate persistence (`js/data/storage.js`)
- **Optional**: Supabase PostgreSQL for cross-device sync (`js/data/cloud-storage.js`)
- **Pattern**: Save to localStorage first, then async cloud save with throttling (2s delay)
- **Critical**: Never clear localStorage when cloud project loads—data layers are intentionally kept separate
- **Auto-save**: Triggered via `autoSaveProject()` (throttled) on every change; `forceSaveToCloud()` for critical operations

### 2. **Global State Management** (`js/core/state.js`)
All UI and data state lives in global variables:
- `appData`: Articles and connections (nodes/edges)
- `tagZones`: Visual grouping rectangles with tags/colors
- `network`: vis-network instance (initialized in `graph.js`)
- `multiSelection`: State for multi-node selection and zone creation
- `connectionMode`, `zoneResizing`, `zoneMoving`: Interaction state machines

**Never** use React-style local component state. All functions read/write directly to these globals.

### 3. **Module System (ES6 Modules)**
Files use ES6 `import`/`export` but HTML loads them via `<script type="module">`:
- `auth/`: Supabase authentication, project CRUD, real-time collaboration
- `core/`: State management (`state.js`) and event binding (`init.js`)
- `data/`: Import/export, storage (local + cloud), BibTeX parser
- `graph/`: vis-network graph, connections, zones visualization
- `ui/`: Modals, filters, list view, toolbars, radial menu
- `utils/`: Helpers (color generation, time formatting)

### 4. **CSS Modular Architecture**
Organized by responsibility (never inline styles):
- `base/`: Reset, layout, typography, dark-theme, cursors
- `components/`: Buttons, dropdowns, modals, notifications, toolbar
- `views/`: Graph-view, list-view, article-preview

Load order matters: Base → Components → Views → Cursors (must be last to override)

## Key Workflows

### Adding a New Feature to Graph Editor
1. **State**: Add variables to `js/core/state.js` (e.g., `let myFeature = { active: false }`)
2. **UI**: Create modal/button HTML in `editor.html` with data attributes
3. **Event binding**: Wire up in `js/core/init.js` → `initializeEventListeners()`
4. **Logic**: Implement in appropriate module (e.g., `js/graph/zones.js` for spatial features)
5. **Persistence**: Update `saveToLocalStorage()` and `loadFromLocalStorage()` in `js/data/storage.js`
6. **Cloud sync**: If data needs cloud storage, add to `project.data` structure in `cloud-storage.js`

### Authentication & Projects Flow
```
index.html → (auth) → projects.html → editor.html?id=<uuid>
```
- **No auth**: Editor works standalone with localStorage
- **With auth**: Projects dashboard (`projects.html`) manages multiple research projects
- **Project loading**: URL param `?id=<uuid>` triggers `initCloudStorage()` to load from Supabase
- **RLS policies**: All Supabase tables use Row Level Security—users only see their own data

### Graph Visualization (vis-network)
- **Initialization**: `initializeGraph()` in `js/graph/graph.js` creates network instance
- **Physics disabled**: Nodes are manually positioned (users drag to organize)
- **Position persistence**: Critical—save positions to `localStorage.papermap_positions` and sync to cloud
- **Node rendering**: Custom font colors via `getContrastColor()` for accessibility
- **Edge control points**: Stored separately in `edgeControlPoints` object for custom bezier curves
- **Zones**: Background rectangles drawn on canvas via `drawTagZones()` in `before` event handler

## Important Patterns

### Data Persistence Pattern
```javascript
// Example: Modifying articles
appData.articles.push(newArticle);
saveToLocalStorage(true); // Silent save triggers cloud auto-save
```
Always call `saveToLocalStorage()` after mutating `appData`, `tagZones`, or `edgeControlPoints`.

### Modal Management
All modals in `js/ui/modal.js`:
- `showModal(id)` / `hideModal(id)` for open/close
- HTML structure: `<div class="modal-overlay"><div class="modal-container">...</div></div>`
- Event delegation: One listener on `.modal-overlay` handles all backdrop clicks

### Import System (DOI/arXiv/BibTeX/PDF)
`js/data/import.js` handles:
- DOI: Fetch from CrossRef API (`https://api.crossref.org/works/{doi}`)
- arXiv: Parse ID format (`2301.12345` or URLs) → API fetch
- BibTeX: Custom parser in `js/data/bibtex-parser.js` (no external deps)
- PDF: Uses `pdf.js` to extract metadata from uploaded files

**Never** assume article data is complete—DOI/arXiv may fail, always have fallbacks.

### Collaboration & Sharing
**Real-time Presence** via `js/auth/collaboration.js`:
- **Presence**: `initCollaboration(projectId)` subscribes to `presence` channel
- **Avatars**: Generated from user emails, displayed as colored circles in top-right
- **Cleanup**: Always call `cleanupCollaboration()` on page unload to remove presence

**Shareable Links**:
- **Share tokens**: Each project has a unique `share_token` for public links (`/share/abc123`)
- **Access control**: `is_public` flag enables anyone-with-link access (read-only by default)
- **Member roles**: `project_members` table tracks owner/editor/viewer permissions
- **Email sharing**: `share_project_by_email()` function adds users directly by email
- **Dashboard integration**: Shared projects appear in "Shared with me" section in `projects.html`

## Database Schema (Supabase)

### `projects` table
```sql
id UUID, user_id UUID, name TEXT, data JSONB, share_token TEXT, is_public BOOLEAN, created_at, updated_at
```
- `data.nodes[]`: Articles array from `appData.articles`
- `data.edges[]`: Connections from `appData.connections`
- `data.positions{}`: Node coordinates `{nodeId: {x, y}}`
- `data.zones[]`: Tag zones from `tagZones`
- `data.edgeControlPoints{}`: Bezier control points
- `share_token`: Unique 12-char token for shareable links (e.g., `abc123xyz456`)
- `is_public`: If true, anyone with share link can view (read-only)

### `project_members` table
```sql
id UUID, project_id UUID, user_id UUID, role TEXT ('owner'|'editor'|'viewer'), added_by UUID, added_at
```
- RLS policies enforce role-based access
- Owners can share, editors can modify, viewers are read-only
- Auto-populated with creator as 'owner' via trigger on project creation

### `profiles` table
```sql
id UUID, email TEXT, full_name TEXT, username TEXT, avatar_url TEXT
```
- Extended user info, auto-created on signup via `handle_new_user()` trigger
- Username for @mentions and sharing (optional)
- Viewable by all authenticated users (needed for collaboration)

## Critical Gotchas

1. **Zone creation flashing**: When capturing preview image, graph temporarily recenters—only generate PNG on dashboard return, never during auto-save
2. **Node position loss**: `network.setData()` resets positions—always restore from `savedNodePositions` immediately after
3. **Multi-selection state**: `multiSelection.active` prevents normal click handlers—always check before node operations
4. **Edge label editing**: `isEditingEdgeLabel` flag prevents view adjustments during text input
5. **Gallery mode**: URL param `?source=gallery` makes projects read-only—block saves with user notification

## Testing Locally
No build step required:
1. Open `editor.html` in browser (Chrome/Firefox/Edge)
2. For cloud features: Configure `js/auth/config.js` with Supabase credentials
3. Check browser console for errors—all modules log initialization steps
4. LocalStorage inspector: Application tab → Local Storage → `papermap_*` keys

## When Modifying Existing Code
- **Read the state file first**: `js/core/state.js` defines all global variables
- **Check IMPLEMENTATION.md**: Documents recent feature additions and architectural decisions
- **Test both modes**: With and without authentication (localStorage-only vs. cloud sync)
- **Preserve positions**: Never skip saving node coordinates—it's the most critical UX aspect
- **Follow CSS module system**: Don't add inline styles, use appropriate CSS file by layer
