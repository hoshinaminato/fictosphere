import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Person, ViewMode, RelationType, RelationLabels, Project, Gender, GenderLabels, Relationship, Attachment, RelationCategories, RelationDefinition, Keyword, TimeSystem, RelationCategory } from '../types';
import { Search, Activity, Sparkles, ChevronDown, ChevronRight, GitGraph, Network, Trash2, Save, UserPlus, Users, Link, Plus, X, Settings, Maximize2, Minimize2, Tag, Upload, Paperclip, FileImage, ExternalLink, Check, AlertTriangle, Target, Edit3, ArrowRight, ArrowLeft, ArrowUpDown, CheckSquare, Square, Filter, Book, Calendar, Clock, Power } from 'lucide-react';
import { analyzeRelationship } from '../services/geminiService';
import { SearchableSelect } from './SearchableSelect';
import { AttachmentManager } from './AttachmentManager';

// Sub-components
import { PersonEditForm } from './sidebar/PersonEditForm';
import { RelationTypeSelector } from './sidebar/RelationTypeSelector';
import { LinkEditPanel } from './sidebar/LinkEditPanel';

interface SidebarProps {
  currentProject: Project;
  
  selectedPerson: Person | null;
  selectedLink: Relationship | null;
  
  onSearch: (query: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  families: string[];
  onToggleFamily: (family: string) => void;
  selectedFamilies: string[];
  onSetSelectedFamilies: (families: string[]) => void;
  
  isFilterEnabled?: boolean;
  onSetFilterEnabled?: (enabled: boolean) => void;

  filterMode?: 'STRICT' | 'KINSHIP';
  onSetFilterMode?: (mode: 'STRICT' | 'KINSHIP') => void;
  
  // Wiki Grouping
  keywords?: Keyword[];
  selectedKeywordId?: string | null;
  onSelectKeyword?: (keywordId: string | null) => void;

  // CRUD Actions
  onUpdatePerson: (person: Person) => void;
  onDeletePerson: (id: string) => void;
  onAddPerson: (person: Person) => void;
  onAddRelation: (sourceId: string, targetId: string, type: string) => void;
  onUpdateRelation: (link: Relationship) => void;
  onDeleteRelation: (linkId: string) => void;
  
  onUpdateProject: (project: Project) => void;

  // Navigation
  onSelectPerson: (id: string, shouldFocus?: boolean) => void;
  onSelectLink?: (id: string) => void;
  
  onJumpToCalendar?: (personId: string) => void;

  // Genealogy Special mode
  isGenealogyMode?: boolean;
  onEnterGenealogyMode?: () => void;
  onViewFamilyTree?: (familyId: string) => void; // New prop for combined action
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  selectedPerson,
  selectedLink,
  onSearch,
  viewMode,
  setViewMode,
  families,
  onToggleFamily,
  selectedFamilies,
  onSetSelectedFamilies,
  isFilterEnabled = false,
  onSetFilterEnabled,
  filterMode = 'STRICT',
  onSetFilterMode,
  keywords = [],
  selectedKeywordId,
  onSelectKeyword,
  onUpdatePerson,
  onDeletePerson,
  onAddPerson,
  onAddRelation,
  onUpdateRelation,
  onDeleteRelation,
  onUpdateProject,
  onSelectPerson,
  onSelectLink,
  onJumpToCalendar,
  isGenealogyMode,
  onEnterGenealogyMode,
  onViewFamilyTree
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Family Search State
  const [familySearchTerm, setFamilySearchTerm] = useState('');

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Person>>({});
  
  // Link Edit Mode
  const [editLinkForm, setEditLinkForm] = useState<Partial<Relationship>>({});

  // Add Mode State
  const [isAdding, setIsAdding] = useState(false);
  const [addType, setAddType] = useState<'NEW' | 'RELATION' | 'DIRECT_RELATION'>('NEW');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Project Settings (Global Attributes)
  const [showSettings, setShowSettings] = useState(false);
  const [newGlobalKey, setNewGlobalKey] = useState('');
  
  // Relation Definitions Management
  const [showRelManager, setShowRelManager] = useState(false);
  const [newRelDefName, setNewRelDefName] = useState('');
  const [newRelIsKinship, setNewRelIsKinship] = useState(false); // Checkbox state
  
  // Inline Edit for Relation Definitions
  const [editingRelDefId, setEditingRelDefId] = useState<string | null>(null);
  const [editingRelDefName, setEditingRelDefName] = useState('');
  const [editingRelDefIsKinship, setEditingRelDefIsKinship] = useState(false);

  const [relDefToDelete, setRelDefToDelete] = useState<RelationDefinition | null>(null); // For warning dialog
  const [relMigrationTarget, setRelMigrationTarget] = useState<string>(''); // For migration
  
  // Expanded View Mode (Modal)
  const [isExpanded, setIsExpanded] = useState(false);
  // Separate state to track if we are editing INSIDE the expanded view
  const [isExpandedEditing, setIsExpandedEditing] = useState(false);

  // Delete Confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form for New Person
  const [newPersonForm, setNewPersonForm] = useState<Partial<Person>>({
    name: '',
    familyId: '',
    bio: '',
    gender: Gender.UNKNOWN,
    birthDate: '', 
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthIsBC: false,
    customBirthDate: '',
    attributes: []
  });

  // Form for Relation Selection
  const [relationCategory, setRelationCategory] = useState<string>('KINSHIP'); 
  const [relationType, setRelationType] = useState<string>(RelationType.PARENT); 

  const [sourcePersonId, setSourcePersonId] = useState<string>(''); // For DIRECT_RELATION
  const [targetPersonId, setTargetPersonId] = useState<string>('');
  
  const handleSwapPeople = () => {
    const s = sourcePersonId;
    const t = targetPersonId;
    setSourcePersonId(t);
    setTargetPersonId(s);
  };

  // Helper to extract ID
  const getPersonId = (node: string | Person) => typeof node === 'object' ? node.id : node;
  const getPersonName = (node: string | Person) => typeof node === 'object' ? node.name : currentProject.data.nodes.find(n => n.id === node)?.name || 'Unknown';

  // Calculate family counts
  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentProject.data.nodes.forEach(node => {
      const fam = node.familyId || '未知';
      counts[fam] = (counts[fam] || 0) + 1;
    });
    return counts;
  }, [currentProject.data.nodes]);

  // Search Results Calculation
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return currentProject.data.nodes.filter(n => 
       n.name.toLowerCase().includes(term) || 
       n.familyId.toLowerCase().includes(term)
    );
  }, [searchTerm, currentProject.data.nodes]);

  // Filter families based on search
  const filteredFamilies = useMemo(() => {
    if (!familySearchTerm) return families;
    return families.filter(f => f.toLowerCase().includes(familySearchTerm.toLowerCase()));
  }, [families, familySearchTerm]);

  // Filter Keywords for Selection (Only those with associated people)
  const validKeywords = useMemo(() => {
     return keywords
       .filter(k => k.relatedPersonIds && k.relatedPersonIds.length > 0)
       .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [keywords]);

  // Existing Relationships Calculation (For Add Mode)
  const existingRelationships = useMemo(() => {
    if (!isAdding || (addType !== 'RELATION' && addType !== 'DIRECT_RELATION')) return [];
    
    // Determine effective Source ID based on mode
    const effectiveSourceId = addType === 'RELATION' ? selectedPerson?.id : sourcePersonId;
    
    if (!effectiveSourceId || !targetPersonId) return [];
    if (effectiveSourceId === targetPersonId) return [];

    return currentProject.data.links.filter(l => {
       const s = getPersonId(l.source);
       const t = getPersonId(l.target);
       return (s === effectiveSourceId && t === targetPersonId) ||
              (s === targetPersonId && t === effectiveSourceId);
    });
  }, [isAdding, addType, selectedPerson, sourcePersonId, targetPersonId, currentProject.data.links]);

  // Related Relationships Calculation (For Person Profile)
  const personRelationships = useMemo(() => {
    if (!selectedPerson) return [];
    
    return currentProject.data.links.filter(l => {
        const sId = getPersonId(l.source);
        const tId = getPersonId(l.target);
        return sId === selectedPerson.id || tId === selectedPerson.id;
    }).map(l => {
        const sId = getPersonId(l.source);
        const tId = getPersonId(l.target);
        const isSource = sId === selectedPerson.id;
        const otherId = isSource ? tId : sId;
        const otherPerson = currentProject.data.nodes.find(n => n.id === otherId);
        
        return {
           link: l,
           isSource,
           otherPerson
        };
    });
  }, [selectedPerson, currentProject.data.links, currentProject.data.nodes]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setSearchTerm(val);
     onSearch(val);
  };

  const clearSearch = () => {
     setSearchTerm('');
     onSearch('');
  };

  // COMPATIBILITY HELPER: Parse existing string date to Year/Month/Day
  const parseDateCompatibility = (person: Person | null) => {
     if (!person) return {};
     
     let { birthYear, birthMonth, birthDay, birthDate, birthIsBC } = person;
     
     // If newer fields are missing but we have a legacy string, try to parse it
     if ((!birthYear && !birthMonth && !birthDay) && birthDate) {
        // Assuming YYYY-MM-DD or YYYY-MM or YYYY
        const parts = birthDate.split(/[-/.]/); 
        if (parts.length >= 1) birthYear = parts[0];
        if (parts.length >= 2) birthMonth = parts[1];
        if (parts.length >= 3) birthDay = parts[2];
     }
     
     return { ...person, birthYear, birthMonth, birthDay, birthIsBC };
  };

  // Reset state when selection changes
  useEffect(() => {
    setSuccessMsg(null); // Clear any success messages
    if (selectedPerson) {
      const hydratedPerson = parseDateCompatibility(selectedPerson);
      setEditForm(hydratedPerson); // Deepish copy with compatibility hydration
      setIsEditing(false);
      setIsExpandedEditing(false);
      setIsAdding(false);
      setAiResponse(null);
      // Clear link state
      setEditLinkForm({});
    } else if (selectedLink) {
      setEditLinkForm({ ...selectedLink });
      setIsEditing(true); // Auto enter edit mode for links
      setIsAdding(false);
      setAiResponse(null);
      setIsExpanded(false);
      setIsExpandedEditing(false);
      
      // Determine initial category for editing
      const type = selectedLink.type;
      let foundCat = 'CUSTOM_PROJECT';
      
      // Fix: cast Object.entries to properly access types on catVal
      for (const [catKey, catVal] of Object.entries(RelationCategories) as [string, RelationCategory][]) {
          if (catVal.types.includes(type as RelationType)) {
             foundCat = catKey;
             break;
          }
      }

      if (foundCat === 'CUSTOM_PROJECT') {
          setRelationCategory('CUSTOM_PROJECT');
          setRelationType(type);
      } else {
         setRelationCategory(foundCat);
         setRelationType(type);
      }
      
    } else {
      setIsEditing(false);
      setIsAdding(false);
      setIsExpanded(false);
      setIsExpandedEditing(false);
    }
  }, [selectedPerson?.id, selectedLink?.id]);

  const handleAiAnalysis = async () => {
    if (!selectedPerson) return;
    setIsAiLoading(true);
    setAiResponse(null);
    const result = await analyzeRelationship(selectedPerson, null, currentProject.data.links, currentProject.data.nodes);
    setAiResponse(result);
    setIsAiLoading(false);
  };

  const constructDateString = (y?: string, m?: string, d?: string) => {
     if (!y && !m && !d) return '';
     if (y && m && d) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
     return `${y || '????'}-${m || '??'}-${d || '??'}`;
  };

  const handleSaveEdit = () => {
    if (editForm.id && editForm.name) {
      // Construct backward compatible birthDate string
      const newBirthDate = constructDateString(editForm.birthYear, editForm.birthMonth, editForm.birthDay);
      
      onUpdatePerson({
         ...editForm as Person,
         birthDate: newBirthDate 
      });
      setIsEditing(false);
      setIsExpandedEditing(false);
    }
  };
  
  const handleSaveLinkEdit = () => {
    if (editLinkForm.id && selectedLink) {
       // Normalize source/target to IDs to prevent object reference issues (D3 sometimes populates these with objects)
       const sourceId = typeof selectedLink.source === 'object' ? (selectedLink.source as Person).id : selectedLink.source as string;
       const targetId = typeof selectedLink.target === 'object' ? (selectedLink.target as Person).id : selectedLink.target as string;

       const updatedLink = {
          ...selectedLink,
          ...editLinkForm,
          source: sourceId,
          target: targetId
       } as Relationship;

       onUpdateRelation(updatedLink);
       setSuccessMsg("关系已保存");
       setTimeout(() => setSuccessMsg(null), 2000);
    }
  };

  const handleAddSubmit = () => {
    if (addType === 'NEW') {
       if (!newPersonForm.name || !newPersonForm.familyId) return;
       
       const newBirthDate = constructDateString(newPersonForm.birthYear, newPersonForm.birthMonth, newPersonForm.birthDay);

       const newPerson = {
        ...newPersonForm,
        id: Math.random().toString(36).substr(2, 9),
        generation: 1, 
        birthDate: newBirthDate, 
        isCollapsed: false,
        attributes: [],
        attachments: []
      } as Person;
      
      onAddPerson(newPerson);
      setNewPersonForm({
        name: '',
        familyId: newPersonForm.familyId,
        bio: '',
        gender: Gender.UNKNOWN,
        birthDate: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        birthIsBC: false,
        customBirthDate: '',
        attributes: []
      });
    } else if (addType === 'RELATION' && selectedPerson) {
      if (!targetPersonId) return;
      if (!relationType) { alert("请输入关系类型"); return; }
      
      onAddRelation(selectedPerson.id, targetPersonId, relationType);
      setTargetPersonId('');
    } else if (addType === 'DIRECT_RELATION') {
      if (!sourcePersonId || !targetPersonId) return;
      if (!relationType) { alert("请输入关系类型"); return; }
      
      onAddRelation(sourcePersonId, targetPersonId, relationType);
      setSourcePersonId('');
      setTargetPersonId('');
    }
    
    setSuccessMsg("添加成功！");
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const startAddRelation = () => {
    setAddType('RELATION');
    setTargetPersonId('');
    setIsAdding(true);
  };

  const startDirectRelation = () => {
    setAddType('DIRECT_RELATION');
    setSourcePersonId('');
    setTargetPersonId('');
    setIsAdding(true);
    setIsEditing(false);
  };

  const handleAddRelDef = () => {
     if (!newRelDefName) return;
     const newDef: RelationDefinition = {
        id: Math.random().toString(36).substr(2, 9),
        name: newRelDefName,
        isKinship: newRelIsKinship
     };
     
     const exists = currentProject.relationDefinitions?.find(d => d.name === newRelDefName);
     if (exists) { alert("关系名称已存在"); return; }
     
     onUpdateProject({
        ...currentProject,
        relationDefinitions: [...(currentProject.relationDefinitions || []), newDef]
     });

     setRelationCategory('CUSTOM_PROJECT');
     setRelationType(newRelDefName);
     
     setNewRelDefName('');
     setNewRelIsKinship(false);
  };

  const handleStartEditRelDef = (def: RelationDefinition) => {
    setEditingRelDefId(def.id);
    setEditingRelDefName(def.name);
    setEditingRelDefIsKinship(def.isKinship || false);
  };

  const handleSaveRelDefEdit = () => {
    if (!editingRelDefId || !editingRelDefName.trim()) return;
    
    const oldDef = currentProject.relationDefinitions?.find(d => d.id === editingRelDefId);
    if (!oldDef) return;

    const oldName = oldDef.name;
    const newName = editingRelDefName.trim();

    // Prevent duplicates if name changed
    if (newName !== oldName && currentProject.relationDefinitions?.some(d => d.name === newName)) {
        alert("关系名称已存在");
        return;
    }

    // 1. Update Definition
    const newDefs = (currentProject.relationDefinitions || []).map(d => 
        d.id === editingRelDefId ? { ...d, name: newName, isKinship: editingRelDefIsKinship } : d
    );

    // 2. Update all links using the old name (CASCADING UPDATE)
    let newLinks = currentProject.data.links;
    if (newName !== oldName) {
        newLinks = newLinks.map(l => l.type === oldName ? { ...l, type: newName } : l);
    }

    onUpdateProject({
        ...currentProject,
        data: { ...currentProject.data, links: newLinks },
        relationDefinitions: newDefs
    });

    setEditingRelDefId(null);
  };

  const handleDeleteRelDefCheck = (def: RelationDefinition) => {
      const usages = currentProject.data.links.filter(l => l.type === def.name).length;
      if (usages > 0) {
          setRelDefToDelete(def);
          setRelMigrationTarget('');
      } else {
          confirmDeleteRelDef(def.name);
      }
  };

  const confirmDeleteRelDef = (name: string, migrateTo?: string) => {
      let newLinks = currentProject.data.links;
      if (migrateTo) {
          newLinks = newLinks.map(l => l.type === name ? { ...l, type: migrateTo } : l);
      } else if (relDefToDelete) {
          newLinks = newLinks.filter(l => l.type !== name);
      }

      const newDefs = (currentProject.relationDefinitions || []).filter(d => d.name !== name);
      
      onUpdateProject({
          ...currentProject,
          data: { ...currentProject.data, links: newLinks },
          relationDefinitions: newDefs
      });

      setRelDefToDelete(null);
  };

  const addGlobalKey = () => {
     if (!newGlobalKey) return;
     const currentKeys = currentProject.globalAttributeKeys || [];
     if (!currentKeys.includes(newGlobalKey)) {
        onUpdateProject({
           ...currentProject,
           globalAttributeKeys: [...currentKeys, newGlobalKey]
        });
     }
     setNewGlobalKey('');
  };

  const removeGlobalKey = (key: string) => {
     const currentKeys = currentProject.globalAttributeKeys || [];
     onUpdateProject({
        ...currentProject,
        globalAttributeKeys: currentKeys.filter(k => k !== key)
     });
  };

  // Time System Handlers
  const handleTimeSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const sys = e.target.value as TimeSystem;
     onUpdateProject({
        ...currentProject,
        timeConfig: {
           ...currentProject.timeConfig,
           system: sys,
           label: sys === TimeSystem.ERA ? '新纪元' : undefined
        }
     });
  };

  const handleTimeLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     onUpdateProject({
        ...currentProject,
        timeConfig: {
           ...currentProject.timeConfig,
           system: currentProject.timeConfig?.system || TimeSystem.REAL,
           label: e.target.value
        }
     });
  };

  const confirmDeletePerson = () => {
    if (deleteConfirmId) {
      onDeletePerson(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const allPersonOptions = useMemo(() => {
    return currentProject.data.nodes
      .map(n => ({ label: n.name, value: n.id, sub: n.familyId }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [currentProject.data.nodes]);

  const availableTargetOptions = useMemo(() => {
     let ignoreId = '';
     if (addType === 'RELATION') ignoreId = selectedPerson?.id || '';
     else if (addType === 'DIRECT_RELATION') ignoreId = sourcePersonId;

     return currentProject.data.nodes
        .filter(n => n.id !== ignoreId)
        .map(n => ({ label: n.name, value: n.id, sub: n.familyId }))
        .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [currentProject.data.nodes, selectedPerson, addType, sourcePersonId]);
    
  const getLinkPersonName = (node: string | Person) => {
      if (typeof node === 'object') return node.name;
      return currentProject.data.nodes.find(n => n.id === node)?.name || node;
  };

  const timeSystem = currentProject.timeConfig?.system || TimeSystem.REAL;

  // Genealogy Button Condition
  const canViewGenealogyTree = selectedFamilies.length === 1 && !searchTerm;

  return (
    <>
    <div className="w-80 h-full bg-gray-900 border-l border-gray-800 flex flex-col text-gray-200 shadow-xl z-10 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
        <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400">
          <Activity size={20} />
          Fictosphere 关系
        </h1>
        <button 
           onClick={() => setShowSettings(!showSettings)}
           className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
           title="工程设置 (全局属性 & 时间观)"
        >
           <Settings size={16} />
        </button>
      </div>
      
      {showSettings && (
         <div className="bg-gray-800 p-4 border-b border-gray-700 animate-fade-in space-y-4">
            {/* Global Attributes */}
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">全局属性模板</h3>
               <div className="flex flex-wrap gap-2 mb-3">
                  {(currentProject.globalAttributeKeys || []).map(key => (
                     <div key={key} className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded border border-blue-800 flex items-center gap-1">
                        {key}
                        <button onClick={() => removeGlobalKey(key)} className="hover:text-white"><X size={10}/></button>
                     </div>
                  ))}
                  {(currentProject.globalAttributeKeys || []).length === 0 && (
                     <div className="text-xs text-gray-500 italic">暂无全局属性</div>
                  )}
               </div>
               <div className="flex gap-2">
                  <input 
                     value={newGlobalKey} 
                     onChange={e => setNewGlobalKey(e.target.value)}
                     placeholder="添加属性 (如: HP, 职业)"
                     className="flex-1 bg-gray-900 border border-gray-700 rounded text-xs px-2 py-1"
                     onKeyDown={e => e.key === 'Enter' && addGlobalKey()}
                  />
                  <button onClick={addGlobalKey} className="bg-blue-600 text-white px-2 rounded hover:bg-blue-500"><Plus size={14}/></button>
               </div>
            </div>

            <hr className="border-gray-700"/>

            {/* Time Configuration */}
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                  <Clock size={12}/> 世界观时间系统
               </h3>
               <select 
                  value={timeSystem}
                  onChange={handleTimeSystemChange}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs mb-2"
               >
                  <option value={TimeSystem.REAL}>现实时间 (Gregorian)</option>
                  <option value={TimeSystem.ERA}>虚构纪元 (Custom Era)</option>
                  <option value={TimeSystem.RELATIVE}>相对时间 (Relative)</option>
                  <option value={TimeSystem.CHAPTER}>章节递推 (Chapter)</option>
                  <option value={TimeSystem.SEASONAL}>季节循环 (Seasonal)</option>
                  <option value={TimeSystem.NONE}>无时间 / 意识流 (None)</option>
               </select>
               {timeSystem === TimeSystem.ERA && (
                  <input 
                     value={currentProject.timeConfig?.label || ''}
                     onChange={handleTimeLabelChange}
                     placeholder="纪元名称 (如: 天启元年)"
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs"
                  />
               )}
               <div className="text-[10px] text-gray-500 mt-1">
                  {timeSystem === TimeSystem.REAL ? "使用标准年月日，支持日历视图。" : "使用自定义顺序，日历将切换为手动排序的时间轴。"}
               </div>
            </div>
         </div>
      )}

      {!showSettings && (
      <div className="p-4 space-y-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="搜索姓名..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
           <button 
             onClick={() => { setAddType('NEW'); setIsAdding(true); setIsEditing(false); }}
             className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm text-gray-300 border border-gray-700"
           >
             <UserPlus size={14} /> 新建人员
           </button>
           <button 
             onClick={startDirectRelation}
             className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm text-gray-300 border border-gray-700"
           >
             <Link size={14} /> 新建关系
           </button>
        </div>
      </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {searchTerm && (
           <div className="bg-gray-800 rounded-xl border border-blue-900/50 overflow-hidden mb-4 shadow-lg animate-fade-in">
              <div className="bg-blue-900/20 px-4 py-2 text-xs font-bold text-blue-400 flex justify-between items-center border-b border-blue-900/30">
                 <span>搜索结果 ({searchResults.length})</span>
                 <button onClick={clearSearch} className="hover:text-white"><X size={14}/></button>
              </div>
              
              {searchResults.length === 0 ? (
                 <div className="p-4 text-center text-xs text-gray-500">未找到匹配项</div>
              ) : (
                 <div className="max-h-64 overflow-y-auto">
                    {searchResults.map(p => (
                       <button
                          key={p.id}
                          onClick={() => onSelectPerson(p.id, true)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-700/50 flex items-center justify-center group transition-colors ${selectedPerson?.id === p.id ? 'bg-blue-900/10' : ''}`}
                       >
                          <div className="flex items-center gap-3 flex-1">
                             <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-600">
                                {p.avatar ? (
                                   <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" />
                                ) : (
                                   p.name.charAt(0)
                                )}
                             </div>
                             <div>
                                <div className={`text-sm font-bold group-hover:text-blue-400 transition-colors ${selectedPerson?.id === p.id ? 'text-blue-400' : 'text-gray-200'}`}>{p.name}</div>
                                <div className="text-[10px] text-gray-500">{p.familyId}</div>
                             </div>
                          </div>
                          <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${selectedPerson?.id === p.id ? 'text-blue-500 opacity-100' : 'text-gray-500'}`}>
                             <Target size={16} />
                          </div>
                       </button>
                    ))}
                 </div>
              )}
           </div>
        )}

        {/* Filters Section */}
        {!isAdding && !isEditing && !searchTerm && (
        <div>
          {/* Wiki Group Selector */}
          {onSelectKeyword && (
             <div className="mb-4 border-b border-gray-800 pb-4">
                <div className="flex items-center justify-between mb-1">
                   <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1">
                      <Book size={10}/> Wiki 词条框选
                   </label>
                   {selectedKeywordId && (
                      <button 
                         onClick={() => onSelectKeyword(null)} 
                         className="text-[10px] text-red-400 hover:text-red-300"
                      >
                         清除
                      </button>
                   )}
                </div>
                <select 
                   className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-gray-300 outline-none focus:border-blue-500"
                   value={selectedKeywordId || ''}
                   onChange={(e) => onSelectKeyword(e.target.value || null)}
                >
                   <option value="">无 (None)</option>
                   {validKeywords.length === 0 ? (
                      <option disabled>无关联词条 (需先在百科中关联人物)</option>
                   ) : (
                      validKeywords.map(k => (
                         <option key={k.id} value={k.id}>{k.name} ({k.relatedPersonIds?.length || 0})</option>
                      ))
                   )}
                </select>
                <div className="text-[11px] text-gray-600 mt-1 italic">
                   仅显示已关联人物的词条。选择后将高亮框选相关人员。
                </div>
             </div>
          )}

          {/* Family Filter */}
          <div className="flex items-center justify-between mb-2">
             <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className="flex items-center gap-1 text-sm font-semibold text-gray-400 uppercase tracking-wider hover:text-white"
             >
               <span>家族筛选</span>
               {isFilterOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
             </button>
             {isFilterOpen && isFilterEnabled && (
                <div className="flex gap-1">
                   <button onClick={() => onSetSelectedFamilies(families)} className="text-[10px] px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300" title="全选"><CheckSquare size={12}/></button>
                   <button onClick={() => onSetSelectedFamilies([])} className="text-[10px] px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300" title="清空"><Square size={12}/></button>
                </div>
             )}
          </div>
          
          {isFilterOpen && (
            <>
              {/* Filter Master Toggle */}
              {onSetFilterEnabled && (
                 <label className="flex items-center gap-2 mb-3 bg-gray-800/30 p-2 rounded border border-gray-800 cursor-pointer hover:bg-gray-800/50">
                    <input 
                       type="checkbox" 
                       checked={isFilterEnabled} 
                       onChange={(e) => onSetFilterEnabled(e.target.checked)}
                       className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                    />
                    <div className="flex-1">
                       <span className={`text-xs font-bold ${isFilterEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                          {isFilterEnabled ? '筛选已启用' : '显示所有人 (未启用筛选)'}
                       </span>
                    </div>
                    <Power size={14} className={isFilterEnabled ? 'text-green-500' : 'text-gray-600'}/>
                 </label>
              )}

              {/* Filter Mode Toggle */}
              {onSetFilterMode && (
                 <div className={`flex bg-gray-900 p-1 rounded border border-gray-700 mb-3 transition-opacity ${!isFilterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button 
                       onClick={() => onSetFilterMode('STRICT')}
                       className={`flex-1 text-[10px] py-1 rounded flex items-center justify-center gap-1 transition-colors ${filterMode === 'STRICT' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                       title="血缘优先：显示选中家族及其血亲（父母/子女/兄弟）"
                    >
                       <Target size={10}/> 严格模式
                    </button>
                    <button 
                       onClick={() => onSetFilterMode('KINSHIP')}
                       className={`flex-1 text-[10px] py-1 rounded flex items-center justify-center gap-1 transition-colors ${filterMode === 'KINSHIP' ? 'bg-blue-900/50 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
                       title="亲缘网络：包含配偶、前配偶及其亲属家族的完整网状连接"
                    >
                       <Network size={10}/> 亲缘模式
                    </button>
                 </div>
              )}

              {/* Special Genealogy Mode Button */}
              {canViewGenealogyTree && onEnterGenealogyMode && (
                <div className="mb-4 px-1 animate-fade-in">
                   <button 
                      onClick={onEnterGenealogyMode}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/50 rounded-lg flex items-center justify-center gap-2 text-blue-400 text-xs font-bold transition-all shadow-lg hover:shadow-blue-500/10 group"
                   >
                      <GitGraph size={16} className="group-hover:rotate-12 transition-transform" />
                      查看该家族族谱树
                   </button>
                   <p className="text-[9px] text-gray-600 text-center mt-1">辈分将按父母/子女关系自动排序</p>
                </div>
              )}

              {/* Family Search Input */}
              <div className={`mb-2 px-1 relative transition-opacity ${!isFilterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                 <Search className="absolute left-3 top-2 text-gray-500" size={12} />
                 <input 
                    type="text" 
                    placeholder="筛选家族..." 
                    className="w-full bg-gray-900 border border-gray-700 rounded py-1 pl-8 pr-6 text-xs text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
                    value={familySearchTerm}
                    onChange={(e) => setFamilySearchTerm(e.target.value)}
                 />
                 {familySearchTerm && (
                    <button 
                      onClick={() => setFamilySearchTerm('')}
                      className="absolute right-2 top-1.5 text-gray-500 hover:text-white"
                    >
                       <X size={12} />
                    </button>
                 )}
              </div>

              <div className={`space-y-2 ml-1 max-h-40 overflow-y-auto transition-opacity ${!isFilterEnabled ? 'opacity-30 pointer-events-none' : ''}`}>
                {filteredFamilies.map(fam => (
                  <label key={fam} className="flex items-center gap-2 cursor-pointer group hover:bg-gray-800/50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedFamilies.includes(fam)}
                      onChange={() => onToggleFamily(fam)}
                      className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{fam}</span>
                      <span className="text-xs text-gray-600 group-hover:text-gray-400 bg-gray-900 px-1.5 rounded-full">{familyCounts[fam] || 0}</span>
                    </div>
                  </label>
                ))}
                {filteredFamilies.length === 0 && (
                   <div className="text-xs text-gray-500 text-center py-2 opacity-50">无匹配家族</div>
                )}
              </div>
            </>
          )}
          <hr className="border-gray-800 mt-4" />
        </div>
        )}
        
        {/* Forms & Lists (Adding / Details) */}
        {isAdding && (
           <div className="bg-gray-800/50 p-4 rounded-xl border border-green-900/50 animate-fade-in">
              <h3 className="text-sm font-bold text-green-400 mb-3">
                {addType === 'NEW' ? '新增人员' : `新增关系`}
              </h3>
              
              {addType === 'RELATION' || addType === 'DIRECT_RELATION' ? (
                 <div className="space-y-3 relative">
                    {addType === 'RELATION' ? (
                       <div className="p-2 bg-gray-900 rounded text-xs text-gray-400">
                          从 <strong>{selectedPerson?.name}</strong> 到...
                       </div>
                    ) : (
                       <div>
                          <label className="text-xs text-gray-500 block mb-1 font-bold">起始人物 (Source)</label>
                          <SearchableSelect 
                             options={allPersonOptions}
                             value={sourcePersonId}
                             onChange={(val) => setSourcePersonId(val)}
                             placeholder="选择起始人物..."
                             darker={true}
                          />
                       </div>
                    )}
                    
                    <div>
                       <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-gray-500 font-bold">目标人物 (Target)</label>
                          <button 
                            onClick={handleSwapPeople}
                            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"
                            title="交换起始/目标 (Swap)"
                          >
                            <ArrowUpDown size={12} />
                          </button>
                       </div>
                       <SearchableSelect 
                          options={availableTargetOptions}
                          value={targetPersonId}
                          onChange={(val) => setTargetPersonId(val)}
                          placeholder="搜索目标人物..."
                          darker={true}
                       />
                    </div>
                    
                    {existingRelationships.length > 0 && (
                       <div className="bg-gray-900/50 p-2 rounded border border-yellow-700/50 my-2 text-xs">
                           <div className="flex items-center gap-1 text-yellow-500 font-bold mb-2">
                               <AlertTriangle size={12}/> 两人已存在的关系:
                           </div>
                           <div className="space-y-1">
                               {existingRelationships.map(link => {
                                  const effectiveSourceId = addType === 'RELATION' ? selectedPerson?.id : sourcePersonId;
                                  const sId = getPersonId(link.source);
                                  const isForward = sId === effectiveSourceId;
                                  
                                  const sourceName = getPersonName(link.source);
                                  const targetName = getPersonName(link.target);
                                  const label = RelationLabels[link.type] || link.type;

                                  return (
                                     <div key={link.id} className="flex items-center gap-1.5 text-gray-300 bg-gray-800/50 p-1 rounded">
                                        <span className="text-gray-500 max-w-[60px] truncate" title={sourceName}>{sourceName}</span>
                                        {isForward ? (
                                           <>
                                             <ArrowRight size={12} className="text-gray-500"/>
                                             <span className="text-blue-400 font-bold">{label}</span>
                                             <ArrowRight size={12} className="text-gray-500"/>
                                           </>
                                        ) : (
                                           <>
                                             <ArrowLeft size={12} className="text-gray-500"/>
                                             <span className="text-orange-400 font-bold">{label}</span>
                                             <ArrowLeft size={12} className="text-gray-500"/>
                                           </>
                                        )}
                                        <span className="text-gray-500 max-w-[60px] truncate" title={targetName}>{targetName}</span>
                                     </div>
                                  );
                               })}
                           </div>
                       </div>
                    )}

                    <RelationTypeSelector 
                        category={relationCategory}
                        setCategory={setRelationCategory}
                        type={relationType}
                        setType={setRelationType}
                        customDefinitions={currentProject.relationDefinitions || []}
                        onShowManager={() => setShowRelManager(true)}
                        isEditingLink={false}
                    />

                 </div>
              ) : (
                 <div className="space-y-3">
                   <input 
                     type="text" 
                     placeholder="姓名" 
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                     value={newPersonForm.name}
                     onChange={e => setNewPersonForm({...newPersonForm, name: e.target.value})}
                   />
                   <input 
                     type="text" 
                     placeholder="家族 (Family ID)" 
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                     value={newPersonForm.familyId}
                     onChange={e => setNewPersonForm({...newPersonForm, familyId: e.target.value})}
                   />
                   <select 
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                      value={newPersonForm.gender}
                      onChange={e => setNewPersonForm({...newPersonForm, gender: e.target.value as Gender})}
                   >
                      <option value={Gender.UNKNOWN}>未知</option>
                      <option value={Gender.MALE}>男</option>
                      <option value={Gender.FEMALE}>女</option>
                   </select>
                   
                   {/* Date Input based on TimeSystem */}
                   {timeSystem === TimeSystem.REAL ? (
                      <div className="space-y-2">
                         <div className="flex gap-1">
                            <input 
                              type="text"
                              className="w-1/2 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center font-mono"
                              value={newPersonForm.birthYear}
                              onChange={e => setNewPersonForm({...newPersonForm, birthYear: e.target.value})}
                              placeholder="年 (YYYY)"
                            />
                            <input 
                              type="text"
                              className="w-1/4 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center font-mono"
                              value={newPersonForm.birthMonth}
                              onChange={e => setNewPersonForm({...newPersonForm, birthMonth: e.target.value})}
                              placeholder="月"
                            />
                            <input 
                              type="text"
                              className="w-1/4 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center font-mono"
                              value={newPersonForm.birthDay}
                              onChange={e => setNewPersonForm({...newPersonForm, birthDay: e.target.value})}
                              placeholder="日"
                            />
                         </div>
                         <label className="flex items-center gap-2 cursor-pointer ml-1">
                            <input 
                               type="checkbox" 
                               checked={newPersonForm.birthIsBC}
                               onChange={e => setNewPersonForm({...newPersonForm, birthIsBC: e.target.checked})}
                               className="rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-0"
                            />
                            <span className="text-xs text-gray-500">公元前 (B.C.)</span>
                         </label>
                      </div>
                   ) : timeSystem !== TimeSystem.NONE ? (
                      <input 
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                        value={newPersonForm.customBirthDate || ''}
                        onChange={e => setNewPersonForm({...newPersonForm, customBirthDate: e.target.value})}
                        placeholder="出生时间 / 登场时间 (自定义)"
                      />
                   ) : null}

                   <textarea 
                     placeholder="生平简介"
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm h-20"
                     value={newPersonForm.bio}
                     onChange={e => setNewPersonForm({...newPersonForm, bio: e.target.value})}
                   />
                </div>
              )}

              <div className="flex gap-2 mt-4 items-center">
                 <button 
                   onClick={handleAddSubmit} 
                   disabled={addType === 'NEW' ? false : (addType === 'DIRECT_RELATION' ? (!sourcePersonId || !targetPersonId) : !targetPersonId)}
                   className="flex-1 bg-green-600 text-white py-1.5 rounded text-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    确定
                 </button>
                 <button onClick={() => setIsAdding(false)} className="flex-1 bg-gray-700 text-gray-300 py-1.5 rounded text-sm hover:bg-gray-600">取消</button>
              </div>
              
              {successMsg && isAdding && (
                <div className="mt-2 text-center text-xs text-green-400 font-bold animate-fade-in bg-green-900/30 py-1 rounded border border-green-800">
                   {successMsg}
                </div>
              )}
           </div>
        )}

        {/* Details Panel / Edit Form */}
        {!isAdding && (
        <div>
          {selectedLink ? (
             <LinkEditPanel 
               link={selectedLink}
               sourceName={getLinkPersonName(selectedLink.source)}
               targetName={getLinkPersonName(selectedLink.target)}
               editLinkForm={editLinkForm}
               setEditLinkForm={setEditLinkForm}
               relationCategory={relationCategory}
               setRelationCategory={setRelationCategory}
               relationType={relationType}
               setRelationType={setRelationType}
               customDefinitions={currentProject.relationDefinitions || []}
               onShowRelManager={() => setShowRelManager(true)}
               onSave={handleSaveLinkEdit}
               onDelete={() => onDeleteRelation(selectedLink.id)}
               successMsg={successMsg}
               timeConfig={currentProject.timeConfig}
               allEvents={currentProject.events || []}
             />
          ) : selectedPerson ? (
            /* PERSON DETAILS MODE */
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                     {isEditing ? '编辑模式' : '详情'}
                  </div>
                  {!isEditing && (
                     <button 
                        onClick={() => setIsExpanded(true)}
                        className="text-blue-400 hover:text-white flex items-center gap-1 text-xs"
                     >
                        <Maximize2 size={12}/> 放大详情
                     </button>
                  )}
              </div>

              {isEditing ? (
                 <PersonEditForm 
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onSave={handleSaveEdit}
                    onCancel={() => setIsEditing(false)}
                    expanded={false}
                    globalAttributeKeys={currentProject.globalAttributeKeys || []}
                    timeConfig={currentProject.timeConfig}
                 />
              ) : (
                /* Compact View Mode */
                <>
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedPerson.name}</h2>
                        <button 
                           onClick={() => onSetSelectedFamilies([selectedPerson.familyId])}
                           className="text-sm text-blue-400 mt-1 hover:text-white hover:underline text-left"
                           title="点击只显示此家族"
                        >
                           {selectedPerson.familyId}
                        </button>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-600">
                        {selectedPerson.avatar ? (
                           <img src={selectedPerson.avatar} alt="Avatar" className="w-full h-full object-cover"/>
                        ) : (
                           <span className="text-lg font-bold text-gray-300">{selectedPerson.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="bg-gray-800 p-2 rounded col-span-1">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1">性别</span>
                        <span className="text-sm text-gray-200">{GenderLabels[selectedPerson.gender] || '未知'}</span>
                      </div>
                      <div className="bg-gray-800 p-2 rounded w-full col-span-2">
                        <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1">出生日期</span>
                        <span className="text-sm text-gray-200 font-mono">
                           {timeSystem === TimeSystem.REAL ? (
                              selectedPerson.birthYear 
                                 ? `${selectedPerson.birthIsBC ? '公元前 ' : ''}${selectedPerson.birthYear}年 ${selectedPerson.birthMonth || '?'}月 ${selectedPerson.birthDay || '?'}日` 
                                 : (selectedPerson.birthDate || '未知')
                           ) : (
                              selectedPerson.customBirthDate || '未知'
                           )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedPerson.attributes && selectedPerson.attributes.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {selectedPerson.attributes.slice(0, 4).map((attr, i) => (
                           <div key={i} className="bg-gray-800/40 p-2 rounded border border-gray-700/50">
                              <span className="block text-[10px] text-gray-500 uppercase truncate" title={attr.key}>{attr.key}</span>
                              <span className="text-sm text-gray-200 truncate block" title={attr.value}>{attr.value}</span>
                           </div>
                        ))}
                        {selectedPerson.attributes.length > 4 && (
                           <div className="text-[10px] text-gray-500 col-span-2 text-center">+ 更多属性请点击详情</div>
                        )}
                     </div>
                  )}
                  
                  {selectedPerson.attachments && selectedPerson.attachments.length > 0 && (
                     <div>
                        <h3 className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Paperclip size={10}/> 附件 ({selectedPerson.attachments.length})</h3>
                        <div className="space-y-1">
                           {selectedPerson.attachments.slice(0, 3).map(att => (
                              <div key={att.id} className="text-xs flex items-center gap-1 text-blue-300">
                                 {att.type === 'IMAGE' ? <FileImage size={10}/> : <Link size={10}/>}
                                 <a href={att.url} target="_blank" className="truncate hover:underline">{att.name}</a>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">生平简介</h3>
                    <p className="text-sm text-gray-400 leading-relaxed bg-gray-800/30 p-3 rounded-lg line-clamp-3">
                      {selectedPerson.bio}
                    </p>
                  </div>

                  {personRelationships.length > 0 && (
                     <div className="border-t border-gray-700 pt-3 mt-1">
                         <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-1"><Users size={12}/> 人际关系</h3>
                         <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {personRelationships.map((rel) => {
                                const { link, isSource, otherPerson } = rel;
                                const label = RelationLabels[link.type] || link.type;
                                return (
                                   <div 
                                      key={link.id}
                                      onClick={() => onSelectLink && onSelectLink(link.id)}
                                      className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-800 cursor-pointer text-xs group"
                                   >
                                       <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isSource ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
                                          {isSource ? '→' : '←'} {label}
                                       </div>
                                       <div className="flex-1 text-gray-300 truncate font-medium group-hover:text-white">
                                          {otherPerson ? otherPerson.name : 'Unknown'}
                                       </div>
                                   </div>
                                );
                            })}
                         </div>
                     </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                     <button onClick={() => setIsEditing(true)} className="bg-gray-800 hover:bg-gray-700 text-xs py-2 rounded border border-gray-700">
                        编辑资料
                     </button>
                     <button onClick={startAddRelation} className="bg-gray-800 hover:bg-gray-700 text-xs py-2 rounded border border-gray-700 flex items-center justify-center gap-1">
                        <Link size={12}/> 新建关系
                     </button>
                     <button 
                        onClick={() => onViewFamilyTree && onViewFamilyTree(selectedPerson.familyId)}
                        className="bg-blue-900/40 hover:bg-blue-800 text-blue-300 text-xs py-2 rounded border border-blue-800 flex justify-center items-center gap-1 transition-all"
                     >
                        <GitGraph size={12}/> 查看家族族谱
                     </button>
                     {onJumpToCalendar && (
                        <button 
                           onClick={() => onJumpToCalendar(selectedPerson.id)}
                           className="bg-green-900/30 hover:bg-green-900/50 text-green-400 text-xs py-2 rounded border border-red-900/50 flex justify-center items-center gap-1"
                        >
                           <Calendar size={12}/> 查看日程
                        </button>
                     )}
                     <button onClick={() => setDeleteConfirmId(selectedPerson.id)} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs py-2 rounded border border-red-900/50 flex justify-center items-center gap-1 col-span-2">
                        <Trash2 size={12}/> 删除此人
                     </button>
                  </div>

                  <div className="pt-2 border-t border-gray-800 mt-2">
                    <button
                      onClick={handleAiAnalysis}
                      disabled={isAiLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isAiLoading ? <span className="animate-pulse">正在分析...</span> : <><Sparkles size={16} /> AI 历史学家</>}
                    </button>
                    {aiResponse && (
                      <div className="mt-3 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg text-sm text-indigo-200 text-xs">
                        {aiResponse}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-600">
              <Users size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">请点击节点或关系查看详情</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>

    {/* Modals */}
    {showRelManager && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
         <div className="bg-gray-900 border border-blue-900/50 rounded-xl shadow-2xl w-[550px] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
               <h3 className="font-bold text-white flex items-center gap-2">
                  <Settings size={18} className="text-blue-500" />
                  自定义关系管理
               </h3>
               <button onClick={() => setShowRelManager(false)} className="text-gray-500 hover:text-white"><X size={18}/></button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
               <div className="mb-6 bg-blue-900/10 p-4 rounded-lg border border-blue-800/30">
                  <label className="text-xs text-blue-400 font-bold uppercase mb-3 block">添加新类型</label>
                  <div className="space-y-3">
                     <div className="flex gap-2">
                        <input 
                           value={newRelDefName}
                           onChange={e => setNewRelDefName(e.target.value)}
                           placeholder="例如: 义结金兰"
                           className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                        <button 
                           onClick={handleAddRelDef} 
                           disabled={!newRelDefName}
                           className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 rounded text-sm font-bold flex items-center gap-1"
                        >
                           <Plus size={14}/> 添加
                        </button>
                     </div>
                     
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={newRelIsKinship} 
                           onChange={e => setNewRelIsKinship(e.target.checked)}
                           className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                        />
                        <span className="text-xs text-gray-400">属于亲属家族关系 (Include in Kinship)</span>
                     </label>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs text-gray-500 font-bold uppercase mb-3 block">已有定义 ({currentProject.relationDefinitions?.length || 0})</label>
                  {(currentProject.relationDefinitions || []).length === 0 ? (
                     <div className="text-center text-gray-600 py-10 border border-dashed border-gray-800 rounded">
                        暂无自定义关系。
                     </div>
                  ) : (
                     (currentProject.relationDefinitions || []).map(def => {
                        const usageCount = currentProject.data.links.filter(l => l.type === def.name).length;
                        const isEditingThis = editingRelDefId === def.id;

                        return (
                           <div key={def.id} className={`flex flex-col bg-gray-800 p-3 rounded border transition-all ${isEditingThis ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-gray-700'}`}>
                              {isEditingThis ? (
                                 <div className="space-y-3 animate-fade-in">
                                    <div className="flex gap-2">
                                       <input 
                                          value={editingRelDefName}
                                          onChange={e => setEditingRelDefName(e.target.value)}
                                          className="flex-1 bg-gray-950 border border-gray-600 rounded p-2 text-sm text-white"
                                          autoFocus
                                       />
                                       <button onClick={handleSaveRelDefEdit} className="bg-green-600 hover:bg-green-500 text-white px-3 rounded text-xs font-bold flex items-center gap-1">
                                          <Check size={14}/> 保存
                                       </button>
                                       <button onClick={() => setEditingRelDefId(null)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 rounded text-xs font-bold">
                                          取消
                                       </button>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                       <input 
                                          type="checkbox" 
                                          checked={editingRelDefIsKinship} 
                                          onChange={e => setEditingRelDefIsKinship(e.target.checked)}
                                          className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                                       />
                                       <span className="text-xs text-gray-400">属于亲属家族关系</span>
                                    </label>
                                 </div>
                              ) : (
                                 <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                       <div className="font-bold text-gray-200 flex items-center gap-2">
                                          {def.name}
                                          {def.isKinship && <span className="text-[9px] bg-blue-900 text-blue-300 px-1 rounded border border-blue-800">亲属</span>}
                                       </div>
                                       <div className="text-[10px] text-gray-600 font-mono mt-0.5">ID: {def.id.substring(0,8)}...</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <div className="text-[10px] bg-gray-900 px-2 py-1 rounded text-gray-500">
                                          {usageCount} 引用
                                       </div>
                                       <button 
                                          onClick={() => handleStartEditRelDef(def)} 
                                          className="text-gray-500 hover:text-blue-400 p-1.5 bg-gray-900/50 rounded"
                                          title="编辑名称/属性"
                                       >
                                          <Edit3 size={14}/>
                                       </button>
                                       <button 
                                          onClick={() => handleDeleteRelDefCheck(def)} 
                                          className="text-gray-500 hover:text-red-400 p-1.5 bg-gray-900/50 rounded"
                                          title="删除"
                                       >
                                          <Trash2 size={14}/>
                                       </button>
                                    </div>
                                 </div>
                              )}
                           </div>
                        );
                     })
                  )}
               </div>
            </div>
         </div>
      </div>
    )}

    {relDefToDelete && (
       <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-red-900 rounded-xl shadow-2xl w-[600px] overflow-hidden">
             <div className="p-4 bg-red-900/20 border-b border-red-900/30 flex items-center gap-2 text-red-400 font-bold">
                <AlertTriangle size={20}/>
                删除确认：引用冲突
             </div>
             <div className="p-6">
                <p className="text-gray-300 mb-4">
                   您正在尝试删除自定义关系 <strong className="text-white">"{relDefToDelete.name}"</strong>，但系统检测到仍有 <strong className="text-white">{currentProject.data.links.filter(l => l.type === relDefToDelete.name).length}</strong> 条连线正在使用此类型。
                </p>
                
                <div className="bg-gray-950 p-3 rounded border border-gray-800 max-h-40 overflow-y-auto mb-4 text-xs">
                   {currentProject.data.links.filter(l => l.type === relDefToDelete.name).map(l => (
                      <div key={l.id} className="flex justify-between py-1 border-b border-gray-800 last:border-0 text-gray-500">
                         <span>{getLinkPersonName(l.source)} → {getLinkPersonName(l.target)}</span>
                         <span>强度: {l.strength}</span>
                      </div>
                   ))}
                </div>

                <div className="bg-gray-800 p-4 rounded border border-gray-700 mb-6">
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-2">处理方式</label>
                   <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="radio" 
                           name="migration" 
                           checked={!relMigrationTarget} 
                           onChange={() => setRelMigrationTarget('')}
                           className="text-red-500 focus:ring-0 bg-gray-900 border-gray-600"
                         />
                         <span className="text-sm text-gray-300">直接删除这些连线 (不可恢复)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                           type="radio" 
                           name="migration" 
                           checked={!!relMigrationTarget} 
                           onChange={() => {
                              if(!relMigrationTarget) setRelMigrationTarget(RelationType.FRIEND);
                           }}
                           className="text-blue-500 focus:ring-0 bg-gray-900 border-gray-600"
                         />
                         <span className="text-sm text-gray-300">迁移至其他类型:</span>
                         <select 
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white ml-2"
                            value={relMigrationTarget}
                            onChange={(e) => setRelMigrationTarget(e.target.value)}
                            disabled={!relMigrationTarget && false}
                            onClick={() => { if(!relMigrationTarget) setRelMigrationTarget(RelationType.FRIEND); }}
                         >
                            <optgroup label="标准类型">
                               {Object.values(RelationType).map(t => (
                                  <option key={t} value={t}>{RelationLabels[t] || t}</option>
                               ))}
                            </optgroup>
                            {(currentProject.relationDefinitions || []).filter(d => d.name !== relDefToDelete.name).length > 0 && (
                               <optgroup label="其他自定义">
                                  {(currentProject.relationDefinitions || []).filter(d => d.name !== relDefToDelete.name).map(d => (
                                     <option key={d.id} value={d.name}>{d.name}</option>
                                  ))}
                               </optgroup>
                            )}
                         </select>
                      </label>
                   </div>
                </div>

                <div className="flex gap-3 justify-end">
                   <button 
                      onClick={() => { setRelDefToDelete(null); setRelMigrationTarget(''); }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 text-sm"
                   >
                      取消
                   </button>
                   <button 
                      onClick={() => confirmDeleteRelDef(relDefToDelete.name, relMigrationTarget)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold text-sm shadow-lg"
                   >
                      确认执行
                   </button>
                </div>
             </div>
          </div>
       </div>
    )}

    {/* --- EXPANDED MODAL VIEW --- */}
    {isExpanded && selectedPerson && !isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsExpanded(false)}>
           <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
               {/* Modal Header */}
               <div className="h-40 bg-gradient-to-r from-blue-900 to-slate-900 p-8 flex items-end relative shrink-0">
                  <button onClick={() => setIsExpanded(false)} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white"><Minimize2 size={20}/></button>
                  <div className="flex items-end gap-6 w-full">
                     <div className="w-24 h-24 rounded-full bg-gray-800 border-4 border-gray-900 shadow-xl flex items-center justify-center overflow-hidden">
                        {selectedPerson.avatar ? (
                           <img src={selectedPerson.avatar} alt="Avatar" className="w-full h-full object-cover"/>
                        ) : (
                           <span className="text-4xl font-bold text-white">{selectedPerson.name.charAt(0)}</span>
                        )}
                     </div>
                     <div className="mb-2">
                        <h1 className="text-4xl font-bold text-white">{selectedPerson.name}</h1>
                        <p className="text-blue-300 font-mono text-lg">{selectedPerson.familyId}</p>
                     </div>
                     <div className="ml-auto flex gap-3 mb-3">
                         {!isExpandedEditing && (
                           <>
                              {onViewFamilyTree && (
                                 <button 
                                    onClick={() => { setIsExpanded(false); onViewFamilyTree(selectedPerson.familyId); }}
                                    className="px-4 py-2 bg-blue-900/50 hover:bg-blue-900 text-blue-300 border border-blue-700 rounded shadow font-bold flex items-center gap-2"
                                 >
                                       <GitGraph size={16}/> 查看族谱
                                 </button>
                              )}
                              {onJumpToCalendar && (
                                 <button 
                                    onClick={() => { setIsExpanded(false); onJumpToCalendar(selectedPerson.id); }}
                                    className="px-4 py-2 bg-green-900/50 hover:bg-green-900 text-green-400 border border-green-800 rounded shadow font-bold flex items-center gap-2"
                                 >
                                       <Calendar size={16}/> 查看日程
                                 </button>
                              )}
                              <button 
                                 onClick={() => setIsExpandedEditing(true)} 
                                 className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow font-bold flex items-center gap-2"
                              >
                                 <Save size={16}/> 编辑档案
                              </button>
                           </>
                         )}
                     </div>
                  </div>
               </div>

               {/* Modal Body */}
               <div className="flex-1 overflow-y-auto p-8">
                  {isExpandedEditing ? (
                     <div className="animate-fade-in">
                        <PersonEditForm 
                           editForm={editForm}
                           setEditForm={setEditForm}
                           onSave={handleSaveEdit}
                           onCancel={() => setIsExpandedEditing(false)}
                           expanded={true}
                           globalAttributeKeys={currentProject.globalAttributeKeys || []}
                           timeConfig={currentProject.timeConfig}
                        />
                     </div>
                  ) : (
                     <div className="grid grid-cols-12 gap-8 animate-fade-in">
                        <div className="col-span-4 space-y-6">
                            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">基础信息</h3>
                               <div className="space-y-3">
                                  <div className="flex justify-between">
                                     <span className="text-gray-500">性别</span>
                                     <span className="text-gray-200">{GenderLabels[selectedPerson.gender]}</span>
                                  </div>
                                  <div className="flex justify-between">
                                     <span className="text-gray-500">出生日期</span>
                                     <span className="text-gray-200">
                                        {timeSystem === TimeSystem.REAL ? (
                                           selectedPerson.birthYear 
                                              ? `${selectedPerson.birthIsBC ? '公元前 ' : ''}${selectedPerson.birthYear}年 ${selectedPerson.birthMonth || '?'}月 ${selectedPerson.birthDay || '?'}日` 
                                              : (selectedPerson.birthDate || '未知')
                                        ) : (
                                           selectedPerson.customBirthDate || '未知'
                                        )}
                                     </span>
                                  </div>
                                  <div className="flex justify-between">
                                     <span className="text-gray-500">ID</span>
                                     <span className="text-gray-500 font-mono text-xs">{selectedPerson.id.substring(0,8)}</span>
                                  </div>
                               </div>
                            </div>
                        </div>
                         <div className="col-span-8 space-y-6">
                            <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                               <h3 className="text-lg font-bold text-white mb-4">生平事迹</h3>
                               <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                                  {selectedPerson.bio || '暂无详细记载。'}
                               </p>
                            </div>

                            {personRelationships.length > 0 && (
                               <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                     <Users size={20}/> 人际关系网
                                  </h3>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                     {personRelationships.map((rel) => {
                                         const { link, isSource, otherPerson } = rel;
                                         const label = RelationLabels[link.type] || link.type;
                                         return (
                                            <div 
                                               key={link.id}
                                               onClick={() => {
                                                  setIsExpanded(false);
                                                  onSelectPerson(otherPerson?.id || '');
                                               }}
                                               className="bg-gray-900 border border-gray-700 p-3 rounded-lg flex items-center gap-3 hover:bg-gray-800 cursor-pointer transition-colors group"
                                            >
                                               <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-400 shrink-0">
                                                  {otherPerson?.avatar ? (
                                                     <img src={otherPerson.avatar} className="w-full h-full rounded-full object-cover"/>
                                                  ) : (
                                                     otherPerson?.name.charAt(0)
                                                  )}
                                               </div>
                                               <div className="min-w-0">
                                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                                     {isSource ? (
                                                        <span className="text-blue-400 font-bold">{label} <ArrowRight size={10} className="inline"/></span>
                                                     ) : (
                                                        <span className="text-orange-400 font-bold"><ArrowLeft size={10} className="inline"/> {label}</span>
                                                     )}
                                                  </div>
                                                  <div className="text-sm font-bold text-gray-200 truncate group-hover:text-white">
                                                     {otherPerson?.name || 'Unknown'}
                                                  </div>
                                               </div>
                                            </div>
                                         );
                                     })}
                                  </div>
                                </div>
                            )}
                            
                            {selectedPerson.attachments && selectedPerson.attachments.length > 0 && (
                                <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
                                   <h3 className="text-lg font-bold text-white mb-4">档案附件</h3>
                                   <AttachmentManager attachments={selectedPerson.attachments} onUpdate={() => {}} readOnly />
                                </div>
                            )}
                         </div>
                     </div>
                  )}
               </div>
           </div>
        </div>
    )}

    {deleteConfirmId && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
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
                  确定要删除人物 <span className="font-bold text-white">{currentProject.data.nodes.find(p => p.id === deleteConfirmId)?.name}</span> 吗？
                </div>
                <div className="text-xs text-gray-500 bg-gray-800 p-3 rounded border border-gray-700 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                      此操作将移除该人物的<span className="text-red-400 font-bold">所有关系连线、日程参与记录及百科关联</span>，且无法撤销。
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-medium border border-gray-700"
                  >
                      取消
                  </button>
                  <button 
                      onClick={confirmDeletePerson}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold shadow-lg shadow-red-900/20"
                  >
                      确认删除
                  </button>
                </div>
            </div>
          </div>
      </div>
    )}
    </>
  );
};
