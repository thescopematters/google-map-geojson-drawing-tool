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
  generateRandomCode,
  getLineDashPattern,
  getCanvasCoordinates
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
      "properties": { "mode": "polygon" }
    },
    {
      "id": "b63873db-5640-4eec-a6f3-34a2465e3c52",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.306978517, 48.854798228] },
      "properties": { "mode": "point" }
    },
    {
      "id": "fd6414b6-6c63-4c05-b71f-370a78cd5821",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307034996, 48.854752626] },
      "properties": { "mode": "point" }
    },
    {
      "id": "4f6222a3-7368-4be5-9f12-d1b30388f8c7",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307160875, 48.854832965] },
      "properties": { "mode": "point" }
    },
    {
      "id": "d066ee45-f19e-4f65-9046-7b4e62c25928",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307235906, 48.854884407] },
      "properties": { "mode": "point" }
    },
    {
      "id": "075dcbc5-4f5f-4527-ac33-7e5f2837842a",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.30727572, 48.854902963] },
      "properties": { "mode": "point" }
    },
    {
      "id": "37541006-23e1-42a4-97e8-ff3125aa8fcf",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307211836, 48.854975653] },
      "properties": { "mode": "point" }
    },
    {
      "id": "5c64cf67-a71d-4330-80c4-b31d4a50c7e1",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.3070859, 48.854876006] },
      "properties": { "mode": "point" }
    },
    {
      "id": "443a7dc9-1e22-4be7-b7ed-2381a72bc28c",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307037513, 48.854848535] },
      "properties": { "mode": "point" }
    },
    {
      "id": "dcb8d8ae-455d-4e49-a1e0-d44be3ee511f",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.307166889, 48.854927092] },
      "properties": { "mode": "point" }
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
  const [mode, setMode] = useState('select'); // 'select', 'add', 'annotate', 'draw'
  const [rotationAngles, setRotationAngles] = useState({ 1: 0, 2: 0 });

  // Drawing tool state
  const [currentTool, setCurrentTool] = useState('pencil');
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState('solid');
  const [rectangleStyle, setRectangleStyle] = useState('solid');
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserType, setEraserType] = useState('circle');
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);

  const canvasRefs = useRef({});
  const drawingsCanvasRefs = useRef({}); // Separate canvas for custom drawings
  const previewCanvasRefs = useRef({});
  const eraserCursorRefs = useRef({});
  const textInputBoxRefs = useRef({});
  const textInputRefs = useRef({});
  const labelsContainerRefs = useRef({});
  const annotationsContainerRefs = useRef({});

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [polygonPoints, setPolygonPoints] = useState({});
  const [drawingHistory, setDrawingHistory] = useState({});
  const [redoHistory, setRedoHistory] = useState({});
  const [showPolygonHint, setShowPolygonHint] = useState(false);
  const [initializedCanvases, setInitializedCanvases] = useState(new Set());

  const [geoStates, setGeoStates] = useState({});
  const [customPins, setCustomPins] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [pointsData, setPointsData] = useState({});
  const [bounds, setBounds] = useState({});
  const [centerPoints, setCenterPoints] = useState({});
  const [drawnShapes, setDrawnShapes] = useState({}); // Store vector data for custom shapes

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Custom Text');
  const [modalText, setModalText] = useState('');
  const [modalType, setModalType] = useState('text');
  const [modalData, setModalData] = useState(null);

  // Initialize GeoJSON data
  const [geojsonData, setGeojsonData] = useState(() => {
    return initialGeoJSON ? JSON.parse(JSON.stringify(initialGeoJSON)) : JSON.parse(JSON.stringify(defaultGeoJSON));
  });

  // Draw GeoJSON on canvas - modified to preserve drawings
  const drawGeoJSON = useCallback((geoId, pinsOverride = null, preserveDrawings = false, previousRotationAngle = null, overrideRotationAngle = null) => {
    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get the separate drawings canvas
    const drawingsCanvas = drawingsCanvasRefs.current[geoId];

    const geoJSON = geojsonData;
    const rotationAngle = overrideRotationAngle !== null ? overrideRotationAngle : (rotationAngles[geoId] || 0);

    // Calculate bounds
    const calculatedBounds = getBounds(geoJSON.features);
    setBounds(prev => ({ ...prev, [geoId]: calculatedBounds }));

    // Calculate center
    const centerPoint = calculateCenterState(calculatedBounds, canvas);
    setCenterPoints(prev => ({ ...prev, [geoId]: centerPoint }));

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const newPointsData = [];
    let polygonPointsArray = [];

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
          polygonPointsArray.push({ x, y });

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

    // Draw vector shapes (Lines, Rectangles, Circles, Polygons)
    const shapes = drawnShapes[geoId] || [];
    shapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.style === 'dashed') {
        ctx.setLineDash([10, 5]);
      } else if (shape.style === 'dotted') {
        ctx.setLineDash([2, 5]);
      } else {
        ctx.setLineDash([]);
      }

      if (shape.type === 'line') {
        const start = projectToCanvasState(shape.start.lon, shape.start.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
        const end = projectToCanvasState(shape.end.lon, shape.end.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (shape.type === 'rectangle') {
        const start = projectToCanvasState(shape.start.lon, shape.start.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
        const end = projectToCanvasState(shape.end.lon, shape.end.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (shape.type === 'circle') {
        const center = projectToCanvasState(shape.center.lon, shape.center.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
        // Calculate radius in pixels (approximate based on width)
        // This is a simplification; for true geo-accuracy we'd need more complex math, 
        // but for this view it should suffice to scale based on canvas width vs geo width
        const geoWidth = calculatedBounds.maxLon - calculatedBounds.minLon;
        const canvasWidthPx = canvas.width - 100; // padding * 2
        const pixelsPerDegree = canvasWidthPx / geoWidth;
        const radiusPx = shape.radius * pixelsPerDegree;

        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'polygon') {
        ctx.fillStyle = shape.color; // Use same color for fill for now, or add fill property
        ctx.beginPath();
        shape.points.forEach((pt, i) => {
          const pos = projectToCanvasState(pt.lon, pt.lat, calculatedBounds, canvas, rotationAngle, centerPoint);
          if (i === 0) ctx.moveTo(pos.x, pos.y);
          else ctx.lineTo(pos.x, pos.y);
        });
        ctx.closePath();
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });

    // Composite drawings canvas on top of main canvas with proper rotation
    if (drawingsCanvas) {
      ctx.save();
      if (rotationAngle !== 0 && centerPoint) {
        ctx.translate(centerPoint.x, centerPoint.y);
        ctx.rotate((rotationAngle * Math.PI) / 180);
        ctx.translate(-centerPoint.x, -centerPoint.y);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(drawingsCanvas, 0, 0);
      ctx.restore();
    }

    renderLabels(geoId, newPointsData);
    renderAnnotations(geoId);
  }, [geojsonData, rotationAngles, customPins]);

  // Save drawing state for undo
  const saveDrawingState = useCallback((geoId) => {
    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    setRedoHistory(prev => ({
      ...prev,
      [geoId]: []
    }));

    setDrawingHistory(prev => ({
      ...prev,
      [geoId]: [...(prev[geoId] || []), imageData].slice(-50)
    }));
  }, []);

  // Clear preview
  const clearPreview = useCallback((geoId) => {
    const previewCanvas = previewCanvasRefs.current[geoId];
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  }, []);

  // Undo drawing
  const undoDrawing = useCallback(() => {
    const canvas = canvasRefs.current[activeGeoId];
    if (!canvas) return;

    setDrawingHistory(prev => {
      const history = prev[activeGeoId] || [];
      if (history.length <= 1) return prev;

      const ctx = canvas.getContext('2d');
      const currentState = history[history.length - 1];
      const previousState = history[history.length - 2];

      ctx.putImageData(previousState, 0, 0);

      setRedoHistory(redoPrev => ({
        ...redoPrev,
        [activeGeoId]: [...(redoPrev[activeGeoId] || []), currentState]
      }));

      // Redraw GeoJSON on top
      setTimeout(() => {
        drawGeoJSON(activeGeoId, null);
      }, 0);

      return {
        ...prev,
        [activeGeoId]: history.slice(0, -1)
      };
    });
  }, [activeGeoId, drawGeoJSON]);

  // Redo drawing
  const redoDrawing = useCallback(() => {
    const canvas = canvasRefs.current[activeGeoId];
    if (!canvas) return;

    setRedoHistory(prev => {
      const redoStack = prev[activeGeoId] || [];
      if (redoStack.length === 0) return prev;

      const ctx = canvas.getContext('2d');
      const stateToRedo = redoStack[redoStack.length - 1];

      ctx.putImageData(stateToRedo, 0, 0);

      setDrawingHistory(historyPrev => ({
        ...historyPrev,
        [activeGeoId]: [...(historyPrev[activeGeoId] || []), stateToRedo]
      }));

      // Redraw GeoJSON on top
      setTimeout(() => {
        drawGeoJSON(activeGeoId, null);
      }, 0);

      return {
        ...prev,
        [activeGeoId]: redoStack.slice(0, -1)
      };
    });
  }, [activeGeoId, drawGeoJSON]);

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
      let pinX = clickX;
      let pinY = clickY;
      if (rotationAngle !== 0 && centerPoint) {
        const inverted = inverseRotatePoint(clickX, clickY, centerPoint.x, centerPoint.y, rotationAngle);
        pinX = inverted.x;
        pinY = inverted.y;
      }

      // Convert canvas coordinates to lat/lon (works anywhere on canvas)
      const { lon, lat } = canvasToLatLonState(pinX, pinY, calculatedBounds, canvas);

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

  // Handle mouse down for drawing
  const handleMouseDown = useCallback((e, geoId) => {
    if (geoId !== activeGeoId) return;

    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e, canvas);
    setStartPos({ x, y });

    // Handle existing modes
    if (mode === 'select') {
      const points = pointsData[geoId] || [];
      points.forEach((point, idx) => {
        const distance = Math.sqrt(
          Math.pow(x - point.x, 2) +
          Math.pow(y - point.y, 2)
        );

        if (distance <= 8) {
          setModalTitle('Select Termite Type');
          setModalType('termite');
          setModalText(point.text || '');
          setModalData({ geoId, pointIndex: idx, point });
          setShowModal(true);
        }
      });
      return;
    }

    if (mode === 'add') {
      let pinX = x;
      let pinY = y;
      const calculatedBounds = bounds[geoId];
      const rotationAngle = rotationAngles[geoId] || 0;
      const centerPoint = centerPoints[geoId];

      if (!calculatedBounds) return;

      if (rotationAngle !== 0 && centerPoint) {
        const inverted = inverseRotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
        pinX = inverted.x;
        pinY = inverted.y;
      }

      // Convert canvas coordinates to lat/lon (works anywhere on canvas)
      const { lon, lat } = canvasToLatLonState(pinX, pinY, calculatedBounds, canvas);

      const newPin = {
        id: 'custom-' + Date.now(),
        lon,
        lat,
        text: ''
      };

      setCustomPins(prev => {
        const updatedPins = [...(prev[geoId] || []), newPin];
        requestAnimationFrame(() => {
          drawGeoJSON(geoId, updatedPins, true);
        });
        return {
          ...prev,
          [geoId]: updatedPins
        };
      });
      return;
    }

    if (mode === 'annotate') {
      let annotateX = x;
      let annotateY = y;
      const calculatedBounds = bounds[geoId];
      const rotationAngle = rotationAngles[geoId] || 0;
      const centerPoint = centerPoints[geoId];

      if (!calculatedBounds) return;

      if (rotationAngle !== 0 && centerPoint) {
        const inverted = inverseRotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
        annotateX = inverted.x;
        annotateY = inverted.y;
      }

      const { lon, lat } = canvasToLatLonState(annotateX, annotateY, calculatedBounds, canvas);

      setModalTitle('Add Annotation');
      setModalType('text');
      setModalText('');
      setModalData({ geoId, lon, lat });
      setShowModal(true);
      return;
    }

    // Drawing mode
    if (mode === 'draw') {
      if (currentTool === 'text') {
        const textInputBox = textInputBoxRefs.current[geoId];
        const textInput = textInputRefs.current[geoId];
        if (textInputBox && textInput && canvas) {
          textInputBox.style.display = 'block';
          textInputBox.style.left = x + 'px';
          textInputBox.style.top = y + 'px';
          textInput.value = '';
          textInputBox.style.zIndex = '1000';
          setTimeout(() => {
            textInput.focus();
            textInput.select();
          }, 10);
        }
        return;
      }

      if (currentTool === 'closedPolygon' || currentTool === 'openPolygon') {
        const drawingsCanvas = drawingsCanvasRefs.current[geoId];
        if (drawingsCanvas) {
          const drawingsCtx = drawingsCanvas.getContext('2d');
          const newPoints = [...(polygonPoints[geoId] || []), { x, y }];
          setPolygonPoints(prev => ({ ...prev, [geoId]: newPoints }));

          drawingsCtx.fillStyle = drawingColor;
          drawingsCtx.beginPath();
          drawingsCtx.arc(x, y, 3, 0, Math.PI * 2);
          drawingsCtx.fill();

          if (newPoints.length > 1) {
            const prev = newPoints[newPoints.length - 2];
            drawingsCtx.strokeStyle = drawingColor;
            drawingsCtx.lineWidth = lineWidth;
            drawingsCtx.beginPath();
            drawingsCtx.moveTo(prev.x, prev.y);
            drawingsCtx.lineTo(x, y);
            drawingsCtx.stroke();
          }

          // Also draw on main canvas for immediate visual feedback
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = drawingColor;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();

          if (newPoints.length > 1) {
            const prev = newPoints[newPoints.length - 2];
            ctx.strokeStyle = drawingColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }
        return;
      }

      setIsDrawing(true);
      saveDrawingState(geoId);
    }
  }, [activeGeoId, mode, currentTool, drawingColor, lineWidth, polygonPoints, pointsData, bounds, rotationAngles, centerPoints, geojsonData, drawGeoJSON, saveDrawingState]);

  // Handle mouse move for drawing
  const handleMouseMove = useCallback((e, geoId) => {
    if (geoId !== activeGeoId) return;

    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e, canvas);

    // Eraser cursor
    if (currentTool === 'eraser' && mode === 'draw') {
      const eraserCursor = eraserCursorRefs.current[geoId];
      if (eraserCursor) {
        eraserCursor.style.display = 'block';
        eraserCursor.style.left = (x - eraserSize / 2) + 'px';
        eraserCursor.style.top = (y - eraserSize / 2) + 'px';
        eraserCursor.style.width = eraserSize + 'px';
        eraserCursor.style.height = eraserSize + 'px';
      }
    }

    if (!isDrawing) {
      // Preview for polygon
      if ((currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[geoId]?.length > 0) {
        const previewCanvas = previewCanvasRefs.current[geoId];
        if (previewCanvas) {
          const ctx = previewCanvas.getContext('2d');
          ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          const lastPoint = polygonPoints[geoId][polygonPoints[geoId].length - 1];
          ctx.strokeStyle = drawingColor;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(x, y);
          ctx.stroke();

          if (currentTool === 'closedPolygon' && polygonPoints[geoId].length > 2) {
            const firstPoint = polygonPoints[geoId][0];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(firstPoint.x, firstPoint.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
      }
      return;
    }

    if (mode !== 'draw') return;

    const previewCanvas = previewCanvasRefs.current[geoId];
    const drawingsCanvas = drawingsCanvasRefs.current[geoId];
    const drawingsCtx = drawingsCanvas ? drawingsCanvas.getContext('2d') : null;

    const rotationAngle = rotationAngles[geoId] || 0;
    const centerPoint = centerPoints[geoId];

    let mapX = x;
    let mapY = y;
    let mapStartX = startPos.x;
    let mapStartY = startPos.y;

    if (rotationAngle !== 0 && centerPoint) {
      const inverted = inverseRotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
      mapX = inverted.x;
      mapY = inverted.y;

      const invertedStart = inverseRotatePoint(startPos.x, startPos.y, centerPoint.x, centerPoint.y, rotationAngle);
      mapStartX = invertedStart.x;
      mapStartY = invertedStart.y;
    }

    if (currentTool === 'pencil' && drawingsCtx) {
      drawingsCtx.strokeStyle = drawingColor;
      drawingsCtx.lineWidth = lineWidth;
      drawingsCtx.lineCap = 'round';
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(mapStartX, mapStartY);
      drawingsCtx.lineTo(mapX, mapY);
      drawingsCtx.stroke();
      setStartPos({ x, y });
      // Also update main canvas for immediate visual feedback
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentTool === 'eraser' && drawingsCtx) {
      if (eraserType === 'circle') {
        drawingsCtx.save();
        drawingsCtx.globalCompositeOperation = 'destination-out';
        drawingsCtx.beginPath();
        drawingsCtx.arc(mapX, mapY, eraserSize / 2, 0, Math.PI * 2);
        drawingsCtx.fill();
        drawingsCtx.restore();
        // Also update main canvas for immediate visual feedback
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawingsCtx.clearRect(mapX - eraserSize / 2, mapY - eraserSize / 2, eraserSize, eraserSize);
        // Also update main canvas for immediate visual feedback
        const ctx = canvas.getContext('2d');
        ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
      }
    } else if (isDrawing && (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
      let previewCanvas = previewCanvasRefs.current[geoId];
      if (!previewCanvas && canvas.parentElement) {
        const newPreview = document.createElement('canvas');
        newPreview.width = canvas.width;
        newPreview.height = canvas.height;
        newPreview.style.position = 'absolute';
        newPreview.style.left = '0';
        newPreview.style.top = '0';
        newPreview.style.pointerEvents = 'none';
        newPreview.style.border = 'none';
        newPreview.style.backgroundColor = 'transparent';
        newPreview.style.zIndex = '10';
        newPreview.style.display = 'block';
        newPreview.className = 'preview-layer';
        canvas.parentElement.appendChild(newPreview);
        previewCanvasRefs.current[geoId] = newPreview;
      }

      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        previewCtx.strokeStyle = drawingColor;
        previewCtx.lineWidth = lineWidth;
        previewCtx.lineCap = 'round';
        previewCtx.lineJoin = 'round';

        if (currentTool === 'line') {
          const dashPattern = getLineDashPattern(lineStyle);
          previewCtx.setLineDash(dashPattern);
          previewCtx.beginPath();
          previewCtx.moveTo(startPos.x, startPos.y);
          previewCtx.lineTo(x, y);
          previewCtx.stroke();
        } else if (currentTool === 'rectangle') {
          const dashPattern = getLineDashPattern(rectangleStyle);
          previewCtx.setLineDash(dashPattern);
          previewCtx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
        } else if (currentTool === 'circle') {
          previewCtx.setLineDash([5, 5]);
          const radius = Math.hypot(x - startPos.x, y - startPos.y);
          previewCtx.beginPath();
          previewCtx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
          previewCtx.stroke();
        }

        previewCtx.setLineDash([]);
      }
    }
  }, [activeGeoId, isDrawing, mode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, eraserSize, eraserType, startPos, polygonPoints]);

  // Handle mouse up for drawing
  const handleMouseUp = useCallback((e, geoId) => {
    if (geoId !== activeGeoId || !isDrawing || mode !== 'draw') return;

    const canvas = canvasRefs.current[geoId];
    if (!canvas) return;

    const drawingsCanvas = drawingsCanvasRefs.current[geoId];
    if (!drawingsCanvas) return;

    const { x, y } = getCanvasCoordinates(e, canvas);
    const drawingsCtx = drawingsCanvas.getContext('2d');
    const finalColor = (drawingColor === '#ffffff' || drawingColor === '#FFFFFF') ? '#000000' : drawingColor;

    const rotationAngle = rotationAngles[geoId] || 0;
    const centerPoint = centerPoints[geoId];

    let mapX = x;
    let mapY = y;
    let mapStartX = startPos.x;
    let mapStartY = startPos.y;

    if (rotationAngle !== 0 && centerPoint) {
      const inverted = inverseRotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
      mapX = inverted.x;
      mapY = inverted.y;

      const invertedStart = inverseRotatePoint(startPos.x, startPos.y, centerPoint.x, centerPoint.y, rotationAngle);
      mapStartX = invertedStart.x;
      mapStartY = invertedStart.y;
    }

    drawingsCtx.strokeStyle = finalColor;
    drawingsCtx.fillStyle = finalColor;
    drawingsCtx.lineWidth = lineWidth;
    drawingsCtx.lineCap = 'round';
    drawingsCtx.lineJoin = 'round';

    if (currentTool === 'line') {
      const dashPattern = getLineDashPattern(lineStyle);
      drawingsCtx.setLineDash(dashPattern);
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(mapStartX, mapStartY);
      drawingsCtx.lineTo(mapX, mapY);
      drawingsCtx.stroke();
      drawingsCtx.setLineDash([]);
    } else if (currentTool === 'rectangle') {
      const dashPattern = getLineDashPattern(rectangleStyle);
      drawingsCtx.setLineDash(dashPattern);
      drawingsCtx.beginPath();
      drawingsCtx.rect(mapStartX, mapStartY, mapX - mapStartX, mapY - mapStartY);
      drawingsCtx.stroke();
      drawingsCtx.setLineDash([]);
    } else if (currentTool === 'circle') {
      const radius = Math.hypot(mapX - mapStartX, mapY - mapStartY);
      drawingsCtx.beginPath();
      drawingsCtx.arc(mapStartX, mapStartY, radius, 0, Math.PI * 2);
      drawingsCtx.stroke();
    }

    setIsDrawing(false);
    clearPreview(geoId);

    // Redraw GeoJSON to composite drawings on top
    drawGeoJSON(geoId, null, true);
    saveDrawingState(geoId);
  }, [activeGeoId, isDrawing, mode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, startPos, saveDrawingState, clearPreview, drawGeoJSON]);

  // Handle double click for polygon
  const handleDoubleClick = useCallback((geoId) => {
    if (geoId !== activeGeoId) return;
    if ((currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[geoId]?.length > 2) {
      completePolygon(geoId);
    }
  }, [activeGeoId, currentTool, polygonPoints]);

  // Complete polygon
  const completePolygon = useCallback((geoId) => {
    const points = polygonPoints[geoId];
    if (!points || points.length < 2) return;

    const drawingsCanvas = drawingsCanvasRefs.current[geoId];
    const canvas = canvasRefs.current[geoId];
    if (!drawingsCanvas || !canvas) return;

    const rotationAngle = rotationAngles[geoId] || 0;
    const centerPoint = centerPoints[geoId];

    // Convert points to map space
    const mapPoints = points.map(p => {
      if (rotationAngle !== 0 && centerPoint) {
        return inverseRotatePoint(p.x, p.y, centerPoint.x, centerPoint.y, rotationAngle);
      }
      return p;
    });

    // Store vector data for export
    const latLonPoints = mapPoints.map(p => canvasToLatLonState(p.x, p.y, bounds[geoId], canvas));

    const newShape = {
      id: generateRandomCode(),
      type: 'polygon',
      points: latLonPoints,
      color: drawingColor,
      width: lineWidth,
      style: 'solid'
    };

    setDrawnShapes(prev => ({
      ...prev,
      [geoId]: [...(prev[geoId] || []), newShape]
    }));

    const drawingsCtx = drawingsCanvas.getContext('2d');
    drawingsCtx.strokeStyle = drawingColor;
    drawingsCtx.lineWidth = lineWidth;

    // Draw all polygon segments
    for (let i = 1; i < mapPoints.length; i++) {
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(mapPoints[i - 1].x, mapPoints[i - 1].y);
      drawingsCtx.lineTo(mapPoints[i].x, mapPoints[i].y);
      drawingsCtx.stroke();
    }

    if (currentTool === 'closedPolygon') {
      const first = mapPoints[0];
      const last = mapPoints[mapPoints.length - 1];
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(last.x, last.y);
      drawingsCtx.lineTo(first.x, first.y);
      drawingsCtx.stroke();
    }

    setPolygonPoints(prev => ({ ...prev, [geoId]: [] }));
    clearPreview(geoId);
    // Redraw to show new vector shape (and clear raster if we switch to full vector rendering)
    // Note: Currently we draw raster AND store vector. 
    // Ideally we should switch to purely vector rendering in drawGeoJSON for these shapes.
    // But for now, let's ensure vector data is stored for export.
    requestAnimationFrame(() => drawGeoJSON(geoId, null, true));
    saveDrawingState(geoId);
  }, [currentTool, drawingColor, lineWidth, polygonPoints, clearPreview, drawGeoJSON, saveDrawingState, rotationAngles, centerPoints, bounds]);

  // Handle ESC key for polygon
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && (currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[activeGeoId]?.length > 1) {
        completePolygon(activeGeoId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTool, polygonPoints, activeGeoId, completePolygon]);

  // Handle text input blur
  const handleTextInputBlur = useCallback((geoId, x, y) => {
    const textInput = textInputRefs.current[geoId];
    const textInputBox = textInputBoxRefs.current[geoId];
    if (!textInput || !textInputBox) return;

    const value = textInput.value.trim();
    if (value) {
      const drawingsCanvas = drawingsCanvasRefs.current[geoId];
      if (drawingsCanvas) {
        const rotationAngle = rotationAngles[geoId] || 0;
        const centerPoint = centerPoints[geoId];

        let mapX = x;
        let mapY = y;

        if (rotationAngle !== 0 && centerPoint) {
          const inverted = inverseRotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
          mapX = inverted.x;
          mapY = inverted.y;
        }

        const drawingsCtx = drawingsCanvas.getContext('2d');
        drawingsCtx.fillStyle = drawingColor;
        drawingsCtx.font = `${lineWidth * 8}px Arial`;
        drawingsCtx.fillText(value, mapX, mapY + lineWidth * 8);
        drawGeoJSON(geoId, null, true);
        saveDrawingState(geoId);
      }
    }
    textInputBox.style.display = 'none';
  }, [drawingColor, lineWidth, drawGeoJSON, saveDrawingState, rotationAngles, centerPoints]);

  // Handle rotation change
  const handleRotationChange = useCallback((geoId, angle) => {
    setRotationAngles(prev => {
      const previousAngle = prev[geoId] || 0;
      setTimeout(() => drawGeoJSON(geoId, null, true, previousAngle, angle), 0);
      return { ...prev, [geoId]: angle };
    });
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

        setTimeout(() => drawGeoJSON(geoId, null, true), 0);
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

        // Add drawn vector shapes
        (drawnShapes[geoId] || []).forEach(shape => {
          let geometry;
          let properties = {
            mode: "draw",
            shapeType: shape.type,
            color: shape.color,
            width: shape.width,
            style: shape.style,
            isCustomShape: true
          };

          if (shape.type === 'line') {
            geometry = {
              type: "LineString",
              coordinates: [
                [shape.start.lon, shape.start.lat],
                [shape.end.lon, shape.end.lat]
              ]
            };
          } else if (shape.type === 'rectangle') {
            // GeoJSON Polygon for rectangle (closed loop)
            // Need to calculate 4 corners
            // We have start (top-left usually) and end (bottom-right)
            // But in lat/lon, it depends.
            // Let's assume start and end are diagonal corners.
            const minLon = Math.min(shape.start.lon, shape.end.lon);
            const maxLon = Math.max(shape.start.lon, shape.end.lon);
            const minLat = Math.min(shape.start.lat, shape.end.lat);
            const maxLat = Math.max(shape.start.lat, shape.end.lat);

            geometry = {
              type: "Polygon",
              coordinates: [[
                [minLon, maxLat], // Top-left
                [maxLon, maxLat], // Top-right
                [maxLon, minLat], // Bottom-right
                [minLon, minLat], // Bottom-left
                [minLon, maxLat]  // Close loop
              ]]
            };
          } else if (shape.type === 'circle') {
            geometry = {
              type: "Point",
              coordinates: [shape.center.lon, shape.center.lat]
            };
            properties.radius = shape.radius;
            properties.subType = "Circle";
          } else if (shape.type === 'polygon') {
            geometry = {
              type: "Polygon",
              coordinates: [
                [
                  ...shape.points.map(p => [p.lon, p.lat]),
                  [shape.points[0].lon, shape.points[0].lat] // Close loop
                ]
              ]
            };
          }

          if (geometry) {
            viewData.features.push({
              id: shape.id,
              type: "Feature",
              geometry,
              properties
            });
          }
        });

        return viewData;
      })
    };

    if (onExport) {
      onExport(exportData);
    }

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

    if (!onExport) {
      alert('GeoJSON exported successfully!');
    }
  }, [geojsonData, customPins, annotations, rotationAngles, drawnShapes, onExport]);

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

  // Initialize canvas for drawing
  useEffect(() => {
    [1, 2].forEach(geoId => {
      const canvas = canvasRefs.current[geoId];
      if (!canvas || initializedCanvases.has(geoId)) return;

      // Initialize drawings canvas (separate layer for custom drawings)
      if (!drawingsCanvasRefs.current[geoId] && canvas.parentElement) {
        const newDrawingsCanvas = document.createElement('canvas');
        newDrawingsCanvas.width = canvas.width;
        newDrawingsCanvas.height = canvas.height;
        newDrawingsCanvas.style.position = 'absolute';
        newDrawingsCanvas.style.left = '0';
        newDrawingsCanvas.style.top = '0';
        newDrawingsCanvas.style.pointerEvents = 'none';
        newDrawingsCanvas.style.border = 'none';
        newDrawingsCanvas.style.backgroundColor = 'transparent';
        newDrawingsCanvas.style.zIndex = '5';
        newDrawingsCanvas.style.display = 'none';
        newDrawingsCanvas.className = 'drawings-layer';
        canvas.parentElement.appendChild(newDrawingsCanvas);
        drawingsCanvasRefs.current[geoId] = newDrawingsCanvas;

        // Initialize with transparent background (no fill needed for transparent canvas)
      }

      // Initialize preview canvas
      const previewCanvas = previewCanvasRefs.current[geoId];
      if (!previewCanvas && canvas.parentElement) {
        const newPreview = document.createElement('canvas');
        newPreview.width = canvas.width;
        newPreview.height = canvas.height;
        newPreview.style.position = 'absolute';
        newPreview.style.left = '0';
        newPreview.style.top = '0';
        newPreview.style.pointerEvents = 'none';
        newPreview.style.border = 'none';
        newPreview.style.backgroundColor = 'transparent';
        newPreview.style.zIndex = '10';
        newPreview.style.display = 'block';
        newPreview.className = 'preview-layer';
        canvas.parentElement.appendChild(newPreview);
        previewCanvasRefs.current[geoId] = newPreview;
      }

      setInitializedCanvases(prev => new Set([...prev, geoId]));
    });
  }, [initializedCanvases]);

  // Tool selection
  const handleToolSelect = (tool) => {
    if (tool === 'undo') {
      undoDrawing();
      return;
    }
    if (tool === 'redo') {
      redoDrawing();
      return;
    }

    setMode('draw');
    setCurrentTool(tool);
    setPolygonPoints(prev => ({ ...prev, [activeGeoId]: [] }));

    const textInputBox = textInputBoxRefs.current[activeGeoId];
    if (textInputBox) textInputBox.style.display = 'none';
    clearPreview(activeGeoId);

    if (tool === 'closedPolygon' || tool === 'openPolygon') {
      setShowPolygonHint(true);
    } else {
      setShowPolygonHint(false);
    }
  };

  const updateStyleButtonText = () => {
    const lineStyleText = lineStyle.charAt(0).toUpperCase() + lineStyle.slice(1);
    const rectStyleText = rectangleStyle.charAt(0).toUpperCase() + rectangleStyle.slice(1);
    return `⚙️ Line: ${lineStyleText} | Rect: ${rectStyleText}`;
  };

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
                  onMouseDown={(e) => handleMouseDown(e, geoId)}
                  onMouseMove={(e) => handleMouseMove(e, geoId)}
                  onMouseUp={(e) => handleMouseUp(e, geoId)}
                  onMouseLeave={() => {
                    clearPreview(geoId);
                    const eraserCursor = eraserCursorRefs.current[geoId];
                    if (eraserCursor) eraserCursor.style.display = 'none';
                    setIsDrawing(false);
                  }}
                  onDoubleClick={() => handleDoubleClick(geoId)}
                  style={{ cursor: mode === 'select' ? 'pointer' : mode === 'add' ? 'crosshair' : mode === 'draw' ? 'crosshair' : 'text' }}
                />
                <div
                  ref={el => eraserCursorRefs.current[geoId] = el}
                  className={`eraser-cursor ${eraserType}`}
                />
                <div
                  ref={el => textInputBoxRefs.current[geoId] = el}
                  className="text-input-box"
                >
                  <input
                    ref={el => textInputRefs.current[geoId] = el}
                    type="text"
                    placeholder="Type text here..."
                    onBlur={() => handleTextInputBlur(geoId, startPos.x, startPos.y)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleTextInputBlur(geoId, startPos.x, startPos.y);
                      }
                    }}
                  />
                </div>
                <div ref={el => labelsContainerRefs.current[geoId] = el} id={`labels${geoId}`} />
                <div ref={el => annotationsContainerRefs.current[geoId] = el} id={`annotations${geoId}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Drawing Tools - Always visible */}
        <div className="drawing-tools">
          <button
            className={`tool-btn ${currentTool === 'pencil' ? 'active' : ''}`}
            onClick={() => handleToolSelect('pencil')}
          >
            ✏️ Pencil
          </button>
          <button
            className={`tool-btn ${currentTool === 'line' ? 'active' : ''}`}
            onClick={() => handleToolSelect('line')}
          >
            📏 Line
          </button>
          <button
            className={`tool-btn ${currentTool === 'rectangle' ? 'active' : ''}`}
            onClick={() => handleToolSelect('rectangle')}
          >
            ▭ Rectangle
          </button>
          <button
            className={`tool-btn ${currentTool === 'circle' ? 'active' : ''}`}
            onClick={() => handleToolSelect('circle')}
          >
            ⭕ Circle
          </button>
          <button
            className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
            onClick={() => handleToolSelect('eraser')}
          >
            🧹 Eraser
          </button>
          <button
            className={`tool-btn ${currentTool === 'closedPolygon' ? 'active' : ''}`}
            onClick={() => handleToolSelect('closedPolygon')}
          >
            ⬡ Closed Polygon
          </button>
          <button
            className={`tool-btn ${currentTool === 'openPolygon' ? 'active' : ''}`}
            onClick={() => handleToolSelect('openPolygon')}
          >
            ⚊ Open Polygon
          </button>
          <button
            className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`}
            onClick={() => handleToolSelect('text')}
          >
            📝 Text
          </button>
          <button
            className="tool-btn"
            onClick={undoDrawing}
            disabled={(drawingHistory[activeGeoId] || []).length <= 1}
            style={{
              background: (drawingHistory[activeGeoId] || []).length > 1 ? '#fff3cd' : '#e0e0e0',
              borderColor: (drawingHistory[activeGeoId] || []).length > 1 ? '#ffc107' : '#ccc',
              cursor: (drawingHistory[activeGeoId] || []).length > 1 ? 'pointer' : 'not-allowed',
              opacity: (drawingHistory[activeGeoId] || []).length > 1 ? 1 : 0.6
            }}
            title="Undo last action"
          >
            ↶ Undo
          </button>
          <button
            className="tool-btn"
            onClick={redoDrawing}
            disabled={!(redoHistory[activeGeoId] || []).length}
            style={{
              background: (redoHistory[activeGeoId] || []).length > 0 ? '#d1ecf1' : '#e0e0e0',
              borderColor: (redoHistory[activeGeoId] || []).length > 0 ? '#17a2b8' : '#ccc',
              cursor: (redoHistory[activeGeoId] || []).length > 0 ? 'pointer' : 'not-allowed',
              opacity: (redoHistory[activeGeoId] || []).length > 0 ? 1 : 0.6
            }}
            title="Redo last undone action"
          >
            ↷ Redo
          </button>

          <div className="style-selector-container">
            <button
              className="tool-btn"
              onClick={() => setShowStyleDropdown(!showStyleDropdown)}
            >
              {updateStyleButtonText()}
            </button>
            {showStyleDropdown && (
              <div className="style-selector-dropdown show">
                <div className="style-option-group">
                  <label>Line Style:</label>
                  <div className="style-options">
                    {['solid', 'dashed', 'dotted'].map(style => (
                      <div
                        key={style}
                        className={`style-option ${lineStyle === style ? 'active' : ''}`}
                        onClick={() => {
                          setLineStyle(style);
                          setShowStyleDropdown(false);
                        }}
                      >
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="style-option-group">
                  <label>Rectangle Style:</label>
                  <div className="style-options">
                    {['solid', 'dotted'].map(style => (
                      <div
                        key={style}
                        className={`style-option ${rectangleStyle === style ? 'active' : ''}`}
                        onClick={() => {
                          setRectangleStyle(style);
                          setShowStyleDropdown(false);
                        }}
                      >
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="color-picker-container">
            <label>Color:</label>
            <input
              type="color"
              value={drawingColor}
              onChange={(e) => setDrawingColor(e.target.value)}
            />
          </div>
          <div className="color-picker-container">
            <label>Width:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value, 10))}
              style={{ width: '80px' }}
            />
          </div>
          {currentTool === 'eraser' && (
            <>
              <div className="color-picker-container">
                <label>Eraser:</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(parseInt(e.target.value, 10))}
                  style={{ width: '80px' }}
                />
              </div>
              <div className="color-picker-container">
                <label>Shape:</label>
                <select
                  value={eraserType}
                  onChange={(e) => setEraserType(e.target.value)}
                  style={{ width: '90px', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {showPolygonHint && (
        <div className="polygon-hint show">
          Click to add points. Press <strong>ESC</strong> to finish or <strong>Double-click</strong> to complete polygon.
        </div>
      )}

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

