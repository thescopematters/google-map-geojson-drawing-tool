# Drawing Tool - React Component

A comprehensive drawing tool component converted from vanilla JavaScript to React. This component provides a full-featured canvas drawing interface with multiple tools, styles, and export capabilities.

## Installation

### Dependencies

Install the required npm packages:

```bash
npm install react react-dom html2canvas
```

Or if using yarn:

```bash
yarn add react react-dom html2canvas
```

## Usage

### Basic Integration

```jsx
import React from 'react';
import DrawingTool from './DrawingTool';
import './DrawingTool.css';

function App() {
  return (
    <div className="App">
      <DrawingTool />
    </div>
  );
}

export default App;
```

### With Custom Props

```jsx
import React from 'react';
import DrawingTool from './DrawingTool';
import './DrawingTool.css';

function App() {
  const handleExport = (data) => {
    console.log('Exported data:', data);
    // Handle export logic
  };

  return (
    <div className="App">
      <DrawingTool
        canvasWidth={1200}
        canvasHeight={800}
        showGeoView={false}
        showDrawingView={true}
        onExport={handleExport}
      />
    </div>
  );
}

export default App;
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialGeoJSON` | `Object` | `null` | Initial GeoJSON data to load |
| `onExport` | `Function` | `null` | Callback function when data is exported |
| `canvasWidth` | `Number` | `1000` | Width of the canvas in pixels |
| `canvasHeight` | `Number` | `700` | Height of the canvas in pixels |
| `showGeoView` | `Boolean` | `true` | Show/hide GeoJSON view |
| `showDrawingView` | `Boolean` | `true` | Show/hide Drawing view |

## Features

### Drawing Tools
- **Pencil**: Freehand drawing
- **Line**: Straight lines with style options (solid, dashed, dotted)
- **Rectangle**: Rectangles with style options (solid, dotted)
- **Circle**: Perfect circles
- **Eraser**: Erase with circle or square shape
- **Closed Polygon**: Draw closed polygons
- **Open Polygon**: Draw open polygons
- **Text**: Add text directly on canvas

### Drawing Modes
- **Select Mode**: Select and edit pins/annotations
- **Add Pin Mode**: Add custom pins to the canvas
- **Annotate Mode**: Add text annotations anywhere

### Style Options
- Line styles: Solid, Dashed, Dotted
- Rectangle styles: Solid, Dotted
- Customizable colors and line widths

### Additional Features
- **Undo**: Undo last drawing action
- **Clear**: Clear entire canvas
- **Capture Image**: Export canvas as PNG image
- **Multiple Canvases**: Switch between Structure 1 and Structure 2

## File Structure

```
v43-stable/
├── DrawingTool.jsx          # Main React component
├── DrawingTool.css          # Component styles
├── drawingUtils.js          # Utility functions
├── index.html               # Original HTML file (for reference)
└── README.md                # This file
```

## Component Architecture

The component is structured as follows:

- **State Management**: Uses React hooks (useState, useRef, useEffect, useCallback)
- **Canvas Handling**: Uses refs to access canvas elements directly
- **Event Handlers**: Mouse events for drawing interactions
- **Modal System**: For text input and termite type selection
- **Export Functionality**: Uses html2canvas for image capture

## Customization

### Styling

All styles are in `DrawingTool.css`. You can customize:
- Colors
- Button styles
- Canvas appearance
- Tool panel layout

### Adding New Tools

To add a new drawing tool:

1. Add a button in the `drawing-tools` section
2. Add a case in `handleMouseDown`, `handleMouseMove`, and `handleMouseUp`
3. Update the `currentTool` state when the tool is selected

## Notes

- The component uses direct DOM manipulation for some features (labels, annotations) for performance
- Canvas operations are optimized using refs to avoid re-renders
- The component is fully self-contained and doesn't require external state management

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This component is provided as-is for integration into your React application.

