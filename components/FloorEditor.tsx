




import React, { useRef, useState, useEffect } from 'react';
import { Floor, Room, Item, Person, MapDisplayMode, RoomType, ThemeMode } from '../types';
import { MousePointer2, Square, DoorOpen, Box, Footprints, ArrowUp, Building2, LogIn, Divide, Droplets, Trees, BrickWall, Anchor } from 'lucide-react';
import { ZoomControls } from './EditorOverlay';

// --- Constants & Types ---
const GRID_SIZE = 20;
const DRAG_THRESHOLD = 3;

interface FloorEditorProps {
  floor: Floor;
  selectedId?: string;
  onRoomSelect: (id: string) => void;
  onItemSelect: (id: string) => void;
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (id: string, changes: Partial<Room>) => void;
  onAddItem: (item: Item) => void;
  onUpdateItem: (id: string, changes: Partial<Item>) => void;
  onEnterRoom: (roomId: string) => void;
  mapMode?: MapDisplayMode;
  peopleInRoom?: Record<string, Person[]>;
  onJumpToPerson?: (personId: string) => void;
  onPersonSelect?: (personId: string) => void;
  theme?: ThemeMode;
}

// --- Helper Components ---

/**
 * Renders a single item (Door, Bed, etc.) inside a room
 */
const ItemNode: React.FC<{
  item: Item;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (e: React.MouseEvent) => void;
  theme: ThemeMode;
}> = ({ item, isSelected, isDragging, onSelect, theme }) => {
  let highlightClass = 'text-highlight';
  let normalClass = 'text-blueprint-400';

  if (theme === 'INK') {
     highlightClass = 'text-red-700';
     normalClass = 'text-black';
  } else if (theme === 'CYBERPUNK') {
     highlightClass = 'text-[#ff00ff] drop-shadow-[0_0_5px_#ff00ff]';
     normalClass = 'text-[#00ffff] drop-shadow-[0_0_2px_#00ffff]';
  } else if (theme === 'CARTOON') {
     highlightClass = 'text-red-600 stroke-black stroke-2';
     normalClass = 'text-black';
  } else if (theme === 'SCRAPBOOK') {
     highlightClass = 'text-pink-600 scale-110';
     normalClass = 'text-gray-700 opacity-90';
  }

  // Visuals for different types
  const renderContent = () => {
     switch(item.type) {
        case 'DOOR': return <DoorOpen size={20} />;
        case 'STAIRS': return <ArrowUp size={20} />;
        case 'NPC': return <Footprints size={18} />;
        case 'ROAD': return <div className="w-5 h-5 bg-gray-600 rounded-sm flex items-center justify-center"><div className="w-full h-0.5 bg-gray-400 border-t border-dashed border-gray-300" /></div>;
        case 'WATER': return <div className="w-5 h-5 bg-blue-500/50 rounded-full flex items-center justify-center"><Droplets size={12} className="text-blue-200"/></div>;
        case 'TREE': return <Trees size={20} className="text-green-500/80" />;
        case 'WALL': return <div className="w-6 h-6 bg-gray-800 border border-gray-600 flex items-center justify-center shadow-lg"><BrickWall size={14} className="text-gray-500"/></div>;
        default: return <Box size={16} />;
     }
  };

  return (
    <div
      onMouseDown={onSelect}
      onClick={(e) => e.stopPropagation()} // Prevent click bubbling to room/canvas
      style={{ left: item.x, top: item.y }}
      className={`absolute w-6 h-6 flex items-center justify-center transition-transform cursor-move pointer-events-auto
        ${isSelected ? `${highlightClass} scale-125 z-50` : `${normalClass} hover:opacity-80 z-40`}
        ${isDragging ? 'opacity-80 scale-125' : ''}
      `}
      title={item.type}
    >
      {renderContent()}
    </div>
  );
};

/**
 * Renders a Room/Area container
 */
const RoomNode: React.FC<{
  room: Room;
  isSelected: boolean;
  dragState: DragState; // Passed to show preview during drag
  occupants: Person[];
  mapMode: MapDisplayMode;
  onMouseDown: (e: React.MouseEvent, type: 'BODY' | 'RESIZE') => void;
  onEnter: () => void;
  onJumpToPerson?: (id: string) => void;
  onPersonSelect?: (id: string) => void;
  children?: React.ReactNode;
  theme: ThemeMode;
}> = ({ 
  room, isSelected, dragState, occupants, mapMode, 
  onMouseDown, onEnter, onJumpToPerson, onPersonSelect, children, theme
}) => {
  
  // Style based on type
  const getStyle = () => {
    // Defaults for BLUEPRINT
    let baseBorder = 'border-blueprint-500';
    let baseBg = 'bg-blueprint-900/80';
    let highlightBorder = 'border-highlight shadow-[0_0_0_2px_rgba(250,204,21,0.5)]';
    
    // Theme Overrides
    if (theme === 'INK') {
       baseBorder = 'border-black border-2';
       baseBg = 'bg-white/80';
       highlightBorder = 'border-red-700 shadow-[0_0_0_1px_#b91c1c]';
    } else if (theme === 'CYBERPUNK') {
       baseBorder = 'border-[#00ffff] shadow-[0_0_5px_rgba(0,255,255,0.3)]';
       baseBg = 'bg-black/80';
       highlightBorder = 'border-[#ff00ff] shadow-[0_0_10px_#ff00ff]';
    } else if (theme === 'CARTOON') {
       baseBorder = 'border-black border-4 rounded-xl';
       baseBg = 'bg-white';
       highlightBorder = 'border-[#ff4500] shadow-[4px_4px_0_#000]';
    } else if (theme === 'SCRAPBOOK') {
       baseBorder = 'border-pink-400 border-2 border-dashed';
       baseBg = 'bg-white/90 shadow-sm';
       highlightBorder = 'border-amber-400 border-2 border-solid shadow-[2px_2px_0px_rgba(0,0,0,0.1)]';
    }

    const base = isSelected
      ? `${highlightBorder} z-30`
      : `${baseBorder} z-10 hover:z-20 hover:opacity-90`;
    
    const cursor = 'cursor-move';

    // Room Type Overrides (Merged with Theme if needed)
    if (room.type === RoomType.WATER) {
       return `${base} ${cursor} bg-blue-500/30 border-blue-400`;
    }
    if (room.type === RoomType.OUTDOOR) {
       return `${base} ${cursor} bg-green-500/10 border-green-500 border-dashed`;
    }
    if (room.type === RoomType.BUILDING) {
       return `${base} ${cursor} ${theme === 'CYBERPUNK' ? 'bg-slate-900/90' : (theme === 'SCRAPBOOK' ? 'bg-orange-50/90' : 'bg-slate-800')}`;
    }

    return `${base} ${cursor} ${baseBg}`;
  };

  const isBuilding = room.type === RoomType.BUILDING;
  
  // Tag Style (The label inside the room)
  let tagStyle = 'text-blueprint-500 bg-blueprint-500/20';
  if (theme === 'INK') tagStyle = 'text-black bg-white border border-black font-bold';
  if (theme === 'CYBERPUNK') tagStyle = 'text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]';
  if (theme === 'CARTOON') tagStyle = 'text-black bg-yellow-300 border-2 border-black font-bold';
  if (theme === 'SCRAPBOOK') tagStyle = 'text-gray-700 bg-yellow-200 shadow-md -rotate-2 font-bold px-2'; // Tape Look

  return (
    <div
      style={{ left: room.x, top: room.y, width: room.w, height: room.h }}
      className={`absolute border-2 transition-colors group pointer-events-auto ${getStyle()}`}
      onMouseDown={(e) => onMouseDown(e, 'BODY')}
      onClick={(e) => e.stopPropagation()} // Critical: Stop click from reaching canvas and deselecting
      onDoubleClick={(e) => { e.stopPropagation(); onEnter(); }}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header Label */}
      <div className={`absolute top-0 left-0 px-1 text-[10px] font-mono pointer-events-none whitespace-nowrap flex items-center gap-2 z-30 ${tagStyle}`}>
        {isBuilding && <Building2 size={10} />}
        {room.name}
        {occupants.length > 0 && (
          <span className="px-1 rounded-full text-[9px] font-bold bg-blueprint-500 text-blueprint-900">
            {occupants.length}
          </span>
        )}
      </div>

      {/* Building Entry Hint */}
      {isBuilding && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
          <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <LogIn size={10} /> 双击进入
          </div>
        </div>
      )}

      {/* Resize Handle */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-center justify-center shadow-sm hover:scale-110 transition-transform pointer-events-auto bg-highlight"
          onMouseDown={(e) => onMouseDown(e, 'RESIZE')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-1 h-1 bg-black rounded-full" />
        </div>
      )}

      {/* People Chips */}
      <div className="absolute inset-0 top-5 p-1 flex flex-wrap content-start gap-1 pointer-events-none overflow-hidden z-20">
        {occupants.map(p => (
          <div
            key={p.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              // Use onPersonSelect if available to show inspector
              if (onPersonSelect) onPersonSelect(p.id);
            }}
            onClick={(e) => e.stopPropagation()} 
            className={`
              w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-white/20 shadow-sm cursor-pointer hover:scale-110 transition-transform pointer-events-auto z-50
              ${mapMode === MapDisplayMode.DYNAMIC ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}
            `}
            title={p.name}
          >
            {p.name.charAt(0)}
          </div>
        ))}
      </div>

      {/* Render Items (Children) */}
      {children}
    </div>
  );
};


// --- Main Editor Logic ---

interface DragState {
  active: boolean;
  isDragging: boolean;
  type: 'ROOM_MOVE' | 'ROOM_RESIZE' | 'ITEM_MOVE' | 'CREATE_DRAW' | 'PAN';
  targetId: string;
  itemRoomId?: string; // For item moves
  startScreen: { x: number; y: number }; // Mouse screen pos
  currentScreen: { x: number; y: number }; // Mouse screen pos
  startCanvas: { x: number; y: number }; // Canvas relative pos (snapped, world coords)
  initialObj: { x: number; y: number; w: number; h: number }; // Initial bounds (world coords)
  initialView?: { x: number; y: number }; // For Pan
}

// Tool Categories for Floor Editor
type FloorToolCategory = 'STRUCT' | 'PROP' | 'NATURE';

export const FloorEditor: React.FC<FloorEditorProps> = ({
  floor,
  selectedId,
  onRoomSelect,
  onItemSelect,
  onAddRoom,
  onUpdateRoom,
  onUpdateItem,
  onEnterRoom,
  mapMode = MapDisplayMode.STATIC,
  peopleInRoom = {},
  onJumpToPerson,
  onPersonSelect,
  theme = 'BLUEPRINT'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'SELECT' | 'DRAW'>('SELECT');
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [toolCategory, setToolCategory] = useState<FloorToolCategory>('STRUCT');
  
  // Unified Drag State
  const [drag, setDrag] = useState<DragState>({
    active: false,
    isDragging: false,
    type: 'ROOM_MOVE',
    targetId: '',
    startScreen: { x: 0, y: 0 },
    currentScreen: { x: 0, y: 0 },
    startCanvas: { x: 0, y: 0 },
    initialObj: { x: 0, y: 0, w: 0, h: 0 }
  });

  const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // Helper to get World Coordinates from Screen Coordinates (accounting for Pan/Zoom)
  const getWorldPos = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewTransform.x) / viewTransform.k,
      y: (clientY - rect.top - viewTransform.y) / viewTransform.k
    };
  };

  // --- Zoom Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomIntensity = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = Math.exp(direction * zoomIntensity);
    const newK = Math.max(0.1, Math.min(5, viewTransform.k * factor));

    // Zoom towards mouse
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - viewTransform.x) * (newK / viewTransform.k);
    const newY = mouseY - (mouseY - viewTransform.y) * (newK / viewTransform.k);

    setViewTransform({ x: newX, y: newY, k: newK });
  };

  const handleZoom = (direction: 1 | -1) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const factor = direction > 0 ? 1.2 : 0.8;
      const newK = Math.max(0.1, Math.min(5, viewTransform.k * factor));

      const newX = centerX - (centerX - viewTransform.x) * (newK / viewTransform.k);
      const newY = centerY - (centerY - viewTransform.y) * (newK / viewTransform.k);
      
      setViewTransform({ x: newX, y: newY, k: newK });
  };

  const resetView = () => {
      setViewTransform({ x: 0, y: 0, k: 1 });
  };

  // --- Interaction Handlers ---

  // 1. Mouse Down on Room
  const handleRoomDown = (e: React.MouseEvent, room: Room, action: 'BODY' | 'RESIZE') => {
    e.stopPropagation();
    onRoomSelect(room.id);
    
    if (e.button === 0 && !e.shiftKey) {
      setDrag({
        active: true,
        isDragging: false,
        type: action === 'RESIZE' ? 'ROOM_RESIZE' : 'ROOM_MOVE',
        targetId: room.id,
        startScreen: { x: e.clientX, y: e.clientY },
        currentScreen: { x: e.clientX, y: e.clientY },
        startCanvas: { x: room.x, y: room.y }, 
        initialObj: { x: room.x, y: room.y, w: room.w, h: room.h }
      });
    }
  };

  // 2. Mouse Down on Item
  const handleItemDown = (e: React.MouseEvent, item: Item, roomId: string) => {
    e.stopPropagation();
    onItemSelect(item.id);

    if (e.button === 0) {
      setDrag({
        active: true,
        isDragging: false,
        type: 'ITEM_MOVE',
        targetId: item.id,
        itemRoomId: roomId,
        startScreen: { x: e.clientX, y: e.clientY },
        currentScreen: { x: e.clientX, y: e.clientY },
        startCanvas: { x: 0, y: 0 },
        initialObj: { x: item.x, y: item.y, w: 0, h: 0 }
      });
    }
  };

  // 3. Mouse Down on Background (Create, Deselect or Pan)
  const handleCanvasDown = (e: React.MouseEvent) => {
    // Check if we are clicking the scroll container OR the inner wrapper div
    const isBackground = e.target === e.currentTarget || 
                         (containerRef.current && e.target === containerRef.current.firstElementChild);

    if (isBackground) {
      onRoomSelect(''); 
    }

    // Pan: Middle Click OR (Left Click + Select Tool + No Shift)
    const isPan = e.button === 1 || (e.button === 0 && !e.shiftKey && tool === 'SELECT');
    
    // Draw: Shift+Click OR Draw Tool
    const isDraw = e.button === 0 && (tool === 'DRAW' || e.shiftKey);

    if (isDraw) {
      const pos = getWorldPos(e.clientX, e.clientY);
      const snappedX = snap(pos.x);
      const snappedY = snap(pos.y);

      setDrag({
        active: true,
        isDragging: false,
        type: 'CREATE_DRAW',
        targetId: 'new',
        startScreen: { x: e.clientX, y: e.clientY },
        currentScreen: { x: e.clientX, y: e.clientY },
        startCanvas: { x: snappedX, y: snappedY },
        initialObj: { x: snappedX, y: snappedY, w: 0, h: 0 }
      });
    } else if (isPan) {
       setDrag({
          active: true,
          isDragging: false,
          type: 'PAN',
          targetId: 'view',
          startScreen: { x: e.clientX, y: e.clientY },
          currentScreen: { x: e.clientX, y: e.clientY },
          startCanvas: { x: 0, y: 0 },
          initialObj: { x: 0, y: 0, w: 0, h: 0 },
          initialView: { x: viewTransform.x, y: viewTransform.y }
       });
    }
  };

  // 4. Global Mouse Move & Up (Effect)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.active) return;
      e.preventDefault();

      // Check threshold
      const moveDist = Math.hypot(e.clientX - drag.startScreen.x, e.clientY - drag.startScreen.y);
      const isDragging = drag.isDragging || moveDist > DRAG_THRESHOLD;

      setDrag(prev => ({
        ...prev,
        isDragging,
        currentScreen: { x: e.clientX, y: e.clientY }
      }));
      
      // Real-time pan update for smoother feel
      if (drag.type === 'PAN' && drag.initialView) {
         const dx = e.clientX - drag.startScreen.x;
         const dy = e.clientY - drag.startScreen.y;
         setViewTransform(prev => ({
            ...prev,
            x: drag.initialView!.x + dx,
            y: drag.initialView!.y + dy
         }));
      }
    };

    const onUp = (e: MouseEvent) => {
      if (!drag.active) return;

      if (drag.isDragging || drag.type === 'CREATE_DRAW') {
        // --- Drag End Logic ---
        // Delta adjusted for zoom
        const dx = (e.clientX - drag.startScreen.x) / viewTransform.k;
        const dy = (e.clientY - drag.startScreen.y) / viewTransform.k;
        
        if (drag.type === 'ROOM_MOVE') {
          const nx = drag.initialObj.x + snap(dx);
          const ny = drag.initialObj.y + snap(dy);
          if (nx !== drag.initialObj.x || ny !== drag.initialObj.y) {
            onUpdateRoom(drag.targetId, { x: nx, y: ny });
          }
        } else if (drag.type === 'ROOM_RESIZE') {
          const nw = Math.max(GRID_SIZE, drag.initialObj.w + snap(dx));
          const nh = Math.max(GRID_SIZE, drag.initialObj.h + snap(dy));
          onUpdateRoom(drag.targetId, { w: nw, h: nh });
        } else if (drag.type === 'ITEM_MOVE' && drag.itemRoomId) {
          const nx = drag.initialObj.x + snap(dx);
          const ny = drag.initialObj.y + snap(dy);
          onUpdateItem(drag.targetId, { x: nx, y: ny });
        } else if (drag.type === 'CREATE_DRAW') {
          // Calculate final rect
          const worldPos = getWorldPos(e.clientX, e.clientY);
          const endX = snap(worldPos.x);
          const endY = snap(worldPos.y);
          
          let x = Math.min(drag.startCanvas.x, endX);
          let y = Math.min(drag.startCanvas.y, endY);
          let w = Math.abs(endX - drag.startCanvas.x);
          let h = Math.abs(endY - drag.startCanvas.y);

          // Support Click-to-Create (Shift+Click) - Default size 80x80
          if (w < GRID_SIZE || h < GRID_SIZE) {
              w = 4 * GRID_SIZE; 
              h = 4 * GRID_SIZE; 
              x = drag.startCanvas.x;
              y = drag.startCanvas.y;
          }

          if (w >= GRID_SIZE && h >= GRID_SIZE) {
             const newRoom: Room = {
                id: Math.random().toString(36).substr(2, 9),
                x, y, w, h,
                name: `Area ${floor.rooms.length + 1}`,
                type: RoomType.ROOM,
                items: [],
                floors: []
             };
             onAddRoom(newRoom);
             onRoomSelect(newRoom.id); 
             
             if (tool !== 'DRAW') {
                 setTool('SELECT'); 
             }
          }
        }
      } else {
        // --- Click Logic (No Drag) ---
        if (drag.type === 'ROOM_MOVE' || drag.type === 'ROOM_RESIZE') {
             onRoomSelect(drag.targetId);
        } else if (drag.type === 'ITEM_MOVE') {
             onItemSelect(drag.targetId);
        }
      }

      setDrag(prev => ({ ...prev, active: false, isDragging: false }));
    };

    if (drag.active) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, onUpdateRoom, onUpdateItem, onAddRoom, floor.rooms, onRoomSelect, onItemSelect, viewTransform]);


  // 5. Handle Drag & Drop (Items from Toolbar)
  const handleDrop = (e: React.DragEvent, roomId: string) => {
     e.preventDefault();
     e.stopPropagation();
     const type = e.dataTransfer.getData('itemType');
     if (!type) return;

     // Need to convert drop coord to room relative
     // room relative = drop world pos - room world pos
     const room = floor.rooms.find(r => r.id === roomId);
     if(!room) return;

     const worldPos = getWorldPos(e.clientX, e.clientY);
     const relativeX = worldPos.x - room.x;
     const relativeY = worldPos.y - room.y;

     const x = Math.max(0, Math.min(room.w - 20, relativeX));
     const y = Math.max(0, Math.min(room.h - 20, relativeY));
     
     const newItem: Item = {
       id: Math.random().toString(36).substr(2, 9),
       type: type as any,
       x: snap(x),
       y: snap(y),
       name: type
     };
     
     onUpdateRoom(roomId, { items: [...room.items, newItem] });
  };


  // Helper for Road Icon
  const RoadIcon = ({ size = 24, ...props }: any) => <svg width={size} height={size} {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="2" x2="12" y2="22" strokeDasharray="4 2" /></svg>;

  // Tool Definitions
  const TOOLS: Record<FloorToolCategory, { type: string, icon: React.ReactNode, title: string }[]> = {
      STRUCT: [
          { type: 'DOOR', icon: <DoorOpen size={20} />, title: '门' },
          { type: 'STAIRS', icon: <ArrowUp size={20} />, title: '楼梯' },
          { type: 'ROAD', icon: <RoadIcon size={20} />, title: '道路' },
          { type: 'WALL', icon: <BrickWall size={20} />, title: '墙壁/障碍' },
      ],
      PROP: [
          { type: 'BED', icon: <Box size={20} />, title: '家具' },
          { type: 'NPC', icon: <Footprints size={20} />, title: 'NPC位置' },
      ],
      NATURE: [
          { type: 'TREE', icon: <Trees size={20} />, title: '树木/植被' },
          { type: 'WATER', icon: <Droplets size={20} />, title: '水景' },
      ]
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-blueprint-900 relative">
      {/* Toolbar */}
      <div className="h-12 bg-blueprint-800 border-b border-blueprint-700 flex items-center px-4 gap-4 shrink-0 select-none z-40">
        <div className="flex bg-blueprint-900 rounded p-1 border border-blueprint-700">
          <button
            onClick={() => setTool('SELECT')}
            className={`p-2 rounded text-xs font-mono flex items-center gap-2 ${tool === 'SELECT' ? 'bg-blueprint-500 text-blueprint-900' : 'text-blueprint-500 hover:bg-blueprint-800'}`}
            title="点击选择，拖拽移动，按住中键平移"
          >
            <MousePointer2 size={16} /> 选择 / 平移
          </button>
          <button
            onClick={() => setTool('DRAW')}
            className={`p-2 rounded text-xs font-mono flex items-center gap-2 ${tool === 'DRAW' ? 'bg-blueprint-500 text-blueprint-900' : 'text-blueprint-500 hover:bg-blueprint-800'}`}
            title="点击或拖拽绘制区域"
          >
            <Square size={16} /> 绘制区域
          </button>
        </div>
        <div className="w-px h-6 bg-blueprint-700 mx-2"></div>
        
        {/* Dynamic Tool Categories */}
        <div className="flex items-center gap-2 bg-blueprint-950/50 rounded p-1 border border-blueprint-800">
            {[
                { id: 'STRUCT', label: '结构' },
                { id: 'PROP', label: '家具' },
                { id: 'NATURE', label: '自然' },
            ].map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setToolCategory(cat.id as FloorToolCategory)}
                    className={`px-2 py-1 text-[10px] font-bold rounded uppercase transition-colors ${toolCategory === cat.id ? 'bg-blueprint-600 text-white' : 'text-blueprint-500 hover:text-white'}`}
                >
                    {cat.label}
                </button>
            ))}
        </div>

        <div className="flex gap-1 items-center text-xs text-blueprint-500 font-mono pl-2 border-l border-blueprint-700">
           {TOOLS[toolCategory].map(item => (
               <div 
                  key={item.type}
                  draggable 
                  onDragStart={e => e.dataTransfer.setData('itemType', item.type)} 
                  className="p-1 hover:bg-blueprint-700 rounded cursor-grab active:cursor-grabbing transition-transform hover:scale-110" 
                  title={`拖拽添加: ${item.title}`}
               >
                  {item.icon}
               </div>
           ))}
        </div>
      </div>

      {/* Helper Hints Overlay (Top Right) */}
      <div className="absolute top-14 right-4 z-30 pointer-events-none select-none">
        <div className="bg-blueprint-900/80 backdrop-blur-sm border border-blueprint-700/50 p-2 rounded-lg shadow-lg">
          <div className="text-[10px] font-mono text-blueprint-400 space-y-1 text-right">
             <div className="flex items-center justify-start gap-2">
                <span className="text-white">中键 / 左键拖拽</span>
                <span className="opacity-50">平移</span>
             </div>
             <div className="flex items-center justify-start gap-2">
                <span className="text-white">滚轮</span>
                <span className="opacity-50">缩放</span>
             </div>
             <div className="flex items-center justify-start gap-2">
                <span className="bg-blueprint-800 border border-blueprint-700 px-1 rounded text-white">Shift</span>

                <span className="text-white">拖拽</span>
                <span className="opacity-50">绘制区域</span>
             </div>
              
             <div className="flex items-center justify-start gap-2">
                <span className="bg-blueprint-800 border border-blueprint-700 px-1 rounded text-white">Shift</span>
                <span className="text-white">点击</span>
                <span className="opacity-50">默认区域</span>
             </div>
          </div>
        </div>
      </div>

      {/* Zoom Controls (Bottom right) */}
      <ZoomControls 
         onZoomIn={() => handleZoom(1)}
         onZoomOut={() => handleZoom(-1)}
         onReset={resetView}
         scale={viewTransform.k}
         className="bottom-4 right-4"
      />

      {/* Canvas */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-hidden relative ${drag.type === 'PAN' ? 'cursor-grabbing' : 'cursor-crosshair'} blueprint-grid-small min-w-0`}
        onMouseDown={handleCanvasDown}
        onDragOver={e => e.preventDefault()}
        onWheel={handleWheel}
        style={{
           backgroundPosition: `${viewTransform.x}px ${viewTransform.y}px`,
           backgroundSize: `${10 * viewTransform.k}px ${10 * viewTransform.k}px`
        }}
      >
        {/* Transform Wrapper */}
        <div 
           className="w-full h-full relative"
           style={{
              transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`,
              transformOrigin: '0 0'
           }}
        >
           {/* Render Rooms */}
           {floor.rooms.map(room => {
             // Calculate Temporary Display Props if dragging this room
             let displayRoom = { ...room };
             
             if (drag.active && drag.isDragging && drag.targetId === room.id) {
               const dx = (drag.currentScreen.x - drag.startScreen.x) / viewTransform.k;
               const dy = (drag.currentScreen.y - drag.startScreen.y) / viewTransform.k;
               if (drag.type === 'ROOM_MOVE') {
                 displayRoom.x = drag.initialObj.x + snap(dx);
                 displayRoom.y = drag.initialObj.y + snap(dy);
               } else if (drag.type === 'ROOM_RESIZE') {
                 displayRoom.w = Math.max(GRID_SIZE, drag.initialObj.w + snap(dx));
                 displayRoom.h = Math.max(GRID_SIZE, drag.initialObj.h + snap(dy));
               }
             }

             return (
               <RoomNode
                 key={room.id}
                 room={displayRoom}
                 isSelected={selectedId === room.id}
                 dragState={drag}
                 occupants={peopleInRoom[room.id] || []}
                 mapMode={mapMode}
                 onMouseDown={(e, type) => handleRoomDown(e, room, type)}
                 onEnter={() => room.type === RoomType.BUILDING && onEnterRoom(room.id)}
                 onJumpToPerson={onJumpToPerson}
                 onPersonSelect={onPersonSelect}
                 theme={theme}
               >
                  <div 
                    onDrop={(e) => handleDrop(e, room.id)} 
                    onDragOver={e => e.preventDefault()} 
                    className="absolute inset-0"
                  >
                    {room.items.map(item => {
                       // Calc temp item pos
                       let ix = item.x;
                       let iy = item.y;
                       const isItemDragging = drag.active && drag.isDragging && drag.type === 'ITEM_MOVE' && drag.targetId === item.id;
                       
                       if (isItemDragging) {
                         const dx = (drag.currentScreen.x - drag.startScreen.x) / viewTransform.k;
                         const dy = (drag.currentScreen.y - drag.startScreen.y) / viewTransform.k;
                         ix = drag.initialObj.x + snap(dx);
                         iy = drag.initialObj.y + snap(dy);
                       }
                       
                       return (
                         <ItemNode
                           key={item.id}
                           item={{ ...item, x: ix, y: iy }}
                           isSelected={selectedId === item.id}
                           isDragging={isItemDragging}
                           onSelect={(e) => handleItemDown(e, item, room.id)}
                           theme={theme}
                         />
                       );
                    })}
                  </div>
               </RoomNode>
             );
           })}

           {/* Creation Preview */}
           {drag.active && drag.type === 'CREATE_DRAW' && (
             <div
               style={{
                 left: Math.min(drag.startCanvas.x, snap(getWorldPos(drag.currentScreen.x, drag.currentScreen.y).x)),
                 top: Math.min(drag.startCanvas.y, snap(getWorldPos(drag.currentScreen.x, drag.currentScreen.y).y)),
                 width: Math.abs(snap(getWorldPos(drag.currentScreen.x, drag.currentScreen.y).x) - drag.startCanvas.x),
                 height: Math.abs(snap(getWorldPos(drag.currentScreen.x, drag.currentScreen.y).y) - drag.startCanvas.y),
               }}
               className={`absolute border-2 border-dashed pointer-events-none z-50 border-highlight bg-highlight/10`}
             />
           )}
        </div>
      </div>
    </div>
  );
};