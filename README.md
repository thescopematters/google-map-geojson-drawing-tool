# GeoJSON Drawing Tool

This project is a browser-based canvas workspace that combines a GeoJSON map viewer with a flexible freeform drawing studio. It is intended for inspectors, planners, or creative teams who need to annotate geographic features, mark termite findings, sketch floorplans, or mock up site scenarios without leaving the browser.

---

## Project Layout
- `v43-stable/` – stable release of the app (inline styles/scripts).  
- `README.md` – this document.

Open `v43-stable/index.html` in a modern desktop browser for the default experience.

---

## GeoJSON View
* Renders the bundled Louvre-area polygon and its original points.
* Rotates the polygon (0°–360°) while preserving interactive hit testing.
* Adds pins inside the polygon only; pins can be tagged with termite-type labels (auto code + dropdown).
* Places free-form annotations anywhere on the map and edits them in select mode.
* Exports a full `FeatureCollection` containing:
  - Original features (with any updated labels),
  - User-added pins (flagged as `isCustomPin`),
  - Free annotations (mode `annotation`),
  - Rotation metadata.

---

## Custom Drawing Studio
The drawing view now supports **two canvases** (`Canvas 1`, `Canvas 2`) under a horizontal tab bar. Each canvas keeps its own independent state.

### Shared Tool Palette
* **Pencil** – freehand draw with adjustable color & width.  
* **Line / Dotted Line** – preview before committing a straight or dashed segment.  
* **Rectangle & Circle** – geometric shapes with live ghost previews.  
* **Closed / Open Polygon** – click-to-place vertices, ESC or double-click to finish.  
* **Text** – drop inline markers with dynamic font sizing.  
* **Eraser** – circular or square eraser with resizable footprint.  
* **Undo** – per-canvas history (50 snapshots) without losing pins/annotations.

### Canvas-Specific Interactions
* `Select Mode` – click pins to relabel via termite dropdown; click annotations to edit.
* `Add Pin Mode` – drop custom pins; labels render in the overlay layer.
* `Annotate Mode` – open the modal for freeform text anchored to canvas coordinates.
* `Clear` – wipes drawing strokes while keeping history consistent.
* `Export Drawing` – consolidates both canvases into a JSON bundle:
  - PNG data URI for each canvas,
  - Pin array with coordinates & labels,
  - Annotation array with text & positions.

Tabs switch states instantly; inactive canvases stay hidden until selected, preserving performance.

---

## Modal & Label Workflow
The single modal is reused across both views. Its behaviour adapts based on the data attributes set prior to opening:
- Dropdown for termite-type assignment (GeoJSON or drawing pins).
- Text field for map annotations or canvas notes.
- Edit mode pre-fills existing content.

Labels and annotation cards render in overlay containers so that drawing operations never overwrite text.

---

## Running & Customising
1. Serve `index.html` from `v43-stable/` (double-click or use a static file server).  
2. To customise GeoJSON data, replace the inline `geojson` constant or load from a file.  
3. Update default canvas sizes by editing the two `<canvas>` elements within `#drawingCanvasContainer`.  
4. Modify colours/fonts by adjusting the CSS blocks at the top of `index.html`.  
5. For more maintainable development, consider extracting scripts/styles into separate files or porting to a framework.

---

## Notes & Limits
- Designed for desktop; mobile/touch interactions are not tuned.  
- Exported PNG data URIs can be large for complex drawings.  
- GeoJSON rotation affects rendering only; coordinates remain unrotated.  
- History snapshots store full canvas bitmaps; keep shapes moderate to avoid memory spikes.

---

## Roadmap Ideas
- Split CSS/JS into modules with build tooling.  
- Add import support for previously exported JSON bundles.  
- Implement persistence (localStorage/cloud) and user accounts.  
- Provide measurement tools and snapping for precision layouts.

Enjoy mapping, annotating, and sketching directly in your browser!


