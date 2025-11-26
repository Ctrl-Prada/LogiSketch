
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { ProjectData, SportsProjectData, LightingOrientation, LightingMode } from '../types';
import { 
  PALLET_COLOR, PALLET_STROKE, MEZZANINE_COLOR, MEZZANINE_STROKE, 
  LIGHTING_COLOR, WALL_COLOR, DIMENSION_COLOR, FIXTURE_COLOR, FIXTURE_GLOW,
  GRASS_COLOR, FIELD_LINE_COLOR, POST_COLOR, POST_STROKE, COVERING_COLOR
} from '../constants';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

export type CanvasHandle = {
  downloadImage: () => void;
};

interface WarehouseCanvasProps {
  data: ProjectData | SportsProjectData;
  width?: number;
  height?: number;
  isInteractive?: boolean; 
  viewMode?: '2D' | '3D';
  mode?: 'INDUSTRIAL' | 'SPORTS';
  onRackMove?: (id: string, x: number, y: number) => void;
}

export const WarehouseCanvas = forwardRef<CanvasHandle, WarehouseCanvasProps>(({ 
  data, 
  width = 600, 
  height = 400,
  isInteractive = false,
  viewMode = '2D',
  mode = 'INDUSTRIAL',
  onRackMove
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Dragging State
  const [dragTarget, setDragTarget] = useState<{ id: string, offsetX: number, offsetY: number } | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  
  // Zoom & Pan State
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Type Guards
  const isIndustrial = (d: any): d is ProjectData => mode === 'INDUSTRIAL';
  const isSports = (d: any): d is SportsProjectData => mode === 'SPORTS';

  const getObjects = () => {
    if (isIndustrial(data)) return data.storage.racks;
    if (isSports(data)) return data.objects;
    return [];
  }

  // --- HELPER: ISOMETRIC PROJECTION ---
  const projectIso = (x: number, y: number, z: number) => {
      const cos30 = 0.866;
      const sin30 = 0.5;
      return {
          x: (x - y) * cos30,
          y: (x + y) * sin30 - z
      };
  };

  // --- DRAW SCENE 3D ---
  const drawScene3D = (ctx: CanvasRenderingContext2D, width: number, height: number, transparentBg: boolean = false) => {
      const w = data.width || 10;
      const l = data.length || 20;
      const h = isIndustrial(data) ? data.ceilingHeight : 0; // Sports doesn't have ceiling height visual usually

      // Calculate Scale to Fit
      // For sports, we might have tall posts, so we consider object heights
      let maxObjH = 0;
      const objects = getObjects();
      objects.forEach(o => {
          const oh = (o.elevation || 0) + (o.height || 0);
          if (oh > maxObjH) maxObjH = oh;
      });
      const renderH = Math.max(h, maxObjH, 5); // Minimum 5m for bounding box

      const points = [
          projectIso(0, 0, 0), projectIso(w, 0, 0), projectIso(w, l, 0), projectIso(0, l, 0), // Base
          projectIso(0, 0, renderH), projectIso(w, 0, renderH), projectIso(w, l, renderH), projectIso(0, l, renderH)  // Top
      ];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      points.forEach(p => {
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });

      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const padding = 60;
      const availW = width - padding * 2;
      const availH = height - padding * 2;
      
      const scaleX = availW / bboxW;
      const scaleY = availH / bboxH;
      const scale = Math.min(scaleX, scaleY); // fit scale

      const bboxCenterX = minX + (bboxW / 2);
      const bboxCenterY = minY + (bboxH / 2);
      const canvasCenterX = width / 2;
      const canvasCenterY = height / 2;

      const toScreen = (x: number, y: number, z: number) => {
          const p = projectIso(x, y, z);
          return {
              x: canvasCenterX + (p.x - bboxCenterX) * scale,
              y: canvasCenterY + (p.y - bboxCenterY) * scale
          };
      };

      // Clear
      if (!transparentBg) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
      }

      // 1. Floor
      const v000 = toScreen(0,0,0);
      const vW00 = toScreen(w,0,0);
      const vWL0 = toScreen(w,l,0);
      const v0L0 = toScreen(0,l,0);

      ctx.beginPath();
      ctx.moveTo(v000.x, v000.y); ctx.lineTo(vW00.x, vW00.y); ctx.lineTo(vWL0.x, vWL0.y); ctx.lineTo(v0L0.x, v0L0.y); ctx.closePath();
      ctx.fillStyle = mode === 'SPORTS' ? GRASS_COLOR : 'rgba(31, 41, 55, 0.5)';
      ctx.fill();
      ctx.strokeStyle = mode === 'SPORTS' ? FIELD_LINE_COLOR : '#4b5563';
      ctx.lineWidth = mode === 'SPORTS' ? 2 : 1;
      ctx.stroke();

      // 2. Objects (Sorted by depth)
      // For Sports, we render cylinders (posts) or planes (coverings)
      const sortedObjects = [...objects].sort((a, b) => (a.x + a.y + (a.elevation || 0)) - (b.x + b.y + (b.elevation || 0)));

      sortedObjects.forEach(obj => {
          const rx = obj.x;
          const ry = obj.y;
          const rw = obj.width;
          const rd = obj.depth;
          const rh = obj.height;
          const el = obj.elevation || 0;
          
          const isMezzanine = obj.type === 'MEZZANINE' || obj.type === 'COVERING';
          const isPost = obj.type === 'POST';

          // Vertices
          const b1 = toScreen(rx, ry, el);
          const b2 = toScreen(rx+rw, ry, el);
          const b3 = toScreen(rx+rw, ry+rd, el);
          const b4 = toScreen(rx, ry+rd, el);
          
          const t1 = toScreen(rx, ry, el + rh);
          const t2 = toScreen(rx+rw, ry, el + rh);
          const t3 = toScreen(rx+rw, ry+rd, el + rh);
          const t4 = toScreen(rx, ry+rd, el + rh);

          // Colors
          let colorBase, colorDark, colorDarker, colorFace;
          
          if (mode === 'SPORTS') {
             if (isPost) {
                 colorBase = POST_COLOR; colorDark = '#9ca3af'; colorDarker = '#6b7280'; colorFace = POST_COLOR;
             } else { // Covering
                 colorBase = COVERING_COLOR; colorDark = '#cbd5e1'; colorDarker = '#94a3b8'; colorFace = 'rgba(255,255,255,0.9)';
             }
          } else {
             // Industrial
             colorBase = isMezzanine ? '#42C0B5' : '#F03200';
             colorDark = isMezzanine ? '#2d8780' : '#b92b00';
             colorDarker = isMezzanine ? '#1e5e59' : '#8a2000';
             colorFace = isMezzanine ? 'rgba(66, 192, 181, 0.8)' : 'rgba(240, 50, 0, 0.8)';
          }

          ctx.strokeStyle = mode === 'SPORTS' ? '#6b7280' : '#FFFFFF';
          ctx.lineWidth = 0.5;

          // Shadows
          if (el > 0) {
              const s1 = toScreen(rx, ry, 0);
              const s2 = toScreen(rx+rw, ry, 0);
              const s3 = toScreen(rx+rw, ry+rd, 0);
              const s4 = toScreen(rx, ry+rd, 0);
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              ctx.beginPath();
              ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y); ctx.closePath();
              ctx.fill();
          }

          // Geometry
          // Bottom Face (visible if floating)
          if (el > 0) {
              ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y); ctx.closePath();
              ctx.fillStyle = colorDarker; ctx.fill(); ctx.stroke();
          }

          // Top Face
          ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = colorFace; ctx.fill(); ctx.stroke();

          // Sides
          ctx.beginPath(); ctx.moveTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y); ctx.closePath();
          ctx.fillStyle = colorDark; ctx.fill(); ctx.stroke();

          ctx.beginPath(); ctx.moveTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y); ctx.lineTo(t4.x, t4.y); ctx.lineTo(t3.x, t3.y); ctx.closePath();
          ctx.fillStyle = colorDarker; ctx.fill(); ctx.stroke();
      });

      // 3. Walls/Ceiling Wireframe (Industrial Only)
      if (mode === 'INDUSTRIAL') {
          const v00H = toScreen(0,0,h);
          const vW0H = toScreen(w,0,h);
          const vWLH = toScreen(w,l,h);
          const v0LH = toScreen(0,l,h);

          ctx.beginPath();
          ctx.moveTo(v00H.x, v00H.y); ctx.lineTo(vW0H.x, vW0H.y); ctx.lineTo(vWLH.x, vWLH.y); ctx.lineTo(v0LH.x, v0LH.y); ctx.closePath();
          ctx.strokeStyle = '#F03200';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Vertical pillars
          ctx.strokeStyle = '#6b7280';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(v000.x, v000.y); ctx.lineTo(v00H.x, v00H.y);
          ctx.moveTo(vW00.x, vW00.y); ctx.lineTo(vW0H.x, vW0H.y);
          ctx.moveTo(vWL0.x, vWL0.y); ctx.lineTo(vWLH.x, vWLH.y);
          ctx.moveTo(v0L0.x, v0L0.y); ctx.lineTo(v0LH.x, v0LH.y);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Height Label
          const drawLabel = (text: string, x: number, y: number, color: string) => {
            ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2); ctx.fill(); ctx.restore();
            ctx.fillStyle = color; ctx.font = 'bold 14px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
          }
          drawLabel(`${h}m`, (v000.x + v00H.x)/2 - 10, (v000.y + v00H.y)/2, '#FFFFFF');
      }

      // Base Dimensions
      const drawBaseLabel = (text: string, x: number, y: number) => {
         ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px Poppins'; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
      }
      drawBaseLabel(`${w}m`, (v000.x + vW00.x)/2, v000.y + 25);
      drawBaseLabel(`${l}m`, (vW00.x + vWL0.x)/2 + 25, (vW00.y + vWL0.y)/2);
  };

  // --- DRAW SCENE 2D ---
  const drawScene2D = (ctx: CanvasRenderingContext2D, width: number, height: number, currentTransform: {scale: number, x: number, y: number} = {scale: 1, x:0, y:0}) => {
     // Metrics
     const padding = 60; 
     const availableWidth = width - padding * 2;
     const availableHeight = height - padding * 2;
     const baseScaleX = availableWidth / (data.width || 1);
     const baseScaleY = availableHeight / (data.length || 1);
     const baseScale = Math.min(baseScaleX, baseScaleY);
     const finalScale = baseScale * currentTransform.scale;
     const drawWidth = data.width * finalScale;
     const drawLength = data.length * finalScale;
     const originX = ((width - drawWidth) / 2) + currentTransform.x;
     const originY = ((height - drawLength) / 2) + currentTransform.y;

     const toPx = (meters: number) => meters * finalScale;
     const getX = (meters: number) => originX + toPx(meters);
     const getY = (meters: number) => originY + toPx(meters);

     // Clear Background
     ctx.fillStyle = '#ffffff';
     ctx.fillRect(0, 0, width, height);

     if (data.width <= 0 || data.length <= 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '500 14px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Defina as dimensões', width / 2, height / 2);
        return { originX, originY, scale: finalScale, drawWidth, drawLength };
     }

     // Floor
     if (mode === 'SPORTS') {
         // Improved Aesthetics for Sports Field
         ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 15;
         ctx.fillStyle = GRASS_COLOR;
         ctx.fillRect(originX, originY, drawWidth, drawLength);
         ctx.shadowBlur = 0;
         
         // Field Lines
         ctx.strokeStyle = FIELD_LINE_COLOR;
         ctx.lineWidth = 2;
         ctx.strokeRect(originX, originY, drawWidth, drawLength);
         
         // Center Line (Simple representation)
         ctx.beginPath();
         ctx.moveTo(originX + drawWidth/2, originY);
         ctx.lineTo(originX + drawWidth/2, originY + drawLength);
         ctx.stroke();
         // Center Circle
         ctx.beginPath();
         ctx.arc(originX + drawWidth/2, originY + drawLength/2, toPx(2), 0, Math.PI*2);
         ctx.stroke();

     } else {
         // Industrial Floor
         ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffffff';
         ctx.fillRect(originX, originY, drawWidth, drawLength); ctx.shadowBlur = 0;
         
         // Grid
         ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath();
         const gridStep = finalScale < 5 ? 10 : 5; 
         for(let i = gridStep; i < data.width; i+=gridStep) { ctx.moveTo(getX(i), getY(0)); ctx.lineTo(getX(i), getY(data.length)); }
         for(let i = gridStep; i < data.length; i+=gridStep) { ctx.moveTo(getX(0), getY(i)); ctx.lineTo(getX(data.width), getY(i)); }
         ctx.stroke();

         // Walls
         ctx.strokeStyle = WALL_COLOR; ctx.lineWidth = 4; ctx.strokeRect(originX, originY, drawWidth, drawLength);
     }

     // Global Dimensions
     const GLOBAL_DIM_OFFSET = 30;
     ctx.strokeStyle = DIMENSION_COLOR; ctx.fillStyle = DIMENSION_COLOR; ctx.lineWidth = 2;
     
     if (mode === 'SPORTS') {
        // Inner Dimensions for Sports - Moved inside to not conflict with post dimensions
        ctx.font = 'bold 24px Poppins'; 
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; // Subtle
        // Width text inside center top
        ctx.fillText(`${data.width}m`, originX + drawWidth/2, originY + 40);
        // Length text inside left center (rotated)
        ctx.save(); ctx.translate(originX + 40, originY + drawLength/2); ctx.rotate(-Math.PI/2); 
        ctx.fillText(`${data.length}m`, 0, 0); ctx.restore();

     } else {
        // Outer Dimensions for Industrial
        ctx.beginPath(); ctx.moveTo(originX, originY - GLOBAL_DIM_OFFSET); ctx.lineTo(originX + drawWidth, originY - GLOBAL_DIM_OFFSET); ctx.stroke();
        ctx.font = 'bold 14px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${data.width}m`, originX + drawWidth/2, originY - GLOBAL_DIM_OFFSET - 5);
   
        ctx.beginPath(); ctx.moveTo(originX - GLOBAL_DIM_OFFSET, originY); ctx.lineTo(originX - GLOBAL_DIM_OFFSET, originY + drawLength); ctx.stroke();
        ctx.save(); ctx.translate(originX - GLOBAL_DIM_OFFSET - 10, originY + drawLength/2); ctx.rotate(-Math.PI/2); 
        ctx.fillText(`${data.length}m`, 0, 0); ctx.restore();
     }

     // Lighting (Industrial Only)
     if (isIndustrial(data) && data.lighting.isActive) {
         const drawFixture = (xMeters: number, yMeters: number) => {
             const cx = getX(xMeters); const cy = getY(yMeters);
             const radius = Math.max(3, Math.min(8, 3 * (finalScale / 1)));
             ctx.shadowBlur = 8; ctx.shadowColor = FIXTURE_GLOW; ctx.fillStyle = FIXTURE_COLOR;
             ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; 
         };
         ctx.strokeStyle = LIGHTING_COLOR; ctx.lineWidth = Math.max(2, finalScale * 0.15); ctx.setLineDash([5, 5]); ctx.beginPath();
         const { orientation, mode, value, offset, fixturesPerProfile } = data.lighting;
         const isLongitudinal = orientation === LightingOrientation.Longitudinal;
         const axisLimit = isLongitudinal ? data.width : data.length; 
         let profilePositions: number[] = [];
         
         if (mode === LightingMode.Quantity) {
            if (value >= 1) {
                if (value === 1) { profilePositions = [axisLimit / 2]; } else {
                    const availableSpace = axisLimit - (offset * 2); const step = availableSpace / (value - 1);
                    for(let i=0; i<value; i++) { profilePositions.push(offset + (i * step)); }
                }
            }
         } else {
             // Mode: Distance
             // Refined: Calculate profiles fitting within safe area (axisLimit - 2*offset) and center them.
             if (value > 0.01) {
                const available = axisLimit - (offset * 2);
                if (available >= 0) {
                    // Count how many gaps of size 'value' fit
                    const intervals = Math.floor(available / value);
                    const count = intervals + 1;
                    
                    if (count > 0) {
                        const span = intervals * value;
                        // Center the span within the available space relative to the offset
                        const start = offset + ((available - span) / 2);
                        
                        for(let i=0; i<count; i++) {
                            profilePositions.push(start + (i * value));
                        }
                    }
                }
             }
         }
         profilePositions.forEach(pos => {
             if (pos > axisLimit) return;
             if (isLongitudinal) { ctx.moveTo(getX(pos), getY(0)); ctx.lineTo(getX(pos), getY(data.length)); } 
             else { ctx.moveTo(getX(0), getY(pos)); ctx.lineTo(getX(data.width), getY(pos)); }
         });
         ctx.stroke(); ctx.setLineDash([]);
         const profileLength = isLongitudinal ? data.length : data.width; 
         if (fixturesPerProfile > 0 && profilePositions.length > 0) {
             const margin = 1; const usableLen = profileLength - (margin * 2);
             profilePositions.forEach(pos => {
                 const step = fixturesPerProfile > 1 ? usableLen / (fixturesPerProfile - 1) : 0;
                 for (let i = 0; i < fixturesPerProfile; i++) {
                     const distAlong = fixturesPerProfile === 1 ? profileLength/2 : margin + (i * step);
                     if (isLongitudinal) { drawFixture(pos, distAlong); } else { drawFixture(distAlong, pos); }
                 }
             });
         }
     } 

     // Objects (Racks or Sports Objects)
     const objects = getObjects();
     
     const drawDimensionLine = (x1: number, y1: number, x2: number, y2: number, text: string, color = DIMENSION_COLOR) => {
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        // Text
        ctx.font = '600 12px Poppins, sans-serif';
        const tm = ctx.measureText(text); const cx = (x1+x2)/2; const cy = (y1+y2)/2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillRect(cx - tm.width/2 - 4, cy - 8, tm.width + 8, 16);
        ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy);
     };

     if (objects.length > 0) {
         // Sort by elevation for drawing order (Objects on top of others)
         const sortedForDrawing = [...objects].sort((a,b) => (a.elevation || 0) - (b.elevation || 0));

         sortedForDrawing.forEach((obj) => {
             const isDragged = dragTarget?.id === obj.id;
             const isHovered = hoveredBlockId === obj.id;
             
             const isMezzanine = obj.type === 'MEZZANINE';
             const isCovering = obj.type === 'COVERING';
             const isPost = obj.type === 'POST';

             const pxX = getX(obj.x);
             const pxY = getY(obj.y);
             const pxW = toPx(obj.width);
             const pxH = toPx(obj.depth);
 
             let strokeColor = PALLET_STROKE; // Default color logic for labels

             if (isPost) {
                 // Draw Circle for Post
                 const radius = pxW / 2;
                 const cx = pxX + radius;
                 const cy = pxY + radius;
                 
                 ctx.fillStyle = isDragged ? '#ffffff' : POST_COLOR;
                 ctx.strokeStyle = POST_STROKE;
                 strokeColor = POST_STROKE;
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                 ctx.fill();
                 ctx.stroke();
             } else {
                 // Rectangles (Racks, Mezzanine, Covering)
                 let fillColor = PALLET_COLOR;
                 
                 if (mode === 'INDUSTRIAL') {
                    if (isMezzanine) { fillColor = MEZZANINE_COLOR; strokeColor = MEZZANINE_STROKE; }
                 } else {
                    if (isCovering) { fillColor = COVERING_COLOR; strokeColor = '#374151'; }
                 }

                 ctx.fillStyle = isDragged ? fillColor.replace('0.25', '0.4').replace('0.2', '0.3') : (isHovered ? fillColor.replace('0.25', '0.3').replace('0.2', '0.25') : fillColor);
                 ctx.strokeStyle = isDragged ? '#D02B00' : strokeColor;
                 ctx.lineWidth = isDragged ? 2 : 1.5;
                 
                 ctx.fillRect(pxX, pxY, pxW, pxH);
                 ctx.strokeRect(pxX, pxY, pxW, pxH);
             }

             // Labels
             const fontSize = Math.max(10, Math.min(16, 11 * (finalScale / 1)));
             ctx.fillStyle = (mode === 'SPORTS' && isPost) ? '#000' : strokeColor;
             if (mode === 'SPORTS' && isCovering) ctx.fillStyle = '#000';

             ctx.font = `bold ${fontSize}px Poppins, sans-serif`;
             ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.fillText(obj.label, pxX + pxW/2, pxY + pxH/2);
             
             if (isPost || obj.height || obj.elevation) {
                  ctx.font = `${fontSize * 0.8}px Poppins, sans-serif`;
                  const hText = isPost ? `H:${obj.height}m` : (obj.elevation ? `E:${obj.elevation}m` : `H:${obj.height}m`);
                  // For posts draw below
                  if (isPost) {
                      ctx.fillStyle = FIELD_LINE_COLOR;
                      ctx.fillText(hText, pxX + pxW/2, pxY + pxH + fontSize);
                  } else {
                      ctx.fillText(hText, pxX + pxW/2, pxY + pxH/2 + fontSize);
                  }
             }
             
             // --- INDUSTRIAL DIMENSIONS (When dragged ONLY) ---
             if (mode === 'INDUSTRIAL' && isDragged) {
                const PROJECTION_COLOR = 'rgba(100, 100, 100, 0.5)';
                const OFFSET = 35;
                const WALL_DIM_COLOR = '#3b82f6';
                const NEIGHBOR_DIM_COLOR = '#F03200'; // Silicon Orange
                
                // 1. Dimensions to Walls (Absolute)
                const drawProjection = (x1: number, y1: number, x2: number, y2: number) => {
                    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                    ctx.strokeStyle = PROJECTION_COLOR; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
                };
                
                const wallDimY = pxY + pxH + OFFSET;
                drawProjection(originX, pxY + pxH, originX, wallDimY); drawProjection(pxX, pxY + pxH, pxX, wallDimY);         
                drawDimensionLine(originX, wallDimY, pxX, wallDimY, `${obj.x.toFixed(2)}m`, WALL_DIM_COLOR);
                
                const wallDimX = pxX + pxW + OFFSET;
                drawProjection(pxX + pxW, originY, wallDimX, originY); drawProjection(pxX + pxW, pxY, wallDimX, pxY); 
                drawDimensionLine(wallDimX, originY, wallDimX, pxY, `${obj.y.toFixed(2)}m`, WALL_DIM_COLOR);

                // 2. Dimensions to Neighbors (Relative / Edge-to-Edge)
                const otherObjects = objects.filter(o => o.id !== obj.id);
                let closestLeft = null, closestRight = null, closestTop = null, closestBottom = null;
                let distLeft = Infinity, distRight = Infinity, distTop = Infinity, distBottom = Infinity;
                
                otherObjects.forEach(other => {
                    // Check Vertical Overlap (Y-range intersection) to determine if they are "side by side"
                    // Add small epsilon to allow for "touching" alignment
                    const EPSILON = 0.05;
                    const vertOverlap = Math.max(0, Math.min(obj.y + obj.depth, other.y + other.depth) - Math.max(obj.y, other.y) + EPSILON);
                    
                    if (vertOverlap > 0) {
                         // Neighbor is to the Right
                         if (other.x >= obj.x + obj.width) {
                             const gap = other.x - (obj.x + obj.width);
                             if (gap < distRight) { distRight = gap; closestRight = other; }
                         }
                         // Neighbor is to the Left
                         if (other.x + other.width <= obj.x) {
                             const gap = obj.x - (other.x + other.width);
                             if (gap < distLeft) { distLeft = gap; closestLeft = other; }
                         }
                    }

                    // Check Horizontal Overlap (X-range intersection) to determine if they are "above/below"
                    const horzOverlap = Math.max(0, Math.min(obj.x + obj.width, other.x + other.width) - Math.max(obj.x, other.x) + EPSILON);

                    if (horzOverlap > 0) {
                        // Neighbor is Below
                        if (other.y >= obj.y + obj.depth) {
                            const gap = other.y - (obj.y + obj.depth);
                            if (gap < distBottom) { distBottom = gap; closestBottom = other; }
                        }
                        // Neighbor is Above
                        if (other.y + other.depth <= obj.y) {
                            const gap = obj.y - (other.y + other.depth);
                            if (gap < distTop) { distTop = gap; closestTop = other; }
                        }
                    }
                });

                // Draw Neighbor Dimensions
                const cy = pxY + pxH / 2;
                const cx = pxX + pxW / 2;

                if (closestRight) {
                    const targetX = getX(closestRight.x); // Left edge of right neighbor
                    drawDimensionLine(pxX + pxW, cy, targetX, cy, `${distRight.toFixed(2)}m`, NEIGHBOR_DIM_COLOR);
                }

                if (closestLeft) {
                    const targetX = getX(closestLeft.x + closestLeft.width); // Right edge of left neighbor
                    drawDimensionLine(pxX, cy, targetX, cy, `${distLeft.toFixed(2)}m`, NEIGHBOR_DIM_COLOR);
                }
                
                if (closestBottom) {
                    const targetY = getY(closestBottom.y); // Top edge of bottom neighbor
                    drawDimensionLine(cx, pxY + pxH, cx, targetY, `${distBottom.toFixed(2)}m`, NEIGHBOR_DIM_COLOR);
                }

                if (closestTop) {
                    const targetY = getY(closestTop.y + closestTop.depth); // Bottom edge of top neighbor
                    drawDimensionLine(cx, pxY, cx, targetY, `${distTop.toFixed(2)}m`, NEIGHBOR_DIM_COLOR);
                }

             }
             // Sports Covering Dimensions (Standard)
             if (mode === 'SPORTS' && isCovering) {
                 const WALL_DIM_COLOR = '#3b82f6';
                 const cx = pxX + pxW/2;
                 const cy = pxY + pxH/2;
                 const centerX = obj.x + obj.width/2;
                 const centerY = obj.y + obj.depth/2;
                 if (centerX < data.width / 2) { drawDimensionLine(originX, cy, cx, cy, `${centerX.toFixed(2)}m`, WALL_DIM_COLOR); } 
                 else { drawDimensionLine(cx, cy, originX + drawWidth, cy, `${(data.width - centerX).toFixed(2)}m`, WALL_DIM_COLOR); }
                 if (centerY < data.length / 2) { drawDimensionLine(cx, originY, cx, cy, `${centerY.toFixed(2)}m`, WALL_DIM_COLOR); } 
                 else { drawDimensionLine(cx, cy, cx, originY + drawLength, `${(data.length - centerY).toFixed(2)}m`, WALL_DIM_COLOR); }
             }
         });
     }

     // --- SPORTS POST DIMENSION LOGIC (Refined & Offset) ---
     if (mode === 'SPORTS') {
        const allPosts = isSports(data) ? data.objects.filter(o => o.type === 'POST').sort((a,b) => a.x - b.x) : [];
        
        let prevAnchorX = 0; // Starts at Left Goal Line
        let offsetLevel = 0; // Level 0 = closest
        const WALL_DIM_COLOR = '#3b82f6';

        allPosts.forEach((obj, index) => {
            const centerX = obj.x + obj.width/2;
            const centerY = obj.y + obj.depth/2;
            
            const pxX = getX(obj.x);
            const pxY = getY(obj.y);
            const pxW = toPx(obj.width);
            const pxH = toPx(obj.depth);
            const cx = pxX + pxW/2;
            const cy = pxY + pxH/2;

            // 1. Calculate visual collision with previous anchor
            const distFromPrev = centerX - prevAnchorX;
            // Rule: If deltaX < 2.0m, bump offset
            if (distFromPrev < 2.0) {
                offsetLevel += 1;
            } else {
                offsetLevel = 0; // Reset if enough space
            }

            // Calculate vertical pixel shift based on offsetLevel
            // Step = 0.5m. Level 0 = 0m. Level 1 = 0.5m...
            const verticalShiftMeters = offsetLevel * 0.5;
            const verticalShiftPx = toPx(verticalShiftMeters);
            
            // Determine direction of shift based on Y position (Up if top half, Down if bottom half)
            const shiftDir = centerY < data.length / 2 ? -1 : 1; 
            const finalShift = verticalShiftPx * shiftDir;

            const lineY = cy + finalShift;

            // DRAW CHAIN DIMENSION (Prev -> Curr)
            // Get previous X pixel coord
            const prevPxX = getX(prevAnchorX);
            
            // Draw
            const dimText = distFromPrev.toFixed(2) + 'm';
            const dimColor = index === 0 ? WALL_DIM_COLOR : '#F03200'; // First one is to wall (blue), others inter-pole (orange)
            
            drawDimensionLine(prevPxX, lineY, cx, lineY, dimText, dimColor);
            
            // Draw small connector if offset is large? Optional visual aid.
            if (offsetLevel > 0) {
               ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.setLineDash([2,2]); 
               ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, lineY); ctx.stroke(); ctx.setLineDash([]);
            }

            // DRAW Y-DIMENSION (Only for first post)
            if (index === 0) {
                 if (centerY < data.length / 2) {
                     drawDimensionLine(cx, originY, cx, cy, `${centerY.toFixed(2)}m`, WALL_DIM_COLOR);
                 } else {
                     drawDimensionLine(cx, cy, cx, originY + drawLength, `${(data.length - centerY).toFixed(2)}m`, WALL_DIM_COLOR);
                 }
            }

            // MIDFIELD RULE
            const midFieldX = data.width / 2;
            if (centerX > midFieldX) {
                // Check distance to right wall
                const distToRight = data.width - centerX;
                drawDimensionLine(cx, lineY, originX + drawWidth, lineY, `${distToRight.toFixed(2)}m`, WALL_DIM_COLOR);
            }

            prevAnchorX = centerX;
        });
     }
     
     return { originX, originY, scale: finalScale, drawWidth, drawLength };
  };

  // --- DOWNLOAD (Refined Report Layout) ---
  useImperativeHandle(ref, () => ({
    downloadImage: () => {
      const sourceCanvas = canvasRef.current;
      if (!sourceCanvas) return;
      
      // Configuration
      const docWidth = 1200;
      const padding = 60;
      const sectionGap = 40;
      
      // Colors
      const bgMain = '#ffffff';
      const textDark = '#121212';
      const textGray = '#666666';
      const brandOrange = '#F03200';
      const brandTeal = '#42C0B5';
      const brandPurple = '#7F3F98';
      
      // Helper: Draw Text
      const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight: string = 'normal', align: CanvasTextAlign = 'left') => {
          ctx.font = `${weight} ${size}px Poppins, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = align;
          ctx.fillText(text, x, y);
      };

      // 1. Calculate Layout Heights
      const headerHeight = 120;
      
      // Data Grid Calculation (Row height approx 70px + padding)
      const dataSectionHeight = 220; 
      
      const obsHeight = data.observations ? 100 : 0;
      
      // Images
      const drawingAspectRatio = sourceCanvas.height / sourceCanvas.width;
      const contentWidth = docWidth - (padding * 2);
      const img2DHeight = contentWidth * drawingAspectRatio;
      const img3DHeight = 500; // Fixed height for 3D usually looks good
      
      const footerHeight = 80;

      const totalHeight = headerHeight + dataSectionHeight + obsHeight + img2DHeight + img3DHeight + (sectionGap * 5) + footerHeight;

      const tempCanvas = document.createElement('canvas'); 
      tempCanvas.width = docWidth; 
      tempCanvas.height = totalHeight;
      const ctx = tempCanvas.getContext('2d'); if (!ctx) return;

      // Background
      ctx.fillStyle = bgMain;
      ctx.fillRect(0, 0, docWidth, totalHeight);

      let currentY = padding + 20;

      // --- HEADER ---
      // Logo / Brand
      drawText(ctx, "Schema", padding, currentY + 10, 40, textDark, 'bold');
      drawText(ctx, "INDUSTRIAL BUILDER", padding, currentY + 40, 14, brandOrange, '600');
      
      // Date
      const dateStr = new Date().toLocaleDateString();
      drawText(ctx, dateStr, docWidth - padding, currentY + 10, 14, textGray, 'normal', 'right');
      
      currentY += headerHeight;

      // --- PROJECT DATA GRID ---
      // Draw Section Title
      drawText(ctx, "DADOS DO PROJETO", padding, currentY, 18, textDark, 'bold');
      currentY += 30;

      // Draw Grid Background
      const gridY = currentY;
      const boxHeight = 160;
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(padding, gridY, contentWidth, boxHeight);
      ctx.strokeStyle = '#e9ecef';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, gridY, contentWidth, boxHeight);

      // Columns
      const colW = contentWidth / 3;
      
      // Function to draw data item
      const drawDataItem = (col: number, row: number, label: string, val: string, sub?: string) => {
          const x = padding + (col * colW) + 20;
          const y = gridY + (row * 70) + 30;
          drawText(ctx, label.toUpperCase(), x, y, 11, textGray, '600');
          drawText(ctx, val, x, y + 25, 18, textDark, 'bold');
          if (sub) drawText(ctx, sub, x, y + 42, 12, brandTeal, '500');
      };

      // Row 1
      let projectName = "Sem Título";
      if (isIndustrial(data) && data.projectName) projectName = data.projectName;
      
      drawDataItem(0, 0, "Nome do Projeto", projectName);
      drawDataItem(1, 0, "Dimensões", `${data.width}m x ${data.length}m`, `Área: ${(data.width * data.length).toFixed(0)}m²`);
      drawDataItem(2, 0, "Pé Direito", isIndustrial(data) ? `${data.ceilingHeight}m` : "N/A");

      // Row 2
      drawDataItem(0, 1, "Nível de Lux", isIndustrial(data) ? `${data.luxRequired} lux` : "N/A");
      
      // Lighting Logic
      let lightingMain = "Não Definido";
      let lightingSub = "";
      if (isIndustrial(data) && data.lighting.isActive) {
          const { mode, value, offset, fixturesPerProfile } = data.lighting;
          const modeText = mode === LightingMode.Distance ? `Dist. ${value}m` : `${value} Linhas`;
          lightingMain = `${modeText} (Offset ${offset}m)`;
          lightingSub = fixturesPerProfile > 0 ? `${fixturesPerProfile} Luminárias/Perfil` : "";
      }
      drawDataItem(1, 1, "Infra. Iluminação", lightingMain, lightingSub);

      // Objects Logic
      const objs = getObjects();
      const racksCount = objs.filter(o => o.type === 'RACK').length;
      const mezzCount = objs.filter(o => o.type === 'MEZZANINE').length;
      const totalObjs = racksCount + mezzCount;
      const objText = totalObjs > 0 ? `${totalObjs} Objetos` : "Nenhum";
      const objSub = totalObjs > 0 ? `(${racksCount} Racks, ${mezzCount} Mezaninos)` : "";
      drawDataItem(2, 1, "Objetos", objText, objSub);

      currentY += boxHeight + sectionGap;

      // --- OBSERVATIONS ---
      if (data.observations) {
          drawText(ctx, "OBSERVAÇÕES", padding, currentY, 18, textDark, 'bold');
          currentY += 20;
          
          ctx.fillStyle = '#fff7ed'; // light orange bg
          ctx.fillRect(padding, currentY, contentWidth, 60);
          ctx.strokeStyle = '#ffedd5';
          ctx.strokeRect(padding, currentY, contentWidth, 60);
          
          // Wrap text logic simplified for short observation or cut off
          ctx.font = '14px Poppins, sans-serif';
          ctx.fillStyle = '#9a3412';
          ctx.fillText(data.observations, padding + 20, currentY + 35);
          
          currentY += 60 + sectionGap;
      }

      // --- 2D LAYOUT ---
      drawText(ctx, "LAYOUT GRÁFICO (2D)", padding, currentY, 18, textDark, 'bold');
      currentY += 20;

      // Draw 2D Scene to temp canvas
      const c2d = document.createElement('canvas'); 
      c2d.width = 1200; 
      c2d.height = 1200 * drawingAspectRatio;
      const ctx2d = c2d.getContext('2d');
      if (ctx2d) drawScene2D(ctx2d, c2d.width, c2d.height);

      ctx.drawImage(c2d, 0, 0, c2d.width, c2d.height, padding, currentY, contentWidth, img2DHeight);
      ctx.strokeStyle = '#121212'; ctx.lineWidth = 2; ctx.strokeRect(padding, currentY, contentWidth, img2DHeight);
      
      currentY += img2DHeight + sectionGap;

      // --- 3D PERSPECTIVE ---
      drawText(ctx, "PERSPECTIVA ISOMÉTRICA (3D)", padding, currentY, 18, textDark, 'bold');
      currentY += 20;

      const c3d = document.createElement('canvas'); 
      c3d.width = 1200; 
      c3d.height = 600; // Fixed aspect for 3D render usually
      const ctx3d = c3d.getContext('2d');
      if (ctx3d) drawScene3D(ctx3d, c3d.width, c3d.height, true); // true for transparent bg, but here we might want dark bg
      
      // Draw Dark Background for 3D on PDF
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(padding, currentY, contentWidth, img3DHeight);
      
      // Draw 3D Image
      ctx.drawImage(c3d, 0, 0, c3d.width, c3d.height, padding, currentY, contentWidth, img3DHeight);
      ctx.strokeStyle = '#121212'; ctx.lineWidth = 2; ctx.strokeRect(padding, currentY, contentWidth, img3DHeight);

      currentY += img3DHeight + sectionGap;

      // --- FOOTER ---
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, totalHeight - footerHeight, docWidth, footerHeight);
      drawText(ctx, "Gerado por Schema | Silicon Group", docWidth/2, totalHeight - (footerHeight/2) + 5, 12, textGray, 'normal', 'center');

      // --- SAVE ---
      const link = document.createElement('a');
      const filename = isIndustrial(data) && data.projectName ? data.projectName : `Schema-${mode}`;
      link.download = `${filename.replace(/\s+/g, '_')}_Report.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
  }));

  // --- MOUSE HANDLERS ---
  const getMetrics = () => {
      const canvas = canvasRef.current; if (!canvas) return null;
      const padding = 60; 
      const availableWidth = canvas.width - padding * 2;
      const availableHeight = canvas.height - padding * 2;
      const baseScaleX = availableWidth / (data.width || 1);
      const baseScaleY = availableHeight / (data.length || 1);
      const baseScale = Math.min(baseScaleX, baseScaleY);
      const finalScale = baseScale * transform.scale;
      const drawWidth = data.width * finalScale;
      const drawLength = data.length * finalScale;
      const originX = ((canvas.width - drawWidth) / 2) + transform.x;
      const originY = ((canvas.height - drawLength) / 2) + transform.y;
      return { scale: finalScale, originX, originY, drawWidth, drawLength };
  };

  const getCanvasCoordinates = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
      };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode === '3D') return;
    if (e.button === 1 || e.button === 2 || e.altKey) { setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY }); return; }
    if (!isInteractive) return;
    const metrics = getMetrics(); if (!metrics) return;
    
    // Correct mouse coordinates accounting for CSS scaling
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(e);
    
    // HIT PADDING: Set to 0 for exact match in Step 3 (Industrial). 
    // Small padding for Sports can be kept if needed later, but removing for accuracy request.
    const HIT_PADDING = 0; 

    const objects = getObjects();
    const clickedObj = [...objects].reverse().find(obj => {
        const pxX = metrics.originX + (obj.x * metrics.scale);
        const pxY = metrics.originY + (obj.y * metrics.scale);
        const pxW = obj.width * metrics.scale;
        const pxH = obj.depth * metrics.scale;
        
        const hitX = pxX - HIT_PADDING;
        const hitY = pxY - HIT_PADDING;
        const hitW = pxW + (HIT_PADDING * 2);
        const hitH = pxH + (HIT_PADDING * 2);

        return mouseX >= hitX && mouseX <= hitX + hitW && mouseY >= hitY && mouseY <= hitY + hitH;
    });
    if (clickedObj) {
        const rackPxX = metrics.originX + (clickedObj.x * metrics.scale);
        const rackPxY = metrics.originY + (clickedObj.y * metrics.scale);
        setDragTarget({ id: clickedObj.id, offsetX: mouseX - rackPxX, offsetY: mouseY - rackPxY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (viewMode === '3D') return;
    if (isPanning) { 
        const dx = e.clientX - lastMousePos.x; const dy = e.clientY - lastMousePos.y;
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return; 
    }
    if (!isInteractive) return;
    const metrics = getMetrics(); if (!metrics) return;
    
    // Correct mouse coordinates
    const { x: mouseX, y: mouseY } = getCanvasCoordinates(e);
    
    const HIT_PADDING = 0; // Strict hit detection

    if (dragTarget && onRackMove) {
        const rawX = mouseX - dragTarget.offsetX;
        const rawY = mouseY - dragTarget.offsetY;
        let xMeters = (rawX - metrics.originX) / metrics.scale;
        let yMeters = (rawY - metrics.originY) / metrics.scale;
        // Snap logic (Updated for Sports Mode to 0.5m)
        const SNAP_INCREMENT = 0.5; // Always 0.5m
        xMeters = Math.round(xMeters / SNAP_INCREMENT) * SNAP_INCREMENT;
        yMeters = Math.round(yMeters / SNAP_INCREMENT) * SNAP_INCREMENT;
        
        const objects = getObjects();
        const obj = objects.find(r => r.id === dragTarget.id);
        if (obj) {
            if (mode === 'SPORTS') {
                // ALLOW MOVEMENT OUTSIDE THE FIELD (Buffer of 50m)
                xMeters = Math.max(-50, Math.min(xMeters, data.width + 50));
                yMeters = Math.max(-50, Math.min(yMeters, data.length + 50));
            } else {
                // Industrial limits (Strictly inside)
                xMeters = Math.max(0, Math.min(xMeters, data.width - obj.width));
                yMeters = Math.max(0, Math.min(yMeters, data.length - obj.depth));
            }
            onRackMove(dragTarget.id, xMeters, yMeters);
        }
        return;
    }
    // Hover logic
    const objects = getObjects();
    const hovered = [...objects].reverse().find(obj => {
        const pxX = metrics.originX + (obj.x * metrics.scale);
        const pxY = metrics.originY + (obj.y * metrics.scale);
        const pxW = obj.width * metrics.scale;
        const pxH = obj.depth * metrics.scale;
        
        const hitX = pxX - HIT_PADDING;
        const hitY = pxY - HIT_PADDING;
        const hitW = pxW + (HIT_PADDING * 2);
        const hitH = pxH + (HIT_PADDING * 2);

        return mouseX >= hitX && mouseX <= hitX + hitW && mouseY >= hitY && mouseY <= hitY + hitH;
    });
    setHoveredBlockId(hovered ? hovered.id : null);
  };

  const handleMouseUp = () => { setDragTarget(null); setIsPanning(false); };
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode === '3D') return;
    const delta = -e.deltaY; const zoomFactor = 1.1; let newScale = transform.scale;
    if (delta > 0) newScale *= zoomFactor; else newScale /= zoomFactor;
    newScale = Math.min(Math.max(0.5, newScale), 10);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  // --- RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    if (viewMode === '3D') {
      drawScene3D(ctx, canvas.width, canvas.height);
    } else {
      drawScene2D(ctx, canvas.width, canvas.height, transform);
    }
  }, [data, width, height, dragTarget, hoveredBlockId, viewMode, transform, mode]);

  return (
    <div 
        className="relative bg-white shadow-2xl shadow-black/50 rounded-sm overflow-hidden flex justify-center items-center select-none border-8 border-white ring-1 ring-gray-900 group"
        onContextMenu={(e) => e.preventDefault()} 
    >
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`max-w-full h-auto ${isInteractive ? (isPanning ? 'cursor-move' : (dragTarget ? 'cursor-grabbing' : 'cursor-grab')) : 'cursor-default'}`}
      />
      
      {viewMode === '2D' && (
          <div className="absolute bottom-4 left-4 flex gap-2">
              <button className="bg-gray-800/80 text-white p-2 rounded-full" onClick={() => setTransform(prev => ({...prev, scale: Math.min(prev.scale * 1.2, 10)}))}><ZoomIn size={16} /></button>
              <button className="bg-gray-800/80 text-white p-2 rounded-full" onClick={() => setTransform(prev => ({...prev, scale: Math.max(prev.scale / 1.2, 0.5)}))}><ZoomOut size={16} /></button>
              <button className="bg-gray-800/80 text-white p-2 rounded-full" onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}><Maximize size={16} /></button>
          </div>
      )}
    </div>
  );
});
