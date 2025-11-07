# ![](./assets/logo-papergraph.svg) papergraph

## Overview

**papergraph** is a lightweight, browser-based research organization tool designed to facilitate the management and visualization of academic literature. The application provides an interactive graph-based interface for mapping conceptual relationships between scholarly articles, complemented by a traditional list view for systematic bibliographic management.

As a client-side web application, papergraph requires no installation or server infrastructure, operating entirely within the user's browser environment with local data persistence and optional cloud synchronization.

## Key Features

The application provides the following core functionality:

- **Dual Visualization Modes**: Interactive network graph and sortable tabular list view
- **Semantic Relationship Mapping**: Support for labeled edges connecting related articles
- **Categorical Organization**: Color-coded tagging system for thematic classification
- **Multi-format Import**: Integration with DOI, arXiv, BibTeX, and PDF metadata extraction
- **Flexible Export Options**: JSON project files, BibTeX bibliographies, PDF reports, and PNG visualizations
- **Advanced Filtering**: Full-text search across titles, authors, publication years, and tags
- **Spatial Clustering**: Zone-based grouping system with customizable boundaries
- **Cloud Synchronization** ☁️ (NEW): Optional Supabase integration for cross-device project sync
- **Multi-Project Management** (NEW): Dashboard for organizing multiple research projects
- **Authentication** (NEW): GitHub, Google OAuth, and email/password sign-in options

## Quick Start

### Without Account (Local Only)

1. Open `index.html` in your browser
2. Click **"Try without account"**
3. Start organizing your research
4. Data is saved locally in your browser

### With Cloud Sync

1. Open `index.html` and click **"Get started"**
2. Sign in with GitHub, Google, or email
3. Create projects from your dashboard
4. Access your research from any device

For cloud sync setup instructions, see [SETUP.md](./SETUP.md).

## Installation and Usage

papergraph requires only a modern web browser supporting ES6+ JavaScript:

1. Open `index.html` in a contemporary web browser
2. Choose to continue with or without an account
3. Begin adding articles and establishing relationships

All data is persisted locally using the browser's localStorage API, with optional cloud backup via Supabase.

## Technical Architecture

The application is implemented using pure vanilla JavaScript (ES6+) with a modular architecture, leveraging the following libraries:

- **vis-network** ([visjs.org](https://visjs.org/)): Interactive network graph rendering and manipulation
- **jsPDF** ([github.com/parallax/jsPDF](https://github.com/parallax/jsPDF)): Client-side PDF generation
- **Supabase** ([supabase.com](https://supabase.com)): Optional cloud database and authentication (PostgreSQL + Row Level Security)
- **localStorage API**: Browser-based data persistence layer

### Project Structure

```
papergraph/
├── index.html              # Landing page with authentication
├── projects.html           # Project management dashboard
├── editor.html             # Main graph editor
├── js/
│   ├── auth/               # Authentication and cloud sync
│   │   ├── config.js       # Supabase configuration
│   │   ├── auth.js         # Auth functions
│   │   └── projects.js     # Project CRUD
│   ├── core/               # Core application logic
│   ├── data/               # Storage and import/export
│   ├── graph/              # Graph visualization
│   ├── ui/                 # UI components
│   └── utils/              # Helper functions
└── css/                    # Modular CSS architecture
    ├── base/               # Reset, layout, typography
    ├── components/         # Reusable UI components
    └── views/              # Page-specific styles
```


## Citation

If you use papergraph in your research or find it helpful for your academic work, please cite this software:

```bibtex
@misc{papergraph,
  title = {papergraph: A minimalist browser-native tool for visual literature mapping and note taking},
  author = {Vallot, Remy},
  year = {2025},
  url = {https://github.com/remyvallot/papergraph},
}
```

We encourage researchers to share how papergraph has contributed to their workflow and literature review processes.

## Contributions
Contributions of all sizes are welcome.

For bugs: include steps to reproduce and console errors if applicable.  
For features: explain the use case and expected behavior.

By submitting a contribution, you agree to license your work under the license.

## License

MIT

