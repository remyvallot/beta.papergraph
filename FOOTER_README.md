# Footer Component

## About
The `footer.html` file contains the unified footer template used across all Papergraph pages.

## Current Implementation
The footer is **dynamically loaded** from `footer.html` using JavaScript. All pages include a placeholder `<div data-include="footer"></div>` that gets replaced with the footer content on page load.

## Files with Footer
- `index.html`
- `projects.html`
- `editor.html`
- `privacy.html`

## How to Update the Footer
When you need to update footer information (author, date, links, version), **simply edit the `footer.html` file**. Changes will automatically appear on all pages that include the footer.

No need to update each page individually!

## Technical Implementation

### Loading Script
The footer is loaded by `js/utils/load-footer.js`, which:
1. Fetches `footer.html` content
2. Finds all elements with `data-include="footer"`
3. Replaces them with the footer HTML

### Usage in HTML
To include the footer in a new page:

```html
<!-- Footer -->
<div data-include="footer"></div>

<!-- Load Footer (before closing </body>) -->
<script src="js/utils/load-footer.js"></script>
```

### Footer Structure
```html
<footer class="app-footer">
    <div class="footer-left">
        <span class="footer-author">Rémy Vallot</span>
        <span class="footer-separator">•</span>
        <span class="footer-date">Last update: Nov 2025</span>
    </div>
    <div class="footer-right">
        <a href="privacy.html" class="footer-link">Privacy Policy</a>
        <span class="footer-separator">•</span>
        <a href="https://github.com/remyvallot/papergraph" target="_blank" rel="noopener" class="footer-github" title="View on GitHub">
            <!-- GitHub SVG -->
        </a>
        <span class="app-version">v1.6.0</span>
    </div>
</footer>
```

## Styling
Footer styles are defined in `css/components/footer.css`.

## Benefits
- ✅ Single source of truth for footer content
- ✅ Easy updates (edit once, changes everywhere)
- ✅ Maintains consistency across all pages
- ✅ No build tool required
