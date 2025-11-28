import React from 'react';
import DrawingTool from '../DrawingTool';
import '../DrawingTool.css';

function App() {
  return (
    <div className="App">
      <DrawingTool
        canvasWidth={1000}
        canvasHeight={700}
        showGeoView={true}
        showDrawingView={true}
        onExport={(data) => {
          console.log('Exported:', data);
        }}
      />
    </div>
  );
}

export default App;

