import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout, Users, Map as MapIcon, Calendar, Upload, Download, Plus, Check, Loader2, ChevronDown, FolderOpen, Trash2, Edit3, Pin, PinOff, Info, Book, RefreshCw, Settings, Shield, Heart, Bug, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { GenealogyModule } from './components/GenealogyModule';
import { BlueprintModule } from './components/BlueprintModule';
import { CalendarModule } from './components/CalendarModule';
import { WikiModule } from './components/WikiModule';
import { Project, WorldData, CalendarEvent, Person, BlueprintViewState, ViewLevel, MapDisplayMode, ExportData, ThemeMode } from './types';
import { initialProjects, getTemplateData, ProjectTemplate } from './services/mockData';
import { loadAllData, seedDB, dbSaveProject, dbSaveSettings, dbDeleteProject } from './services/storage';
import { validateProject } from './services/validator'; // Import validator
import { getGlobalThemeCSS } from './utils/themeStyles';
import { ContextMenu } from './components/ContextMenu';

// Modals
import { AboutModal } from './components/modals/AboutModal';
import { SystemSettingsModal } from './components/modals/SystemSettingsModal';
import { ImportModal } from './components/modals/ImportModal';
import { DeleteProjectModal } from './components/modals/DeleteProjectModal';
import { NewProjectModal } from './components/modals/NewProjectModal';

type Module = 'GENEALOGY' | 'BLUEPRINT' | 'CALENDAR' | 'WIKI';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [currentModule, setCurrentModule] = useState<Module>('GENEALOGY');
  
  // --- Theme State ---
  // Feature disabled temporarily: Locked to BLUEPRINT
  const [theme, setTheme] = useState<ThemeMode>('BLUEPRINT');

  // --- Global State (Consolidated in Projects) ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  
  // Project Editing State
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // --- System Settings & About State ---
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [assetPath, setAssetPath] = useState<string>('');
  
  // Derived State
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0] || initialProjects[0];
  
  // Sort projects: Pinned first, then by lastAccessed (desc)
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // 1. Pin Priority
      if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
      }
      // 2. Time Priority
      const timeA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
      const timeB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
      return timeB - timeA; // Most recent first
    });
  }, [projects]);

  const worldData = currentProject.world;
  const events = currentProject.events;
  const allPeople = currentProject.data.nodes;

  // Jump Target State
  const [jumpTargetPersonId, setJumpTargetPersonId] = useState<string | null>(null);
  const [jumpTargetEventId, setJumpTargetEventId] = useState<string | null>(null);
  const [jumpTargetCalendarPersonId, setJumpTargetCalendarPersonId] = useState<string | null>(null);
  const [jumpTargetWikiId, setJumpTargetWikiId] = useState<string | null>(null);

  // --- Initialization ---
  const reloadData = async () => {
      try {
        setIsLoading(true);
        let data = await loadAllData();
        
        if (!data) {
          console.log("Database empty or outdated, seeding...");
          await seedDB();
          data = await loadAllData();
        }

        if (data) {
          setProjects(data.projects);
          // Only update current ID if it's missing or invalid
          if (!data.projects.find(p => p.id === currentProjectId)) {
              setCurrentProjectId(data.currentProjectId);
          } else if (!currentProjectId) {
              setCurrentProjectId(data.currentProjectId);
          }
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
  };

  // Load asset path on start
  useEffect(() => {
    if (window.electronAPI) {
       window.electronAPI.getAssetPath().then(path => {
          setAssetPath(path);
       });
    }
  }, [isSystemSettingsOpen]); 

  useEffect(() => {
    const init = async () => {
      await reloadData();
    };
    init();
  }, []);

  // Blueprint View State
  const [blueprintState, setBlueprintState] = useState<BlueprintViewState>({
    viewLevel: ViewLevel.WORLD,
    activeNodeId: null,
    activeFloorId: null,
    navigationStack: [],
    selection: null,
    mapMode: MapDisplayMode.STATIC,
    currentTime: new Date().toISOString().split('T')[0] + 'T09:00:00',
    isPlaying: false
  });

  // --- Import/Export State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<ExportData | null>(null);
  const [importMode, setImportMode] = useState<'OVERWRITE' | 'NEW_USER' | 'SELECT_USER'>('OVERWRITE');
  const [targetImportId, setTargetImportId] = useState<string>('');

  // --- Persisted Handlers ---

  const handleSwitchProject = (id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (p) {
       const updated = { ...p, lastAccessed: new Date().toISOString() };
       handleUpdateProject(updated); 
       setCurrentProjectId(id);
       dbSaveSettings(id);
    } else {
       setCurrentProjectId(id);
       dbSaveSettings(id);
    }
    // Reset Blueprint state
    setBlueprintState(prev => ({ ...prev, viewLevel: ViewLevel.WORLD, activeNodeId: null, selection: null }));
    setIsProjectMenuOpen(false);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    dbSaveProject(updatedProject);
  };

  // Updated: Open Modal instead of direct creation
  const openNewProjectModal = () => {
     setIsProjectMenuOpen(false);
     setIsNewProjectModalOpen(true);
  };

  const handleCreateProject = (templateType: ProjectTemplate) => {
     const newProj = getTemplateData(templateType);
     // Ensure unique ID just in case
     newProj.id = Date.now().toString();
     
     if (templateType === 'EMPTY') {
        newProj.name = `新工程 ${projects.length + 1}`;
     }

     setProjects([...projects, newProj]);
     setCurrentProjectId(newProj.id);
     dbSaveProject(newProj);
     dbSaveSettings(newProj.id);
     
     setIsNewProjectModalOpen(false);
     
     // Auto enter rename mode if empty
     if (templateType === 'EMPTY') {
        setTitleEditValue(newProj.name);
        setIsRenamingTitle(true);
     }
  };

  const handleSaveRenameProject = () => {
     if (titleEditValue.trim() && currentProject) {
        handleUpdateProject({ ...currentProject, name: titleEditValue.trim() });
     }
     setIsRenamingTitle(false);
  };

  const handleTogglePin = (e: React.MouseEvent, p: Project) => {
      e.stopPropagation();
      const updated = { ...p, isPinned: !p.isPinned };
      handleUpdateProject(updated);
  };

  const requestDeleteProject = (e: React.MouseEvent, p: Project) => {
     e.stopPropagation();
     if (projects.length <= 1) {
        alert("系统至少需要保留一个工程。");
        return;
     }
     setDeleteConfirmation({ id: p.id, name: p.name });
  };

  const startRenaming = (e: React.MouseEvent, p: Project) => {
      e.stopPropagation();
      if (p.id !== currentProjectId) {
          handleSwitchProject(p.id);
      }
      setTitleEditValue(p.name);
      setIsRenamingTitle(true);
      setIsProjectMenuOpen(false);
  };

  const confirmDeleteProject = async () => {
     if (!deleteConfirmation) return;
     const id = deleteConfirmation.id;
     
     setDeleteConfirmation(null);
     setIsDeleting(true);

     const remainingProjects = projects.filter(p => p.id !== id);
     let nextProjectId = currentProjectId;
     
     if (id === currentProjectId) {
         nextProjectId = remainingProjects[0].id;
     }

     setProjects(remainingProjects);
     setCurrentProjectId(nextProjectId);
     setBlueprintState(prev => ({ ...prev, viewLevel: ViewLevel.WORLD, activeNodeId: null, selection: null }));

     try {
         await dbDeleteProject(id);
         await dbSaveSettings(nextProjectId);
     } catch (e) {
         console.error("Delete failed in DB", e);
         alert("删除失败，正在恢复数据...");
         await reloadData();
     } finally {
        setIsDeleting(false);
     }
  };

  const handleUpdatePerson = (updatedPerson: Person) => {
     if (!currentProject) return;
     const newNodes = currentProject.data.nodes.map(n => n.id === updatedPerson.id ? updatedPerson : n);
     handleUpdateProject({ ...currentProject, data: { ...currentProject.data, nodes: newNodes } });
  };

  const handleWorldUpdate = (action: WorldData | ((prev: WorldData) => WorldData)) => {
    setProjects(prevProjects => {
      const nextProjects = prevProjects.map(p => {
        if (p.id === currentProjectId) {
           const newWorld = typeof action === 'function' ? action(p.world) : action;
           const updated = { ...p, world: newWorld };
           dbSaveProject(updated); 
           return updated;
        }
        return p;
      });
      return nextProjects;
    });
  };

  const updateEvents = (newEvents: CalendarEvent[]) => {
      const updatedProject = { ...currentProject, events: newEvents };
      handleUpdateProject(updatedProject);
  };

  const handleAddEvent = (evt: CalendarEvent) => {
    updateEvents([...events, evt]);
  };

  const handleUpdateEvent = (evt: CalendarEvent) => {
    updateEvents(events.map(e => e.id === evt.id ? evt : e));
  };

  const handleBatchUpdateEvents = (updates: CalendarEvent[]) => {
      const updateMap = new Map(updates.map(e => [e.id, e]));
      const newEvents = events.map(e => updateMap.get(e.id) || e);
      updateEvents(newEvents);
  };

  const handleDeleteEvent = (id: string) => {
    updateEvents(events.filter(e => e.id !== id));
  };

  // --- Handlers: Import/Export ---
  const handleExport = async () => {
    const exportData: ExportData = {
      version: '3.1.0',
      timestamp: new Date().toISOString(),
      project: currentProject 
    };

    if (window.electronAPI) {
      const success = await window.electronAPI.exportProject(exportData);
      if (success) {
        alert("导出成功！所有图片资源已包含在文件中。");
      }
    } else {
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fictosphere_export_${currentProject.name}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const openImportModal = () => {
     setPendingImportData(null); // Reset
     setImportModalOpen(true);
  };

  const handleTriggerFileUpload = async () => {
    if (window.electronAPI) {
       const importedData = await window.electronAPI.importProject();
       if (importedData) {
          setPendingImportData(importedData);
          setImportMode('OVERWRITE');
          setTargetImportId(currentProjectId);
          // Modal is already open, data will render
       }
    } else {
       if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.project) {
          setPendingImportData(json);
          setImportMode('OVERWRITE');
          setTargetImportId(currentProjectId);
          // Modal is already open
        } else {
          alert('Invalid file format. Missing project data.');
        }
      } catch (error) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const confirmImport = () => {
    if (!pendingImportData) return;
    
    // Validate and Sanitize
    const validation = validateProject(pendingImportData.project);
    if (!validation.isValid || !validation.sanitizedProject) {
        alert("导入失败: " + validation.error);
        return;
    }

    const cleanProject = validation.sanitizedProject;
    cleanProject.lastAccessed = new Date().toISOString();

    if (importMode === 'OVERWRITE') {
      const updatedProject = { ...cleanProject, id: currentProjectId };
      setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedProject : p));
      dbSaveProject(updatedProject);
    } else if (importMode === 'SELECT_USER') {
      if (!targetImportId) return;
      const updatedProject = { ...cleanProject, id: targetImportId };
      setProjects(prev => prev.map(p => p.id === targetImportId ? updatedProject : p));
      setCurrentProjectId(targetImportId);
      dbSaveProject(updatedProject);
      dbSaveSettings(targetImportId);
    } else if (importMode === 'NEW_USER') {
      const newId = 'imported_' + Date.now();
      const newProject = { ...cleanProject, id: newId, name: `${cleanProject.name} (Imported)` };
      setProjects(prev => [...prev, newProject]);
      setCurrentProjectId(newId);
      dbSaveProject(newProject);
      dbSaveSettings(newId);
    }

    setImportModalOpen(false);
    setPendingImportData(null);
    
    setBlueprintState(prev => ({ 
        ...prev, 
        viewLevel: ViewLevel.WORLD, 
        activeNodeId: null, 
        activeFloorId: null, 
        selection: null,
        navigationStack: []
    }));
  };

  const handleChangeAssetPath = async () => {
    if (!window.electronAPI) return;
    const newPath = await window.electronAPI.selectAssetPath();
    if (newPath) {
      setAssetPath(newPath);
      if (confirm("修改存储路径需要刷新应用以生效。是否立即刷新？")) {
        window.electronAPI.reloadApp();
      }
    }
  };

  // --- Deep Link Handlers ---
  const handleJumpToLocation = (locationId: string) => {
     let targetNodeId: string | null = null;
     let targetFloorId: string | null = null;
     let targetRoomId: string | null = null;

     const isNode = worldData.nodes.find(n => n.id === locationId);
     if (isNode) {
        targetNodeId = isNode.id;
        if (isNode.floors.length > 0) targetFloorId = isNode.floors[0].id;
     } else {
        for (const node of worldData.nodes) {
           for (const floor of node.floors) {
              const room = floor.rooms.find(r => r.id === locationId);
              if (room) {
                 targetNodeId = node.id;
                 targetFloorId = floor.id;
                 targetRoomId = room.id;
                 break;
              }
           }
           if (targetNodeId) break;
        }
     }

     if (targetNodeId) {
        setBlueprintState(prev => ({
           ...prev,
           viewLevel: targetFloorId ? ViewLevel.BUILDING_EDITOR : ViewLevel.WORLD,
           activeNodeId: targetNodeId,
           activeFloorId: targetFloorId,
           selection: targetRoomId ? { type: 'ROOM', id: targetRoomId } : { type: 'NODE', id: targetNodeId },
           mapMode: MapDisplayMode.STATIC,
           navigationStack: []
        }));
        setCurrentModule('BLUEPRINT');
     } else {
        console.warn("Location not found: " + locationId);
     }
  };

  const handleJumpToEvent = (evt: CalendarEvent) => {
     handleJumpToLocation(evt.locationId);
     setBlueprintState(prev => ({
        ...prev,
        mapMode: MapDisplayMode.DYNAMIC,
        currentTime: evt.start,
        isPlaying: false,
     }));
  };

  const handleJumpToPerson = (personId: string) => {
    setJumpTargetPersonId(personId);
    setCurrentModule('GENEALOGY');
  };

  const handleJumpToCalendarEvent = (eventId: string) => {
     setJumpTargetEventId(eventId);
     setCurrentModule('CALENDAR');
  };

  const handleJumpToCalendarPerson = (personId: string) => {
     setJumpTargetCalendarPersonId(personId);
     setCurrentModule('CALENDAR');
  };

  const handleJumpToWiki = (keywordId: string) => {
     setJumpTargetWikiId(keywordId);
     setCurrentModule('WIKI');
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center text-blue-500 gap-4">
        <Loader2 size={48} className="animate-spin" />
        <div className="font-mono text-sm tracking-widest uppercase">Loading System Data...</div>
      </div>
    );
  }

  return (
    <div className={`app-wrapper flex flex-col h-screen w-screen bg-gray-950 text-slate-300 overflow-hidden transition-colors duration-500 ${isDeleting ? 'pointer-events-none opacity-80' : ''}`}>
      <style>{getGlobalThemeCSS(theme)}</style>
      
      {/* Global Context Menu */}
      <ContextMenu />

      {/* Top System Bar */}
      <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 z-50 shrink-0 shadow-sm relative">
        <div className="flex items-center gap-4">
           {/* Logo */}
           <div className="flex items-center gap-2 text-lg font-bold tracking-wide">
             <div className="bg-gradient-to-tr from-blue-500 to-purple-600 w-8 h-8 rounded flex items-center justify-center text-white shadow">
               <Layout size={18} />
             </div>
             <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 hidden md:inline">
               Fictosphere
             </span>
           </div>

           {/* Refresh Button */}
           <button 
              onClick={reloadData} 
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="刷新工程数据"
           >
              <RefreshCw size={16} className={isLoading ? "animate-spin text-blue-500" : ""} />
           </button>

           {/* Project Selector & Renaming */}
           <div className="relative flex items-center gap-2">
             {isRenamingTitle ? (
                <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1.5 border border-blue-500">
                   <FolderOpen size={16} className="text-blue-500"/>
                   <input 
                     value={titleEditValue} 
                     onChange={e => setTitleEditValue(e.target.value)}
                     autoFocus
                     onFocus={(e) => e.target.select()} 
                     onBlur={handleSaveRenameProject}
                     onKeyDown={e => e.key === 'Enter' && handleSaveRenameProject()}
                     className="bg-transparent border-none text-white text-sm focus:ring-0 outline-none w-40 font-bold"
                     placeholder="输入工程名称"
                   />
                   <button onClick={handleSaveRenameProject} className="text-green-500 hover:text-white p-0.5"><Check size={14}/></button>
                </div>
             ) : (
                <>
                  <button 
                    onClick={() => !isDeleting && setIsProjectMenuOpen(!isProjectMenuOpen)} 
                    disabled={isDeleting}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 px-3 py-1.5 rounded border border-gray-700 hover:border-blue-500 transition-all text-sm group disabled:opacity-50"
                  >
                      <FolderOpen size={16} className="text-blue-500 group-hover:text-blue-400"/>
                      <span className="font-medium max-w-[120px] lg:max-w-[200px] truncate">{isDeleting ? '处理中...' : currentProject?.name}</span>
                      <ChevronDown size={14} className="text-gray-500"/>
                  </button>
                  
                  <button 
                     onClick={() => {
                        setTitleEditValue(currentProject.name);
                        setIsRenamingTitle(true);
                     }}
                     className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
                     title="重命名当前工程"
                  >
                     <Edit3 size={14} />
                  </button>
                </>
             )}

             {isProjectMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[60] py-1 animate-fade-in">
                  <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-gray-800 uppercase tracking-wider flex justify-between">
                     <span>切换工程</span>
                     <span className="text-[10px] font-normal">优先显示置顶</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {sortedProjects.map(p => (
                      <div 
                         key={p.id} 
                         className={`group flex items-center justify-between px-2 py-1 hover:bg-gray-800 border-b border-gray-800/50 last:border-0 ${currentProject.id === p.id ? 'bg-blue-900/10' : ''}`}
                      >
                         <button
                            onClick={() => handleSwitchProject(p.id)}
                            className={`flex-1 text-left px-2 py-1 text-sm truncate flex flex-col ${currentProject.id === p.id ? 'text-blue-400 font-bold' : 'text-gray-300'}`}
                            title={p.name}
                         >
                            <span className="flex items-center gap-1">
                               {p.isPinned && <Pin size={10} className="text-yellow-500 fill-current"/>}
                               {p.name}
                            </span>
                            {p.lastAccessed && (
                               <span className="text-[9px] text-gray-600 font-normal">
                                  {new Date(p.lastAccessed).toLocaleDateString()} {new Date(p.lastAccessed).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            )}
                         </button>
                         
                         <div className="flex items-center gap-0.5 opacity-100 transition-opacity">
                            <button
                                onClick={(e) => handleTogglePin(e, p)}
                                className={`p-1.5 rounded hover:bg-gray-700 ${p.isPinned ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-500'}`}
                                title={p.isPinned ? "取消置顶" : "置顶工程"}
                            >
                                {p.isPinned ? <PinOff size={12}/> : <Pin size={12}/>}
                            </button>

                            <button
                                onClick={(e) => startRenaming(e, p)}
                                className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700 rounded"
                                title="重命名"
                            >
                                <Edit3 size={12}/>
                            </button>

                            <button 
                               onClick={(e) => requestDeleteProject(e, p)}
                               className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                               title="删除工程"
                            >
                               <Trash2 size={12}/>
                            </button>
                          </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-800 mt-1 pt-1 px-1">
                     <button onClick={openNewProjectModal} className="w-full text-left px-3 py-2 rounded text-sm text-green-500 hover:bg-gray-800 flex items-center gap-2">
                       <Plus size={14} /> 新建工程
                     </button>
                  </div>
                </div>
             )}
           </div>
        </div>

        {/* Module Switcher */}
        <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
           <button 
              onClick={() => setCurrentModule('GENEALOGY')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                currentModule === 'GENEALOGY' 
                ? 'bg-gray-700 text-white shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
              }`}
           >
              <Users size={16} /> 关系
           </button>
           <button 
              onClick={() => setCurrentModule('BLUEPRINT')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                currentModule === 'BLUEPRINT' 
                ? 'bg-blue-900/50 text-blue-400 shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
              }`}
           >
              <MapIcon size={16} /> 蓝图
           </button>
           <button 
              onClick={() => setCurrentModule('CALENDAR')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                currentModule === 'CALENDAR' 
                ? 'bg-green-900/50 text-green-400 shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
              }`}
           >
              <Calendar size={16} /> 日程
           </button>
           <button 
              onClick={() => setCurrentModule('WIKI')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                currentModule === 'WIKI' 
                ? 'bg-purple-900/50 text-purple-400 shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
              }`}
           >
              <Book size={16} /> 百科
           </button>
        </div>

        <div className="flex items-center gap-2">
           {/* Global Theme Switcher - TEMPORARILY REMOVED per request */}
           {/* To re-enable, uncomment theme switcher block and Palette import */}

           {/* Import/Export Controls */}
           <button onClick={handleExport} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded" title="导出数据">
              <Download size={16} />
           </button>
           <button onClick={openImportModal} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded" title="导入数据">
              <Upload size={16} />
           </button>
           
           {/* System Settings */}
           <button onClick={() => setIsSystemSettingsOpen(true)} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded ml-1" title="系统设置 (System Settings)">
              <Settings size={16} />
           </button>

           {/* About / Info */}
           <button onClick={() => setIsAboutOpen(true)} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded ml-1" title="关于 (About)">
              <Info size={16} />
           </button>

           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileChange} 
             className="hidden" 
             accept=".json"
           />
        </div>
      </div>

      {/* Main Module Content */}
      <div className="flex-1 overflow-hidden relative">
         {currentModule === 'GENEALOGY' ? (
           <GenealogyModule 
             currentProject={currentProject}
             onUpdateProject={handleUpdateProject}
             targetPersonId={jumpTargetPersonId}
             onJumpToCalendar={handleJumpToCalendarPerson}
             onJumpToWiki={handleJumpToWiki}
           />
         ) : currentModule === 'BLUEPRINT' ? (
           <BlueprintModule 
              people={allPeople} 
              events={events}
              worldData={worldData}
              setWorldData={handleWorldUpdate}
              viewState={blueprintState}
              setViewState={setBlueprintState}
              onUpdatePerson={handleUpdatePerson}
              onJumpToPerson={handleJumpToPerson}
              theme={theme} 
           />
         ) : currentModule === 'CALENDAR' ? (
           <CalendarModule 
              events={events}
              people={allPeople}
              world={worldData}
              keywords={currentProject.keywords}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onJump={handleJumpToEvent}
              onJumpToPerson={handleJumpToPerson}
              targetEventId={jumpTargetEventId}
              targetPersonId={jumpTargetCalendarPersonId}
              timeConfig={currentProject.timeConfig}
              onBatchUpdateEvents={handleBatchUpdateEvents}
              theme={theme}
           />
         ) : (
            <WikiModule 
               project={currentProject}
               onUpdateProject={handleUpdateProject}
               onJumpToPerson={handleJumpToPerson}
               onJumpToEvent={handleJumpToCalendarEvent}
               onJumpToLocation={handleJumpToLocation}
               targetKeywordId={jumpTargetWikiId}
            />
         )}
      </div>

      {/* Modals */}
      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
      />
      
      <SystemSettingsModal 
        isOpen={isSystemSettingsOpen} 
        onClose={() => setIsSystemSettingsOpen(false)} 
        assetPath={assetPath} 
        onChangeAssetPath={handleChangeAssetPath} 
      />

      <ImportModal 
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        pendingImportData={pendingImportData}
        projects={projects}
        currentProjectId={currentProjectId}
        importMode={importMode}
        setImportMode={setImportMode}
        targetImportId={targetImportId}
        setTargetImportId={setTargetImportId}
        onConfirmImport={confirmImport}
        onTriggerFileUpload={handleTriggerFileUpload}
      />

      {deleteConfirmation && (
        <DeleteProjectModal 
          isOpen={!!deleteConfirmation}
          onClose={() => setDeleteConfirmation(null)}
          onConfirm={confirmDeleteProject}
          projectName={deleteConfirmation.name}
        />
      )}

      {/* New Project Selection Modal */}
      <NewProjectModal 
         isOpen={isNewProjectModalOpen}
         onClose={() => setIsNewProjectModalOpen(false)}
         onConfirm={handleCreateProject}
      />
      
      {/* Loading Overlay */}
      {isDeleting && (
         <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center text-white cursor-wait">
            <Loader2 size={48} className="animate-spin text-blue-500 mb-2"/>
            <div className="font-bold">正在删除工程...</div>
         </div>
      )}
    </div>
  );
};

export default App;