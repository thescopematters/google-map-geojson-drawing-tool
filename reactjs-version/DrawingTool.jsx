import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { getLineDashPattern, generateRandomCode, getCanvasCoordinates, rotatePoint, inverseRotatePoint } from './drawingUtils';
import GeoJSONView from './GeoJSONView';
import './DrawingTool.css';

const DrawingTool = ({
  initialGeoJSON = null,
  onExport = null,
  canvasWidth = 1000,
  canvasHeight = 700,
  showGeoView = true,
  showDrawingView = true
}) => {
  // View state
  const [currentView, setCurrentView] = useState(showGeoView ? 'geo' : 'drawing'); // 'geo' or 'drawing'
  const [activeCanvasId, setActiveCanvasId] = useState(1);
  const [rotationAngles, setRotationAngles] = useState({ 1: 0, 2: 0 });

  // Drawing state
  const [currentTool, setCurrentTool] = useState('pencil');
  const [drawMode, setDrawMode] = useState('draw'); // 'draw', 'select', 'addPin', 'annotate'
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState('solid');
  const [rectangleStyle, setRectangleStyle] = useState('solid');
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserType, setEraserType] = useState('circle');
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);

  // Canvas refs
  const canvasRefs = useRef({});
  const drawingsCanvasRefs = useRef({}); // Backing store for unrotated drawings
  const previewCanvasRefs = useRef({});
  const eraserCursorRefs = useRef({});
  const textInputBoxRefs = useRef({});
  const textInputRefs = useRef({});
  const labelsContainerRefs = useRef({});
  const annotationsContainerRefs = useRef({});

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [drawingHistory, setDrawingHistory] = useState({});
  const [redoHistory, setRedoHistory] = useState({});
  const [customPins, setCustomPins] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [showPolygonHint, setShowPolygonHint] = useState(false);
  const [initializedCanvases, setInitializedCanvases] = useState(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Custom Text');
  const [modalText, setModalText] = useState('');
  const [modalType, setModalType] = useState('text'); // 'text' or 'termite'
  const [modalData, setModalData] = useState(null);

  // Save drawing state for undo - defined early so it can be used in useEffect
  const saveDrawingState = useCallback((canvasId) => {
    const drawingsCanvas = drawingsCanvasRefs.current[canvasId];
    if (!drawingsCanvas) return;

    const ctx = drawingsCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, drawingsCanvas.width, drawingsCanvas.height);

    // When saving a new state, clear redo history (can't redo after new action)
    setRedoHistory(prev => ({
      ...prev,
      [canvasId]: []
    }));

    setDrawingHistory(prev => ({
      ...prev,
      [canvasId]: [...(prev[canvasId] || []), imageData].slice(-50) // Keep last 50 states
    }));
  }, []);

  // Draw pins on canvas - defined early so it can be used in useEffect
  const drawPinsOnCanvas = useCallback((canvasId, overrideRotation = null) => {
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const pins = customPins[canvasId] || [];
    const rotation = overrideRotation !== null ? overrideRotation : (rotationAngles[canvasId] || 0);
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    pins.forEach(pin => {
      let x = pin.x;
      let y = pin.y;

      if (rotation !== 0) {
        const rotated = rotatePoint(x, y, center.x, center.y, rotation);
        x = rotated.x;
        y = rotated.y;
      }

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34a853';
      ctx.fill();
      ctx.strokeStyle = '#1e8e3e';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [customPins, rotationAngles]);

  // Redraw canvas with rotation
  const redrawCanvas = useCallback((canvasId, overrideRotation = null) => {
    const canvas = canvasRefs.current[canvasId];
    const drawingsCanvas = drawingsCanvasRefs.current[canvasId];
    if (!canvas || !drawingsCanvas) return;

    const ctx = canvas.getContext('2d');
    const rotation = overrideRotation !== null ? overrideRotation : (rotationAngles[canvasId] || 0);
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw rotated drawings
    ctx.save();
    if (rotation !== 0) {
      ctx.translate(center.x, center.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-center.x, -center.y);
    }
    ctx.drawImage(drawingsCanvas, 0, 0);
    ctx.restore();

    // Draw pins on top
    drawPinsOnCanvas(canvasId, rotation);
  }, [rotationAngles, drawPinsOnCanvas]);

  // Render labels - defined early so it can be used in useEffect
  const renderLabels = useCallback((canvasId) => {
    const container = labelsContainerRefs.current[canvasId];
    const canvas = canvasRefs.current[canvasId];
    if (!container || !canvas) return;

    const pins = customPins[canvasId] || [];
    const rotation = rotationAngles[canvasId] || 0;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    container.innerHTML = '';

    pins.forEach(pin => {
      if (pin.text) {
        let x = pin.x;
        let y = pin.y;

        if (rotation !== 0) {
          const rotated = rotatePoint(x, y, center.x, center.y, rotation);
          x = rotated.x;
          y = rotated.y;
        }

        const label = document.createElement('div');
        label.className = 'point-label';
        label.textContent = pin.text;
        label.style.left = (x + 10) + 'px';
        label.style.top = (y - 10) + 'px';
        container.appendChild(label);
      }
    });
  }, [customPins, rotationAngles]);

  // Render annotations - defined early so it can be used in useEffect
  const renderAnnotations = useCallback((canvasId) => {
    const container = annotationsContainerRefs.current[canvasId];
    const canvas = canvasRefs.current[canvasId];
    if (!container || !canvas) return;

    const anns = annotations[canvasId] || [];
    const rotation = rotationAngles[canvasId] || 0;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    container.innerHTML = '';

    anns.forEach((annotation, idx) => {
      let x = annotation.x;
      let y = annotation.y;

      if (rotation !== 0) {
        const rotated = rotatePoint(x, y, center.x, center.y, rotation);
        x = rotated.x;
        y = rotated.y;
      }

      const label = document.createElement('div');
      label.className = 'annotation';
      label.textContent = annotation.text;
      label.style.left = x + 'px';
      label.style.top = y + 'px';
      label.style.transform = 'translate(-50%, -50%)';
      label.style.background = 'rgba(251, 188, 4, 0.95)';
      label.style.cursor = drawMode === 'select' ? 'pointer' : 'default';
      label.style.pointerEvents = drawMode === 'select' ? 'auto' : 'none';

      if (drawMode === 'select') {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          setModalTitle('Edit Annotation');
          setModalType('text');
          setModalText(annotation.text);
          setModalData({ canvasId, annotationIndex: idx });
          setShowModal(true);
        });
      }

      container.appendChild(label);
    });
  }, [annotations, drawMode, rotationAngles]);

  // Initialize canvas - only once per canvas, don't clear on tab switch
  useEffect(() => {
    [1, 2].forEach(canvasId => {
      const canvas = canvasRefs.current[canvasId];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // Initialize drawings canvas (backing store)
      if (!drawingsCanvasRefs.current[canvasId] && canvas.parentElement) {
        const newDrawingsCanvas = document.createElement('canvas');
        newDrawingsCanvas.width = canvas.width;
        newDrawingsCanvas.height = canvas.height;
        newDrawingsCanvas.style.display = 'none'; // Hidden backing store
        canvas.parentElement.appendChild(newDrawingsCanvas);
        drawingsCanvasRefs.current[canvasId] = newDrawingsCanvas;

        // Initialize with white background
        const dCtx = newDrawingsCanvas.getContext('2d');
        dCtx.fillStyle = 'white';
        dCtx.fillRect(0, 0, newDrawingsCanvas.width, newDrawingsCanvas.height);
      }

      // Check if canvas already has content by checking a sample
      const testImageData = ctx.getImageData(0, 0, 1, 1);
      const hasContent = testImageData.data[0] !== 255 || testImageData.data[1] !== 255 || testImageData.data[2] !== 255;

      // Only initialize with white if canvas is truly empty
      if (!hasContent) {
        // Check more thoroughly - sample multiple points
        const samplePoints = [
          [0, 0], [canvas.width - 1, 0], [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
          [Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)]
        ];
        let trulyEmpty = true;
        for (const [x, y] of samplePoints) {
          const pixel = ctx.getImageData(x, y, 1, 1);
          if (pixel.data[0] !== 255 || pixel.data[1] !== 255 || pixel.data[2] !== 255) {
            trulyEmpty = false;
            break;
          }
        }

        if (trulyEmpty) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          saveDrawingState(canvasId);
        }
      }

      // Initialize preview canvas
      const previewCanvas = previewCanvasRefs.current[canvasId];
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
        previewCanvasRefs.current[canvasId] = newPreview;
      }

      setInitializedCanvases(prev => new Set([...prev, canvasId]));
    });
  }, [initializedCanvases, saveDrawingState]);

  // Restore canvas state when switching tabs - restore from history if available
  useEffect(() => {
    if (!initializedCanvases.has(activeCanvasId)) return;

    const canvas = canvasRefs.current[activeCanvasId];
    if (!canvas) return;

    // Restore canvas from history if it exists
    const history = drawingHistory[activeCanvasId];
    if (history && history.length > 0) {
      const ctx = canvas.getContext('2d');
      const lastState = history[history.length - 1];

      // Restore backing store state if needed (though it should persist)
      // If drawingsCanvas was somehow reset or we are undoing/redoing, we need to ensure it matches history.
      // But here we are just switching tabs. drawingsCanvas persists.
      // However, to be safe and consistent with Undo/Redo, we should restore history to drawingsCanvas.
      const drawingsCanvas = drawingsCanvasRefs.current[activeCanvasId];
      if (drawingsCanvas) {
        const dCtx = drawingsCanvas.getContext('2d');
        dCtx.putImageData(lastState, 0, 0);
      }

      // Use requestAnimationFrame to ensure canvas is ready
      requestAnimationFrame(() => {
        redrawCanvas(activeCanvasId);
      });
    } else {
      // If no history, save current state (canvas might already have content)
      // This preserves any drawings that were made before history was saved
      const ctx = canvas.getContext('2d');
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check if canvas has any non-white content
      let hasContent = false;
      for (let i = 0; i < currentImageData.data.length; i += 4) {
        if (currentImageData.data[i] !== 255 || currentImageData.data[i + 1] !== 255 || currentImageData.data[i + 2] !== 255) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        // Save the existing content to history
        saveDrawingState(activeCanvasId);
      }
    }

    // Clear redo history when switching tabs (can't redo across tabs)
    setRedoHistory(prev => ({
      ...prev,
      [activeCanvasId]: []
    }));

    // Re-render labels and annotations for the active canvas
    renderLabels(activeCanvasId);
    renderAnnotations(activeCanvasId);
  }, [activeCanvasId, drawingHistory, drawPinsOnCanvas, renderLabels, renderAnnotations, initializedCanvases, saveDrawingState]);

  // Undo drawing
  const undoDrawing = useCallback(() => {
    const canvas = canvasRefs.current[activeCanvasId];
    const drawingsCanvas = drawingsCanvasRefs.current[activeCanvasId];
    if (!canvas || !drawingsCanvas) return;

    // Use functional updates to get the latest state
    setDrawingHistory(prev => {
      const history = prev[activeCanvasId] || [];
      if (history.length <= 1) return prev; // Can't undo if only initial state

      const ctx = drawingsCanvas.getContext('2d');

      // Get current state (last in history) and move it to redo stack
      const currentState = history[history.length - 1];
      const previousState = history[history.length - 2];

      // Restore previous state immediately to backing store
      ctx.putImageData(previousState, 0, 0);

      // Add current state to redo stack
      setRedoHistory(redoPrev => ({
        ...redoPrev,
        [activeCanvasId]: [...(redoPrev[activeCanvasId] || []), currentState]
      }));

      // Redraw canvas with rotation and pins
      setTimeout(() => {
        redrawCanvas(activeCanvasId);
        renderLabels(activeCanvasId);
        renderAnnotations(activeCanvasId);
      }, 0);

      // Return updated history (remove last state)
      return {
        ...prev,
        [activeCanvasId]: history.slice(0, -1)
      };
    });
  }, [activeCanvasId, redrawCanvas, renderLabels, renderAnnotations]);

  // Redo drawing
  const redoDrawing = useCallback(() => {
    const canvas = canvasRefs.current[activeCanvasId];
    const drawingsCanvas = drawingsCanvasRefs.current[activeCanvasId];
    if (!canvas || !drawingsCanvas) return;

    // Use functional updates to get the latest state
    setRedoHistory(prev => {
      const redoStack = prev[activeCanvasId] || [];
      if (redoStack.length === 0) return prev; // Nothing to redo

      const ctx = drawingsCanvas.getContext('2d');

      // Get the state to redo (last in redo stack)
      const stateToRedo = redoStack[redoStack.length - 1];

      // Restore the state immediately to backing store
      ctx.putImageData(stateToRedo, 0, 0);

      // Add back to history
      setDrawingHistory(historyPrev => ({
        ...historyPrev,
        [activeCanvasId]: [...(historyPrev[activeCanvasId] || []), stateToRedo]
      }));

      // Redraw canvas with rotation and pins
      setTimeout(() => {
        redrawCanvas(activeCanvasId);
        renderLabels(activeCanvasId);
        renderAnnotations(activeCanvasId);
      }, 0);

      // Return updated redo stack (remove last state)
      return {
        ...prev,
        [activeCanvasId]: redoStack.slice(0, -1)
      };
    });
  }, [activeCanvasId, redrawCanvas, renderLabels, renderAnnotations]);

  // Clear preview
  const clearPreview = useCallback((canvasId) => {
    const previewCanvas = previewCanvasRefs.current[canvasId];
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  }, []);

  // Ensure drawings canvas exists
  const ensureDrawingsCanvas = useCallback((canvasId) => {
    const canvas = canvasRefs.current[canvasId];
    if (!canvas || !canvas.parentElement) return null;

    if (!drawingsCanvasRefs.current[canvasId]) {
      const newDrawingsCanvas = document.createElement('canvas');
      newDrawingsCanvas.width = canvas.width;
      newDrawingsCanvas.height = canvas.height;
      newDrawingsCanvas.style.display = 'none'; // Hidden backing store
      canvas.parentElement.appendChild(newDrawingsCanvas);
      drawingsCanvasRefs.current[canvasId] = newDrawingsCanvas;

      // Initialize with white background
      const dCtx = newDrawingsCanvas.getContext('2d');
      dCtx.fillStyle = 'white';
      dCtx.fillRect(0, 0, newDrawingsCanvas.width, newDrawingsCanvas.height);
    }

    return drawingsCanvasRefs.current[canvasId];
  }, [drawingsCanvasRefs]);

  // Handle mouse down
  const handleMouseDown = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId) return;

    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;

    // Ensure drawings canvas exists
    ensureDrawingsCanvas(canvasId);

    const { x, y } = getCanvasCoordinates(e, canvas);
    setStartPos({ x, y });

    const rotation = rotationAngles[canvasId] || 0;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    let mapX = x;
    let mapY = y;

    if (rotation !== 0) {
      const inverted = inverseRotatePoint(x, y, center.x, center.y, rotation);
      mapX = inverted.x;
      mapY = inverted.y;
    }

    if (drawMode === 'select') {
      // Handle pin selection
      const pins = customPins[canvasId] || [];
      pins.forEach((pin, idx) => {
        // Check distance in Map Space
        const distance = Math.hypot(mapX - pin.x, mapY - pin.y);
        if (distance <= 8) {
          setModalTitle('Select Termite Type');
          setModalType('termite');
          setModalData({ canvasId, pinIndex: idx, pin });
          setShowModal(true);
        }
      });
      return;
    }

    if (drawMode === 'addPin') {
      const newPin = {
        id: 'draw-pin-' + Date.now(),
        x: mapX,
        y: mapY,
        text: ''
      };

      // Update state
      setCustomPins(prev => ({
        ...prev,
        [canvasId]: [...(prev[canvasId] || []), newPin]
      }));

      // Redraw canvas to show new pin
      setTimeout(() => {
        redrawCanvas(canvasId);
        renderLabels(canvasId);
      }, 0);

      saveDrawingState(canvasId);
      return;
    }

    if (drawMode === 'annotate') {
      setModalTitle('Add Annotation');
      setModalType('text');
      setModalText('');
      setModalData({ canvasId, x: mapX, y: mapY });
      setShowModal(true);
      return;
    }

    if (currentTool === 'text') {
      const textInputBox = textInputBoxRefs.current[canvasId];
      const textInput = textInputRefs.current[canvasId];
      if (textInputBox && textInput && canvas) {
        // Position text input box at click location (Screen Space)
        textInputBox.style.display = 'block';
        textInputBox.style.left = x + 'px';
        textInputBox.style.top = y + 'px';
        textInput.value = '';
        textInputBox.style.zIndex = '1000';
        // Use setTimeout to ensure the input is visible and positioned before focusing
        setTimeout(() => {
          textInput.focus();
          textInput.select();
        }, 10);
      }
      return;
    }

    if (currentTool === 'closedPolygon' || currentTool === 'openPolygon') {
      const ctx = canvas.getContext('2d');
      // Store points in Map Space
      const newPoints = [...(polygonPoints[canvasId] || []), { x: mapX, y: mapY }];
      setPolygonPoints(prev => ({ ...prev, [canvasId]: newPoints }));

      // Draw visual feedback in Screen Space
      ctx.fillStyle = drawingColor;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      if (newPoints.length > 1) {
        // Get previous point (Map Space) and rotate to Screen Space for drawing
        const prevMap = newPoints[newPoints.length - 2];
        let prevScreenX = prevMap.x;
        let prevScreenY = prevMap.y;

        if (rotation !== 0) {
          const rotated = rotatePoint(prevMap.x, prevMap.y, center.x, center.y, rotation);
          prevScreenX = rotated.x;
          prevScreenY = rotated.y;
        }

        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(prevScreenX, prevScreenY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      return;
    }

    setIsDrawing(true);
  }, [activeCanvasId, drawMode, currentTool, drawingColor, lineWidth, polygonPoints, customPins, renderLabels, rotationAngles, redrawCanvas, saveDrawingState, ensureDrawingsCanvas]);

  // Handle mouse move
  const handleMouseMove = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId) return;

    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e, canvas);

    const rotation = rotationAngles[canvasId] || 0;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    let mapX = x;
    let mapY = y;
    let mapStartX = startPos.x;
    let mapStartY = startPos.y;

    if (rotation !== 0) {
      const inverted = inverseRotatePoint(x, y, center.x, center.y, rotation);
      mapX = inverted.x;
      mapY = inverted.y;

      const invertedStart = inverseRotatePoint(startPos.x, startPos.y, center.x, center.y, rotation);
      mapStartX = invertedStart.x;
      mapStartY = invertedStart.y;
    }

    // Eraser cursor
    if (currentTool === 'eraser' && drawMode === 'draw') {
      const eraserCursor = eraserCursorRefs.current[canvasId];
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
      if (currentTool === 'closedPolygon' || currentTool === 'openPolygon') {
        // Ensure preview canvas exists
        let previewCanvas = previewCanvasRefs.current[canvasId];
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
          previewCanvasRefs.current[canvasId] = newPreview;
          previewCanvas = newPreview;
        }

        if (previewCanvas && polygonPoints[canvasId]?.length > 0) {
          const ctx = previewCanvas.getContext('2d');
          ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

          // Get last point (Map Space) and rotate to Screen Space
          const lastPointMap = polygonPoints[canvasId][polygonPoints[canvasId].length - 1];
          let lastPointScreenX = lastPointMap.x;
          let lastPointScreenY = lastPointMap.y;

          if (rotation !== 0) {
            const rotated = rotatePoint(lastPointMap.x, lastPointMap.y, center.x, center.y, rotation);
            lastPointScreenX = rotated.x;
            lastPointScreenY = rotated.y;
          }

          // Draw dashed guideline from last point to current mouse position
          ctx.strokeStyle = drawingColor;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([5, 5]);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(lastPointScreenX, lastPointScreenY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // For closed polygon, also show preview line to first point if there are enough points
          if (currentTool === 'closedPolygon' && polygonPoints[canvasId].length > 2) {
            const firstPointMap = polygonPoints[canvasId][0];
            let firstPointScreenX = firstPointMap.x;
            let firstPointScreenY = firstPointMap.y;

            if (rotation !== 0) {
              const rotated = rotatePoint(firstPointMap.x, firstPointMap.y, center.x, center.y, rotation);
              firstPointScreenX = rotated.x;
              firstPointScreenY = rotated.y;
            }

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(firstPointScreenX, firstPointScreenY);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else if (previewCanvas) {
          // Clear preview if no points yet
          const ctx = previewCanvas.getContext('2d');
          ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
      }
      return;
    }

    if (drawMode !== 'draw') return;

    const previewCanvas = previewCanvasRefs.current[canvasId];
    const ctx = canvas.getContext('2d');
    const drawingsCanvas = drawingsCanvasRefs.current[canvasId];
    const drawingsCtx = drawingsCanvas ? drawingsCanvas.getContext('2d') : null;

    if (currentTool === 'pencil' && drawingsCtx) {
      // Pencil draws to drawingsCanvas (Map Space)
      drawingsCtx.strokeStyle = drawingColor;
      drawingsCtx.lineWidth = lineWidth;
      drawingsCtx.lineCap = 'round';
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(mapStartX, mapStartY);
      drawingsCtx.lineTo(mapX, mapY);
      drawingsCtx.stroke();

      setStartPos({ x, y });

      // Also draw to main canvas (Screen Space) for immediate feedback
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentTool === 'eraser' && drawingsCtx) {
      // Eraser clears drawingsCanvas (Map Space)
      if (eraserType === 'circle') {
        drawingsCtx.save();
        drawingsCtx.globalCompositeOperation = 'destination-out';
        drawingsCtx.beginPath();
        drawingsCtx.arc(mapX, mapY, eraserSize / 2, 0, Math.PI * 2);
        drawingsCtx.fill();
        drawingsCtx.restore();

        // Also clear main canvas (Screen Space)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawingsCtx.clearRect(mapX - eraserSize / 2, mapY - eraserSize / 2, eraserSize, eraserSize);
        // Also clear main canvas (Screen Space)
        ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
      }
    } else if (isDrawing && (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
      // For line, rectangle, circle - show preview while dragging (Screen Space)
      // Ensure preview canvas exists
      let previewCanvas = previewCanvasRefs.current[canvasId];
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
        previewCanvasRefs.current[canvasId] = newPreview;
        previewCanvas = newPreview;
      }

      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        // Clear previous preview
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Draw preview with appropriate line style
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
          previewCtx.setLineDash([5, 5]); // Always dashed for circle preview
          const radius = Math.hypot(x - startPos.x, y - startPos.y);
          previewCtx.beginPath();
          previewCtx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
          previewCtx.stroke();
        }

        previewCtx.setLineDash([]);
      }
    }
  }, [activeCanvasId, isDrawing, drawMode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, eraserSize, eraserType, startPos, polygonPoints, rotationAngles]);

  // Handle mouse up
  const handleMouseUp = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId || !isDrawing || drawMode !== 'draw') return;

    const canvas = canvasRefs.current[canvasId];
    // Ensure drawings canvas exists
    const drawingsCanvas = ensureDrawingsCanvas(canvasId);

    if (!canvas || !drawingsCanvas) {
      // Fail-safe: reset drawing state even if canvas is missing
      setIsDrawing(false);
      clearPreview(canvasId);
      return;
    }

    const { x, y } = getCanvasCoordinates(e, canvas);
    const drawingsCtx = drawingsCanvas.getContext('2d');
    const finalColor = (drawingColor === '#ffffff' || drawingColor === '#FFFFFF') ? '#000000' : drawingColor;

    const rotation = rotationAngles[canvasId] || 0;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    let mapX = x;
    let mapY = y;
    let mapStartX = startPos.x;
    let mapStartY = startPos.y;

    if (rotation !== 0) {
      const inverted = inverseRotatePoint(x, y, center.x, center.y, rotation);
      mapX = inverted.x;
      mapY = inverted.y;

      const invertedStart = inverseRotatePoint(startPos.x, startPos.y, center.x, center.y, rotation);
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
    clearPreview(canvasId);
    redrawCanvas(canvasId);
    saveDrawingState(canvasId);
  }, [activeCanvasId, isDrawing, drawMode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, startPos, redrawCanvas, saveDrawingState, clearPreview, rotationAngles]);

  // Handle double click for polygon
  const handleDoubleClick = useCallback((canvasId) => {
    if (canvasId !== activeCanvasId) return;
    if ((currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[canvasId]?.length > 2) {
      completePolygon(canvasId);
    }
  }, [activeCanvasId, currentTool, polygonPoints]);

  // Complete polygon
  const completePolygon = useCallback((canvasId) => {
    const points = polygonPoints[canvasId];
    if (!points || points.length < 2) return;

    const drawingsCanvas = drawingsCanvasRefs.current[canvasId];
    if (!drawingsCanvas) return;

    const drawingsCtx = drawingsCanvas.getContext('2d');
    drawingsCtx.strokeStyle = drawingColor;
    drawingsCtx.lineWidth = lineWidth;

    // Points are already in Map Space (stored in handleMouseDown)

    // Draw all segments
    for (let i = 1; i < points.length; i++) {
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(points[i - 1].x, points[i - 1].y);
      drawingsCtx.lineTo(points[i].x, points[i].y);
      drawingsCtx.stroke();
    }

    if (currentTool === 'closedPolygon') {
      const first = points[0];
      const last = points[points.length - 1];
      drawingsCtx.beginPath();
      drawingsCtx.moveTo(last.x, last.y);
      drawingsCtx.lineTo(first.x, first.y);
      drawingsCtx.stroke();
    }

    setPolygonPoints(prev => ({ ...prev, [canvasId]: [] }));
    clearPreview(canvasId);
    redrawCanvas(canvasId);
    saveDrawingState(canvasId);
  }, [currentTool, drawingColor, lineWidth, polygonPoints, clearPreview, redrawCanvas, saveDrawingState]);

  // Handle ESC key for polygon
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && (currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[activeCanvasId]?.length > 1) {
        completePolygon(activeCanvasId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTool, polygonPoints, activeCanvasId, completePolygon]);

  // Handle text input blur
  const handleTextInputBlur = useCallback((canvasId, x, y) => {
    const textInput = textInputRefs.current[canvasId];
    const textInputBox = textInputBoxRefs.current[canvasId];
    if (!textInput || !textInputBox) return;

    const value = textInput.value.trim();
    if (value) {
      const canvas = canvasRefs.current[canvasId];
      const drawingsCanvas = drawingsCanvasRefs.current[canvasId];
      if (canvas && drawingsCanvas) {
        const rotation = rotationAngles[canvasId] || 0;
        const center = { x: canvas.width / 2, y: canvas.height / 2 };

        let mapX = x;
        let mapY = y;

        if (rotation !== 0) {
          const inverted = inverseRotatePoint(x, y, center.x, center.y, rotation);
          mapX = inverted.x;
          mapY = inverted.y;
        }

        const drawingsCtx = drawingsCanvas.getContext('2d');
        drawingsCtx.fillStyle = drawingColor;
        drawingsCtx.font = `${lineWidth * 8}px Arial`;
        drawingsCtx.fillText(value, mapX, mapY + lineWidth * 8);

        redrawCanvas(canvasId);
        saveDrawingState(canvasId);
      }
    }
    textInputBox.style.display = 'none';
  }, [drawingColor, lineWidth, saveDrawingState, rotationAngles, redrawCanvas]);

  // Save modal text
  const handleSaveModal = useCallback(() => {
    if (!modalData) return;

    if (modalType === 'text') {
      const { canvasId, x, y } = modalData;
      const newAnnotation = {
        id: 'annotation-' + Date.now(),
        x,
        y,
        text: modalText
      };
      setAnnotations(prev => ({
        ...prev,
        [canvasId]: [...(prev[canvasId] || []), newAnnotation]
      }));
    } else if (modalType === 'termite') {
      const { canvasId, pinIndex } = modalData;
      const termiteType = modalText;
      if (termiteType) {
        const code = generateRandomCode();
        const displayText = code + ' ' + termiteType;
        setCustomPins(prev => {
          const pins = [...(prev[canvasId] || [])];
          pins[pinIndex] = { ...pins[pinIndex], text: displayText };
          return { ...prev, [canvasId]: pins };
        });
      }
    }

    setShowModal(false);
    setModalText('');
    setModalData(null);
  }, [modalData, modalType, modalText]);

  // Capture image
  const handleCaptureImage = useCallback(async (canvasId) => {
    const canvasWrapper = document.getElementById(`canvas-wrapper-${canvasId}`);
    if (!canvasWrapper) return;

    const canvasElement = canvasRefs.current[canvasId];
    const labelsContainer = labelsContainerRefs.current[canvasId];
    const annotationsContainer = annotationsContainerRefs.current[canvasId];

    if (!canvasElement) {
      alert('Canvas not found!');
      return;
    }

    try {
      // Hide tools temporarily
      const drawingTools = document.querySelector('.drawing-tools');
      const originalDisplay = drawingTools ? drawingTools.style.display : '';
      if (drawingTools) drawingTools.style.display = 'none';

      const eraserCursor = eraserCursorRefs.current[canvasId];
      const eraserCursorOriginalDisplay = eraserCursor ? eraserCursor.style.display : '';
      if (eraserCursor) eraserCursor.style.display = 'none';

      const textInputBox = textInputBoxRefs.current[canvasId];
      const textInputBoxOriginalDisplay = textInputBox ? textInputBox.style.display : '';
      if (textInputBox) textInputBox.style.display = 'none';

      const previewCanvas = previewCanvasRefs.current[canvasId];
      const previewCanvasOriginalDisplay = previewCanvas ? previewCanvas.style.display : '';
      if (previewCanvas) previewCanvas.style.display = 'none';

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

      if (drawingTools) drawingTools.style.display = originalDisplay;
      if (eraserCursor) eraserCursor.style.display = eraserCursorOriginalDisplay;
      if (textInputBox) textInputBox.style.display = textInputBoxOriginalDisplay;
      if (previewCanvas) previewCanvas.style.display = previewCanvasOriginalDisplay;

      const imageData = capturedCanvas.toDataURL('image/png');
      const blob = await (await fetch(imageData)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drawing-canvas-${canvasId}-${new Date().toISOString().slice(0, 10)}.png`;
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

  // Update labels and annotations when they change
  useEffect(() => {
    renderLabels(activeCanvasId);
  }, [customPins, activeCanvasId, renderLabels]);

  useEffect(() => {
    renderAnnotations(activeCanvasId);
  }, [annotations, activeCanvasId, renderAnnotations]);

  // Tool selection
  const handleToolSelect = (tool) => {
    if (tool === 'undo') {
      undoDrawing();
      return;
    }

    setDrawMode('draw');
    setCurrentTool(tool);
    setPolygonPoints(prev => ({ ...prev, [activeCanvasId]: [] }));

    const textInputBox = textInputBoxRefs.current[activeCanvasId];
    if (textInputBox) textInputBox.style.display = 'none';
    clearPreview(activeCanvasId);

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
    <div className="drawing-tool-container">
      <h1>GeoJSON Canvas Viewer</h1>

      {showGeoView && showDrawingView && (
        <div className="view-toggle">
          <button
            className={`btn ${currentView === 'geo' ? 'btn-primary mode-active' : 'btn-secondary'}`}
            onClick={() => setCurrentView('geo')}
          >
            GeoJSON View
          </button>
          <button
            className={`btn ${currentView === 'drawing' ? 'btn-primary mode-active' : 'btn-secondary'}`}
            onClick={() => setCurrentView('drawing')}
          >
            Custom Drawing View
          </button>
        </div>
      )}

      {currentView === 'geo' && showGeoView && (
        <GeoJSONView
          initialGeoJSON={initialGeoJSON}
          onExport={onExport}
          canvasWidth={800}
          canvasHeight={600}
        />
      )}

      {currentView === 'drawing' && showDrawingView && (
        <div className="main-container">
          <div className="controls">
            <button
              className={`btn ${drawMode === 'select' ? 'btn-primary mode-active' : 'btn-secondary'}`}
              onClick={() => setDrawMode('select')}
            >
              Select Mode
            </button>
            <button
              className={`btn ${drawMode === 'addPin' ? 'btn-primary mode-active' : 'btn-secondary'}`}
              onClick={() => setDrawMode('addPin')}
            >
              Add Pin Mode
            </button>
            <button
              className={`btn ${drawMode === 'annotate' ? 'btn-primary mode-active' : 'btn-secondary'}`}
              onClick={() => setDrawMode('annotate')}
            >
              Annotate Mode
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const canvas = canvasRefs.current[activeCanvasId];
                const drawingsCanvas = drawingsCanvasRefs.current[activeCanvasId];
                if (canvas && drawingsCanvas) {
                  const ctx = canvas.getContext('2d');
                  const dCtx = drawingsCanvas.getContext('2d');

                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = 'white';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);

                  dCtx.clearRect(0, 0, drawingsCanvas.width, drawingsCanvas.height);
                  dCtx.fillStyle = 'white';
                  dCtx.fillRect(0, 0, drawingsCanvas.width, drawingsCanvas.height);

                  setCustomPins(prev => ({ ...prev, [activeCanvasId]: [] }));
                  setAnnotations(prev => ({ ...prev, [activeCanvasId]: [] }));
                  setRotationAngles(prev => ({ ...prev, [activeCanvasId]: 0 }));

                  // Clear redo history when clearing canvas
                  setRedoHistory(prev => ({
                    ...prev,
                    [activeCanvasId]: []
                  }));
                  saveDrawingState(activeCanvasId);
                }
              }}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleCaptureImage(activeCanvasId)}
            >
              📷 Capture Image
            </button>
          </div>

          <div className="rotation-control-container" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <label style={{ fontWeight: '500', color: '#5f6368' }}>Rotate View:</label>
            <input
              type="range"
              min="0"
              max="360"
              value={rotationAngles[activeCanvasId] || 0}
              onChange={(e) => {
                const angle = parseInt(e.target.value, 10);
                setRotationAngles(prev => ({ ...prev, [activeCanvasId]: angle }));
                requestAnimationFrame(() => {
                  redrawCanvas(activeCanvasId, angle);
                });
              }}
              style={{ width: '200px' }}
            />
            <span style={{ minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>{rotationAngles[activeCanvasId] || 0}°</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setRotationAngles(prev => ({ ...prev, [activeCanvasId]: 0 }));
                requestAnimationFrame(() => {
                  redrawCanvas(activeCanvasId, 0);
                });
              }}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Reset
            </button>
          </div>

          <div className="canvas-tabs">
            <button
              className={`canvas-tab ${activeCanvasId === 1 ? 'active' : ''}`}
              onClick={() => setActiveCanvasId(1)}
            >
              Structure 1
            </button>
            <button
              className={`canvas-tab ${activeCanvasId === 2 ? 'active' : ''}`}
              onClick={() => setActiveCanvasId(2)}
            >
              Structure 2
            </button>
          </div>

          <div className="canvas-area">
            <div className="canvas-panels">
              {[1, 2].map(canvasId => (
                <div
                  key={canvasId}
                  id={`canvas-wrapper-${canvasId}`}
                  className={`canvas-wrapper canvas-panel ${activeCanvasId === canvasId ? 'active' : ''}`}
                >
                  <canvas
                    ref={el => canvasRefs.current[canvasId] = el}
                    className="drawing-canvas"
                    width={canvasWidth}
                    height={canvasHeight}
                    onMouseDown={(e) => handleMouseDown(e, canvasId)}
                    onMouseMove={(e) => handleMouseMove(e, canvasId)}
                    onMouseUp={(e) => handleMouseUp(e, canvasId)}
                    onMouseLeave={() => {
                      clearPreview(canvasId);
                      const eraserCursor = eraserCursorRefs.current[canvasId];
                      if (eraserCursor) eraserCursor.style.display = 'none';
                      setIsDrawing(false);
                    }}
                    onDoubleClick={() => handleDoubleClick(canvasId)}
                  />
                  <div
                    ref={el => eraserCursorRefs.current[canvasId] = el}
                    className={`eraser-cursor ${eraserType}`}
                  />
                  <div
                    ref={el => textInputBoxRefs.current[canvasId] = el}
                    className="text-input-box"
                  >
                    <input
                      ref={el => textInputRefs.current[canvasId] = el}
                      type="text"
                      placeholder="Type text here..."
                      onBlur={() => handleTextInputBlur(canvasId, startPos.x, startPos.y)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleTextInputBlur(canvasId, startPos.x, startPos.y);
                        }
                      }}
                    />
                  </div>
                  <div ref={el => labelsContainerRefs.current[canvasId] = el} />
                  <div ref={el => annotationsContainerRefs.current[canvasId] = el} />
                </div>
              ))}
            </div>

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
                disabled={(drawingHistory[activeCanvasId] || []).length <= 1}
                style={{
                  background: (drawingHistory[activeCanvasId] || []).length > 1 ? '#fff3cd' : '#e0e0e0',
                  borderColor: (drawingHistory[activeCanvasId] || []).length > 1 ? '#ffc107' : '#ccc',
                  cursor: (drawingHistory[activeCanvasId] || []).length > 1 ? 'pointer' : 'not-allowed',
                  opacity: (drawingHistory[activeCanvasId] || []).length > 1 ? 1 : 0.6
                }}
                title="Undo last action"
              >
                ↶ Undo
              </button>
              <button
                className="tool-btn"
                onClick={redoDrawing}
                disabled={!(redoHistory[activeCanvasId] || []).length}
                style={{
                  background: (redoHistory[activeCanvasId] || []).length > 0 ? '#d1ecf1' : '#e0e0e0',
                  borderColor: (redoHistory[activeCanvasId] || []).length > 0 ? '#17a2b8' : '#ccc',
                  cursor: (redoHistory[activeCanvasId] || []).length > 0 ? 'pointer' : 'not-allowed',
                  opacity: (redoHistory[activeCanvasId] || []).length > 0 ? 1 : 0.6
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
        </div>
      )}

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

export default DrawingTool;

