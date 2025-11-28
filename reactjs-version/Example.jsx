// Example usage of DrawingTool component
import React from 'react';
import DrawingTool from './DrawingTool';
import './DrawingTool.css';

function Example() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Drawing Tool Example</h1>
      <DrawingTool
        canvasWidth={1000}
        canvasHeight={700}
        showGeoView={false}
        showDrawingView={true}
        onExport={(data) => {
          console.log('Exported:', data);
        }}
      />
    </div>
  );
}

export default Example;

