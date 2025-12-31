




import React, { useRef, useState, useEffect } from 'react';
import { MapNode, MapEdge, NodeType, ThemeMode } from '../types';
import { Move, Plus, MapPin, Box, Navigation, Mountain, Waves, Pause, ZoomIn, ZoomOut, Maximize, Trees, Globe, Castle, Landmark, Warehouse, MousePointer2, LogIn, Anchor, Construction } from 'lucide-react';
import { EditorHints, ZoomControls } from './EditorOverlay';

interface WorldEditorProps {
  nodes: MapNode[];
  edges: MapEdge[];
  selectedId?: string;
  onNodeSelect: (id: string) => void;
  onEdgeSelect: (id: string) => void;
  onNodeUpdate: (id: string, x: number, y: number, w?: number, h?: number) => void;
  onAddNode: (x: number, y: number, type: NodeType) => void;
  onAddEdge: (sourceId: string, targetId: string) => void;
  onOpenBuilding: (nodeId: string) => void;
  theme?: ThemeMode;
}

type ToolCategory = 'INFRA' | 'NATURE' | 'LIVING' | 'SPECIAL';

export const WorldEditor: React.FC<WorldEditorProps> = ({
  nodes,
  edges,
  selectedId,
  onNodeSelect,
  onEdgeSelect,
  onNodeUpdate,
  onAddNode,
  onAddEdge,
  onOpenBuilding,
  theme = 'BLUEPRINT'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // View Transform State (Pan & Zoom)
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });

  const [interactionState, setInteractionState] = useState<{
    mode: 'DRAG' | 'RESIZE' | 'CONNECT' | 'PAN' | 'IDLE';
    targetId: string | null;
    startPos: { x: number; y: number }; // World Coordinates for Drag/Resize
    startScreenPos: { x: number; y: number }; // Screen Coordinates for Panning
    initialNode?: { x: number; y: number; w: number; h: number };
    initialView?: { x: number; y: number }; // For Panning
  }>({ mode: 'IDLE', targetId: null, startPos: { x: 0, y: 0 }, startScreenPos: { x: 0, y: 0 } });
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Current World Pos
  const [addTool, setAddTool] = useState<NodeType>(NodeType.LOCATION);
  const [toolCategory, setToolCategory] = useState<ToolCategory>('LIVING');

  // --- Coordinate Conversion Helpers ---

  // Get raw point in SVG coordinate system (ignoring our custom zoom/pan)
  const getRawSVGPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (clientX - CTM.e) / CTM.a,
      y: (clientY - CTM.f) / CTM.d
    };
  };

  // Get logical point in the "World" (accounting for zoom/pan)
  const getWorldPoint = (clientX: number, clientY: number) => {
    const raw = getRawSVGPoint(clientX, clientY);
    return {
      x: (raw.x - viewTransform.x) / viewTransform.k,
      y: (raw.y - viewTransform.y) / viewTransform.k
    };
  };

  // --- Zoom Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const zoomIntensity = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = Math.exp(direction * zoomIntensity);
    const newK = Math.max(0.1, Math.min(5, viewTransform.k * factor)); // Clamp zoom 0.1x to 5x

    // Zoom towards mouse pointer
    const rawPt = getRawSVGPoint(e.clientX, e.clientY);
    const newX = rawPt.x - (rawPt.x - viewTransform.x) * (newK / viewTransform.k);
    const newY = rawPt.y - (rawPt.y - viewTransform.y) * (newK / viewTransform.k);

    setViewTransform({ x: newX, y: newY, k: newK });
  };

  const handleZoom = (direction: 1 | -1) => {
      const centerRaw = getRawSVGPoint(window.innerWidth / 2, window.innerHeight / 2);
      const factor = direction > 0 ? 1.2 : 0.8;
      const newK = Math.max(0.1, Math.min(5, viewTransform.k * factor));

      const newX = centerRaw.x - (centerRaw.x - viewTransform.x) * (newK / viewTransform.k);
      const newY = centerRaw.y - (centerRaw.y - viewTransform.y) * (newK / viewTransform.k);
      
      setViewTransform({ x: newX, y: newY, k: newK });
  };

  const resetView = () => {
      setViewTransform({ x: 0, y: 0, k: 1 });
  };

  // --- Mouse Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'BODY' | 'HANDLE') => {
    const worldPt = getWorldPoint(e.clientX, e.clientY);
    e.stopPropagation();
    
    const node = nodes.find(n => n.id === id);
    const initialNode = node ? { x: node.x, y: node.y, w: node.w || 50, h: node.h || 40 } : undefined;

    if (e.button === 2) { // Right click connect
      e.preventDefault();
      setInteractionState({ 
         mode: 'CONNECT', 
         targetId: id, 
         startPos: worldPt, 
         startScreenPos: { x: e.clientX, y: e.clientY } 
      });
    } else if (type === 'HANDLE') {
       setInteractionState({ 
          mode: 'RESIZE', 
          targetId: id, 
          startPos: worldPt, 
          initialNode, 
          startScreenPos: { x: e.clientX, y: e.clientY } 
       });
    } else {
       setInteractionState({ 
          mode: 'DRAG', 
          targetId: id, 
          startPos: worldPt, 
          initialNode, 
          startScreenPos: { x: e.clientX, y: e.clientY } 
       });
       onNodeSelect(id);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
     const startScreenPos = { x: e.clientX, y: e.clientY };

     // Middle click or Left click on BG -> Pan
     // NOTE: We deliberately exclude Shift+Click from Pan to allow Add Node
     if (e.button === 1 || (e.button === 0 && !e.shiftKey)) {
        setInteractionState({
           mode: 'PAN',
           targetId: null,
           startPos: { x: 0, y: 0 },
           startScreenPos: startScreenPos,
           initialView: { x: viewTransform.x, y: viewTransform.y }
        });
     } else {
         // Even if we don't PAN, we MUST record the startScreenPos so that handleBgClick
         // can correctly calculate the distance and determine if it was a click or drag.
         setInteractionState(prev => ({
             ...prev,
             startScreenPos: startScreenPos,
             mode: 'IDLE'
         }));
     }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPt = getWorldPoint(e.clientX, e.clientY);
    setMousePos(worldPt);

    if (interactionState.mode === 'PAN' && interactionState.initialView) {
       const dx = e.clientX - interactionState.startScreenPos.x;
       const dy = e.clientY - interactionState.startScreenPos.y;
       setViewTransform(prev => ({
          ...prev,
          x: interactionState.initialView!.x + dx,
          y: interactionState.initialView!.y + dy
       }));
    } else if (interactionState.mode === 'DRAG' && interactionState.targetId && interactionState.initialNode) {
      const dx = worldPt.x - interactionState.startPos.x;
      const dy = worldPt.y - interactionState.startPos.y;
      onNodeUpdate(
        interactionState.targetId, 
        interactionState.initialNode.x + dx, 
        interactionState.initialNode.y + dy
      );
    } else if (interactionState.mode === 'RESIZE' && interactionState.targetId && interactionState.initialNode) {
      const dx = worldPt.x - interactionState.startPos.x;
      const dy = worldPt.y - interactionState.startPos.y;
      const newW = Math.max(20, interactionState.initialNode.w + dx);
      const newH = Math.max(20, interactionState.initialNode.h + dy);
      onNodeUpdate(
        interactionState.targetId, 
        interactionState.initialNode.x, 
        interactionState.initialNode.y,
        newW,
        newH
      );
    }
  };

  const handleMouseUp = (e: React.MouseEvent, targetId?: string) => {
    if (interactionState.mode === 'CONNECT' && interactionState.targetId && targetId && interactionState.targetId !== targetId) {
      onAddEdge(interactionState.targetId, targetId);
    }
    
    setInteractionState(prev => ({ ...prev, mode: 'IDLE', targetId: null }));
  };

  const handleBgClick = (e: React.MouseEvent) => {
    const dist = Math.hypot(e.clientX - interactionState.startScreenPos.x, e.clientY - interactionState.startScreenPos.y);
    
    // If we just panned, dist will be > 5.
    if (dist > 5) return; 

    if (e.target === svgRef.current) {
      const pt = getWorldPoint(e.clientX, e.clientY);
      if (e.shiftKey) {
        onAddNode(pt.x, pt.y, addTool);
      } else {
        onNodeSelect(''); // Deselect
      }
    }
  };

  const getNodeDimensions = (node: MapNode) => {
     // Defaults if not set
     return {
        w: node.w || 60,
        h: node.h || 40
     };
  };

  // --- Theme Style Helpers ---
  const getThemeStyles = () => {
     switch(theme) {
        case 'INK': return {
            primary: '#000000',
            fill: '#f5f5f7',
            highlight: '#b91c1c',
            text: '#000000',
            strokeWidth: 2.5,
            strokeLinecap: 'round' as 'round',
            radius: 1,
            filter: 'url(#ink-blur)',
            strokeDasharray: 'none'
        };
        case 'CYBERPUNK': return {
            primary: '#00ffff',
            fill: 'rgba(0, 20, 20, 0.8)',
            highlight: '#ff00ff',
            text: '#00ffff',
            strokeWidth: 1.5,
            radius: 0,
            filter: 'url(#neon-glow)',
            strokeDasharray: 'none'
        };
        case 'CARTOON': return {
            primary: '#000000',
            fill: '#ffffff',
            highlight: '#ff4500',
            text: '#000000',
            strokeWidth: 4, // Very Bold
            radius: 8,
            filter: '',
            strokeDasharray: 'none'
        };
        case 'SCRAPBOOK': return {
            primary: '#db2777', // Pinkish/Crayon
            fill: '#ffffff',
            highlight: '#f59e0b', // Amber
            text: '#4b5563',
            strokeWidth: 2,
            radius: 2,
            filter: 'url(#hand-drawn)', // Wobbly line
            strokeDasharray: 'none'
        };
        case 'BLUEPRINT': 
        default: return { 
            primary: '#38bdf8', 
            fill: '#1e293b', 
            highlight: '#facc15', 
            text: '#e2e8f0',
            strokeWidth: 2,
            radius: 0,
            filter: '',
            strokeDasharray: '5,5'
        };
     }
  };

  const c = getThemeStyles();

  // Rendering helpers (Shape rendering logic removed for brevity, it's identical to previous version)
  const renderNodeShape = (node: MapNode, isSelected: boolean) => {
     const { w, h } = getNodeDimensions(node);
     const strokeColor = isSelected ? c.highlight : c.primary;
     const strokeWidth = isSelected ? c.strokeWidth + 1 : c.strokeWidth;

     const commonProps = {
        stroke: strokeColor,
        strokeWidth,
        fill: c.fill,
        filter: c.filter,
        strokeLinecap: c.strokeLinecap || 'butt' as 'butt' | 'round' | 'square',
        strokeDasharray: 'none'
     };
     
     if (theme === 'CYBERPUNK') {
        commonProps.fill = isSelected ? 'rgba(255, 0, 255, 0.2)' : 'rgba(0, 255, 255, 0.1)';
     } else if (theme === 'SCRAPBOOK') {
        commonProps.fill = 'rgba(255, 255, 255, 0.8)';
     }

     switch (node.type) {
        case NodeType.MOUNTAIN:
           return (
              <g>
                 <path d={`M${w/2},0 L${w},${h} L0,${h} Z`} {...commonProps} strokeLinejoin="round" />
                 <path d={`M${w/2},0 L${w*0.65},${h*0.3} L${w*0.5},${h*0.25} L${w*0.35},${h*0.3} Z`} fill={strokeColor} opacity={0.3} />
              </g>
           );
        case NodeType.RIVER:
           // Rectangular River
           return (
             <rect 
                width={w} height={h} 
                fill={theme === 'BLUEPRINT' ? '#3b82f6' : (theme === 'INK' ? '#000' : '#60a5fa')} 
                fillOpacity={theme === 'BLUEPRINT' ? 0.3 : 0.5} 
                stroke={strokeColor} 
                strokeWidth={strokeWidth} 
                strokeDasharray={theme === 'BLUEPRINT' ? 'none' : c.strokeDasharray}
             />
           );
        case NodeType.OCEAN:
           return (
             <g>
                <rect 
                   width={w} height={h} 
                   fill={theme === 'BLUEPRINT' ? '#1e3a8a' : '#2563eb'} 
                   fillOpacity={0.6} 
                   stroke={strokeColor} 
                   strokeWidth={strokeWidth}
                />
                <path d={`M${w*0.2},${h*0.3} Q${w*0.3},${h*0.2} ${w*0.4},${h*0.3} T${w*0.6},${h*0.3}`} fill="none" stroke={strokeColor} strokeOpacity={0.5} />
                <path d={`M${w*0.5},${h*0.6} Q${w*0.6},${h*0.5} ${w*0.7},${h*0.6} T${w*0.9},${h*0.6}`} fill="none" stroke={strokeColor} strokeOpacity={0.5} />
             </g>
           );
        case NodeType.ROAD:
           return (
             <g>
               <rect 
                  width={w} height={h} 
                  fill={theme === 'BLUEPRINT' ? '#334155' : '#4b5563'} 
                  stroke="none"
               />
               <line x1={0} y1={0} x2={w} y2={0} stroke={strokeColor} strokeWidth={1} />
               <line x1={0} y1={h} x2={w} y2={h} stroke={strokeColor} strokeWidth={1} />
               {/* Center Line */}
               {w > h ? (
                  <line x1={0} y1={h/2} x2={w} y2={h/2} stroke={strokeColor} strokeWidth={1} strokeDasharray="10 10" strokeOpacity={0.5} />
               ) : (
                  <line x1={w/2} y1={0} x2={w/2} y2={h} stroke={strokeColor} strokeWidth={1} strokeDasharray="10 10" strokeOpacity={0.5} />
               )}
             </g>
           );
        case NodeType.BRIDGE:
           return <g><rect width={w} height={h} {...commonProps} /><path d={`M${w*0.2},0 V${h} M${w*0.8},0 V${h}`} stroke={strokeColor} strokeWidth={2}/><line x1="0" y1={h/2} x2={w} y2={h/2} stroke={strokeColor} strokeWidth={1} strokeDasharray="4"/></g>;
        case NodeType.FOREST:
           return <g><path d={`M${w*0.5},${h*0.1} L${w*0.8},${h*0.6} L${w*0.2},${h*0.6} Z`} {...commonProps} /><path d={`M${w*0.3},${h*0.4} L${w*0.6},${h*0.9} L${w*0.0},${h*0.9} Z`} {...commonProps} /><path d={`M${w*0.7},${h*0.4} L${w*1.0},${h*0.9} L${w*0.4},${h*0.9} Z`} {...commonProps} /></g>;
        case NodeType.ISLAND:
           return <path d={`M${w*0.2},${h*0.2} Q${w*0.5},0 ${w*0.8},${h*0.2} Q${w},${h*0.5} ${w*0.8},${h*0.8} Q${w*0.5},${h} ${w*0.2},${h*0.8} Q0,${h*0.5} ${w*0.2},${h*0.2}`} {...commonProps} strokeLinejoin="round" />;
        case NodeType.CASTLE:
           return <g><rect x={w*0.2} y={h*0.3} width={w*0.6} height={h*0.7} {...commonProps} /><rect x={0} y={0} width={w*0.25} height={h} {...commonProps} /><rect x={w*0.75} y={0} width={w*0.25} height={h} {...commonProps} /><path d={`M0,0 h${w*0.08} v${h*0.1} h${w*0.09} v-${h*0.1} h${w*0.08}`} stroke={strokeColor} fill="none" /><path d={`M${w*0.75},0 h${w*0.08} v${h*0.1} h${w*0.09} v-${h*0.1} h${w*0.08}`} stroke={strokeColor} fill="none" /><path d={`M${w*0.4},${h} v-${h*0.3} a${w*0.1},${w*0.1} 0 0 1 ${w*0.2},0 v${h*0.3}`} fill="none" stroke={strokeColor} /></g>;
        case NodeType.TOWER:
           return <g><rect x={w*0.25} y={h*0.3} width={w*0.5} height={h*0.7} {...commonProps} /><path d={`M${w*0.2},${h*0.3} L${w*0.5},0 L${w*0.8},${h*0.3} Z`} {...commonProps} /></g>;
        case NodeType.VILLAGE:
           return <g><path d={`M0,${h*0.4} L${w*0.3},0 L${w*0.6},${h*0.4} v${h*0.6} h-${w*0.6} Z`} {...commonProps} /><path d={`M${w*0.5},${h*0.6} L${w*0.75},${h*0.3} L${w},${h*0.6} v${h*0.4} h-${w*0.5} Z`} {...commonProps} /></g>;
        case NodeType.DUNGEON:
           return <g><path d={`M0,${h} V${h*0.5} C0,0 ${w},0 ${w},${h*0.5} V${h} Z`} {...commonProps} /><circle cx={w*0.3} cy={h*0.4} r={w*0.1} fill={strokeColor} opacity={0.5} /><circle cx={w*0.7} cy={h*0.4} r={w*0.1} fill={strokeColor} opacity={0.5} /><path d={`M${w*0.4},${h*0.7} h${w*0.2}`} stroke={strokeColor} strokeWidth={2} /></g>;
        case NodeType.SECT:
           return <g><rect x={w*0.1} y={h*0.4} width={w*0.8} height={h*0.6} {...commonProps} /><path d={`M0,${h*0.4} Q${w*0.1},${h*0.3} ${w*0.2},${h*0.2} L${w*0.8},${h*0.2} Q${w*0.9},${h*0.3} ${w},${h*0.4}`} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} /><line x1={w*0.2} y1={h*0.2} x2={w*0.8} y2={h*0.2} stroke={strokeColor} strokeWidth={strokeWidth} /></g>;
        case NodeType.PAGODA:
           return <g><rect x={w*0.3} y={h*0.1} width={w*0.4} height={h*0.9} stroke="none" fill={commonProps.fill} /><path d={`M${w*0.2},${h*0.3} L${w*0.8},${h*0.3} L${w*0.5},${h*0.1} Z`} {...commonProps} /><path d={`M${w*0.15},${h*0.6} L${w*0.85},${h*0.6} L${w*0.5},${h*0.3} Z`} {...commonProps} /><path d={`M${w*0.1},${h*0.9} L${w*0.9},${h*0.9} L${w*0.5},${h*0.6} Z`} {...commonProps} /></g>;
        case NodeType.CAVE:
           return <path d={`M0,${h} Q${w*0.1},${h*0.2} ${w*0.5},0 Q${w*0.9},${h*0.2} ${w},${h} Z`} {...commonProps} />;
        case NodeType.CITY_BLOCK:
           return <g><rect x={0} y={0} width={w} height={h} {...commonProps} /><line x1={w/2} y1={0} x2={w/2} y2={h} stroke={strokeColor} strokeOpacity={0.3} /><line x1={0} y1={h/2} x2={w} y2={h/2} stroke={strokeColor} strokeOpacity={0.3} /><rect x={w*0.1} y={h*0.1} width={w*0.3} height={h*0.3} fill={strokeColor} opacity={0.2} /><rect x={w*0.6} y={h*0.6} width={w*0.3} height={h*0.3} fill={strokeColor} opacity={0.2} /></g>;
        case NodeType.SLUM:
           return <g><rect width={w} height={h} stroke="none" fill={commonProps.fill} opacity={0.5} /><rect x={0} y={h*0.2} width={w*0.4} height={h*0.4} {...commonProps} /><rect x={w*0.3} y={h*0.5} width={w*0.3} height={h*0.5} {...commonProps} /><rect x={w*0.5} y={0} width={w*0.5} height={h*0.4} {...commonProps} /></g>;
        case NodeType.FACTORY:
           return <g><rect x={0} y={h*0.4} width={w} height={h*0.6} {...commonProps} /><path d={`M0,${h*0.4} L0,0 L${w*0.33},${h*0.4} L${w*0.33},0 L${w*0.66},${h*0.4} L${w*0.66},0 L${w},${h*0.4}`} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} /><circle cx={w*0.2} cy={-10} r={5} fill={strokeColor} opacity={0.3} /><circle cx={w*0.3} cy={-25} r={8} fill={strokeColor} opacity={0.2} /></g>;
        case NodeType.HUB:
           return <circle r={w/2} cx={w/2} cy={h/2} {...commonProps} />;
        default: 
           return <rect width={w} height={h} {...commonProps} rx={c.radius} />;
     }
  };

  // Helper for missing icons
  const ArrowUp = ({ size = 24, ...props }: any) => <svg width={size} height={size} {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>;
  const Building2 = ({ size = 24, ...props }: any) => <svg width={size} height={size} {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
  const CircleHalf = ({ size = 24, ...props }: any) => <svg width={size} height={size} {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2"/><path d="M12 2v20"/></svg>;
  const RoadIcon = ({ size = 24, ...props }: any) => <svg width={size} height={size} {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="2" x2="12" y2="22" strokeDasharray="4 2" /></svg>;

  // Tools Configuration (Reorganized)
  const TOOLS: Record<ToolCategory, { t: NodeType, i: React.ReactNode, label: string }[]> = {
      INFRA: [
          { t: NodeType.ROAD, i: <div className="w-5 h-5 flex items-center justify-center"><RoadIcon size={16} /></div>, label: '道路' },
          { t: NodeType.BRIDGE, i: <div className="w-5 h-5 flex items-center justify-center"><Pause size={16} className="rotate-90"/></div>, label: '桥梁' },
          { t: NodeType.HUB, i: <div className="w-5 h-5 flex items-center justify-center"><Plus size={16} /></div>, label: '枢纽' },
          { t: NodeType.TRANSIT, i: <div className="w-5 h-5 flex items-center justify-center"><Navigation size={16} /></div>, label: '中转' },
      ],
      NATURE: [
          { t: NodeType.OCEAN, i: <div className="w-5 h-5 flex items-center justify-center"><Anchor size={16} /></div>, label: '海洋' },
          { t: NodeType.RIVER, i: <div className="w-5 h-5 flex items-center justify-center"><Waves size={16} /></div>, label: '河流' },
          { t: NodeType.MOUNTAIN, i: <div className="w-5 h-5 flex items-center justify-center"><Mountain size={16} /></div>, label: '山脉' },
          { t: NodeType.FOREST, i: <div className="w-5 h-5 flex items-center justify-center"><Trees size={16} /></div>, label: '森林' },
          { t: NodeType.ISLAND, i: <div className="w-5 h-5 flex items-center justify-center"><Globe size={16} /></div>, label: '岛屿' },
      ],
      LIVING: [
          { t: NodeType.LOCATION, i: <div className="w-5 h-5 flex items-center justify-center"><Box size={16} /></div>, label: '地点' },
          { t: NodeType.CITY_BLOCK, i: <div className="w-5 h-5 flex items-center justify-center"><Building2 size={16} /></div>, label: '街区' },
          { t: NodeType.VILLAGE, i: <div className="w-5 h-5 flex items-center justify-center"><Box size={16} /></div>, label: '村庄' },
          { t: NodeType.SLUM, i: <div className="w-5 h-5 flex items-center justify-center"><Box size={16} /></div>, label: '贫民窟' },
      ],
      SPECIAL: [
          { t: NodeType.CASTLE, i: <div className="w-5 h-5 flex items-center justify-center"><Castle size={16} /></div>, label: '城堡' },
          { t: NodeType.TOWER, i: <div className="w-5 h-5 flex items-center justify-center"><Landmark size={16} /></div>, label: '高塔' },
          { t: NodeType.SECT, i: <div className="w-5 h-5 flex items-center justify-center"><Landmark size={16} /></div>, label: '宗门' },
          { t: NodeType.PAGODA, i: <div className="w-5 h-5 flex items-center justify-center"><ArrowUp size={16} /></div>, label: '宝塔' },
          { t: NodeType.CAVE, i: <div className="w-5 h-5 flex items-center justify-center"><CircleHalf size={16} /></div>, label: '洞府' },
          { t: NodeType.FACTORY, i: <div className="w-5 h-5 flex items-center justify-center"><Warehouse size={16} /></div>, label: '工厂' },
          { t: NodeType.DUNGEON, i: <div className="w-5 h-5 flex items-center justify-center"><Construction size={16} /></div>, label: '地牢' },
      ]
  };

  return (
    <div 
      className="flex-1 h-full bg-blueprint-900 blueprint-grid relative overflow-hidden flex flex-col transition-colors duration-300"
      style={{
         backgroundPosition: `${viewTransform.x}px ${viewTransform.y}px`,
         backgroundSize: `${40 * viewTransform.k}px ${40 * viewTransform.k}px`
      }}
    >
      {/* Enhanced Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blueprint-800/95 backdrop-blur rounded-lg border border-blueprint-700 shadow-xl z-20 flex flex-col overflow-hidden">
          
          {/* Category Tabs */}
          <div className="flex border-b border-blueprint-700 bg-blueprint-950/50">
              {[
                  { id: 'INFRA', label: '基础/设施' },
                  { id: 'NATURE', label: '自然/地形' },
                  { id: 'LIVING', label: '聚落/区域' },
                  { id: 'SPECIAL', label: '特殊建筑' },
              ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setToolCategory(cat.id as ToolCategory)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${toolCategory === cat.id ? 'bg-blueprint-700 text-white' : 'text-blueprint-500 hover:bg-blueprint-800 hover:text-white'}`}
                  >
                      {cat.label}
                  </button>
              ))}
          </div>

          {/* Tool Buttons */}
          <div className="flex p-1 gap-1 justify-center">
            {TOOLS[toolCategory].map(tool => (
                <button
                key={tool.t}
                onClick={() => setAddTool(tool.t)}
                className={`p-2 rounded flex flex-col items-center gap-1 min-w-[50px] transition-all ${addTool === tool.t ? 'bg-blueprint-500 text-blueprint-900 shadow-sm scale-105' : 'text-blueprint-500 hover:bg-blueprint-700'}`}
                title={`Shift+点击 添加 ${tool.label}`}
                >
                    {tool.i}
                    <span className="text-[11px] font-mono uppercase">{tool.label}</span>
                </button>
            ))}
          </div>
      </div>

      {/* Editor Hints and Zoom Controls remain unchanged */}
      <EditorHints items={[
         "SHIFT + 点击: 添加节点",
         "左键/中键拖拽画布: 平移",
         "左键拖拽节点: 移动",
         "右键可从建筑中拖出线",
         `滚轮: 缩放 (${Math.round(viewTransform.k * 100)}%)`
      ]} />

      <ZoomControls 
         onZoomIn={() => handleZoom(1)} 
         onZoomOut={() => handleZoom(-1)} 
         onReset={resetView} 
         scale={viewTransform.k}
      />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full flex-1 ${interactionState.mode === 'PAN' ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={() => handleMouseUp({} as any)}
        onClick={handleBgClick}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
      >
        <defs>
           {/* Filters remain unchanged */}
           <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
             <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
           </filter>
           <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
             <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
           </filter>
           <filter id="ink-blur" x="-20%" y="-20%" width="140%" height="140%">
             <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
             <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
           </filter>
           <filter id="hand-drawn" x="-20%" y="-20%" width="140%" height="140%">
             <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" />
             <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
           </filter>
        </defs>

        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          {edges.map(edge => {
            const source = nodes.find(n => n.id === edge.sourceId);
            const target = nodes.find(n => n.id === edge.targetId);
            if (!source || !target) return null;
            const sDim = getNodeDimensions(source);
            const tDim = getNodeDimensions(target);
            const sC = { x: source.x + sDim.w/2, y: source.y + sDim.h/2 };
            const tC = { x: target.x + tDim.w/2, y: target.y + tDim.h/2 };
            const isSelected = edge.id === selectedId;

            return (
              <g key={edge.id} onClick={(e) => { e.stopPropagation(); onEdgeSelect(edge.id); }}>
                <line x1={sC.x} y1={sC.y} x2={tC.x} y2={tC.y} stroke={isSelected ? c.highlight : c.primary} strokeWidth={isSelected ? c.strokeWidth + 1 : c.strokeWidth} strokeDasharray={c.strokeDasharray} strokeLinecap={c.strokeLinecap} filter={c.filter} className="transition-colors duration-200" />
                {edge.label && <text x={(sC.x + tC.x) / 2} y={(sC.y + tC.y) / 2 - 5} textAnchor="middle" fill={c.text} fontSize="10" className="font-mono opacity-80" transform={`rotate(0, ${(sC.x + tC.x) / 2}, ${(sC.y + tC.y) / 2 - 5})`} style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: 'bold', textShadow: theme === 'CARTOON' ? '0px 0px 3px white' : '0px 0px 3px black' }}>{edge.label}</text>}
              </g>
            );
          })}

          {interactionState.mode === 'CONNECT' && interactionState.targetId && (() => {
            const source = nodes.find(n => n.id === interactionState.targetId);
            if (!source) return null;
            const dim = getNodeDimensions(source);
            return <line x1={source.x + dim.w/2} y1={source.y + dim.h/2} x2={mousePos.x} y2={mousePos.y} stroke={c.highlight} strokeWidth={2} strokeDasharray="4" />;
          })()}

          {nodes.map(node => {
            const isSelected = node.id === selectedId;
            const { w, h } = getNodeDimensions(node);
            
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onMouseDown={(e) => handleMouseDown(e, node.id, 'BODY')} onMouseUp={(e) => handleMouseUp(e, node.id)} onDoubleClick={() => onOpenBuilding(node.id)} className="cursor-pointer transition-opacity hover:opacity-90 group">
                {renderNodeShape(node, isSelected)}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                   <rect x={w/2 - 35} y={-28} width={70} height={20} rx={4} fill="rgba(0,0,0,0.8)" stroke={c.primary} strokeWidth={1} />
                   <text x={w/2} y={-14} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" dominantBaseline="middle">双击进入</text>
                </g>
                <text x={w/2} y={h + 15} textAnchor="middle" fill={c.text} fontSize="11" className="font-mono uppercase font-bold tracking-wider pointer-events-none" style={{ textShadow: theme === 'CARTOON' ? '0px 0px 3px white' : '0px 0px 4px black', fontFamily: theme === 'INK' ? 'KaiTi, serif' : 'inherit' }}>{node.name}</text>
                {isSelected && <rect x={w - 6} y={h - 6} width={6} height={6} fill={c.highlight} className="cursor-se-resize" onMouseDown={(e) => handleMouseDown(e, node.id, 'HANDLE')} />}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}