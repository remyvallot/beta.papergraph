# Custom Cursors (SVG)

This folder contains custom cursor files for Papergraph.

## Cursor Files

Place your custom cursor SVG images here. SVG format is recommended for:
- ✅ **Scalable** - Works perfectly on any screen resolution (1x, 2x, 3x displays)
- ✅ **Sharp** - Always crisp and clear
- ✅ **Lightweight** - Small file sizes
- ✅ **Cross-platform** - Works on all browsers and operating systems

### SVG Requirements
- Size: 32x32 pixels viewBox recommended
- Format: `.svg` files
- Hotspot: Define with cursor metadata or use top-left (0,0) as default

## Required Cursor Files

To enable custom cursors, add the following files:

### Basic Cursors
- `default.svg` - Default pointer
- `pointer.svg` - Hand pointer (for links/buttons)
- `text.svg` - Text selection cursor

### Resize Cursors
- `n-resize.svg` - North resize (↑)
- `s-resize.svg` - South resize (↓)
- `e-resize.svg` - East resize (→)
- `w-resize.svg` - West resize (←)
- `ne-resize.svg` - Northeast resize (↗)
- `nw-resize.svg` - Northwest resize (↖)
- `se-resize.svg` - Southeast resize (↘)
- `sw-resize.svg` - Southwest resize (↙)
- `ew-resize.svg` - East-West resize (↔)
- `ns-resize.svg` - North-South resize (↕)
- `nesw-resize.svg` - Northeast-Southwest resize (⤢)
- `nwse-resize.svg` - Northwest-Southeast resize (⤡)

### Action Cursors
- `move.svg` - Move/drag cursor
- `grab.svg` - Grab cursor (hand open)
- `grabbing.svg` - Grabbing cursor (hand closed)
- `wait.svg` - Loading/wait cursor
- `not-allowed.svg` - Not allowed/disabled cursor
- `help.svg` - Help cursor (with question mark)

### Editing Cursors
- `crosshair.svg` - Crosshair/precision cursor
- `zoom-in.svg` - Zoom in cursor
- `zoom-out.svg` - Zoom out cursor
- `copy.svg` - Copy cursor
- `alias.svg` - Alias/shortcut cursor
- `no-drop.svg` - No drop cursor

### Other Cursors
- `progress.svg` - Progress cursor (partial wait)
- `cell.svg` - Cell select cursor
- `vertical-text.svg` - Vertical text cursor
- `col-resize.svg` - Column resize
- `row-resize.svg` - Row resize
- `all-scroll.svg` - All-scroll cursor
- `context-menu.svg` - Context menu cursor

## Usage

1. Add cursor files to this folder
2. Include `css/base/cursors.css` in your HTML:
   ```html
   <link rel="stylesheet" href="css/base/cursors.css">
   ```
3. Add classes to elements to use specific cursors:
   ```html
   <div class="draggable">Drag me</div>
   <div class="resize-se">Resize me</div>
   ```

## SVG Cursor Template

Example SVG cursor structure:

```svg
<svg xmlns="http://www.w3.org/2000/svg" 
     width="32" height="32" 
     viewBox="0 0 32 32">
  <!-- Your cursor design here -->
  <path d="M..." fill="currentColor"/>
</svg>
```

## Cursor Size Recommendations

- **ViewBox**: `0 0 32 32` (standard)
- **Width/Height**: 32x32 pixels
- **Hotspot**: Top-left (0,0) for default, centered (16,16) for resize
- **Stroke width**: 1-2px for clarity

## Creating SVG Cursors

You can create SVG cursors using:
- **Figma** - Export as SVG
- **Adobe Illustrator** - Save as SVG
- **Inkscape** - Free and open-source
- **Online tools**: 
  - svgcursor.com
  - editor.method.ac
  - vectr.com
- **Code editors**: VS Code with SVG preview extensions

## Disabling Custom Cursors

To disable custom cursors, remove or comment out the link to `cursors.css` in your HTML files.
