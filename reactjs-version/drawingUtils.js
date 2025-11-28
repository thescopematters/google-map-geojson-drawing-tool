// Utility functions for drawing tool

/**
 * Get line dash pattern based on style
 */
export function getLineDashPattern(style) {
  switch (style) {
    case 'dashed':
      return [10, 5];
    case 'dotted':
      return [2, 5];
    case 'solid':
    default:
      return [];
  }
}

/**
 * Generate random code (A-Z)(0-9)
 */
export function generateRandomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const digit = Math.floor(Math.random() * 10);
  return letter + digit;
}

/**
 * Get canvas coordinates from mouse event
 */
export function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

/**
 * Check if a point is inside a polygon
 */
export function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Rotate a point around a center
 */
export function rotatePoint(x, y, cx, cy, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  
  const dx = x - cx;
  const dy = y - cy;
  
  return {
    x: cos * dx - sin * dy + cx,
    y: sin * dx + cos * dy + cy
  };
}

/**
 * Inverse rotation for click detection
 */
export function inverseRotatePoint(x, y, cx, cy, angleDeg) {
  return rotatePoint(x, y, cx, cy, -angleDeg);
}

// GeoJSON utility functions

/**
 * Find bounds of all coordinates in GeoJSON features
 */
export function getBounds(features) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates[0].forEach(coord => {
        minLon = Math.min(minLon, coord[0]);
        maxLon = Math.max(maxLon, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
      });
    } else if (feature.geometry.type === 'Point') {
      minLon = Math.min(minLon, feature.geometry.coordinates[0]);
      maxLon = Math.max(maxLon, feature.geometry.coordinates[0]);
      minLat = Math.min(minLat, feature.geometry.coordinates[1]);
      maxLat = Math.max(maxLat, feature.geometry.coordinates[1]);
    }
  });
  
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Convert lat/lon to canvas x/y coordinates
 */
export function projectToCanvasState(lon, lat, bounds, canvas, rotationAngle = 0, centerPoint = null) {
  const padding = 50;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  
  let x = padding + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
  let y = padding + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
  
  if (rotationAngle !== 0 && centerPoint) {
    const rotated = rotatePoint(x, y, centerPoint.x, centerPoint.y, rotationAngle);
    x = rotated.x;
    y = rotated.y;
  }
  
  return { x, y };
}

/**
 * Calculate center point of bounds
 */
export function calculateCenterState(bounds, canvas) {
  const padding = 50;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  
  const x = padding + ((centerLon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
  const y = padding + ((bounds.maxLat - centerLat) / (bounds.maxLat - bounds.minLat)) * height;
  
  return { x, y };
}

/**
 * Convert canvas x/y back to lat/lon
 */
export function canvasToLatLonState(x, y, bounds, canvas) {
  const padding = 50;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  
  const lon = bounds.minLon + ((x - padding) / width) * (bounds.maxLon - bounds.minLon);
  const lat = bounds.maxLat - ((y - padding) / height) * (bounds.maxLat - bounds.minLat);
  
  return { lon, lat };
}

