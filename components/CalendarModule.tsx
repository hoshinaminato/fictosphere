
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalendarEvent, Person, WorldData, Keyword, Project, TimeSystem, ThemeMode } from '../types';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, X, Edit3, Eye, Save, ArrowRight, User, ChevronLeft, ChevronRight, Activity, List, LayoutGrid, AlignLeft, AlertTriangle, Search, Book, Filter, CheckSquare, Square, Copy, GripVertical, ArrowDown, Hash, Undo2, Bookmark, BookmarkMinus, Check, MoreHorizontal } from 'lucide-react';
import { AttachmentManager } from './AttachmentManager';
import { SearchableSelect } from './SearchableSelect';

interface CalendarModuleProps {
  events: CalendarEvent[];
  people: Person[];
  world: WorldData;
  keywords?: Keyword[];
  onAddEvent: (event: CalendarEvent) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onJump: (event: CalendarEvent) => void;
  onJumpToPerson?: (personId: string) => void;
  targetEventId?: string | null;
  targetPersonId?: string | null;
  
  // Project Config for Time System
  timeConfig?: Project['timeConfig'];
  onBatchUpdateEvents?: (events: CalendarEvent[]) => void;
  theme?: ThemeMode;
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  events,
  people,
  world,
  keywords,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onJump,
  onJumpToPerson,
  targetEventId,
  targetPersonId,
  timeConfig,
  onBatchUpdateEvents,
  theme = 'BLUEPRINT'
}) => {
  // Determine Time System
  const timeSystem = timeConfig?.system || TimeSystem.REAL;
  const isRealTime = timeSystem === TimeSystem.REAL;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // View Mode: Calendar vs Timeline vs DayGrid (Only for Real Time)
  const [calendarMode, setCalendarMode] = useState<'MONTH' | 'TIMELINE' | 'DAY_GRID' | 'SEQUENCE'>('MONTH');

  // Navigation States
  const [viewState, setViewState] = useState<'IDLE' | 'CREATE' | 'DETAIL' | 'EDIT'>('IDLE');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter State (Participant Filtering)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterParticipantIds, setFilterParticipantIds] = useState<string[]>([]);
  const [filterOperator, setFilterOperator] = useState<'OR' | 'AND'>('OR'); 

  // Modal State for Person Details & Delete Confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null); // Visual guide

  // --- NEW: Non-Real Time State ---
  const [history, setHistory] = useState<CalendarEvent[][]>([]); // Undo stack
  const [markedEventIds, setMarkedEventIds] = useState<string[]>([]); // "Staged" items
  const [selectedMarkedIds, setSelectedMarkedIds] = useState<string[]>([]); // Items selected in sidebar to be inserted
  const [autoUnmark, setAutoUnmark] = useState(true); // Config

  // Form State
  const [formData, setFormData] = useState<Partial<CalendarEvent> & { startDate?: string; endDate?: string }>({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    start: '09:00',
    end: '10:00',
    displayDate: '', // For non-real time
    sortOrder: 0,
    locationId: '',
    participantIds: [],
    relatedKeywordIds: [],
    attachments: []
  });

  // Helper: Event Color Generator based on Theme
  const getEventColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash);

    if (theme === 'INK') {
       // Ink Theme: Monochrome with borders or slight patterns
       return 'bg-white text-black border border-black shadow-[2px_2px_0_black]';
    } else if (theme === 'CYBERPUNK') {
       // Cyberpunk: Neon outlines, dark fills
       const neons = ['border-pink-500 text-pink-400', 'border-cyan-500 text-cyan-400', 'border-yellow-500 text-yellow-400', 'border-purple-500 text-purple-400'];
       return `bg-black/80 border ${neons[idx % neons.length]} shadow-[0_0_5px_currentColor]`;
    } else if (theme === 'SCRAPBOOK') {
       // Scrapbook: Pastel paper notes
       const pastels = ['bg-yellow-100 text-gray-800 border-yellow-300', 'bg-blue-100 text-gray-800 border-blue-300', 'bg-green-100 text-gray-800 border-green-300', 'bg-pink-100 text-gray-800 border-pink-300'];
       return `${pastels[idx % pastels.length]} border-2 shadow-sm font-bold`;
    }

    // Default Blueprint/Cartoon
    const colors = [
      'bg-blue-600 border-blue-500',
      'bg-green-600 border-green-500',
      'bg-purple-600 border-purple-500',
      'bg-orange-600 border-orange-500',
      'bg-pink-600 border-pink-500',
      'bg-indigo-600 border-indigo-500',
      'bg-teal-600 border-teal-500',
      'bg-red-600 border-red-500'
    ];
    return colors[idx % colors.length];
  };

  // Effect: Force Sequence View if not Real Time
  useEffect(() => {
     if (!isRealTime) {
        setCalendarMode('SEQUENCE');
     } else if (calendarMode === 'SEQUENCE') {
        setCalendarMode('MONTH');
     }
  }, [isRealTime]);

  // Handle external jump target (Event)
  useEffect(() => {
    if (targetEventId) {
       const evt = events.find(e => e.id === targetEventId);
       if (evt) {
          setSelectedEventId(targetEventId);
          setViewState('DETAIL');
          if (isRealTime) {
             setSelectedDate(evt.start.split('T')[0]);
             setCurrentYear(parseInt(evt.start.split('-')[0]));
          }
       }
    }
  }, [targetEventId, events, isRealTime]);

  // Handle external jump target (Person Filter)
  useEffect(() => {
     if (targetPersonId) {
        setFilterParticipantIds([targetPersonId]);
        setFilterOperator('OR');
        setViewState('IDLE');
        if (isRealTime) {
           const firstEvent = events.find(e => e.participantIds.includes(targetPersonId));
           if (firstEvent) {
              setSelectedDate(firstEvent.start.split('T')[0]);
              setCurrentYear(parseInt(firstEvent.start.split('-')[0]));
           }
        }
     }
  }, [targetPersonId, events, isRealTime]);

  // --- Initializers ---
  const initCreate = () => {
     const maxOrder = events.reduce((max, e) => Math.max(max, e.sortOrder || 0), 0);
     
     setFormData({ 
       title: '', 
       description: '', 
       startDate: selectedDate, 
       endDate: selectedDate,
       start: '09:00', 
       end: '10:00', 
       displayDate: '',
       sortOrder: maxOrder + 1,
       locationId: '', 
       participantIds: [], 
       relatedKeywordIds: [],
       attachments: [] 
     });
     setViewState('CREATE');
  };

  const initEdit = (evt: CalendarEvent) => {
     setFormData({
        ...evt,
        startDate: isRealTime ? evt.start.split('T')[0] : '',
        endDate: isRealTime ? evt.end.split('T')[0] : '',
        start: isRealTime ? evt.start.split('T')[1].substring(0, 5) : '',
        end: isRealTime ? evt.end.split('T')[1].substring(0, 5) : '',
        displayDate: evt.displayDate || '',
        sortOrder: evt.sortOrder ?? 0
     });
     setViewState('EDIT');
  };
  
  const openDetail = (evt: CalendarEvent) => {
      setSelectedEventId(evt.id);
      setViewState('DETAIL');
  };

  const requestDelete = (id: string) => {
     setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
     if (deleteConfirmId) {
        saveHistory();
        onDeleteEvent(deleteConfirmId);
        setDeleteConfirmId(null);
        setViewState('IDLE');
        setSelectedEventId(null);
        // Cleanup marks
        setMarkedEventIds(prev => prev.filter(id => id !== deleteConfirmId));
        setSelectedMarkedIds(prev => prev.filter(id => id !== deleteConfirmId));
     }
  };

  // --- Undo / History ---
  const saveHistory = () => {
      setHistory(prev => {
          const newHist = [...prev, events];
          if (newHist.length > 20) newHist.shift(); // Limit to 20 steps
          return newHist;
      });
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const prevEvents = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      
      if (onBatchUpdateEvents) {
          onBatchUpdateEvents(prevEvents);
      } else {
          // Fallback if batch update not available (shouldn't happen with App.tsx update)
          alert("Batch update not supported in this version.");
      }
  };

  // --- Marking System ---
  const toggleMarkEvent = (id: string) => {
      setMarkedEventIds(prev => {
          if (prev.includes(id)) return prev.filter(mid => mid !== id);
          return [...prev, id];
      });
  };

  const toggleSidebarSelection = (id: string) => {
      setSelectedMarkedIds(prev => {
          if (prev.includes(id)) return prev.filter(sid => sid !== id);
          return [...prev, id];
      });
  };

  // --- Helpers ---
  const getAllLocations = () => {
    const locations: {id: string, name: string, type: string}[] = [];
    world.nodes.forEach(node => {
       locations.push({ id: node.id, name: node.name, type: 'Site' });
       node.floors.forEach(floor => {
          floor.rooms.forEach(room => {
             locations.push({ id: room.id, name: `${node.name} - ${room.name}`, type: 'Room' });
          });
       });
    });
    return locations;
  };

  // --- Main Filter Logic ---
  const getFilteredEvents = (sourceEvents: CalendarEvent[]) => {
     return sourceEvents.filter(e => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
        
        let matchesParticipants = true;
        if (filterParticipantIds.length > 0) {
            if (filterOperator === 'OR') {
                matchesParticipants = e.participantIds.some(pid => filterParticipantIds.includes(pid));
            } else {
                matchesParticipants = filterParticipantIds.every(pid => e.participantIds.includes(pid));
            }
        }
        return matchesSearch && matchesParticipants;
     });
  };

  const globalFilteredEvents = useMemo(() => getFilteredEvents(events), [events, searchQuery, filterParticipantIds, filterOperator]);

  // Sort events based on mode
  const sortedEvents = useMemo(() => {
     if (isRealTime) {
        return [...globalFilteredEvents].sort((a,b) => a.start.localeCompare(b.start));
     } else {
        // Sequence Mode: Sort by sortOrder. Fallback to array index logic if sortOrder is missing (legacy)
        return [...globalFilteredEvents].sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
     }
  }, [globalFilteredEvents, isRealTime]);

  const filteredEventsForDay = useMemo(() => 
    isRealTime ? globalFilteredEvents.filter(e => {
       const dayStart = `${selectedDate}T00:00:00`;
       const dayEnd = `${selectedDate}T23:59:59`;
       return e.start <= dayEnd && e.end >= dayStart;
    }) : [],
  [globalFilteredEvents, selectedDate, isRealTime]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return sortedEvents;
  }, [searchQuery, sortedEvents]);

  const handleSearchSelect = (evt: CalendarEvent) => {
      if (isRealTime) {
         setSelectedDate(evt.start.split('T')[0]);
         setCurrentYear(parseInt(evt.start.split('-')[0]));
      }
      openDetail(evt);
      setIsSearchOpen(false);
      setSearchQuery('');
  };

  const locations = useMemo(() => getAllLocations(), [world]);
  const selectedEvent = events.find(e => e.id === selectedEventId);

  const keywordOptions = useMemo(() => {
     return (keywords || []).map(k => ({
        label: k.name,
        value: k.id,
        group: k.category
     })).sort((a,b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [keywords]);

  const personOptions = useMemo(() => {
     return people.map(p => ({
        label: p.name,
        value: p.id,
        group: p.familyId
     })).sort((a,b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [people]);

  const eventsByDate = useMemo(() => {
    if (!isRealTime) return new Map();
    const map = new Map<string, number>();
    globalFilteredEvents.forEach(e => {
        const startDay = e.start.split('T')[0];
        map.set(startDay, (map.get(startDay) || 0) + 1);
    });
    return map;
  }, [globalFilteredEvents, isRealTime]);

  const handleSubmit = () => {
    if(!formData.title || !formData.locationId) return;
    
    // For Real Time, validate dates
    let fullStart = '';
    let fullEnd = '';
    
    if (isRealTime) {
       if(!formData.startDate || !formData.endDate || !formData.start || !formData.end) {
          alert("请完善时间信息"); return;
       }
       fullStart = `${formData.startDate}T${formData.start}:00`;
       fullEnd = `${formData.endDate}T${formData.end}:00`;
       if (fullEnd < fullStart) {
           alert("结束时间不能早于开始时间");
           return;
       }
    } else {
       // Non-Real Time: Use a dummy ISO date for compatibility but rely on displayDate/sortOrder
       fullStart = new Date().toISOString(); 
       fullEnd = new Date().toISOString();
    }

    const payload = {
       id: viewState === 'EDIT' && selectedEventId ? selectedEventId : Math.random().toString(36).substr(2,9),
       title: formData.title,
       description: formData.description || '',
       start: fullStart,
       end: fullEnd,
       locationId: formData.locationId,
       participantIds: formData.participantIds || [],
       relatedKeywordIds: formData.relatedKeywordIds || [],
       attachments: formData.attachments || [],
       
       // New Fields
       displayDate: formData.displayDate,
       sortOrder: (viewState === 'CREATE' && !isRealTime && formData.sortOrder === undefined) ? events.length + 1 : (formData.sortOrder || 0)
    } as CalendarEvent;

    if (viewState === 'EDIT') {
       onUpdateEvent(payload);
       openDetail(payload);
    } else {
       onAddEvent(payload);
       setViewState('IDLE');
       if (isRealTime) setSelectedDate(formData.startDate || selectedDate);
    }
  };

  // --- Sorting / Drag Logic (Sequence View) ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
     setDraggedEventId(id);
     e.dataTransfer.effectAllowed = "move";
     // Minimal drag image or default
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
     e.preventDefault(); 
     if (draggedEventId !== targetId) {
        setDropTargetId(targetId);
     }
  };

  const handleDragLeave = () => {
     setDropTargetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
     e.preventDefault();
     setDropTargetId(null);
     if (!draggedEventId || draggedEventId === targetId) return;

     saveHistory();

     // Perform Reorder locally
     const draggedIndex = sortedEvents.findIndex(e => e.id === draggedEventId);
     const targetIndex = sortedEvents.findIndex(e => e.id === targetId);
     
     if (draggedIndex === -1 || targetIndex === -1) return;

     const newOrder = [...sortedEvents];
     const [draggedItem] = newOrder.splice(draggedIndex, 1);
     newOrder.splice(targetIndex, 0, draggedItem);

     // Update ALL items sortOrder to reflect new array order
     const updates: CalendarEvent[] = [];
     newOrder.forEach((evt, index) => {
        if (evt.sortOrder !== index) {
           updates.push({ ...evt, sortOrder: index });
        }
     });

     if (updates.length > 0 && onBatchUpdateEvents) {
         onBatchUpdateEvents(updates);
     }

     setDraggedEventId(null);
  };

  // --- Insert from Sidebar Logic ---
  const handleInsert = (insertIndex: number) => {
      if (selectedMarkedIds.length === 0) return;
      saveHistory();

      // 1. Identify Items to Move
      const idsToMove = new Set(selectedMarkedIds);
      
      // 2. Separate current list into [ToMove] and [Others]
      const others = sortedEvents.filter(e => !idsToMove.has(e.id));
      const movingItems = selectedMarkedIds
          .map(id => sortedEvents.find(e => e.id === id))
          .filter(e => e !== undefined) as CalendarEvent[];

      // 3. Insert Moving items at the calculated visual index
      // Simplification: We insert into 'others' array.
      let targetIndexInOthers = 0;
      if (insertIndex >= sortedEvents.length) {
          targetIndexInOthers = others.length;
      } else {
          const targetId = sortedEvents[insertIndex].id;
          // If the target itself is being moved, we search for the next non-moving item
          let effectiveTargetId = targetId;
          let searchIdx = insertIndex;
          while (searchIdx < sortedEvents.length && idsToMove.has(sortedEvents[searchIdx].id)) {
              searchIdx++;
          }
          
          if (searchIdx < sortedEvents.length) {
              effectiveTargetId = sortedEvents[searchIdx].id;
              targetIndexInOthers = others.findIndex(e => e.id === effectiveTargetId);
          } else {
              targetIndexInOthers = others.length;
          }
      }

      // 4. Construct new list
      const newList = [...others];
      newList.splice(targetIndexInOthers, 0, ...movingItems);

      // 5. Update Sort Orders
      const updates: CalendarEvent[] = [];
      newList.forEach((evt, index) => {
          if (evt.sortOrder !== index) {
              updates.push({ ...evt, sortOrder: index });
          }
      });

      if (updates.length > 0 && onBatchUpdateEvents) {
          onBatchUpdateEvents(updates);
      }

      // 6. Handle Config (Unmark)
      if (autoUnmark) {
          setMarkedEventIds(prev => prev.filter(id => !idsToMove.has(id)));
          setSelectedMarkedIds([]);
      }
  };

  const handleAddParticipant = (id: string) => {
     const current = formData.participantIds || [];
     if (!current.includes(id)) {
        setFormData({...formData, participantIds: [...current, id]});
     }
  };

  const handleRemoveParticipant = (id: string) => {
     const current = formData.participantIds || [];
     setFormData({...formData, participantIds: current.filter(pid => pid !== id)});
  };

  const toggleKeyword = (id: string) => {
     const current = formData.relatedKeywordIds || [];
     if(current.includes(id)) {
        setFormData({...formData, relatedKeywordIds: current.filter(kid => kid !== id)});
     } else {
        setFormData({...formData, relatedKeywordIds: [...current, id]});
     }
  };
  
  const addFilterParticipant = (id: string) => {
     if (!filterParticipantIds.includes(id)) {
        setFilterParticipantIds([...filterParticipantIds, id]);
     }
  };

  const removeFilterParticipant = (id: string) => {
     setFilterParticipantIds(filterParticipantIds.filter(pid => pid !== id));
  };

  const getEventLocName = (id: string) => locations.find(l => l.id === id)?.name || '未知地点';
  const getParticipants = (ids: string[]) => people.filter(p => ids.includes(p.id));
  const getRelatedKeywords = (ids: string[]) => (keywords || []).filter(k => ids.includes(k.id));

  // --- Render Functions ---

  const renderMonth = (monthIndex: number) => {
     const date = new Date(currentYear, monthIndex, 1);
     const monthName = date.toLocaleString('zh-CN', { month: 'long' });
     const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
     const firstDayOfWeek = date.getDay(); 

     const days = [];
     for(let i=0; i<firstDayOfWeek; i++) {
        days.push(<div key={`empty-start-${i}`} className="h-8" />);
     }
     
     for(let d=1; d<=daysInMonth; d++) {
        const dayStr = `${currentYear}-${(monthIndex+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
        const isSelected = dayStr === selectedDate;
        const eventCount = eventsByDate.get(dayStr) || 0;
        const isToday = dayStr === new Date().toISOString().split('T')[0];

        // Theme aware styles
        let cellClass = 'text-gray-400 hover:bg-gray-800 hover:text-white';
        if (theme === 'INK') cellClass = 'text-gray-600 hover:bg-black hover:text-white border-transparent hover:border-black';
        if (theme === 'SCRAPBOOK') cellClass = 'text-gray-600 hover:bg-yellow-200 hover:text-black font-hand';

        let selectedClass = 'bg-blue-600 text-white font-bold shadow-md scale-110';
        if (theme === 'INK') selectedClass = 'bg-black text-white font-bold ring-2 ring-gray-300';
        if (theme === 'CYBERPUNK') selectedClass = 'bg-cyan-600 text-white shadow-[0_0_8px_cyan] font-bold';
        if (theme === 'SCRAPBOOK') selectedClass = 'bg-red-400 text-white font-bold rotate-6 shadow-sm';

        days.push(
           <div 
             key={d}
             onClick={() => { setSelectedDate(dayStr); }}
             className={`
                h-8 flex items-center justify-center rounded-full text-xs cursor-pointer relative transition-all group border border-transparent
                ${isSelected ? selectedClass : cellClass}
                ${isToday && !isSelected ? (theme === 'INK' ? 'border-gray-400 text-black' : 'border-blue-500/50 text-blue-400') : ''}
                ${eventCount > 0 ? '' : 'opacity-50 hover:opacity-100'}
             `}
           >
              {d}
              {eventCount > 0 && !isSelected && (
                 <div className={`absolute bottom-1 w-1 h-1 rounded-full ${theme === 'INK' ? 'bg-black' : 'bg-green-500'}`} />
              )}
              {eventCount > 0 && isSelected && (
                 <div className={`absolute -top-1 right-0 text-[8px] px-1 rounded-full font-bold shadow ${theme === 'INK' ? 'bg-white text-black border border-black' : 'bg-green-500 text-black'}`}>
                    {eventCount}
                 </div>
              )}
           </div>
        );
     }

     const totalCells = 42;
     const currentCells = firstDayOfWeek + daysInMonth;
     for(let i=currentCells; i<totalCells; i++) {
        days.push(<div key={`empty-end-${i}`} className="h-8 pointer-events-none" />);
     }

     return (
        <div key={monthIndex} className="bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-lg flex flex-col h-full">
           <h4 className={`text-sm font-bold mb-2 pl-1 border-l-2 ml-1 ${theme === 'INK' ? 'text-black border-black' : 'text-gray-300 border-blue-600'}`}>{monthName}</h4>
           <div className="grid grid-cols-7 gap-1 text-center flex-1 content-start">
              {['日','一','二','三','四','五','六'].map(h => (
                 <span key={h} className="text-[10px] text-gray-500 font-bold uppercase h-6 flex items-center justify-center">{h}</span>
              ))}
              {days}
           </div>
        </div>
     );
  };

  const renderTimeline = () => {
    // Only real time
    const sorted = [...globalFilteredEvents].sort((a, b) => a.start.localeCompare(b.start));
    const groups: { [key: string]: CalendarEvent[] } = {};
    sorted.forEach(e => {
        const key = e.start.substring(0, 7); // YYYY-MM
        if(!groups[key]) groups[key] = [];
        groups[key].push(e);
    });

    return (
        <div className="flex-1 overflow-y-auto p-8 relative">
           <div className={`absolute left-[30px] md:left-1/2 top-0 bottom-0 w-0.5 ${theme === 'INK' ? 'bg-gray-300' : 'bg-gray-800'}`} />
           <div className="max-w-4xl mx-auto space-y-12">
               {Object.keys(groups).sort().map(monthKey => (
                  <div key={monthKey} className="relative">
                      <div className="flex justify-start md:justify-center mb-6 pl-[60px] md:pl-0">
                         <div className={`px-4 py-1 rounded-full border text-sm font-bold shadow-lg z-10 
                            ${theme === 'INK' ? 'bg-white text-black border-black' : 'bg-gray-800 text-blue-400 border-blue-900/50'}`}>
                            {monthKey}
                         </div>
                      </div>
                      
                      <div className="space-y-8">
                          {groups[monthKey].map((evt, idx) => {
                             const isLeft = idx % 2 === 0;
                             const dateNum = evt.start.split('-')[2].split('T')[0];
                             const cardClass = theme === 'INK' 
                                ? 'bg-white border border-black shadow-[4px_4px_0_rgba(0,0,0,0.1)] text-black' 
                                : (theme === 'SCRAPBOOK' 
                                    ? 'bg-[#fffef9] border-2 border-gray-200 shadow-sm text-gray-700 font-hand'
                                    : 'bg-gray-900 border border-gray-700 hover:border-blue-500/50 hover:shadow-lg text-gray-300');

                             return (
                                <div key={evt.id} className="relative md:flex md:justify-between items-center group">
                                    <div className={`absolute left-[26px] md:left-1/2 top-4 w-2.5 h-2.5 rounded-full z-10 transform md:-translate-x-1.5 border-2 ${theme === 'INK' ? 'bg-white border-black' : 'border-gray-900 bg-gray-600 group-hover:bg-blue-400'} ${viewState === 'DETAIL' && selectedEventId === evt.id ? 'scale-150' : ''}`} />
                                    <div className={`ml-[60px] md:ml-0 md:w-[45%] ${isLeft ? 'md:mr-auto md:text-right' : 'md:ml-auto md:text-left'}`}>
                                        <div 
                                          onClick={() => openDetail(evt)}
                                          className={`p-4 rounded-xl cursor-pointer transition-all ${isLeft ? 'md:pr-6' : 'md:pl-6'} ${cardClass}`}
                                        >
                                            <div className={`text-xs font-mono mb-1 ${isLeft ? 'md:flex-row-reverse' : ''} flex items-center gap-2 ${theme === 'INK' ? 'text-gray-600' : 'text-blue-500'}`}>
                                               <span className="font-bold text-lg">{dateNum}日</span>
                                               <span className="opacity-70">{evt.start.split('T')[1].substring(0,5)}</span>
                                            </div>
                                            <h3 className={`font-bold text-lg mb-1 ${theme === 'INK' ? 'text-black' : 'text-white'}`}>{evt.title}</h3>
                                            <div className={`flex items-center gap-2 text-xs opacity-70 ${isLeft ? 'md:justify-end' : 'md:justify-start'}`}>
                                                <MapPin size={12}/> {getEventLocName(evt.locationId)}
                                            </div>
                                            <div className="mt-2 text-sm opacity-80 line-clamp-2">{evt.description}</div>
                                        </div>
                                    </div>
                                    <div className="hidden md:block md:w-[45%]" />
                                </div>
                             );
                          })}
                      </div>
                  </div>
               ))}
           </div>
        </div>
    );
  };

  const renderDayGrid = () => {
    const [y, m] = selectedDate.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    
    // Helper to calculate overlap lanes
    const computeLanes = (dayEvents: CalendarEvent[]) => {
      // Sort by start
      const sorted = [...dayEvents].sort((a,b) => a.start.localeCompare(b.start));
      const lanes: CalendarEvent[][] = [];
      
      sorted.forEach(evt => {
        let placed = false;
        // Try to place in existing lane
        for(let i=0; i<lanes.length; i++) {
            const lastInLane = lanes[i][lanes[i].length - 1];
            // If current starts after last one ends, it fits
            if (evt.start >= lastInLane.end) {
                lanes[i].push(evt);
                placed = true;
                break;
            }
        }
        // Else create new lane
        if(!placed) lanes.push([evt]);
      });
      return lanes;
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-950">
           {/* Time Scale Header */}
           <div className="sticky top-0 z-30 bg-gray-900 border-b border-gray-700 flex mb-4 ml-[80px] rounded-lg shadow border-x border-t">
              {Array.from({length: 25}).map((_, i) => (
                 <div key={i} className="flex-1 text-[10px] text-gray-500 py-1 border-l border-gray-800 first:border-l-0 text-center relative font-mono">
                    <span className="block">{i}</span>
                 </div>
              ))}
           </div>

           <div className="space-y-4 pb-20">
              {Array.from({length: daysInMonth}).map((_, i) => {
                 const d = i + 1;
                 const dateStr = `${y}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
                 
                 // Get Events overlapping this day
                 const dayStart = `${dateStr}T00:00:00`;
                 const dayEnd = `${dateStr}T23:59:59`;
                 
                 // Use globalFilteredEvents to respect search filters
                 const dayEvents = globalFilteredEvents.filter(e => e.start < dayEnd && e.end > dayStart);
                 const lanes = computeLanes(dayEvents);
                 const rowHeight = Math.max(48, lanes.length * 28 + 12);
                 const isSelected = dateStr === selectedDate;

                 return (
                    <div 
                      key={dateStr} 
                      className={`flex group rounded-lg transition-colors ${isSelected ? 'bg-blue-900/10' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                    >
                       {/* Date Label */}
                       <div className="w-[80px] shrink-0 flex flex-col justify-center pr-4 text-right border-r border-gray-800 py-2">
                          <span className={`text-xl font-bold font-mono ${isSelected ? (theme === 'INK' ? 'text-black' : 'text-blue-400') : 'text-gray-300'}`}>{d}</span>
                          <span className="text-[10px] text-gray-500 uppercase">{new Date(dateStr).toLocaleString('zh-CN', {weekday:'short'})}</span>
                       </div>
                       
                       {/* Timeline Track */}
                       <div className="flex-1 relative bg-gray-900/30 rounded-r-lg border-y border-r border-gray-800/50 transition-colors group-hover:bg-gray-800/30" style={{height: rowHeight}}>
                          {/* Grid Lines */}
                           <div className="absolute inset-0 flex pointer-events-none">
                              {Array.from({length: 24}).map((_, idx) => (
                                 <div key={idx} className="flex-1 border-r border-gray-800/20" />
                              ))}
                           </div>

                          {dayEvents.map(evt => {
                             // Determine Lane Index
                             let laneIdx = 0;
                             lanes.forEach((lane, idx) => { if(lane.includes(evt)) laneIdx = idx; });
                             
                             // Calculate Position
                             const msInDay = 24 * 60 * 60 * 1000;
                             const tDayStart = new Date(dayStart).getTime();
                             const tDayEnd = new Date(dayEnd).getTime();
                             const tEvtStart = new Date(evt.start).getTime();
                             const tEvtEnd = new Date(evt.end).getTime();
                             
                             const effectiveStart = Math.max(tEvtStart, tDayStart);
                             const effectiveEnd = Math.min(tEvtEnd, tDayEnd);
                             
                             const leftPct = ((effectiveStart - tDayStart) / msInDay) * 100;
                             const widthPct = ((effectiveEnd - effectiveStart) / msInDay) * 100;

                             return (
                                <div 
                                  key={evt.id}
                                  onClick={(e) => { e.stopPropagation(); openDetail(evt); }}
                                  className={`absolute rounded px-2 text-[10px] truncate cursor-pointer hover:brightness-110 hover:z-20 flex items-center transition-all opacity-90 hover:opacity-100 ${getEventColor(evt.id)}`}
                                  style={{
                                     left: `${leftPct}%`,
                                     width: `${Math.max(widthPct, 0.5)}%`, // Min width visibility
                                     top: `${laneIdx * 26 + 6}px`,
                                     height: '22px',
                                     zIndex: 10
                                  }}
                                  title={`${evt.title} (${evt.start.split('T')[1].slice(0,5)} - ${evt.end.split('T')[1].slice(0,5)})`}
                                >
                                   <span className="truncate font-bold">{evt.title}</span>
                                </div>
                             )
                          })}
                       </div>
                    </div>
                 )
              })}
           </div>
        </div>
    );
  };

  // --- NEW: Insert Zone Component ---
  const InsertZone: React.FC<{ index: number; onInsert: (idx: number) => void }> = ({ index, onInsert }) => (
      <div 
         onClick={() => onInsert(index)}
         className="h-6 -my-3 relative group cursor-pointer z-10 flex items-center justify-center"
      >
         <div className="h-0.5 w-full bg-blue-500/0 group-hover:bg-blue-500/50 transition-colors rounded-full" />
         <div className="absolute bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-lg">
            在此处插入选中项
         </div>
      </div>
  );

  // --- NEW: Sequence View (Fictional Time) ---
  const renderSequenceView = () => {
     const hasSelection = selectedMarkedIds.length > 0;

     return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-950">
           <div className="max-w-2xl mx-auto space-y-2 pb-20 relative">
              
              <div className="text-center text-gray-500 text-sm mb-8 flex flex-col items-center gap-2">
                 <div className="bg-gray-900 px-4 py-2 rounded-full border border-gray-700 text-xs font-mono flex items-center gap-2 shadow-lg">
                    <Clock size={12} className="text-green-500"/>
                    <span className="text-gray-300 font-bold">{timeConfig?.label || '当前世界观'}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">线性时间轴</span>
                 </div>
                 <div className="text-[10px] opacity-50 flex items-center gap-1">
                    <GripVertical size={10}/> 提示：拖拽卡片调整顺序，或使用左侧标记功能批量插入
                 </div>
              </div>

              {/* Top Insert Zone */}
              {hasSelection && <InsertZone index={0} onInsert={handleInsert} />}

              {sortedEvents.map((evt, index) => (
                 <React.Fragment key={evt.id}>
                    <div 
                        draggable
                        onDragStart={(e) => handleDragStart(e, evt.id)}
                        onDragOver={(e) => handleDragOver(e, evt.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, evt.id)}
                        className={`
                           relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-move group
                           ${draggedEventId === evt.id ? 'opacity-30 border-dashed border-blue-500 bg-blue-900/10' : ''}
                           ${dropTargetId === evt.id ? 'border-blue-500 ring-2 ring-blue-500/20 translate-y-1' : 'bg-gray-900 border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'}
                           ${markedEventIds.includes(evt.id) ? 'border-l-4 border-l-yellow-500' : ''}
                        `}
                    >
                        {/* Visual Connector Line */}
                        {index < sortedEvents.length - 1 && (
                           <div className="absolute left-[27px] top-12 bottom-[-20px] w-0.5 bg-gray-800 pointer-events-none group-hover:bg-gray-700"/>
                        )}

                        {/* Timeline Node / Drag Handle */}
                        <div className="flex flex-col items-center gap-1 pt-1 shrink-0 z-10 w-8">
                           <div className={`w-2.5 h-2.5 rounded-full border-2 border-gray-900 shadow-md group-hover:scale-125 transition-transform ${markedEventIds.includes(evt.id) ? 'bg-yellow-500' : 'bg-blue-600'}`} />
                           <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical size={14} className="text-gray-500"/>
                           </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(evt)}>
                           <div className="flex justify-between items-start mb-1">
                              <h3 className="font-bold text-gray-200 group-hover:text-white text-base truncate pr-2">{evt.title}</h3>
                              <div className="flex items-center gap-2">
                                 {evt.displayDate && (
                                    <div className="shrink-0 text-xs text-green-400 font-mono bg-green-900/20 px-2 py-0.5 rounded border border-green-900/30">
                                       {evt.displayDate}
                                    </div>
                                 )}
                                 {/* Mark Button */}
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); toggleMarkEvent(evt.id); }}
                                    className={`p-1 rounded hover:bg-gray-700 transition-colors ${markedEventIds.includes(evt.id) ? 'text-yellow-500' : 'text-gray-600'}`}
                                    title={markedEventIds.includes(evt.id) ? "取消标记" : "标记 (加入侧边栏)"}
                                 >
                                    {markedEventIds.includes(evt.id) ? <BookmarkMinus size={14}/> : <Bookmark size={14}/>}
                                 </button>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                              <span className="flex items-center gap-1"><MapPin size={10}/> {getEventLocName(evt.locationId)}</span>
                              {evt.participantIds.length > 0 && (
                                 <span className="flex items-center gap-1"><User size={10}/> {evt.participantIds.length} 人</span>
                              )}
                              <span className="text-[9px] bg-gray-800 px-1 rounded text-gray-600 font-mono">#{index + 1}</span>
                           </div>
                           
                           {evt.description && (
                              <p className="text-sm text-gray-400 line-clamp-2 border-l-2 border-gray-800 pl-2">
                                 {evt.description}
                              </p>
                           )}
                        </div>
                    </div>
                    {/* Insert Zone After Item */}
                    {hasSelection && <InsertZone index={index + 1} onInsert={handleInsert} />}
                 </React.Fragment>
              ))}

              {sortedEvents.length === 0 && (
                 <div className="text-center py-16 text-gray-600 border-2 border-dashed border-gray-800 rounded-xl">
                    <List size={48} className="mx-auto mb-4 opacity-20"/>
                    <p className="text-sm">暂无事件。</p>
                    <button onClick={initCreate} className="mt-4 text-blue-500 hover:text-blue-400 text-xs underline">创建第一个事件</button>
                 </div>
              )}
           </div>
        </div>
     );
  };


  return (
    <div className="flex h-full bg-gray-950 text-slate-300 relative">
      {/* Sidebar: Show Real Time Calendar OR Custom Staging Area */}
      <div className="w-80 border-r border-gray-800 bg-gray-900 flex flex-col shrink-0 z-10 shadow-xl hidden md:flex">
         
         {isRealTime ? (
            // === REAL TIME SIDEBAR ===
            <>
               <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                     <CalendarIcon className="text-blue-500" size={20} />
                     日程列表
                  </h2>
                  <div className="mt-2 flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                     <div className="text-2xl font-bold text-white">{selectedDate.split('-')[2]}</div>
                     <div className="flex flex-col text-xs text-gray-400 leading-tight">
                        <span>{new Date(selectedDate).toLocaleString('zh-CN', { weekday: 'long' })}</span>
                        <span>{selectedDate.split('-')[0]}年{selectedDate.split('-')[1]}月</span>
                     </div>
                     <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-auto w-6 h-6 opacity-0 absolute cursor-pointer" 
                        title="选择日期"
                     />
                     <Edit3 size={14} className="ml-auto text-gray-500"/>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">当日事项 ({filteredEventsForDay.length})</span>
                  </div>
                  
                  {filteredEventsForDay.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-10 text-gray-600 border border-dashed border-gray-800 rounded-lg bg-gray-800/20">
                        <Clock size={24} className="mb-2 opacity-50"/>
                        <span className="text-sm">今日无安排</span>
                     </div>
                  ) : (
                     filteredEventsForDay.sort((a,b) => a.start.localeCompare(b.start)).map(evt => {
                        const timeStr = `${evt.start.split('T')[1].substring(0,5)} - ${evt.end.split('T')[1].substring(0,5)}`;
                        const isSelected = selectedEventId === evt.id && (viewState === 'DETAIL' || viewState === 'EDIT');
                        
                        return (
                           <div 
                               key={evt.id} 
                               onClick={() => openDetail(evt)}
                               className={`p-3 rounded-lg border cursor-pointer transition-all relative overflow-hidden group
                                  ${isSelected 
                                     ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                     : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750'}
                               `}
                           >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${isSelected ? 'bg-blue-500' : 'bg-gray-600 group-hover:bg-blue-400 transition-colors'}`}/>
                              <div className="pl-2">
                                 <div className={`font-bold text-sm truncate mb-1 ${isSelected ? 'text-blue-100' : 'text-gray-200'}`}>{evt.title}</div>
                                 <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1 bg-gray-900/50 px-1.5 py-0.5 rounded"><Clock size={10} /> {timeStr}</span>
                                 </div>
                                 {evt.locationId && (
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-2 truncate">
                                       <MapPin size={10} /> {getEventLocName(evt.locationId)}
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
            </>
         ) : (
            // === NON-REAL TIME SIDEBAR (STAGING AREA) ===
            <>
               <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0">
                  <div className="flex justify-between items-center mb-3">
                     <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Bookmark className="text-yellow-500" size={20} />
                        标记事件
                     </h2>
                     {history.length > 0 && (
                        <button 
                           onClick={handleUndo}
                           className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-700"
                           title="撤销上一次排序/操作"
                        >
                           <Undo2 size={12}/> 撤销
                        </button>
                     )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                     <span>已标记 ({markedEventIds.length})</span>
                     {markedEventIds.length > 0 && (
                        <button onClick={() => { setMarkedEventIds([]); setSelectedMarkedIds([]); }} className="hover:text-red-400">清空</button>
                     )}
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-800 mb-1">
                     <input 
                        type="checkbox" 
                        checked={autoUnmark} 
                        onChange={e => setAutoUnmark(e.target.checked)}
                        id="autoUnmark"
                        className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                     />
                     <label htmlFor="autoUnmark" className="text-xs text-gray-400 cursor-pointer select-none">
                        插入后自动移除标记
                     </label>
                  </div>
                  
                  {markedEventIds.length > 0 && (
                     <div className="flex gap-1 mt-2">
                        <button 
                           onClick={() => setSelectedMarkedIds(markedEventIds)} 
                           className="flex-1 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
                        >
                           全选
                        </button>
                        <button 
                           onClick={() => setSelectedMarkedIds([])} 
                           className="flex-1 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
                        >
                           取消选择
                        </button>
                     </div>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-900/50">
                  {markedEventIds.length === 0 ? (
                     <div className="text-center py-10 text-gray-600 text-xs px-4">
                        <Bookmark size={24} className="mx-auto mb-2 opacity-30"/>
                        在右侧时间轴点击 <Bookmark size={10} className="inline"/> 图标标记事件，可在此处进行批量插入操作。
                     </div>
                  ) : (
                     markedEventIds.map(id => {
                        const evt = events.find(e => e.id === id);
                        if (!evt) return null;
                        const isSelected = selectedMarkedIds.includes(id);
                        
                        return (
                           <div 
                              key={id}
                              onClick={() => toggleSidebarSelection(id)}
                              className={`
                                 p-2 rounded border cursor-pointer select-none transition-all text-sm flex items-start gap-2
                                 ${isSelected ? 'bg-yellow-900/30 border-yellow-600/50 text-yellow-100' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}
                              `}
                           >
                              <div className={`mt-0.5 w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-gray-600 bg-transparent'}`}>
                                 {isSelected && <Check size={10} strokeWidth={4}/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="truncate font-medium">{evt.title}</div>
                                 <div className="flex justify-between items-center text-[10px] opacity-70 mt-0.5">
                                    <span>#{evt.sortOrder}</span>
                                    <span>{evt.displayDate}</span>
                                 </div>
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
            </>
         )}
         
         <div className="p-4 border-t border-gray-800 bg-gray-900 z-10">
            <button 
               onClick={initCreate}
               className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
            >
               <Plus size={16} /> 新建日程
            </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-950 relative flex flex-col overflow-hidden">
         <div className="h-12 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 shrink-0">
             
             {/* View Switcher (Real Time) vs Title (Fictional) */}
             {isRealTime ? (
               <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                  <button 
                     onClick={() => setCalendarMode('MONTH')}
                     className={`px-3 py-1.5 text-xs flex items-center gap-2 rounded transition-all ${calendarMode === 'MONTH' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                     <LayoutGrid size={14}/> 年视图
                  </button>
                  <button 
                     onClick={() => setCalendarMode('DAY_GRID')}
                     className={`px-3 py-1.5 text-xs flex items-center gap-2 rounded transition-all ${calendarMode === 'DAY_GRID' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                     <AlignLeft size={14}/> 月视图
                  </button>
                  <button 
                     onClick={() => setCalendarMode('TIMELINE')}
                     className={`px-3 py-1.5 text-xs flex items-center gap-2 rounded transition-all ${calendarMode === 'TIMELINE' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                     <List size={14}/> 时间轴
                  </button>
               </div>
             ) : (
                <div className="font-bold text-gray-300 flex items-center gap-2">
                   <Clock size={16} className="text-green-500"/>
                   {timeConfig?.label || '自定义时间'} 
                   <span className="text-xs text-gray-500 font-normal border border-gray-700 px-2 py-0.5 rounded">
                      {timeSystem === TimeSystem.NONE ? '无时间' : (timeSystem === TimeSystem.ERA ? '虚构纪元' : (timeSystem === TimeSystem.CHAPTER ? '章节模式' : (timeSystem === TimeSystem.SEASONAL ? '季节循环' : '相对时间')))}
                   </span>
                </div>
             )}
             
             {isRealTime && calendarMode === 'MONTH' && (
                <div className="flex items-center gap-4 text-white font-bold font-mono text-lg">
                   <button onClick={() => setCurrentYear(y => y-1)} className="hover:text-blue-400"><ChevronLeft/></button>
                   {currentYear}年
                   <button onClick={() => setCurrentYear(y => y+1)} className="hover:text-blue-400"><ChevronRight/></button>
                </div>
             )}

             <div className="flex items-center gap-2">
                {/* Filter & Search (Shared) */}
                <div className="relative">
                   <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`p-1.5 rounded transition-colors ${isFilterOpen || filterParticipantIds.length > 0 ? 'bg-indigo-700 text-white' : 'hover:bg-gray-800 text-gray-500 hover:text-white'}`}
                      title="筛选参与人"
                   >
                      <Filter size={16}/>
                   </button>
                   {filterParticipantIds.length > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-gray-900"/>
                   )}
                   {/* ... Filter Dropdown Logic ... */}
                   {isFilterOpen && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl animate-fade-in z-50 p-3">
                         <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                            <span className="text-xs font-bold text-gray-400">筛选人员</span>
                            {filterParticipantIds.length > 0 && (
                               <button onClick={() => setFilterParticipantIds([])} className="text-[10px] text-red-400 hover:text-red-300">清空</button>
                            )}
                         </div>
                         
                         {/* Operator Toggle */}
                         <div className="flex bg-gray-950 p-1 rounded border border-gray-800 mb-2">
                            <button 
                               onClick={() => setFilterOperator('OR')} 
                               className={`flex-1 text-[10px] py-1 rounded ${filterOperator === 'OR' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
                            >
                               包含任一 (OR)
                            </button>
                            <button 
                               onClick={() => setFilterOperator('AND')} 
                               className={`flex-1 text-[10px] py-1 rounded ${filterOperator === 'AND' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
                            >
                               包含所有 (AND)
                            </button>
                         </div>

                         {/* Active Filters */}
                         <div className="flex flex-wrap gap-1 mb-2">
                            {filterParticipantIds.map(pid => (
                               <div key={pid} className="bg-indigo-900/50 text-indigo-300 text-[10px] px-2 py-1 rounded border border-indigo-800 flex items-center gap-1">
                                  {people.find(p => p.id === pid)?.name}
                                  <button onClick={() => removeFilterParticipant(pid)} className="hover:text-white"><X size={10}/></button>
                               </div>
                            ))}
                         </div>

                         <SearchableSelect 
                            options={personOptions}
                            value=""
                            onChange={(val) => { if(val) addFilterParticipant(val); }}
                            placeholder="添加人员..."
                            darker={true}
                         />
                      </div>
                   )}
                </div>

                <div className="relative">
                    <button 
                       onClick={() => setIsSearchOpen(!isSearchOpen)}
                       className={`p-1.5 rounded transition-colors ${isSearchOpen ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 text-gray-500 hover:text-white'}`}
                       title="搜索日程"
                    >
                       <Search size={16}/>
                    </button>
                    {isSearchOpen && (
                       <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl animate-fade-in overflow-hidden z-50">
                          <div className="p-2 border-b border-gray-800 flex items-center gap-2">
                             <Search size={12} className="text-gray-500"/>
                             <input 
                                autoFocus
                                className="bg-transparent border-none text-xs text-white placeholder-gray-600 focus:ring-0 w-full outline-none"
                                placeholder="搜索标题或描述..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                             />
                             <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-gray-500 hover:text-white"><X size={12}/></button>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                             {searchResults.length === 0 ? (
                                <div className="p-3 text-center text-xs text-gray-600">
                                   {searchQuery ? '无搜索结果' : '输入关键词搜索'}
                                </div>
                             ) : (
                                searchResults.map((evt) => (
                                   <button
                                      key={evt.id}
                                      onClick={() => handleSearchSelect(evt)}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-800 border-b border-gray-800/50 last:border-0 flex flex-col"
                                   >
                                      <div className="text-xs font-bold text-gray-300 truncate">{evt.title}</div>
                                      <div className="text-[10px] text-gray-500 flex justify-between w-full">
                                         <span>{isRealTime ? evt.start.split('T')[0] : (evt.displayDate || 'N/A')}</span>
                                         <span>{getEventLocName(evt.locationId)}</span>
                                      </div>
                                   </button>
                                ))
                             )}
                          </div>
                       </div>
                    )}
                </div>

                {/* Add Buttons */}
                <button 
                    onClick={initCreate}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-all"
                >
                    <Plus size={14} /> {isRealTime ? '新建' : '添加节点'}
                </button>
             </div>
         </div>

         {/* CONTENT VIEWS */}
         {viewState === 'IDLE' && (
            isRealTime ? (
               <>
                  {calendarMode === 'MONTH' && (
                     <div className="flex-1 overflow-y-auto p-4 md:p-8">
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {Array.from({length: 12}).map((_, i) => renderMonth(i))}
                           </div>
                     </div>
                  )}
                  {calendarMode === 'DAY_GRID' && renderDayGrid()}
                  {calendarMode === 'TIMELINE' && renderTimeline()}
               </>
            ) : (
               renderSequenceView()
            )
         )}

         {/* DETAIL VIEW */}
         {viewState === 'DETAIL' && selectedEvent && (
             <div className="absolute inset-0 z-20 bg-gray-950/80 backdrop-blur flex justify-end">
                <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 h-full overflow-y-auto animate-slide-in-right shadow-2xl">
                    <div className="relative h-48 bg-gradient-to-br from-blue-900 to-slate-900 p-8 flex flex-col justify-end">
                        <button onClick={() => setViewState('IDLE')} className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white"><X size={20}/></button>
                        
                        <h1 className="text-3xl font-bold text-white mb-2">{selectedEvent.title}</h1>
                        <div className="text-blue-200 text-sm flex items-center gap-3 font-mono">
                           {isRealTime ? (
                              <>
                                 <span className="bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30 text-blue-300">
                                   {selectedEvent.start.split('T')[0]}
                                 </span>
                                 <span className="flex items-center gap-1 opacity-70 ml-2">
                                    <Clock size={14}/> 
                                    {selectedEvent.start.split('T')[1].substring(0,5)}
                                 </span>
                              </>
                           ) : (
                              <span className="bg-green-500/20 px-3 py-1 rounded border border-green-500/30 text-green-300 font-bold">
                                 {selectedEvent.displayDate || '时间未知'}
                              </span>
                           )}
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-8">
                        {/* Location */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">地点</label>
                            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                <div className="bg-blue-900/30 p-3 rounded-lg text-blue-400"><MapPin size={24}/></div>
                                <div>
                                    <div className="text-gray-200 font-bold text-lg">{getEventLocName(selectedEvent.locationId)}</div>
                                    <div className="text-xs text-gray-500 font-mono">ID: {selectedEvent.locationId}</div>
                                </div>
                            </div>
                        </div>

                        {/* Keywords */}
                        {selectedEvent.relatedKeywordIds && selectedEvent.relatedKeywordIds.length > 0 && (
                           <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">相关词条</label>
                              <div className="flex flex-wrap gap-2">
                                 {getRelatedKeywords(selectedEvent.relatedKeywordIds).map(k => (
                                    <span key={k.id} className="bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full text-xs border border-purple-800">
                                       {k.name}
                                    </span>
                                 ))}
                              </div>
                           </div>
                        )}

                        {/* Description */}
                        <div>
                           <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">详情描述</label>
                           <p className="text-gray-300 leading-relaxed bg-gray-800/30 p-4 rounded-lg border border-gray-800">
                              {selectedEvent.description || '暂无描述'}
                           </p>
                        </div>

                        {/* Participants */}
                        <div>
                           <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">参与人员</label>
                           {selectedEvent.participantIds.length === 0 ? (
                              <div className="text-gray-600 text-sm italic">无记录</div>
                           ) : (
                              <div className="grid grid-cols-2 gap-3">
                                 {getParticipants(selectedEvent.participantIds).map(p => (
                                    <div key={p.id} className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
                                       <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold">
                                          {p.avatar ? <img src={p.avatar} className="w-full h-full rounded-full object-cover"/> : p.name.charAt(0)}
                                       </div>
                                       <div className="text-sm font-bold text-gray-300">{p.name}</div>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>

                        {/* Attachments */}
                        {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                           <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">附件</label>
                              <AttachmentManager attachments={selectedEvent.attachments} onUpdate={() => {}} readOnly />
                           </div>
                        )}
                        
                        {/* Actions */}
                        <div className="pt-8 mt-8 border-t border-gray-800 flex gap-4">
                            <button 
                                onClick={() => initEdit(selectedEvent)} 
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold border border-gray-600 flex justify-center items-center gap-2"
                            >
                                <Edit3 size={18}/> 编辑
                            </button>
                            <button 
                                onClick={() => requestDelete(selectedEvent.id)}
                                className="px-4 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg border border-red-900/50"
                            >
                                <Trash2 size={18}/>
                            </button>
                            <button 
                                onClick={() => onJump(selectedEvent)}
                                className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                <Eye size={18} /> 跳转蓝图
                            </button>
                        </div>
                    </div>
                </div>
             </div>
         )}

         {/* CREATE / EDIT VIEW */}
         {(viewState === 'CREATE' || viewState === 'EDIT') && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50 shrink-0">
                     <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {viewState === 'CREATE' ? <Plus size={20} className="text-blue-500"/> : <Edit3 size={20} className="text-blue-500"/>}
                        {viewState === 'CREATE' ? '创建新日程' : '编辑日程'}
                     </h3>
                     <button onClick={() => setViewState(viewState === 'EDIT' ? 'DETAIL' : 'IDLE')} className="text-gray-500 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">事件标题</label>
                        <input 
                           type="text" 
                           className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                           placeholder="例如：书房密谈"
                           value={formData.title}
                           onChange={e => setFormData({...formData, title: e.target.value})}
                           autoFocus
                        />
                     </div>

                     {/* Dynamic Time Input Section */}
                     {isRealTime ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-gray-800/30 p-3 rounded border border-gray-700/50 relative group">
                              <div className="flex justify-between items-center mb-2">
                                  <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                     <Clock size={12}/> 开始时间 (Start)
                                  </label>
                              </div>
                              <div className="space-y-2">
                                 <input 
                                    type="date" 
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white text-sm"
                                    value={formData.startDate}
                                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                                 />
                                 <input 
                                    type="time" 
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white text-sm"
                                    value={formData.start}
                                    onChange={e => setFormData({...formData, start: e.target.value})}
                                 />
                              </div>
                           </div>
                           <div className="bg-gray-800/30 p-3 rounded border border-gray-700/50 relative group">
                              <div className="flex justify-between items-center mb-2">
                                  <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                                     <Clock size={12}/> 结束时间 (End)
                                  </label>
                              </div>
                              <div className="space-y-2">
                                 <input 
                                    type="date" 
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white text-sm"
                                    value={formData.endDate}
                                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                                 />
                                 <input 
                                    type="time" 
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-white text-sm"
                                    value={formData.end}
                                    onChange={e => setFormData({...formData, end: e.target.value})}
                                 />
                              </div>
                           </div>
                        </div>
                     ) : (
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-gray-800/30 p-4 rounded border border-gray-700/50">
                              <label className="block text-xs font-bold text-green-400 uppercase tracking-wider mb-2">
                                 {timeSystem === TimeSystem.NONE ? '时间说明 (可选)' : (timeSystem === TimeSystem.CHAPTER ? '章节 / 进度' : '时间点描述')}
                              </label>
                              {timeSystem === TimeSystem.SEASONAL ? (
                                 <select
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                                    value={formData.displayDate}
                                    onChange={e => setFormData({...formData, displayDate: e.target.value})}
                                 >
                                    <option value="">选择季节...</option>
                                    <option value="春 (Spring)">春 (Spring)</option>
                                    <option value="夏 (Summer)">夏 (Summer)</option>
                                    <option value="秋 (Autumn)">秋 (Autumn)</option>
                                    <option value="冬 (Winter)">冬 (Winter)</option>
                                 </select>
                              ) : (
                                 <input 
                                    type="text"
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                                    placeholder={timeSystem === TimeSystem.CHAPTER ? "例如: 第五章" : (timeSystem === TimeSystem.ERA ? "例如: 天启3年 5月" : "例如: 很久很久以前")}
                                    value={formData.displayDate || ''}
                                    onChange={e => setFormData({...formData, displayDate: e.target.value})}
                                 />
                              )}
                           </div>
                           
                           {/* Sort Order Input for Non-Real Time */}
                           <div className="bg-gray-800/30 p-4 rounded border border-gray-700/50">
                              <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                 <Hash size={12}/> 排序权重 (Order)
                              </label>
                              <input 
                                 type="number"
                                 className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono"
                                 placeholder="数字越大越靠后"
                                 value={formData.sortOrder}
                                 onChange={e => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})}
                              />
                              <div className="text-[10px] text-gray-500 mt-2">
                                 可手动输入数字或在列表中拖拽调整。
                              </div>
                           </div>
                        </div>
                     )}

                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">地点</label>
                        <select 
                           className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                           value={formData.locationId}
                           onChange={e => setFormData({...formData, locationId: e.target.value})}
                        >
                           <option value="">选择地点...</option>
                           {locations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name} ({loc.type === 'Site' ? '地点' : '房间'})</option>
                           ))}
                        </select>
                     </div>

                     {/* Participants & Keywords */}
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">参与者</label>
                        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3">
                           <div className="flex flex-wrap gap-2 mb-3">
                              {(formData.participantIds || []).map(pid => {
                                  const p = people.find(person => person.id === pid);
                                  return (
                                     <div key={pid} className="bg-blue-900/30 text-blue-200 text-xs px-2 py-1 rounded border border-blue-800 flex items-center gap-1">
                                        <User size={10}/>
                                        {p?.name || 'Unknown'}
                                        <button onClick={() => handleRemoveParticipant(pid)} className="hover:text-white"><X size={12}/></button>
                                     </div>
                                  );
                              })}
                           </div>
                           <SearchableSelect 
                              options={personOptions}
                              value=""
                              onChange={(val) => { if(val) handleAddParticipant(val); }}
                              placeholder="搜索并添加人员..."
                              darker={true}
                           />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">相关词条</label>
                        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3">
                           <div className="flex flex-wrap gap-2 mb-3">
                              {(formData.relatedKeywordIds || []).map(kid => {
                                  const k = keywords?.find(kw => kw.id === kid);
                                  return (
                                     <div key={kid} className="bg-purple-900/30 text-purple-200 text-xs px-2 py-1 rounded border border-purple-800 flex items-center gap-1">
                                        <Book size={10}/>
                                        {k?.name || 'Unknown'}
                                        <button onClick={() => toggleKeyword(kid)} className="hover:text-white"><X size={12}/></button>
                                     </div>
                                  );
                              })}
                           </div>
                           <SearchableSelect 
                              options={keywordOptions}
                              value=""
                              onChange={(val) => { if(val) toggleKeyword(val); }}
                              placeholder="搜索关联词条..."
                              darker={true}
                           />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">事件详情</label>
                        <textarea 
                           className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white h-24 resize-none focus:border-blue-500 outline-none"
                           value={formData.description}
                           onChange={e => setFormData({...formData, description: e.target.value})}
                           placeholder="描述事件的具体内容..."
                        />
                     </div>

                     {/* Attachments */}
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">附件资料</label>
                        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3">
                           <AttachmentManager 
                              attachments={formData.attachments || []}
                              onUpdate={(atts) => setFormData({...formData, attachments: atts})}
                           />
                        </div>
                     </div>

                  </div>

                  <div className="p-6 border-t border-gray-800 flex justify-between gap-3 bg-gray-900 shrink-0">
                     {viewState === 'EDIT' ? (
                        <button 
                           onClick={() => requestDelete(selectedEventId!)}
                           className="px-4 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg border border-red-900/30 flex items-center gap-2"
                        >
                           <Trash2 size={16} /> 删除
                        </button>
                     ) : <div />}
                     
                     <div className="flex gap-3">
                        <button onClick={() => setViewState(viewState === 'EDIT' ? 'DETAIL' : 'IDLE')} className="px-5 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">取消</button>
                        <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30">
                           <Save size={18}/>
                           {viewState === 'CREATE' ? '创建日程' : '保存修改'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Delete Confirmation Modal ... (same as before) */}
         {deleteConfirmId && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
               <div className="bg-gray-900 border border-red-900/50 rounded-xl shadow-2xl w-96 overflow-hidden">
                  <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-red-900/20">
                     <h3 className="font-bold text-red-400 flex items-center gap-2">
                        <Trash2 size={18} />
                        确认删除
                     </h3>
                     <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 hover:text-white"><X size={18}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                     <div className="text-gray-300">
                        确定要删除日程 <span className="font-bold text-white">{events.find(e => e.id === deleteConfirmId)?.title}</span> 吗？
                     </div>
                     <div className="flex gap-3 mt-4">
                        <button 
                           onClick={() => setDeleteConfirmId(null)}
                           className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-medium border border-gray-700"
                        >
                           取消
                        </button>
                        <button 
                           onClick={confirmDelete}
                           className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold shadow-lg shadow-red-900/20"
                        >
                           确认删除
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};
