import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { getLineDashPattern, generateRandomCode, getCanvasCoordinates } from './drawingUtils';
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
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
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
  const drawPinsOnCanvas = useCallback((canvasId) => {
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const pins = customPins[canvasId] || [];
    
    pins.forEach(pin => {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34a853';
      ctx.fill();
      ctx.strokeStyle = '#1e8e3e';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [customPins]);
  
  // Render labels - defined early so it can be used in useEffect
  const renderLabels = useCallback((canvasId) => {
    const container = labelsContainerRefs.current[canvasId];
    if (!container) return;
    
    const pins = customPins[canvasId] || [];
    container.innerHTML = '';
    
    pins.forEach(pin => {
      if (pin.text) {
        const label = document.createElement('div');
        label.className = 'point-label';
        label.textContent = pin.text;
        label.style.left = (pin.x + 10) + 'px';
        label.style.top = (pin.y - 10) + 'px';
        container.appendChild(label);
      }
    });
  }, [customPins]);
  
  // Render annotations - defined early so it can be used in useEffect
  const renderAnnotations = useCallback((canvasId) => {
    const container = annotationsContainerRefs.current[canvasId];
    if (!container) return;
    
    const anns = annotations[canvasId] || [];
    container.innerHTML = '';
    
    anns.forEach((annotation, idx) => {
      const label = document.createElement('div');
      label.className = 'annotation';
      label.textContent = annotation.text;
      label.style.left = annotation.x + 'px';
      label.style.top = annotation.y + 'px';
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
  }, [annotations, drawMode]);
  
  // Initialize canvas - only once per canvas, don't clear on tab switch
  useEffect(() => {
    [1, 2].forEach(canvasId => {
      const canvas = canvasRefs.current[canvasId];
      if (!canvas || initializedCanvases.has(canvasId)) return;
      
      const ctx = canvas.getContext('2d');
      
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
      // Use requestAnimationFrame to ensure canvas is ready
      requestAnimationFrame(() => {
        ctx.putImageData(lastState, 0, 0);
        // Redraw pins on top
        drawPinsOnCanvas(activeCanvasId);
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
    if (!canvas) return;
    
    // Use functional updates to get the latest state
    setDrawingHistory(prev => {
      const history = prev[activeCanvasId] || [];
      if (history.length <= 1) return prev; // Can't undo if only initial state
      
      const ctx = canvas.getContext('2d');
      
      // Get current state (last in history) and move it to redo stack
      const currentState = history[history.length - 1];
      const previousState = history[history.length - 2];
      
      // Restore previous state immediately
      ctx.putImageData(previousState, 0, 0);
      
      // Add current state to redo stack
      setRedoHistory(redoPrev => ({
        ...redoPrev,
        [activeCanvasId]: [...(redoPrev[activeCanvasId] || []), currentState]
      }));
      
      // Redraw pins and update labels/annotations after a brief delay to ensure state is updated
      setTimeout(() => {
        drawPinsOnCanvas(activeCanvasId);
        renderLabels(activeCanvasId);
        renderAnnotations(activeCanvasId);
      }, 0);
      
      // Return updated history (remove last state)
      return {
        ...prev,
        [activeCanvasId]: history.slice(0, -1)
      };
    });
  }, [activeCanvasId, drawPinsOnCanvas, renderLabels, renderAnnotations]);
  
  // Redo drawing
  const redoDrawing = useCallback(() => {
    const canvas = canvasRefs.current[activeCanvasId];
    if (!canvas) return;
    
    // Use functional updates to get the latest state
    setRedoHistory(prev => {
      const redoStack = prev[activeCanvasId] || [];
      if (redoStack.length === 0) return prev; // Nothing to redo
      
      const ctx = canvas.getContext('2d');
      
      // Get the state to redo (last in redo stack)
      const stateToRedo = redoStack[redoStack.length - 1];
      
      // Restore the state immediately
      ctx.putImageData(stateToRedo, 0, 0);
      
      // Add back to history
      setDrawingHistory(historyPrev => ({
        ...historyPrev,
        [activeCanvasId]: [...(historyPrev[activeCanvasId] || []), stateToRedo]
      }));
      
      // Redraw pins and update labels/annotations after a brief delay
      setTimeout(() => {
        drawPinsOnCanvas(activeCanvasId);
        renderLabels(activeCanvasId);
        renderAnnotations(activeCanvasId);
      }, 0);
      
      // Return updated redo stack (remove last state)
      return {
        ...prev,
        [activeCanvasId]: redoStack.slice(0, -1)
      };
    });
  }, [activeCanvasId, drawPinsOnCanvas, renderLabels, renderAnnotations]);
  
  // Clear preview
  const clearPreview = useCallback((canvasId) => {
    const previewCanvas = previewCanvasRefs.current[canvasId];
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  }, []);
  
  // Handle mouse down
  const handleMouseDown = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId) return;
    
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const { x, y } = getCanvasCoordinates(e, canvas);
    setStartPos({ x, y });
    
    if (drawMode === 'select') {
      // Handle pin selection
      const pins = customPins[canvasId] || [];
      pins.forEach((pin, idx) => {
        const distance = Math.hypot(x - pin.x, y - pin.y);
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
        x,
        y,
        text: ''
      };
      // Draw pin immediately on canvas before state update
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34a853';
      ctx.fill();
      ctx.strokeStyle = '#1e8e3e';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Update state
      setCustomPins(prev => ({
        ...prev,
        [canvasId]: [...(prev[canvasId] || []), newPin]
      }));
      
      // Update labels after state update
      setTimeout(() => {
        renderLabels(canvasId);
      }, 0);
      
      saveDrawingState(canvasId);
      return;
    }
    
    if (drawMode === 'annotate') {
      setModalTitle('Add Annotation');
      setModalType('text');
      setModalText('');
      setModalData({ canvasId, x, y });
      setShowModal(true);
      return;
    }
    
    if (currentTool === 'text') {
      const textInputBox = textInputBoxRefs.current[canvasId];
      const textInput = textInputRefs.current[canvasId];
      if (textInputBox && textInput && canvas) {
        // Position text input box at click location
        // Since canvas wrapper has position: relative and text-input-box has position: absolute,
        // we can use canvas coordinates directly (canvas is at 0,0 within wrapper)
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
      const newPoints = [...(polygonPoints[canvasId] || []), { x, y }];
      setPolygonPoints(prev => ({ ...prev, [canvasId]: newPoints }));
      
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
      return;
    }
    
    setIsDrawing(true);
  }, [activeCanvasId, drawMode, currentTool, drawingColor, lineWidth, polygonPoints, customPins, renderLabels]);
  
  // Handle mouse move
  const handleMouseMove = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId) return;
    
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const { x, y } = getCanvasCoordinates(e, canvas);
    
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
      if ((currentTool === 'closedPolygon' || currentTool === 'openPolygon') && polygonPoints[canvasId]?.length > 0) {
        const previewCanvas = previewCanvasRefs.current[canvasId];
        if (previewCanvas) {
          const ctx = previewCanvas.getContext('2d');
          ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          const lastPoint = polygonPoints[canvasId][polygonPoints[canvasId].length - 1];
          ctx.strokeStyle = drawingColor;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          if (currentTool === 'closedPolygon' && polygonPoints[canvasId].length > 2) {
            const firstPoint = polygonPoints[canvasId][0];
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
    
    if (drawMode !== 'draw') return;
    
    const previewCanvas = previewCanvasRefs.current[canvasId];
    const ctx = canvas.getContext('2d');
    
    if (currentTool === 'pencil') {
      // Pencil draws directly on main canvas
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      setStartPos({ x, y });
    } else if (currentTool === 'eraser') {
      // Eraser draws directly on main canvas
      if (eraserType === 'circle') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
      }
    } else if (isDrawing && (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
      // For line, rectangle, circle - show preview while dragging
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
  }, [activeCanvasId, isDrawing, drawMode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, eraserSize, eraserType, startPos, polygonPoints]);
  
  // Handle mouse up
  const handleMouseUp = useCallback((e, canvasId) => {
    if (canvasId !== activeCanvasId || !isDrawing || drawMode !== 'draw') return;
    
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const { x, y } = getCanvasCoordinates(e, canvas);
    const ctx = canvas.getContext('2d');
    const finalColor = (drawingColor === '#ffffff' || drawingColor === '#FFFFFF') ? '#000000' : drawingColor;
    
    ctx.strokeStyle = finalColor;
    ctx.fillStyle = finalColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'line') {
      const dashPattern = getLineDashPattern(lineStyle);
      ctx.setLineDash(dashPattern);
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (currentTool === 'rectangle') {
      const dashPattern = getLineDashPattern(rectangleStyle);
      ctx.setLineDash(dashPattern);
      ctx.beginPath();
      ctx.rect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (currentTool === 'circle') {
      const radius = Math.hypot(x - startPos.x, y - startPos.y);
      ctx.beginPath();
      ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    setIsDrawing(false);
    clearPreview(canvasId);
    drawPinsOnCanvas(canvasId);
    saveDrawingState(canvasId);
  }, [activeCanvasId, isDrawing, drawMode, currentTool, drawingColor, lineWidth, lineStyle, rectangleStyle, startPos, drawPinsOnCanvas, saveDrawingState, clearPreview]);
  
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
    
    const canvas = canvasRefs.current[canvasId];
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = lineWidth;
    
    if (currentTool === 'closedPolygon') {
      const first = points[0];
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(first.x, first.y);
      ctx.stroke();
    }
    
    setPolygonPoints(prev => ({ ...prev, [canvasId]: [] }));
    clearPreview(canvasId);
    drawPinsOnCanvas(canvasId);
    saveDrawingState(canvasId);
  }, [currentTool, drawingColor, lineWidth, polygonPoints, clearPreview, drawPinsOnCanvas, saveDrawingState]);
  
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
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = drawingColor;
        ctx.font = `${lineWidth * 8}px Arial`;
        ctx.fillText(value, x, y + lineWidth * 8);
        saveDrawingState(canvasId);
      }
    }
    textInputBox.style.display = 'none';
  }, [drawingColor, lineWidth, saveDrawingState]);
  
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
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = 'white';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  setCustomPins(prev => ({ ...prev, [activeCanvasId]: [] }));
                  setAnnotations(prev => ({ ...prev, [activeCanvasId]: [] }));
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

