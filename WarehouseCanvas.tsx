
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { ProjectData, LightingOrientation, LightingMode } from '../types';
import { PALLET_COLOR, PALLET_STROKE, MEZZANINE_COLOR, MEZZANINE_STROKE, LIGHTING_COLOR, WALL_COLOR, DIMENSION_COLOR, FIXTURE_COLOR, FIXTURE_GLOW } from '../constants';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

export type CanvasHandle = {
  downloadImage: () => void;
};

interface WarehouseCanvasProps {
  data: ProjectData;
  width?: number;
  height?: number;
  isInteractive?: boolean; 
  viewMode?: '2D' | '3D';
  onRackMove?: (id: string, x: number, y: number) => void;
}

export const WarehouseCanvas = forwardRef<CanvasHandle, WarehouseCanvasProps>(({ 
  data, 
  width = 600, 
  height = 400,
  isInteractive = false,
  viewMode = '2D',
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
      const h = data.ceilingHeight || 5;

      // Calculate Scale to Fit
      const points = [
          projectIso(0, 0, 0), projectIso(w, 0, 0), projectIso(w, l, 0), projectIso(0, l, 0), // Base
          projectIso(0, 0, h), projectIso(w, 0, h), projectIso(w, l, h), projectIso(0, l, h)  // Top
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
      ctx.fillStyle = 'rgba(31, 41, 55, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Racks (Sorted by depth for painter's algorithm)
      // Sort by (x + y) approximately works for isometric Z-sorting, also consider elevation
      const sortedRacks = [...data.storage.racks].sort((a, b) => (a.x + a.y + (a.elevation || 0)) - (b.x + b.y + (b.elevation || 0)));

      sortedRacks.forEach(rack => {
          const rx = rack.x;
          const ry = rack.y;
          const rw = rack.width;
          const rd = rack.depth;
          const rh = rack.height;
          const el = rack.elevation || 0; // Elevation from ground
          
          const isMezzanine = rack.type === 'MEZZANINE';

          // Vertices Bottom (at Elevation)
          const b1 = toScreen(rx, ry, el);
          const b2 = toScreen(rx+rw, ry, el);
          const b3 = toScreen(rx+rw, ry+rd, el);
          const b4 = toScreen(rx, ry+rd, el);
          
          // Vertices Top (Elevation + Height)
          const t1 = toScreen(rx, ry, el + rh);
          const t2 = toScreen(rx+rw, ry, el + rh);
          const t3 = toScreen(rx+rw, ry+rd, el + rh);
          const t4 = toScreen(rx, ry+rd, el + rh);

          // Colors
          const colorBase = isMezzanine ? '#42C0B5' : '#F03200';
          const colorDark = isMezzanine ? '#2d8780' : '#b92b00';
          const colorDarker = isMezzanine ? '#1e5e59' : '#8a2000';
          const colorFace = isMezzanine ? 'rgba(66, 192, 181, 0.8)' : 'rgba(240, 50, 0, 0.8)';

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 0.5;

          // Faces (Right: 2-3-7-6, Left: 3-4-8-7, Top: 5-6-7-8) - Simplified, drawing visible faces
          
          // Bottom Face (Visible if floating mezzanine)
          if (el > 0) {
              ctx.beginPath();
              ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y); ctx.closePath();
              ctx.fillStyle = colorDarker;
              ctx.fill();
              ctx.stroke();
              
              // Shadow on floor
              const s1 = toScreen(rx, ry, 0);
              const s2 = toScreen(rx+rw, ry, 0);
              const s3 = toScreen(rx+rw, ry+rd, 0);
              const s4 = toScreen(rx, ry+rd, 0);
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              ctx.beginPath();
              ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y); ctx.closePath();
              ctx.fill();
          }

          // Top Face
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = isMezzanine ? colorBase : colorFace; // Top
          ctx.fill();
          ctx.stroke();

          // Right Face (Visible if looking from corner)
          ctx.beginPath();
          ctx.moveTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y); ctx.closePath();
          ctx.fillStyle = colorDark; 
          ctx.fill();
          ctx.stroke();

          // Front/Left Face
          ctx.beginPath();
          ctx.moveTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y); ctx.lineTo(t4.x, t4.y); ctx.lineTo(t3.x, t3.y); ctx.closePath();
          ctx.fillStyle = colorDarker; 
          ctx.fill();
          ctx.stroke();
      });

      // 3. Ceiling/Walls Wireframe (On top to show volume)
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

      // Labels
      const drawLabel = (text: string, x: number, y: number, color: string) => {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle = color;
        ctx.font = 'bold 14px Poppins';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
      }
      drawLabel(`${h}m`, (v000.x + v00H.x)/2 - 10, (v000.y + v00H.y)/2, '#F6C847');
      drawLabel(`${w}m`, (v000.x + vW00.x)/2, v000.y + 25, '#ffffff');
      drawLabel(`${l}m`, (vW00.x + vWL0.x)/2 + 25, (vW00.y + vWL0.y)/2, '#ffffff');
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
        ctx.fillText('Defina as dimensões do galpão', width / 2, height / 2);
        return { originX, originY, scale: finalScale, drawWidth, drawLength };
     }

     // Floor Shadow
     ctx.shadowColor = 'rgba(0,0,0,0.1)';
     ctx.shadowBlur = 10;
     ctx.fillStyle = '#ffffff';
     ctx.fillRect(originX, originY, drawWidth, drawLength);
     ctx.shadowBlur = 0;

     // Grid
     ctx.strokeStyle = '#e5e7eb';
     ctx.lineWidth = 1;
     ctx.beginPath();
     const gridStep = finalScale < 5 ? 10 : 5; 
     for(let i = gridStep; i < data.width; i+=gridStep) {
         ctx.moveTo(getX(i), getY(0)); ctx.lineTo(getX(i), getY(data.length));
     }
     for(let i = gridStep; i < data.length; i+=gridStep) {
         ctx.moveTo(getX(0), getY(i)); ctx.lineTo(getX(data.width), getY(i));
     }
     ctx.stroke();

     // Walls
     ctx.strokeStyle = WALL_COLOR;
     ctx.lineWidth = 4;
     ctx.strokeRect(originX, originY, drawWidth, drawLength);

     // Global Dimensions
     const GLOBAL_DIM_OFFSET = 30;
     ctx.strokeStyle = DIMENSION_COLOR;
     ctx.fillStyle = DIMENSION_COLOR;
     ctx.lineWidth = 2;
     
     // Width
     ctx.beginPath(); ctx.moveTo(originX, originY - GLOBAL_DIM_OFFSET); ctx.lineTo(originX + drawWidth, originY - GLOBAL_DIM_OFFSET); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(originX, originY - GLOBAL_DIM_OFFSET - 5); ctx.lineTo(originX, originY - GLOBAL_DIM_OFFSET + 5); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(originX + drawWidth, originY - GLOBAL_DIM_OFFSET - 5); ctx.lineTo(originX + drawWidth, originY - GLOBAL_DIM_OFFSET + 5); ctx.stroke();
     ctx.font = 'bold 14px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
     ctx.fillText(`${data.width}m`, originX + drawWidth/2, originY - GLOBAL_DIM_OFFSET - 5);

     // Length
     ctx.beginPath(); ctx.moveTo(originX - GLOBAL_DIM_OFFSET, originY); ctx.lineTo(originX - GLOBAL_DIM_OFFSET, originY + drawLength); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(originX - GLOBAL_DIM_OFFSET - 5, originY); ctx.lineTo(originX - GLOBAL_DIM_OFFSET + 5, originY); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(originX - GLOBAL_DIM_OFFSET - 5, originY + drawLength); ctx.lineTo(originX - GLOBAL_DIM_OFFSET + 5, originY + drawLength); ctx.stroke();
     ctx.save(); ctx.translate(originX - GLOBAL_DIM_OFFSET - 10, originY + drawLength/2); ctx.rotate(-Math.PI/2); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
     ctx.fillText(`${data.length}m`, 0, 0); ctx.restore();

     // Lighting
     const drawFixture = (xMeters: number, yMeters: number) => {
         const cx = getX(xMeters);
         const cy = getY(yMeters);
         const radius = Math.max(3, Math.min(8, 3 * (finalScale / 1)));
         ctx.shadowBlur = 8; ctx.shadowColor = FIXTURE_GLOW; ctx.fillStyle = FIXTURE_COLOR;
         ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; 
     };

     if (data.lighting.isActive) {
         ctx.strokeStyle = LIGHTING_COLOR;
         // Optimized line width: proportional to physical width (~15cm) but min 2px for visibility
         ctx.lineWidth = Math.max(2, finalScale * 0.15);
         ctx.setLineDash([5, 5]);
         ctx.beginPath();
         const { orientation, mode, value, offset, fixturesPerProfile } = data.lighting;
         const isLongitudinal = orientation === LightingOrientation.Longitudinal;
         const axisLimit = isLongitudinal ? data.width : data.length; 
         let profilePositions: number[] = [];
         if (mode === LightingMode.Quantity) {
            if (value >= 1) {
                if (value === 1) { profilePositions = [axisLimit / 2]; } else {
                    const availableSpace = axisLimit - (offset * 2);
                    const step = availableSpace / (value - 1);
                    for(let i=0; i<value; i++) { profilePositions.push(offset + (i * step)); }
                }
            }
         } else {
             // CRITICAL FIX: Ensure value is positive to prevent infinite loop/crash
             if (value > 0.01) {
                let currentPos = offset;
                let iterations = 0;
                while (currentPos < axisLimit && iterations < 5000) { 
                    profilePositions.push(currentPos); 
                    currentPos += value; 
                    iterations++;
                }
             }
         }
         profilePositions.forEach(pos => {
             if (pos > axisLimit) return;
             if (isLongitudinal) { ctx.moveTo(getX(pos), getY(0)); ctx.lineTo(getX(pos), getY(data.length)); } 
             else { ctx.moveTo(getX(0), getY(pos)); ctx.lineTo(getX(data.width), getY(pos)); }
         });
         ctx.stroke(); ctx.setLineDash([]);
         
         // Fixtures PER PROFILE (New Logic)
         const profileLength = isLongitudinal ? data.length : data.width; 
         if (fixturesPerProfile > 0 && profilePositions.length > 0) {
             const margin = 1; 
             const usableLen = profileLength - (margin * 2);
             
             profilePositions.forEach(pos => {
                 const step = fixturesPerProfile > 1 ? usableLen / (fixturesPerProfile - 1) : 0;
                 for (let i = 0; i < fixturesPerProfile; i++) {
                     const distAlong = fixturesPerProfile === 1 ? profileLength/2 : margin + (i * step);
                     if (isLongitudinal) { drawFixture(pos, distAlong); } else { drawFixture(distAlong, pos); }
                 }
             });
         }
     } 

     // Racks
     if (data.storage.isActive && data.storage.racks.length > 0) {
         // Sort so Mezzanines are on top if desired, or simple render
         const sortedRacks = [...data.storage.racks].sort((a,b) => (a.elevation || 0) - (b.elevation || 0));

         sortedRacks.forEach((rack) => {
             const isDragged = dragTarget?.id === rack.id;
             const isHovered = hoveredBlockId === rack.id;
             const isMezzanine = rack.type === 'MEZZANINE';

             const fillColor = isMezzanine ? MEZZANINE_COLOR : PALLET_COLOR;
             const strokeColor = isMezzanine ? MEZZANINE_STROKE : PALLET_STROKE;
 
             ctx.fillStyle = isDragged ? fillColor.replace('0.25', '0.4') : (isHovered ? fillColor.replace('0.25', '0.3') : fillColor);
             ctx.strokeStyle = isDragged ? '#D02B00' : strokeColor;
             ctx.lineWidth = isDragged ? 2 : 1.5;
             
             const pxX = getX(rack.x);
             const pxY = getY(rack.y);
             const pxW = toPx(rack.width);
             const pxH = toPx(rack.depth);
 
             ctx.fillRect(pxX, pxY, pxW, pxH);
             ctx.strokeRect(pxX, pxY, pxW, pxH);
 
             const fontSize = Math.max(10, Math.min(16, 11 * (finalScale / 1)));
             ctx.fillStyle = strokeColor;
             ctx.font = `bold ${fontSize}px Poppins, sans-serif`;
             ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.fillText(rack.label, pxX + pxW/2, pxY + pxH/2);
             
             if (isMezzanine) {
                  ctx.font = `${fontSize * 0.8}px Poppins, sans-serif`;
                  ctx.fillText(`E:${rack.elevation}m`, pxX + pxW/2, pxY + pxH/2 + fontSize);
             } else if (rack.height) {
                  ctx.font = `${fontSize * 0.8}px Poppins, sans-serif`;
                  ctx.fillText(`H:${rack.height}m`, pxX + pxW/2, pxY + pxH/2 + fontSize);
             }

             // Dragging Dimensions (Same for both)
             if (isDragged) {
                 const OFFSET = 35;
                 const drawDimensionLine = (x1: number, y1: number, x2: number, y2: number, text: string, color = DIMENSION_COLOR) => {
                    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                    // Arrows
                    const angle = Math.atan2(y2 - y1, x2 - x1); const headLen = 4;
                    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + headLen * Math.cos(angle-Math.PI/6), y1 + headLen * Math.sin(angle-Math.PI/6)); ctx.lineTo(x1 + headLen * Math.cos(angle+Math.PI/6), y1 + headLen * Math.sin(angle+Math.PI/6)); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - headLen * Math.cos(angle-Math.PI/6), y2 - headLen * Math.sin(angle-Math.PI/6)); ctx.lineTo(x2 - headLen * Math.cos(angle+Math.PI/6), y2 - headLen * Math.sin(angle+Math.PI/6)); ctx.fill();
                    // Text
                    ctx.font = '600 12px Poppins, sans-serif';
                    const tm = ctx.measureText(text); const cx = (x1+x2)/2; const cy = (y1+y2)/2;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillRect(cx - tm.width/2 - 4, cy - 8, tm.width + 8, 16);
                    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy);
                 };
                 const drawProjection = (x1: number, y1: number, x2: number, y2: number) => {
                    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
                };

                const WALL_DIM_COLOR = '#3b82f6';
                
                // Wall Distances
                const wallDimY = pxY + pxH + OFFSET;
                drawProjection(originX, pxY + pxH, originX, wallDimY); drawProjection(pxX, pxY + pxH, pxX, wallDimY);         
                drawDimensionLine(originX, wallDimY, pxX, wallDimY, `${rack.x.toFixed(2)}m`, WALL_DIM_COLOR);
                
                const wallDimX = pxX + pxW + OFFSET;
                drawProjection(pxX + pxW, originY, wallDimX, originY); drawProjection(pxX + pxW, pxY, wallDimX, pxY); 
                drawDimensionLine(wallDimX, originY, wallDimX, pxY, `${rack.y.toFixed(2)}m`, WALL_DIM_COLOR);

                // EDGE-TO-EDGE NEIGHBOR DIMENSIONS
                let closestGap = Infinity;
                let closestNeighbor = null;
                let gapData = { p1: {x:0, y:0}, p2: {x:0, y:0} };

                data.storage.racks.forEach(other => {
                    if (other.id === rack.id) return;
                    
                    const r1 = { x: rack.x, y: rack.y, w: rack.width, d: rack.depth };
                    const r2 = { x: other.x, y: other.y, w: other.width, d: other.depth };

                    // Check Overlaps
                    const xOverlapStart = Math.max(r1.x, r2.x);
                    const xOverlapEnd = Math.min(r1.x + r1.w, r2.x + r2.w);
                    const hasXOverlap = xOverlapStart < xOverlapEnd;

                    const yOverlapStart = Math.max(r1.y, r2.y);
                    const yOverlapEnd = Math.min(r1.y + r1.d, r2.y + r2.d);
                    const hasYOverlap = yOverlapStart < yOverlapEnd;

                    let currentGap = Infinity;
                    let currentP1 = {x:0, y:0}, currentP2 = {x:0, y:0};
                    let isAligned = false;

                    if (hasYOverlap) {
                        // Horizontal Gap (Left/Right)
                        isAligned = true;
                        if (r1.x < r2.x) { // R1 Left, R2 Right
                            currentGap = r2.x - (r1.x + r1.w);
                            const midY = (yOverlapStart + yOverlapEnd) / 2;
                            currentP1 = { x: r1.x + r1.w, y: midY };
                            currentP2 = { x: r2.x, y: midY };
                        } else { // R1 Right, R2 Left
                            currentGap = r1.x - (r2.x + r2.w);
                            const midY = (yOverlapStart + yOverlapEnd) / 2;
                            currentP1 = { x: r2.x + r2.w, y: midY };
                            currentP2 = { x: r1.x, y: midY };
                        }
                    } else if (hasXOverlap) {
                        // Vertical Gap (Top/Bottom)
                        isAligned = true;
                        if (r1.y < r2.y) { // R1 Top, R2 Bottom
                            currentGap = r2.y - (r1.y + r1.d);
                            const midX = (xOverlapStart + xOverlapEnd) / 2;
                            currentP1 = { x: midX, y: r1.y + r1.d };
                            currentP2 = { x: midX, y: r2.y };
                        } else { // R1 Bottom, R2 Top
                            currentGap = r1.y - (r2.y + r2.d);
                            const midX = (xOverlapStart + xOverlapEnd) / 2;
                            currentP1 = { x: midX, y: r2.y + r2.d };
                            currentP2 = { x: midX, y: r1.y };
                        }
                    }

                    if (isAligned && currentGap >= 0 && currentGap < closestGap) {
                        closestGap = currentGap;
                        closestNeighbor = other;
                        gapData = { p1: currentP1, p2: currentP2 };
                    }
                });

                if (closestNeighbor && isFinite(closestGap)) {
                    const cx1 = getX(gapData.p1.x);
                    const cy1 = getY(gapData.p1.y);
                    const cx2 = getX(gapData.p2.x);
                    const cy2 = getY(gapData.p2.y);
                    drawDimensionLine(cx1, cy1, cx2, cy2, `${closestGap.toFixed(2)}m`, DIMENSION_COLOR);
                }
             }
         });
     }
     
     return { originX, originY, scale: finalScale, drawWidth, drawLength };
  };

  // --- DOWNLOAD ---
  useImperativeHandle(ref, () => ({
    downloadImage: () => {
      const sourceCanvas = canvasRef.current;
      if (!sourceCanvas) return;

      const docWidth = 1200;
      const padding = 60;
      const headerHeight = 120;
      const summaryHeight = 280;
      const obsHeight = data.observations ? 150 : 0;
      
      const drawingAspectRatio = sourceCanvas.height / sourceCanvas.width;
      const drawingWidth = docWidth - (padding * 2);
      const drawingHeight = drawingWidth * drawingAspectRatio;
      
      // Extra space for 3D view
      const perspectiveHeight = 500; 

      const docHeight = headerHeight + summaryHeight + drawingHeight + obsHeight + perspectiveHeight + padding + 100;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = docWidth;
      tempCanvas.height = docHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Bg White
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0, 0, docWidth, docHeight);

      // 2. Header
      const gradient = ctx.createLinearGradient(0, 0, docWidth, 0);
      gradient.addColorStop(0, '#F6C847'); gradient.addColorStop(0.5, '#F03200'); gradient.addColorStop(1, '#7F3F98');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, docWidth, 10);

      ctx.fillStyle = '#1f2937'; ctx.font = 'bold 48px Poppins, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText("LogiSketch Pro", padding, 80);
      ctx.fillStyle = '#6b7280'; ctx.font = '500 20px Poppins, sans-serif';
      ctx.fillText("DOCUMENTO TÉCNICO DE PROJETO", padding, 110);
      ctx.beginPath(); ctx.arc(docWidth - padding - 20, 70, 20, 0, Math.PI * 2); ctx.fillStyle = '#F03200'; ctx.fill();

      // 3. Summary Grid (Reuse logic)
      const startY = headerHeight + 20;
      const boxW = (docWidth - (padding * 2) - 40) / 3;
      const boxH = 100;
      const drawBox = (title: string, value: string, sub: string, col: number, row: number, color: string) => {
         const x = padding + (col * (boxW + 20)); const y = startY + (row * (boxH + 20));
         ctx.fillStyle = '#f9fafb'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.fillRect(x, y, boxW, boxH); ctx.strokeRect(x, y, boxW, boxH);
         ctx.fillStyle = color; ctx.fillRect(x, y, 4, boxH);
         ctx.fillStyle = '#6b7280'; ctx.font = '600 14px Poppins, sans-serif'; ctx.fillText(title.toUpperCase(), x + 20, y + 30);
         ctx.fillStyle = '#111827'; ctx.font = 'bold 24px Poppins, sans-serif'; ctx.fillText(value, x + 20, y + 60);
         if (sub) { ctx.fillStyle = color; ctx.font = '500 14px Poppins, sans-serif'; ctx.fillText(sub, x + 20, y + 82); }
      };
      
      const fixturesCount = data.lighting.isActive 
        ? (data.lighting.fixturesPerProfile > 0 ? "Definido/Perfil" : "N/A") 
        : "N/A";
        
      drawBox("Dimensões", `${data.width}m x ${data.length}m`, `Área: ${data.width * data.length}m²`, 0, 0, '#6b7280');
      drawBox("Pé Direito", `${data.ceilingHeight}m`, "Altura Útil", 1, 0, '#6b7280');
      drawBox("Lux Alvo", `${data.luxRequired} lux`, "Requisito", 2, 0, '#F6C847');
      drawBox("Iluminação", fixturesCount, data.lighting.isActive ? `Perfilado: ${data.lighting.orientation === 'LONGITUDINAL' ? '// Comp' : '// Larg'}` : "Sem Perfilado", 0, 1, '#42C0B5');
      const totalRacks = data.storage.racks.filter(r => r.type === 'RACK').length;
      const totalMezzanines = data.storage.racks.filter(r => r.type === 'MEZZANINE').length;
      drawBox("Armazenagem", `${totalRacks} Racks`, `${totalMezzanines} Mezaninos`, 1, 1, '#F03200');

      // 4. Draw 2D Layout
      const imgY = startY + (boxH * 2) + 60;
      ctx.fillStyle = '#111827'; ctx.font = 'bold 20px Poppins, sans-serif'; ctx.fillText("LAYOUT GRÁFICO (2D)", padding, imgY - 20);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.strokeRect(padding, imgY, drawingWidth, drawingHeight);
      
      ctx.save();
      ctx.translate(padding, imgY);
      const c2d = document.createElement('canvas'); c2d.width = 1200; c2d.height = 1200 * drawingAspectRatio;
      const ctx2d = c2d.getContext('2d');
      if (ctx2d) drawScene2D(ctx2d, c2d.width, c2d.height);
      ctx.drawImage(c2d, 0, 0, drawingWidth, drawingHeight);
      ctx.restore();

      // 5. Draw 3D Perspective
      const pY = imgY + drawingHeight + 60;
      ctx.fillStyle = '#111827'; ctx.font = 'bold 20px Poppins, sans-serif'; ctx.fillText("PERSPECTIVA ISOMÉTRICA (3D)", padding, pY - 20);
      ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(padding, pY, drawingWidth, perspectiveHeight);
      
      const c3d = document.createElement('canvas'); c3d.width = 1200; c3d.height = 600;
      const ctx3d = c3d.getContext('2d');
      if (ctx3d) drawScene3D(ctx3d, c3d.width, c3d.height, true); // Transparent BG
      // Draw a dark background for the 3D area on the doc
      ctx.fillStyle = '#111827'; ctx.fillRect(padding, pY, drawingWidth, perspectiveHeight);
      ctx.drawImage(c3d, 0,0, c3d.width, c3d.height, padding, pY, drawingWidth, perspectiveHeight);

      // 6. Observations
      let footerY = pY + perspectiveHeight + 30;
      if (data.observations) {
        ctx.fillStyle = '#f3f4f6'; ctx.fillRect(padding, footerY, drawingWidth, 100);
        ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(padding, footerY, drawingWidth, 100);
        ctx.fillStyle = '#1f2937'; ctx.font = 'bold 16px Poppins, sans-serif'; ctx.fillText("OBSERVAÇÕES DO PROJETO:", padding + 20, footerY + 30);
        ctx.fillStyle = '#4b5563'; ctx.font = '14px Poppins, sans-serif';
        ctx.fillText(data.observations.substring(0, 150) + (data.observations.length > 150 ? '...' : ''), padding + 20, footerY + 60);
      }

      ctx.fillStyle = '#9ca3af'; ctx.font = '12px Poppins, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Gerado por LogiSketch Pro - ${new Date().toLocaleDateString()}`, docWidth/2, docHeight - 20);

      const link = document.createElement('a');
      link.download = `LogiSketch-Relatorio-${new Date().toISOString().slice(0,10)}.png`;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
  }));

  // --- MOUSE HANDLERS (Same structure, using helper) ---
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode === '3D') return;
    const delta = -e.deltaY; const zoomFactor = 1.1; let newScale = transform.scale;
    if (delta > 0) newScale *= zoomFactor; else newScale /= zoomFactor;
    newScale = Math.min(Math.max(0.5, newScale), 10);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const startPan = (e: React.MouseEvent) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
          e.preventDefault(); setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY });
      }
  };

  const handlePanMove = (e: React.MouseEvent) => {
      if (isPanning) {
          const dx = e.clientX - lastMousePos.x; const dy = e.clientY - lastMousePos.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          setLastMousePos({ x: e.clientX, y: e.clientY });
      }
  };

  const endPan = () => { setIsPanning(false); };

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode === '3D') return;
    if (e.button === 1 || e.button === 2 || e.altKey) { startPan(e); return; }
    if (!isInteractive) return;
    const metrics = getMetrics(); if (!metrics) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const clickedRack = [...data.storage.racks].reverse().find(rack => {
        const pxX = metrics.originX + (rack.x * metrics.scale);
        const pxY = metrics.originY + (rack.y * metrics.scale);
        const pxW = rack.width * metrics.scale;
        const pxH = rack.depth * metrics.scale;
        return mouseX >= pxX && mouseX <= pxX + pxW && mouseY >= pxY && mouseY <= pxY + pxH;
    });
    if (clickedRack) {
        const rackPxX = metrics.originX + (clickedRack.x * metrics.scale);
        const rackPxY = metrics.originY + (clickedRack.y * metrics.scale);
        setDragTarget({ id: clickedRack.id, offsetX: mouseX - rackPxX, offsetY: mouseY - rackPxY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (viewMode === '3D') return;
    if (isPanning) { handlePanMove(e); return; }
    if (!isInteractive) return;
    const metrics = getMetrics(); if (!metrics) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;

    if (dragTarget && onRackMove) {
        const rawX = mouseX - dragTarget.offsetX;
        const rawY = mouseY - dragTarget.offsetY;
        let xMeters = (rawX - metrics.originX) / metrics.scale;
        let yMeters = (rawY - metrics.originY) / metrics.scale;
        // Snap logic
        const SNAP_INCREMENT = 0.5;
        xMeters = Math.round(xMeters / SNAP_INCREMENT) * SNAP_INCREMENT;
        yMeters = Math.round(yMeters / SNAP_INCREMENT) * SNAP_INCREMENT;
        const rack = data.storage.racks.find(r => r.id === dragTarget.id);
        if (rack) {
            xMeters = Math.max(0, Math.min(xMeters, data.width - rack.width));
            yMeters = Math.max(0, Math.min(yMeters, data.length - rack.depth));
            onRackMove(dragTarget.id, xMeters, yMeters);
        }
        return;
    }

    const hovered = data.storage.racks.find(rack => {
        const pxX = metrics.originX + (rack.x * metrics.scale);
        const pxY = metrics.originY + (rack.y * metrics.scale);
        const pxW = rack.width * metrics.scale;
        const pxH = rack.depth * metrics.scale;
        return mouseX >= pxX && mouseX <= pxX + pxW && mouseY >= pxY && mouseY <= pxY + pxH;
    });
    setHoveredBlockId(hovered ? hovered.id : null);
  };

  const handleMouseUp = () => { setDragTarget(null); endPan(); };

  // --- RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    if (viewMode === '3D') {
      drawScene3D(ctx, canvas.width, canvas.height);
    } else {
      drawScene2D(ctx, canvas.width, canvas.height, transform);
    }
  }, [data, width, height, dragTarget, hoveredBlockId, viewMode, transform]);

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
              <button 
                className="bg-gray-800/80 text-white p-2 rounded-full hover:bg-silicon-orange transition-colors"
                onClick={() => setTransform(prev => ({...prev, scale: Math.min(prev.scale * 1.2, 10)}))}
                title="Zoom In"
              >
                  <ZoomIn size={16} />
              </button>
              <button 
                className="bg-gray-800/80 text-white p-2 rounded-full hover:bg-silicon-orange transition-colors"
                onClick={() => setTransform(prev => ({...prev, scale: Math.max(prev.scale / 1.2, 0.5)}))}
                title="Zoom Out"
              >
                  <ZoomOut size={16} />
              </button>
              <button 
                className="bg-gray-800/80 text-white p-2 rounded-full hover:bg-silicon-orange transition-colors"
                onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
                title="Reset View"
              >
                  <Maximize size={16} />
              </button>
              <div className="bg-gray-800/50 px-3 py-2 rounded-full text-white text-[10px] flex items-center gap-1">
                 <Move size={10} /> <span>Pan: Alt + Drag</span>
              </div>
          </div>
      )}
    </div>
  );
});
