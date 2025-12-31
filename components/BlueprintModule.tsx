
import React, { useEffect, useMemo, useState } from 'react';
import { WorldEditor } from './WorldEditor';
import { BuildingView } from './BuildingView';
import { FloorEditor } from './FloorEditor';
import { Inspector } from './Inspector';
import { ViewLevel, WorldData, SelectionType, NodeType, MapNode, Person, CalendarEvent, MapDisplayMode, BlueprintViewState, Floor, Room, Item, ThemeMode } from '../types';
import { Download, ArrowLeft, Map as MapIcon, Building, Clock, Play, Pause, ChevronRight, User, Home, Search, X, MapPin } from 'lucide-react';

interface BlueprintModuleProps {
  people: Person[];
  events: CalendarEvent[];
  worldData: WorldData;
  setWorldData: (data: WorldData | ((prev: WorldData) => WorldData)) => void;
  
  // Controlled State
  viewState: BlueprintViewState;
  setViewState: (state: BlueprintViewState | ((prev: BlueprintViewState) => BlueprintViewState)) => void;

  onJumpToPerson?: (personId: string) => void;
  onUpdatePerson?: (person: Person) => void;
  theme: ThemeMode; // Global Theme
}

export const BlueprintModule: React.FC<BlueprintModuleProps> = ({ 
  people, 
  events, 
  worldData: world, 
  setWorldData: setWorld,
  viewState,
  setViewState,
  onJumpToPerson,
  onUpdatePerson,
  theme
}) => {
  
  const { viewLevel, activeNodeId, activeFloorId, selection, mapMode, currentTime, isPlaying, navigationStack = [] } = viewState;

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Resolve Active Context (Nested Buildings) ---
  const resolveContext = () => {
     if (!activeNodeId) return { activeNode: null, activeContainer: null, path: [] };

     const activeNode = world.nodes.find(n => n.id === activeNodeId) || null;
     if (!activeNode) return { activeNode: null, activeContainer: null, path: [] };

     let currentContainer: any = activeNode;
     const path = [{ id: activeNode.id, name: activeNode.name, type: 'NODE' }];

     // Traverse Stack
     for (const roomId of navigationStack) {
        // Find room in current container's floors
        let foundRoom: Room | null = null;
        if (currentContainer.floors) {
           for (const floor of currentContainer.floors as Floor[]) {
              const r = floor.rooms.find(r => r.id === roomId);
              if (r) {
                 foundRoom = r;
                 break;
              }
           }
        }
        
        if (foundRoom) {
           currentContainer = foundRoom;
           path.push({ id: foundRoom.id, name: foundRoom.name, type: 'ROOM' });
        } else {
           break;
        }
     }

     return { activeNode, activeContainer: currentContainer, path };
  };

  const { activeNode, activeContainer, path: breadcrumbs } = resolveContext();
  const activeFloor = activeContainer?.floors?.find((f: Floor) => f.id === activeFloorId);

  // --- Search Logic ---
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { type: 'NODE' | 'ROOM', id: string, name: string, context: string, node: MapNode, floorId?: string }[] = [];

    world.nodes.forEach(n => {
        if (n.name.toLowerCase().includes(q)) {
            results.push({ type: 'NODE', id: n.id, name: n.name, context: '世界节点', node: n });
        }
        n.floors.forEach(f => {
            f.rooms.forEach(r => {
                if (r.name.toLowerCase().includes(q)) {
                    results.push({ type: 'ROOM', id: r.id, name: r.name, context: `${n.name} - ${f.name}`, node: n, floorId: f.id });
                }
            });
        });
    });
    return results;
  }, [searchQuery, world]);

  const handleSearchSelect = (result: typeof searchResults[0]) => {
      if (result.type === 'NODE') {
          setViewState(prev => ({
              ...prev,
              viewLevel: ViewLevel.WORLD,
              activeNodeId: null,
              activeFloorId: null,
              selection: { type: 'NODE', id: result.id }
          }));
      } else if (result.type === 'ROOM') {
          setViewState(prev => ({
              ...prev,
              viewLevel: ViewLevel.BUILDING_EDITOR,
              activeNodeId: result.node.id,
              activeFloorId: result.floorId || null,
              navigationStack: [], // For simplicity, reset deep stack when searching
              selection: { type: 'ROOM', id: result.id }
          }));
      }
      setIsSearchOpen(false);
      setSearchQuery('');
  };

  // --- Simulation Logic: Where is everyone? ---
  const peopleLocations = useMemo(() => {
    const locationMap: Record<string, Person[]> = {}; // RoomID -> Person[]

    people.forEach(person => {
      let locId = person.defaultLocationId; // Default: Static Mode

      if (mapMode === MapDisplayMode.DYNAMIC) {
         // Check events for this specific time
         const activeEvent = events.find(evt => 
            evt.participantIds.includes(person.id) &&
            currentTime >= evt.start &&
            currentTime <= evt.end
         );

         if (activeEvent) {
            locId = activeEvent.locationId;
         }
      }

      if (locId) {
         if (!locationMap[locId]) locationMap[locId] = [];
         locationMap[locId].push(person);
      }
    });

    return locationMap;
  }, [people, events, mapMode, currentTime]);

  // Get people in current selection (For Inspector)
  const peopleInSelection = useMemo(() => {
     if (!selection || selection.type !== 'NODE') return [];
     const nodeId = selection.id;
     const node = world.nodes.find(n => n.id === nodeId);
     if (!node) return [];

     let foundPeople: Person[] = [];
     
     const scanFloors = (floors: Floor[]) => {
        floors.forEach(f => {
           f.rooms.forEach(r => {
              if (peopleLocations[r.id]) foundPeople.push(...peopleLocations[r.id]);
              if (r.floors) scanFloors(r.floors);
           });
        });
     };
     
     scanFloors(node.floors);
     
     return Array.from(new Set(foundPeople)); // Dedup
  }, [selection, world.nodes, peopleLocations]);


  // --- Time Controller Animation ---
  useEffect(() => {
     let interval: any;
     if (isPlaying && mapMode === MapDisplayMode.DYNAMIC) {
        interval = setInterval(() => {
           setViewState(prev => {
              const d = new Date(prev.currentTime);
              d.setMinutes(d.getMinutes() + 15); // Advance 15 mins per tick
              return { ...prev, currentTime: d.toISOString().split('.')[0] }; // Keep format simple
           });
        }, 1000); // 1 sec real time = 15 mins sim time
     }
     return () => clearInterval(interval);
  }, [isPlaying, mapMode, setViewState]);


  // --- Actions ---

  const updateSelection = (type: SelectionType, id: string, parentId?: string) => {
    if (!type) setViewState(prev => ({ ...prev, selection: null }));
    else setViewState(prev => ({ ...prev, selection: { type, id, parentId } }));
  };

  const openBuilding = (nodeId: string) => {
     const node = world.nodes.find(n => n.id === nodeId);
     if (!node) return;
     
     const firstFloorId = node.floors.length > 0 ? node.floors[0].id : null;
     
     setViewState(prev => ({
       ...prev,
       activeNodeId: nodeId,
       navigationStack: [], // Reset stack (we are at root of this node)
       activeFloorId: firstFloorId,
       viewLevel: ViewLevel.BUILDING_EDITOR,
       selection: firstFloorId ? { type: 'FLOOR', id: firstFloorId } : null
     }));
  };

  // Navigating into a nested room (Building)
  const handleEnterRoom = (roomId: string) => {
     let foundRoom: Room | null = null;
     if (activeContainer && activeContainer.floors) {
        for(const f of activeContainer.floors) {
           const r = f.rooms.find((r: Room) => r.id === roomId);
           if (r) { foundRoom = r; break; }
        }
     }

     if (foundRoom) {
         setViewState(prev => ({
            ...prev,
            navigationStack: [...(prev.navigationStack || []), roomId],
            activeFloorId: (foundRoom!.floors && foundRoom!.floors.length > 0) ? foundRoom!.floors[0].id : null,
            selection: null
         }));
     }
  };

  const handleNavigateUp = (index?: number) => {
     setViewState(prev => {
        const currentStack = prev.navigationStack || [];
        
        if (index === undefined) {
           // Go back one level
           if (currentStack.length > 0) {
              const newStack = currentStack.slice(0, -1);
              return { ...prev, navigationStack: newStack, activeFloorId: null, selection: null };
           } else {
              // Exit to World
              return { ...prev, viewLevel: ViewLevel.WORLD, activeNodeId: null, activeFloorId: null, selection: null };
           }
        } else {
           if (index === 0) {
              return { ...prev, navigationStack: [], activeFloorId: null, selection: null };
           } else {
              const newStack = currentStack.slice(0, index);
              return { ...prev, navigationStack: newStack, activeFloorId: null, selection: null };
           }
        }
     });
  };

  // World Actions
  const handleAddNode = (x: number, y: number, type: NodeType) => {
    const isTerrain = type === NodeType.MOUNTAIN || type === NodeType.RIVER || type === NodeType.BRIDGE;
    const newNode: MapNode = {
      id: Math.random().toString(36).substr(2, 9),
      x, y,
      w: type === NodeType.MOUNTAIN ? 100 : (type === NodeType.RIVER ? 150 : (type === NodeType.BRIDGE ? 100 : 50)),
      h: type === NodeType.MOUNTAIN ? 80 : (type === NodeType.RIVER ? 40 : (type === NodeType.BRIDGE ? 30 : 40)),
      type,
      name: isTerrain ? (type === NodeType.MOUNTAIN ? 'Mountain' : 'River') : 'New Location',
      description: '',
      tags: [],
      floors: []
    };
    setWorld(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    updateSelection('NODE', newNode.id);
  };

  const handleNodeUpdate = (id: string, x: number, y: number, w?: number, h?: number) => {
    setWorld(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, x, y, ...(w ? {w} : {}), ...(h ? {h} : {}) } : n)
    }));
  };

  const handleAddEdge = (sourceId: string, targetId: string) => {
    setWorld(prev => ({
      ...prev,
      edges: [...prev.edges, {
        id: Math.random().toString(36).substr(2, 9),
        sourceId, targetId, label: '???'
      }]
    }));
  };

  // Building Actions (Applies to current activeContainer)
  const handleAddFloor = () => {
    if (!activeContainer) return;
    
    const newFloor = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Floor ${activeContainer.floors.length + 1}`,
      level: activeContainer.floors.length + 1,
      rooms: []
    };
    
    const updateContainer = (node: MapNode): MapNode => {
       if (navigationStack.length === 0 && node.id === activeContainer.id) {
          return { ...node, floors: [...node.floors, newFloor] };
       }
       if (navigationStack.length > 0) {
          return updateDeep(node, [...navigationStack], (target) => {
             target.floors = [...(target.floors || []), newFloor];
             return target;
          });
       }
       return node;
    };
    
    setWorld(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === activeNodeId ? updateContainer(n) : n)
    }));
    
    setViewState(prev => ({ ...prev, activeFloorId: newFloor.id }));
    updateSelection('FLOOR', newFloor.id);
  };

  const updateDeep = (obj: any, pathStack: string[], updateFn: (target: any) => any): any => {
      if (pathStack.length === 0) {
          return updateFn(obj);
      }
      const [nextId, ...rest] = pathStack;
      
      // Look in floors -> rooms
      if (obj.floors) {
          const newFloors = obj.floors.map((floor: Floor) => ({
             ...floor,
             rooms: floor.rooms.map((room: Room) => {
                if (room.id === nextId) {
                   return updateDeep(room, rest, updateFn);
                }
                return room;
             })
          }));
          return { ...obj, floors: newFloors };
      }
      return obj;
  };

  const handleDeleteFloor = (floorId: string) => {
     if (!activeContainer) return;
     
     const updateContainer = (node: MapNode): MapNode => {
         return updateDeep(node, [...navigationStack], (target) => {
             target.floors = target.floors.filter((f: Floor) => f.id !== floorId);
             return target;
         });
     };

     setWorld(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === activeNodeId ? updateContainer(n) : n)
     }));
     
     if (activeFloorId === floorId) {
        setViewState(prev => ({...prev, activeFloorId: null, selection: null}));
     }
  };

  // Floor Actions
  const handleUpdateRoom = (roomId: string, changes: Partial<Room>) => {
    if (!activeContainer || !activeFloorId) return;
    
    setWorld(prev => {
       return {
          ...prev,
          nodes: prev.nodes.map(n => {
             if (n.id !== activeNodeId) return n;
             return updateDeep(n, [...navigationStack], (target) => {
                const floors = target.floors.map((f: Floor) => {
                   if (f.id !== activeFloorId) return f;
                   return {
                      ...f,
                      rooms: f.rooms.map((r: Room) => r.id === roomId ? { ...r, ...changes } : r)
                   };
                });
                return { ...target, floors };
             });
          })
       };
    });
  };
  
  const handleAddRoom = (room: Room) => {
    if (!activeContainer || !activeFloorId) return;
    
    setWorld(prev => {
       return {
          ...prev,
          nodes: prev.nodes.map(n => {
             if (n.id !== activeNodeId) return n;
             return updateDeep(n, [...navigationStack], (target) => {
                const floors = target.floors.map((f: Floor) => {
                   if (f.id !== activeFloorId) return f;
                   return { ...f, rooms: [...f.rooms, room] };
                });
                return { ...target, floors };
             });
          })
       };
    });
    updateSelection('ROOM', room.id, activeFloorId!);
  };

  const handleUpdateItem = (itemId: string, changes: Partial<Item>) => {
    if(!activeContainer || !activeFloorId) return;
    
    setWorld(prev => {
       return {
          ...prev,
          nodes: prev.nodes.map(n => {
             if (n.id !== activeNodeId) return n;
             return updateDeep(n, [...navigationStack], (target) => {
                const floors = target.floors.map((f: Floor) => {
                   if (f.id !== activeFloorId) return f;
                   return {
                      ...f,
                      rooms: f.rooms.map((r: Room) => {
                         const idx = r.items.findIndex((i: Item) => i.id === itemId);
                         if (idx === -1) return r;
                         const newItems = [...r.items];
                         newItems[idx] = { ...newItems[idx], ...changes };
                         return { ...r, items: newItems };
                      })
                   };
                });
                return { ...target, floors };
             });
          })
       };
    });
  };

  const getInspectorData = () => {
    if (!selection) return null;
    if (selection.type === 'NODE') return world.nodes.find(n => n.id === selection.id);
    if (selection.type === 'EDGE') return world.edges.find(e => e.id === selection.id);
    if (selection.type === 'FLOOR') return activeContainer?.floors?.find((f: Floor) => f.id === selection.id);
    if (selection.type === 'ROOM') return activeFloor?.rooms?.find((r: Room) => r.id === selection.id);
    if (selection.type === 'ITEM') {
      const rooms = activeFloor?.rooms || [];
      for(const r of rooms as Room[]) {
         const item = r.items.find((i: Item) => i.id === selection.id);
         if(item) return item;
      }
    }
    if (selection.type === 'PERSON') {
       return people.find(p => p.id === selection.id);
    }
    return null;
  };

  const handleInspectorUpdate = (field: string, value: any) => {
    if (!selection) return;
    const deepUpdate = (obj: any, key: string, val: any) => ({ ...obj, [key]: val });

    if (selection.type === 'NODE') {
       setWorld(prev => ({
         ...prev,
         nodes: prev.nodes.map(n => n.id === selection.id ? deepUpdate(n, field, value) : n)
       }));
    } else if (selection.type === 'EDGE') {
       setWorld(prev => ({
         ...prev,
         edges: prev.edges.map(e => e.id === selection.id ? deepUpdate(e, field, value) : e)
       }));
    } else if (selection.type === 'FLOOR') {
       if (!activeContainer) return;
       setWorld(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => {
             if (n.id !== activeNodeId) return n;
             return updateDeep(n, [...navigationStack], (target) => {
                target.floors = target.floors.map((f: Floor) => f.id === selection.id ? { ...f, [field]: value } : f);
                return target;
             });
          })
       }));
    } else if (selection.type === 'ROOM') {
       handleUpdateRoom(selection.id, { [field]: value });
    } else if (selection.type === 'ITEM') {
       handleUpdateItem(selection.id, { [field]: value });
    } else if (selection.type === 'PERSON') {
       if (onUpdatePerson) {
          const person = people.find(p => p.id === selection.id);
          if (person) {
             onUpdatePerson({ ...person, [field]: value });
          }
       }
    }
  };
  
  const handleDeleteSelection = () => {
    if (!selection) return;
    if (selection.type === 'NODE') {
      setWorld(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== selection.id),
        edges: prev.edges.filter(e => e.sourceId !== selection.id && e.targetId !== selection.id)
      }));
      setViewState(prev => ({ ...prev, selection: null }));
    } else if (selection.type === 'EDGE') {
       setWorld(prev => ({
         ...prev,
         edges: prev.edges.filter(e => e.id !== selection.id)
       }));
       setViewState(prev => ({ ...prev, selection: null }));
    } else if (selection.type === 'ROOM') {
       if(!activeContainer || !activeFloorId) return;
       setWorld(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => {
             if(n.id !== activeNodeId) return n;
             return updateDeep(n, [...navigationStack], (target) => {
                target.floors = target.floors.map((f: Floor) => {
                   if (f.id !== activeFloorId) return f;
                   return { ...f, rooms: f.rooms.filter(r => r.id !== selection.id) };
                });
                return target;
             });
          })
       }));
       setViewState(prev => ({ ...prev, selection: null }));
    } else if (selection.type === 'FLOOR') {
       handleDeleteFloor(selection.id);
    } else if (selection.type === 'ITEM') {
       if(!activeContainer || !activeFloorId) return;
       setWorld(prev => {
          return {
             ...prev,
             nodes: prev.nodes.map(n => {
                if (n.id !== activeNodeId) return n;
                return updateDeep(n, [...navigationStack], (target) => {
                   target.floors = target.floors.map((f: Floor) => {
                      if (f.id !== activeFloorId) return f;
                      return {
                         ...f,
                         rooms: f.rooms.map((r: Room) => ({ ...r, items: r.items.filter(i => i.id !== selection.id) }))
                      };
                   });
                   return target;
                });
             })
          };
       });
       setViewState(prev => ({ ...prev, selection: null }));
    } else if (selection.type === 'PERSON') {
       setViewState(prev => ({ ...prev, selection: null }));
    }
  };

  const exportJson = () => {
    const dataStr = JSON.stringify(world, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blueprint_${world.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="blueprint-module-wrapper flex flex-col h-full w-full bg-blueprint-900 text-slate-300 overflow-hidden font-mono relative">
      {/* Navigation Bar */}
      <div className="h-12 border-b border-blueprint-700 flex items-center justify-between px-4 bg-blueprint-900/90 backdrop-blur shrink-0 z-30">
        <div className="flex items-center gap-2 text-sm">
            {viewLevel === ViewLevel.WORLD ? (
               <div className="flex items-center gap-2 text-blueprint-500 font-bold">
                  <MapIcon size={16} />
                  <span>世界地图</span>
               </div>
            ) : (
               <div className="flex items-center gap-1 overflow-hidden">
                  <button 
                     onClick={() => handleNavigateUp()}
                     className="hover:text-white text-slate-500 flex items-center gap-1 transition-colors mr-2"
                  >
                     <ArrowLeft size={14} /> 返回
                  </button>
                  
                  {/* Breadcrumbs */}
                  {breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={crumb.id}>
                         <button 
                           onClick={() => handleNavigateUp(idx)}
                           className={`flex items-center gap-1 px-1 rounded ${idx === breadcrumbs.length - 1 ? 'text-white font-bold' : 'text-blueprint-500 hover:bg-blueprint-800'}`}
                         >
                            {idx === 0 ? <Building size={14}/> : <Home size={14} className="scale-75 opacity-70"/>}
                            <span className="truncate max-w-[100px]">{crumb.name}</span>
                         </button>
                         {idx < breadcrumbs.length - 1 && <ChevronRight size={14} className="text-blueprint-700" />}
                      </React.Fragment>
                  ))}
               </div>
            )}
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
            <div className="flex bg-blueprint-950 rounded border border-blueprint-700 p-0.5 ml-4">
               <button 
                 onClick={() => setViewState(prev => ({ ...prev, mapMode: MapDisplayMode.STATIC, isPlaying: false }))}
                 className={`px-3 py-1 text-xs flex items-center gap-1 rounded ${mapMode === MapDisplayMode.STATIC ? 'bg-blueprint-700 text-white' : 'text-blueprint-500 hover:text-white'}`}
               >
                 <Building size={12}/> 默认视图
               </button>
               <button 
                 onClick={() => setViewState(prev => ({ ...prev, mapMode: MapDisplayMode.DYNAMIC }))}
                 className={`px-3 py-1 text-xs flex items-center gap-1 rounded ${mapMode === MapDisplayMode.DYNAMIC ? 'bg-green-700 text-white' : 'text-green-500 hover:text-white'}`}
               >
                 <Clock size={12}/> 时间轴
               </button>
            </div>
            
            {/* Search Bar */}
            <div className="relative ml-2">
               <button 
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`p-1.5 rounded transition-colors ${isSearchOpen ? 'bg-blueprint-700 text-white' : 'hover:bg-blueprint-800 text-blueprint-500 hover:text-white'}`}
                  title="搜索地点"
               >
                  <Search size={16}/>
               </button>

               {isSearchOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-blueprint-900 border border-blueprint-700 rounded-lg shadow-xl animate-fade-in overflow-hidden z-50">
                     <div className="p-2 border-b border-blueprint-800 flex items-center gap-2">
                        <Search size={12} className="text-blueprint-500"/>
                        <input 
                           autoFocus
                           className="bg-transparent border-none text-xs text-white placeholder-blueprint-700 focus:ring-0 w-full outline-none"
                           placeholder="搜索节点或房间..."
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-blueprint-500 hover:text-white"><X size={12}/></button>
                     </div>
                     <div className="max-h-64 overflow-y-auto">
                        {searchResults.length === 0 ? (
                           <div className="p-3 text-center text-xs text-blueprint-700">
                              {searchQuery ? '无搜索结果' : '输入名称搜索'}
                           </div>
                        ) : (
                           searchResults.map((res, idx) => (
                              <button
                                 key={`${res.type}-${res.id}-${idx}`}
                                 onClick={() => handleSearchSelect(res)}
                                 className="w-full text-left px-3 py-2 hover:bg-blueprint-800 border-b border-blueprint-800/50 last:border-0 flex items-center gap-2 group"
                              >
                                 <div className={`p-1 rounded ${res.type === 'NODE' ? 'bg-blueprint-900 text-blueprint-400' : 'bg-green-900/30 text-green-400'}`}>
                                    {res.type === 'NODE' ? <MapIcon size={12}/> : <Home size={12}/>}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-300 group-hover:text-white truncate">{res.name}</div>
                                    <div className="text-[10px] text-blueprint-600 truncate">{res.context}</div>
                                 </div>
                                 <div className="opacity-0 group-hover:opacity-100 text-blueprint-500">
                                    <MapPin size={12}/>
                                 </div>
                              </button>
                           ))
                        )}
                     </div>
                  </div>
               )}
            </div>
        </div>

        <div className="flex gap-2 ml-4">
          <button onClick={exportJson} className="p-1.5 hover:bg-blueprint-800 rounded text-blueprint-500 flex items-center gap-2 text-xs" title="导出 JSON">
             <Download size={16} /> 导出
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative flex flex-col min-w-0">
          
          <div className="flex-1 flex relative overflow-hidden">
            {viewLevel === ViewLevel.WORLD && (
              <WorldEditor 
                nodes={world.nodes} 
                edges={world.edges}
                selectedId={selection?.id}
                onNodeSelect={(id) => updateSelection(id ? 'NODE' : null, id)}
                onEdgeSelect={(id) => updateSelection('EDGE', id)}
                onNodeUpdate={handleNodeUpdate}
                onAddNode={handleAddNode}
                onAddEdge={handleAddEdge}
                onOpenBuilding={openBuilding}
                theme={theme}
              />
            )}

            {viewLevel === ViewLevel.BUILDING_EDITOR && activeContainer && (
              <>
                <BuildingView 
                    container={activeContainer}
                    selectedFloorId={activeFloorId || undefined}
                    onAddFloor={handleAddFloor}
                    onSelectFloor={(id) => {
                      setViewState(prev => ({ ...prev, activeFloorId: id }));
                      updateSelection('FLOOR', id);
                    }}
                    onDeleteFloor={handleDeleteFloor}
                />
                
                {activeFloor ? (
                    <FloorEditor 
                      floor={activeFloor}
                      selectedId={selection?.id}
                      onRoomSelect={(id) => updateSelection(id ? 'ROOM' : (activeFloorId ? 'FLOOR' : null), id || activeFloorId || '')}
                      onItemSelect={(id) => updateSelection('ITEM', id)}
                      onPersonSelect={(id) => updateSelection('PERSON', id)}
                      onAddRoom={handleAddRoom}
                      onUpdateRoom={handleUpdateRoom}
                      onAddItem={() => {}}
                      onUpdateItem={handleUpdateItem}
                      onEnterRoom={handleEnterRoom}
                      // Simulation Props
                      mapMode={mapMode}
                      peopleInRoom={peopleLocations}
                      onJumpToPerson={onJumpToPerson}
                      theme={theme}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-blueprint-900 text-slate-600">
                      <div className="text-center">
                          <p>请选择楼层进行编辑</p>
                      </div>
                    </div>
                )}
              </>
            )}
          </div>

          {/* Time Controller (Visible only in Dynamic Mode) */}
          {mapMode === MapDisplayMode.DYNAMIC && (
            <div className="h-14 bg-gray-900 border-t border-green-900/50 flex items-center px-4 gap-4 shrink-0 animate-fade-in shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
               <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border ${isPlaying ? 'bg-green-600 border-green-500 text-white' : 'border-gray-600 text-gray-400 hover:text-white'}`}
                  >
                     {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                  </button>
                  
                  {/* Time Display */}
                  <div className="font-mono text-green-400 font-bold text-lg w-16 text-center">
                     {currentTime.split('T')[1].substring(0,5)}
                  </div>

                  {/* Date Selection */}
                  <input 
                    type="date" 
                    value={currentTime.split('T')[0]}
                    onChange={(e) => {
                       const newDate = e.target.value;
                       if(!newDate) return;
                       const timePart = currentTime.split('T')[1];
                       setViewState(prev => ({ ...prev, currentTime: `${newDate}T${timePart}` }));
                    }}
                    className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded px-2 py-1 font-mono focus:border-green-500 outline-none hover:bg-gray-700 cursor-pointer"
                  />
               </div>
               
               <div className="flex-1 mx-4 relative">
                  <input 
                     type="range" 
                     min="0" max="1439" // Minutes in a day
                     value={parseInt(currentTime.split('T')[1].split(':')[0]) * 60 + parseInt(currentTime.split('T')[1].split(':')[1])}
                     onChange={(e) => {
                        const mins = parseInt(e.target.value);
                        const h = Math.floor(mins / 60).toString().padStart(2,'0');
                        const m = (mins % 60).toString().padStart(2,'0');
                        const newTime = `${currentTime.split('T')[0]}T${h}:${m}:00`;
                        setViewState(prev => ({ ...prev, currentTime: newTime }));
                     }}
                     className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  {/* Current Event Indicator */}
                  {events.filter(e => e.start.startsWith(currentTime.split('T')[0])).map(e => {
                      // Simple calculation to position markers on timeline
                      const startMins = parseInt(e.start.split('T')[1].split(':')[0]) * 60 + parseInt(e.start.split('T')[1].split(':')[1]);
                      const endMins = parseInt(e.end.split('T')[1].split(':')[0]) * 60 + parseInt(e.end.split('T')[1].split(':')[1]);
                      const width = ((endMins - startMins) / 1440) * 100;
                      const left = (startMins / 1440) * 100;
                      return (
                         <div 
                           key={e.id}
                           className="absolute top-3 h-1 bg-blue-500/50 rounded-full pointer-events-none"
                           style={{ left: `${left}%`, width: `${width}%` }}
                           title={e.title}
                         />
                      );
                  })}
               </div>

               <div className="text-xs text-gray-500 flex items-center gap-1">
                  <User size={12}/> {people.length} 智能体
               </div>
            </div>
          )}

        </div>

        {/* Inspector Panel */}
        <Inspector 
          selection={selection!} 
          data={getInspectorData()} 
          onUpdate={handleInspectorUpdate}
          onDelete={handleDeleteSelection}
          peopleInSelection={peopleInSelection}
          allPeople={people}
          onJumpToPerson={onJumpToPerson}
          worldData={world}
          onUpdatePerson={onUpdatePerson}
        />
      </div>
    </div>
  );
};
