import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { 
  getBounds, 
  projectToCanvasState, 
  calculateCenterState, 
  canvasToLatLonState,
  rotatePoint,
  inverseRotatePoint,
  isPointInPolygon,
  generateRandomCode
} from './drawingUtils';
import './DrawingTool.css';

// Default GeoJSON data
const defaultGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "id": "94fc1a86-1843-4db8-94bc-5cbac98c4bf9",
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [2.306948881, 48.854796034],
            [2.306978124, 48.854759168],
            [2.307025219, 48.854728772],
            [2.307238865, 48.85487281],
            [2.307318225, 48.854893604],
            [2.307223739, 48.855001572],
            [2.307159854, 48.854976422],
            [2.307193695, 48.854942818],
            [2.307148268, 48.854934899],
            [2.306948881, 48.854796034]
          ]
        ]
      },
      "properties": {"mode": "polygon"}
    },
    {
      "id": "b63873db-5640-4eec-a6f3-34a2465e3c52",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.306978517, 48.854798228]},
      "properties": {"mode": "point"}
    },
    {
      "id": "fd6414b6-6c63-4c05-b71f-370a78cd5821",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307034996, 48.854752626]},
      "properties": {"mode": "point"}
    },
    {
      "id": "4f6222a3-7368-4be5-9f12-d1b30388f8c7",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307160875, 48.854832965]},
      "properties": {"mode": "point"}
    },
    {
      "id": "d066ee45-f19e-4f65-9046-7b4e62c25928",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307235906, 48.854884407]},
      "properties": {"mode": "point"}
    },
    {
      "id": "075dcbc5-4f5f-4527-ac33-7e5f2837842a",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.30727572, 48.854902963]},
      "properties": {"mode": "point"}
    },
    {
      "id": "37541006-23e1-42a4-97e8-ff3125aa8fcf",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307211836, 48.854975653]},
      "properties": {"mode": "point"}
    },
    {
      "id": "5c64cf67-a71d-4330-80c4-b31d4a50c7e1",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.3070859, 48.854876006]},
      "properties": {"mode": "point"}
    },
    {
      "id": "443a7dc9-1e22-4be7-b7ed-2381a72bc28c",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307037513, 48.854848535]},
      "properties": {"mode": "point"}
    },
    {
      "id": "dcb8d8ae-455d-4e49-a1e0-d44be3ee511f",
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [2.307166889, 48.854927092]},
      "properties": {"mode": "point"}
    }
  ]
};

const GeoJSONView = ({ 
  initialGeoJSON = null,
  onExport = null,
  canvasWidth = 800,
  canvasHeight = 600
}) => {
  const [activeGeoId, setActiveGeoId] = useState(1);
  const [mode, setMode] = useState('select'); // 'select', 'add', 'annotate'
  const [rotationAngles, setRotationAngles] = useState({ 1: 0, 2: 0 });
  
  const canvasRefs = useRef({});
  const labelsContainerRefs = useRef({});
  const annotationsContainerRefs = useRef({});
  
  const [geoStates, setGeoStates] = useState({});
  const [customPins, setCustomPins] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [pointsData, setPointsData] = useState({});
  const [bounds, setBounds] = useState({});
  const [centerPoints, setCenterPoints] = useState({});
  
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Custom Text');
  const [modalText, setModalText] = useState('');
  const [modalType, setModalType] = useState('text');
  const [modalData, setModalData] = useState(null);
  
  // Initialize GeoJSON data
  const [geojsonData, setGeojsonData] = useState(() => {
    return initialGeoJSON ? JSON.parse(JSON.stringify(initialGeoJSON)) : JSON.parse(JSON.stringify(defaultGeoJSON));
  });
  
  // Draw GeoJSON on canvas - accepts optional pins parameter to use latest pins
  const drawGeoJSON = useCallback((geoId, pinsOverride = null) => {
    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const geoJSON = geojsonData;
    const rotationAngle = rotationAngles[geoId] || 0;
    
    // Calculate bounds
    const calculatedBounds = getBounds(geoJSON.features);
    setBounds(prev => ({ ...prev, [geoId]: calculatedBounds }));
    
    // Calculate center
    const centerPoint = calculateCenterState(calculatedBounds, canvas);
    setCenterPoints(prev => ({ ...prev, [geoId]: centerPoint }));
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const newPointsData = [];
    let polygonPoints = [];
    
    // Draw features
    geoJSON.features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        ctx.beginPath();
        const coords = feature.geometry.coordinates[0];
        coords.forEach((coord, i) => {
          const { x, y } = projectToCanvasState(
            coord[0], 
            coord[1], 
            calculatedBounds, 
            canvas, 
            rotationAngle, 
            centerPoint
          );
          polygonPoints.push({ x, y });
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(66, 133, 244, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (feature.geometry.type === 'Point') {
        const { x, y } = projectToCanvasState(
          feature.geometry.coordinates[0],
          feature.geometry.coordinates[1],
          calculatedBounds,
          canvas,
          rotationAngle,
          centerPoint
        );
        
        newPointsData.push({
          x, y,
          featureId: feature.id,
          text: feature.properties.customText || '',
          isCustom: false
        });
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ea4335';
        ctx.fill();
        ctx.strokeStyle = '#c5221f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    
    // Draw custom pins - use override if provided, otherwise use state
    const pins = pinsOverride !== null ? pinsOverride : (customPins[geoId] || []);
    pins.forEach(pin => {
      const { x, y } = projectToCanvasState(
        pin.lon, 
        pin.lat, 
        calculatedBounds, 
        canvas, 
        rotationAngle, 
        centerPoint
      );
      
      newPointsData.push({
        x, y,
        featureId: pin.id,
        text: pin.text || '',
        isCustom: true
      });
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34a853';
      ctx.fill();
      ctx.strokeStyle = '#1e8e3e';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    setPointsData(prev => ({ ...prev, [geoId]: newPointsData }));
    renderLabels(geoId, newPointsData);
    renderAnnotations(geoId);
  }, [geojsonData, rotationAngles, customPins]);
  
  // Render labels
  const renderLabels = useCallback((geoId, points = null) => {
    const container = labelsContainerRefs.current[geoId];
    if (!container) return;
    
    const pointsToRender = points || pointsData[geoId] || [];
    container.innerHTML = '';
    
    pointsToRender.forEach(point => {
      if (point.text) {
        const label = document.createElement('div');
        label.className = 'point-label';
        label.textContent = point.text;
        label.style.left = (point.x + 10) + 'px';
        label.style.top = (point.y - 10) + 'px';
        container.appendChild(label);
      }
    });
  }, [pointsData]);
  
  // Render annotations
  const renderAnnotations = useCallback((geoId) => {
    const container = annotationsContainerRefs.current[geoId];
    if (!container) return;
    
    const anns = annotations[geoId] || [];
    container.innerHTML = '';
    
    anns.forEach((annotation, idx) => {
      const calculatedBounds = bounds[geoId];
      const canvas = canvasRefs.current[geoId];
      const rotationAngle = rotationAngles[geoId] || 0;
      const centerPoint = centerPoints[geoId];
      
      if (!calculatedBounds || !canvas) return;
      
      const { x, y } = projectToCanvasState(
        annotation.lon, 
        annotation.lat, 
        calculatedBounds, 
        canvas, 
        rotationAngle, 
        centerPoint
      );
      
      const label = document.createElement('div');
      label.className = 'annotation';
      label.textContent = annotation.text;
      label.style.left = x + 'px';
      label.style.top = y + 'px';
      label.style.transform = 'translate(-50%, -50%)';
      label.style.background = 'rgba(251, 188, 4, 0.95)';
      label.style.cursor = mode === 'select' ? 'pointer' : 'default';
      label.style.pointerEvents = mode === 'select' ? 'auto' : 'none';
      
      if (mode === 'select') {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          setModalTitle('Edit Annotation');
          setModalType('text');
          setModalText(annotation.text);
          setModalData({ geoId, annotationIndex: idx });
          setShowModal(true);
        });
      }
      
      container.appendChild(label);
    });
  }, [annotations, bounds, rotationAngles, centerPoints, mode]);
  
  // Handle canvas click
  const handleCanvasClick = useCallback((e, geoId) => {
    if (geoId !== activeGeoId) return;
    
    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clickX = e.clientX - rect.left;
    let clickY = e.clientY - rect.top;
    
    const calculatedBounds = bounds[geoId];
    const rotationAngle = rotationAngles[geoId] || 0;
    const centerPoint = centerPoints[geoId];
    
    if (!calculatedBounds) return;
    
    if (mode === 'select') {
      const points = pointsData[geoId] || [];
      points.forEach((point, idx) => {
        const distance = Math.sqrt(
          Math.pow(clickX - point.x, 2) + 
          Math.pow(clickY - point.y, 2)
        );
        
        if (distance <= 8) {
          setModalTitle('Select Termite Type');
          setModalType('termite');
          setModalText(point.text || '');
          setModalData({ geoId, pointIndex: idx, point });
          setShowModal(true);
        }
      });
    } else if (mode === 'add') {
      let checkX = clickX;
      let checkY = clickY;
      if (rotationAngle !== 0 && centerPoint) {
        const inverted = inverseRotatePoint(clickX, clickY, centerPoint.x, centerPoint.y, rotationAngle);
        checkX = inverted.x;
        checkY = inverted.y;
      }
      
      // Get polygon points for checking
      const polygonPoints = [];
      geojsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(coord => {
            const { x, y } = projectToCanvasState(
              coord[0], 
              coord[1], 
              calculatedBounds, 
              canvas, 
              0, 
              null
            );
            polygonPoints.push({ x, y });
          });
        }
      });
      
      if (isPointInPolygon(checkX, checkY, polygonPoints)) {
        const { lon, lat } = canvasToLatLonState(checkX, checkY, calculatedBounds, canvas);
        
        const newPin = {
          id: 'custom-' + Date.now(),
          lon,
          lat,
          text: ''
        };
        
        // Update state and immediately draw with the updated pins
        setCustomPins(prev => {
          const updatedPins = [...(prev[geoId] || []), newPin];
          
          // Draw immediately with the updated pins array
          requestAnimationFrame(() => {
            drawGeoJSON(geoId, updatedPins);
          });
          
          return {
            ...prev,
            [geoId]: updatedPins
          };
        });
      } else {
        alert('Please click inside the blue polygon area to add a pin');
      }
    } else if (mode === 'annotate') {
      let annotateX = clickX;
      let annotateY = clickY;
      if (rotationAngle !== 0 && centerPoint) {
        const inverted = inverseRotatePoint(clickX, clickY, centerPoint.x, centerPoint.y, rotationAngle);
        annotateX = inverted.x;
        annotateY = inverted.y;
      }
      
      const { lon, lat } = canvasToLatLonState(annotateX, annotateY, calculatedBounds, canvas);
      
      setModalTitle('Add Annotation');
      setModalType('text');
      setModalText('');
      setModalData({ geoId, lon, lat });
      setShowModal(true);
    }
  }, [activeGeoId, mode, bounds, rotationAngles, centerPoints, pointsData, geojsonData, drawGeoJSON]);
  
  // Handle rotation change
  const handleRotationChange = useCallback((geoId, angle) => {
    setRotationAngles(prev => ({ ...prev, [geoId]: angle }));
    setTimeout(() => drawGeoJSON(geoId), 0);
  }, [drawGeoJSON]);
  
  // Handle modal save
  const handleSaveModal = useCallback(() => {
    if (!modalData) return;
    
    if (modalType === 'text') {
      if (modalData.lon !== undefined && modalData.lat !== undefined) {
        // New annotation
        const newAnnotation = {
          id: 'annotation-' + Date.now(),
          lon: modalData.lon,
          lat: modalData.lat,
          text: modalText
        };
        setAnnotations(prev => ({
          ...prev,
          [modalData.geoId]: [...(prev[modalData.geoId] || []), newAnnotation]
        }));
      } else if (modalData.annotationIndex !== undefined) {
        // Edit annotation
        setAnnotations(prev => {
          const anns = [...(prev[modalData.geoId] || [])];
          anns[modalData.annotationIndex].text = modalText;
          return { ...prev, [modalData.geoId]: anns };
        });
      }
    } else if (modalType === 'termite') {
      const { geoId, pointIndex, point } = modalData;
      if (modalText) {
        const code = generateRandomCode();
        const displayText = code + ' ' + modalText;
        
        if (point.isCustom) {
          setCustomPins(prev => {
            const pins = [...(prev[geoId] || [])];
            const pin = pins.find(p => p.id === point.featureId);
            if (pin) pin.text = displayText;
            return { ...prev, [geoId]: pins };
          });
        } else {
          setGeojsonData(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            newData.features.forEach(feature => {
              if (feature.id === point.featureId) {
                feature.properties.customText = displayText;
              }
            });
            return newData;
          });
        }
        
        setTimeout(() => drawGeoJSON(geoId), 0);
      }
    }
    
    setShowModal(false);
    setModalText('');
    setModalData(null);
  }, [modalData, modalType, modalText, drawGeoJSON]);
  
  // Export GeoJSON
  const handleExport = useCallback(() => {
    const exportData = {
      type: "FeatureCollection",
      geoViews: [1, 2].map(geoId => {
        const viewData = {
          id: `geo-view-${geoId}`,
          type: "FeatureCollection",
          features: [],
          metadata: {
            rotationAngle: rotationAngles[geoId] || 0
          }
        };
        
        // Add all original features
        geojsonData.features.forEach(feature => {
          viewData.features.push(JSON.parse(JSON.stringify(feature)));
        });
        
        // Add custom pins
        (customPins[geoId] || []).forEach(pin => {
          viewData.features.push({
            id: pin.id,
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [pin.lon, pin.lat]
            },
            properties: {
              mode: "point",
              customText: pin.text || "",
              isCustomPin: true
            }
          });
        });
        
        // Add annotations
        (annotations[geoId] || []).forEach(ann => {
          viewData.features.push({
            id: ann.id,
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [ann.lon, ann.lat]
            },
            properties: {
              mode: "annotation",
              annotationText: ann.text,
              isAnnotation: true
            }
          });
        });
        
        return viewData;
      })
    };
    
    if (onExport) {
      onExport(exportData);
    } else {
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exported-geojson-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('GeoJSON exported successfully!');
    }
  }, [geojsonData, customPins, annotations, rotationAngles, onExport]);
  
  // Capture image
  const handleCaptureImage = useCallback(async (geoId) => {
    const canvasWrapper = document.getElementById(`geo-canvas-wrapper-${geoId}`);
    if (!canvasWrapper) return;
    
    const canvasElement = canvasRefs.current[geoId];
    const labelsContainer = labelsContainerRefs.current[geoId];
    const annotationsContainer = annotationsContainerRefs.current[geoId];
    
    if (!canvasElement) {
      alert('Canvas not found!');
      return;
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = canvasElement.width + 'px';
      tempContainer.style.height = canvasElement.height + 'px';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.overflow = 'hidden';
      document.body.appendChild(tempContainer);
      
      // Clone and add canvas
      const clonedCanvas = document.createElement('canvas');
      clonedCanvas.width = canvasElement.width;
      clonedCanvas.height = canvasElement.height;
      const clonedCtx = clonedCanvas.getContext('2d');
      clonedCtx.drawImage(canvasElement, 0, 0);
      clonedCanvas.style.position = 'absolute';
      clonedCanvas.style.left = '0';
      clonedCanvas.style.top = '0';
      clonedCanvas.style.display = 'block';
      tempContainer.appendChild(clonedCanvas);
      
      // Clone and add labels (remove borders and shadows)
      if (labelsContainer && labelsContainer.children.length > 0) {
        const clonedLabels = labelsContainer.cloneNode(true);
        clonedLabels.style.position = 'absolute';
        clonedLabels.style.left = '0';
        clonedLabels.style.top = '0';
        clonedLabels.style.width = canvasElement.width + 'px';
        clonedLabels.style.height = canvasElement.height + 'px';
        Array.from(clonedLabels.children).forEach(label => {
          label.style.border = 'none';
          label.style.boxShadow = 'none';
        });
        tempContainer.appendChild(clonedLabels);
      }
      
      // Clone and add annotations (remove borders and shadows)
      if (annotationsContainer && annotationsContainer.children.length > 0) {
        const clonedAnnotations = annotationsContainer.cloneNode(true);
        clonedAnnotations.style.position = 'absolute';
        clonedAnnotations.style.left = '0';
        clonedAnnotations.style.top = '0';
        clonedAnnotations.style.width = canvasElement.width + 'px';
        clonedAnnotations.style.height = canvasElement.height + 'px';
        Array.from(clonedAnnotations.children).forEach(annotation => {
          annotation.style.border = 'none';
          annotation.style.boxShadow = 'none';
        });
        tempContainer.appendChild(clonedAnnotations);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Capture the temporary container
      const capturedCanvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 1,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: canvasElement.width,
        height: canvasElement.height
      });
      
      // Clean up
      document.body.removeChild(tempContainer);
      
      const imageData = capturedCanvas.toDataURL('image/png');
      const blob = await (await fetch(imageData)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geojson-canvas-${geoId}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Image captured successfully!');
    } catch (error) {
      console.error('Error capturing image:', error);
      alert('Error capturing image. Please try again.');
    }
  }, []);
  
  // Initialize and draw on mount/update
  useEffect(() => {
    [1, 2].forEach(geoId => {
      drawGeoJSON(geoId);
    });
  }, [drawGeoJSON]);
  
  // Update annotations when rotation changes
  useEffect(() => {
    [1, 2].forEach(geoId => {
      renderAnnotations(geoId);
    });
  }, [renderAnnotations, rotationAngles]);
  
  return (
    <div className="main-container">
      <div className="controls">
        <button 
          className={`btn ${mode === 'select' ? 'btn-primary mode-active' : 'btn-secondary'}`}
          onClick={() => setMode('select')}
        >
          Select Mode
        </button>
        <button 
          className={`btn ${mode === 'add' ? 'btn-primary mode-active' : 'btn-secondary'}`}
          onClick={() => setMode('add')}
        >
          Add Pin Mode
        </button>
        <button 
          className={`btn ${mode === 'annotate' ? 'btn-primary mode-active' : 'btn-secondary'}`}
          onClick={() => setMode('annotate')}
        >
          Annotate Mode
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => {
            setCustomPins(prev => ({ ...prev, [activeGeoId]: [] }));
            setTimeout(() => drawGeoJSON(activeGeoId), 0);
          }}
        >
          Clear Custom Pins
        </button>
        <button 
          className="btn btn-primary"
          onClick={handleExport}
        >
          Export GeoJSON
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => handleCaptureImage(activeGeoId)}
        >
          📷 Capture Image
        </button>
      </div>
      
      <div className="geo-tabs">
        <button 
          className={`geo-tab ${activeGeoId === 1 ? 'active' : ''}`}
          onClick={() => setActiveGeoId(1)}
        >
          Polygon Map 1
        </button>
        <button 
          className={`geo-tab ${activeGeoId === 2 ? 'active' : ''}`}
          onClick={() => setActiveGeoId(2)}
        >
          Polygon Map 2
        </button>
      </div>
      
      <div className="geo-area">
        <div className="geo-panels">
          {[1, 2].map(geoId => (
            <div 
              key={geoId}
              className={`geo-panel ${activeGeoId === geoId ? 'active' : ''}`}
            >
              <div className="controls">
                <label style={{ marginRight: '10px', fontWeight: 500 }}>
                  Rotate Polygon:
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={rotationAngles[geoId] || 0}
                  onChange={(e) => handleRotationChange(geoId, parseInt(e.target.value, 10))}
                  style={{ width: '300px', verticalAlign: 'middle' }}
                />
                <span style={{ marginLeft: '10px', fontWeight: 500 }}>
                  {rotationAngles[geoId] || 0}°
                </span>
                <button 
                  className="btn btn-secondary"
                  style={{ marginLeft: '15px' }}
                  onClick={() => {
                    handleRotationChange(geoId, 0);
                    // Reset slider
                    const slider = document.querySelector(`input[type="range"]`);
                    if (slider) slider.value = 0;
                  }}
                >
                  Reset Rotation
                </button>
              </div>
              <div 
                id={`geo-canvas-wrapper-${geoId}`}
                className="canvas-wrapper"
              >
                <canvas
                  ref={el => canvasRefs.current[geoId] = el}
                  id={`mapCanvas${geoId}`}
                  width={canvasWidth}
                  height={canvasHeight}
                  onClick={(e) => handleCanvasClick(e, geoId)}
                  style={{ cursor: mode === 'select' ? 'pointer' : mode === 'add' ? 'crosshair' : 'text' }}
                />
                <div ref={el => labelsContainerRefs.current[geoId] = el} id={`labels${geoId}`} />
                <div ref={el => annotationsContainerRefs.current[geoId] = el} id={`annotations${geoId}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="info">
        <p><strong>Polygon:</strong> <span style={{ color: '#4285f4' }}>Blue fill</span> with <span style={{ color: '#1a73e8' }}>dark blue stroke</span></p>
        <p><strong>Original Points:</strong> <span style={{ color: '#ea4335' }}>Red circles</span></p>
        <p><strong>Custom Pins:</strong> <span style={{ color: '#34a853' }}>Green circles</span> - Added by you</p>
        <p><strong>Annotations:</strong> <span style={{ color: '#fbbc04' }}>Yellow labels</span> - Click anywhere to add text annotations</p>
        <p><strong>Tip:</strong> Switch modes to add pins, annotate anywhere, or select points. Click any point to add text.</p>
        <p><strong>Location:</strong> Paris, France (near the Louvre)</p>
      </div>
      
      {/* Modal */}
      {showModal && (
        <div className="modal show" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalTitle}</h2>
            {modalType === 'text' ? (
              <textarea
                value={modalText}
                onChange={(e) => setModalText(e.target.value)}
                placeholder="Enter your text here..."
              />
            ) : (
              <select
                value={modalText}
                onChange={(e) => setModalText(e.target.value)}
              >
                <option value="">Select Termite Type</option>
                <option value="Subterranean Termites">Subterranean Termites</option>
                <option value="Drywood Termites">Drywood Termites</option>
                <option value="Dampwood Termites">Dampwood Termites</option>
                <option value="Formosan Termites">Formosan Termites</option>
                <option value="Conehead Termites">Conehead Termites</option>
              </select>
            )}
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveModal}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoJSONView;

