
import React, { useState, useMemo } from 'react';
import { Project, Keyword, KeywordCategory, KeywordCategoryLabels } from '../types';
import { Book, Search, Plus, Tag, Edit3, Trash2, BookOpen, Scroll, Shield, Zap, MapPin, Box, Check, X, User, Calendar, Link, UserPlus, Quote, AlertTriangle, Paperclip, ChevronRight, ChevronDown, CornerDownRight, FolderTree, GitBranch, FileText } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { AttachmentManager } from './AttachmentManager';
import { WikiTreeCanvas } from './WikiTreeCanvas';

interface WikiModuleProps {
  project: Project;
  onUpdateProject: (updatedProject: Project) => void;
  onJumpToPerson?: (personId: string) => void;
  onJumpToEvent?: (eventId: string) => void;
  onJumpToLocation?: (locationId: string) => void;
}

// Recursive Tree Node Component (Sidebar)
const WikiTreeNode: React.FC<{
  keyword: Keyword;
  allKeywords: Keyword[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}> = ({ keyword, allKeywords, selectedId, onSelect, level, expandedIds, toggleExpand }) => {
  const children = allKeywords.filter(k => k.parentId === keyword.id).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(keyword.id);
  const isSelected = selectedId === keyword.id;

  const getCategoryIcon = (cat: KeywordCategory) => {
    switch(cat) {
      case 'ITEM': return <Box size={12} />;
      case 'FACTION': return <Shield size={12} />;
      case 'SPELL': return <Zap size={12} />;
      case 'TERM': return <BookOpen size={12} />;
      case 'LOCATION_LORE': return <MapPin size={12} />;
      default: return <Tag size={12} />;
    }
  };

  return (
    <>
      <div 
        className={`
          group flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors text-sm
          ${isSelected ? 'bg-blue-900/30 text-blue-200' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(keyword.id)}
      >
        {hasChildren ? (
           <button 
             onClick={(e) => { e.stopPropagation(); toggleExpand(keyword.id); }}
             className="p-0.5 rounded hover:bg-gray-700 text-gray-500"
           >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
           </button>
        ) : (
           <div className="w-4" /> 
        )}
        
        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
           {getCategoryIcon(keyword.category)}
        </div>
        
        <span className="truncate font-medium">{keyword.name}</span>
        {hasChildren && (
           <span className="text-[9px] text-gray-600 ml-auto">{children.length}</span>
        )}
      </div>
      
      {isExpanded && children.map(child => (
        <WikiTreeNode 
          key={child.id} 
          keyword={child} 
          allKeywords={allKeywords} 
          selectedId={selectedId} 
          onSelect={onSelect} 
          level={level + 1}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  );
};

export const WikiModule: React.FC<WikiModuleProps> = ({ 
   project, 
   onUpdateProject, 
   onJumpToPerson, 
   onJumpToEvent, 
   onJumpToLocation
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTreeView, setShowTreeView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<KeywordCategory | 'ALL'>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Keyword>>({});

  const keywords = project.keywords || [];
  const selectedKeyword = keywords.find(k => k.id === selectedId);

  // 寻找当前选中词条的最顶层祖先（用于树状图根节点）
  const rootAncestor = useMemo(() => {
     if (!selectedKeyword) return null;
     let curr = selectedKeyword;
     while (curr.parentId) {
        const parent = keywords.find(k => k.id === curr.parentId);
        if (parent) curr = parent;
        else break;
     }
     return curr;
  }, [selectedKeyword, keywords]);

  const filteredKeywords = useMemo(() => {
    return keywords.filter(k => {
      const matchesSearch = k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            k.tags?.some(t => t.includes(searchQuery));
      const matchesCategory = activeCategory === 'ALL' || k.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [keywords, searchQuery, activeCategory]);

  const isTreeView = !searchQuery && activeCategory === 'ALL';
  
  const rootKeywords = useMemo(() => {
     return keywords.filter(k => !k.parentId).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [keywords]);

  const expandPathToId = (id: string) => {
     const path = new Set<string>();
     let current = keywords.find(k => k.id === id);
     while (current && current.parentId) {
        path.add(current.parentId);
        current = keywords.find(k => k.id === current!.parentId);
     }
     setExpandedIds(prev => new Set([...prev, ...path]));
  };

  const toggleExpand = (id: string) => {
     setExpandedIds(prev => {
        const next = new Set(prev);
        if(next.has(id)) next.delete(id);
        else next.add(id);
        return next;
     });
  };

  const getSnippet = (text: string, term: string) => {
      const idx = text.toLowerCase().indexOf(term);
      if (idx === -1) return null;
      const start = Math.max(0, idx - 15);
      const end = Math.min(text.length, idx + term.length + 20);
      return (start > 0 ? "..." : "") + text.substring(start, end) + (end < text.length ? "..." : "");
  };

  const references = useMemo(() => {
     if (!selectedKeyword) return [];
     const term = selectedKeyword.name.toLowerCase();
     const refs: { type: 'PERSON' | 'EVENT' | 'LOCATION' | 'OTHER', id: string, name: string, context: string, snippet?: string, data: any }[] = [];

     project.data.nodes.forEach(p => {
         let matchReason = '';
         let snippet = null;
         if (selectedKeyword.relatedPersonIds?.includes(p.id)) matchReason = 'Explicit Link';
         else if (p.bio?.toLowerCase().includes(term)) { matchReason = 'Bio Mention'; snippet = getSnippet(p.bio || '', term); }
         else if (p.inventory?.some(i => i.toLowerCase().includes(term))) { matchReason = 'Inventory'; const item = p.inventory?.find(i => i.toLowerCase().includes(term)); snippet = item; }
         if (matchReason) refs.push({ type: 'PERSON', id: p.id, name: p.name, context: matchReason, snippet: snippet || undefined, data: p });
     });

     project.events.forEach(e => {
         const titleMatch = e.title.toLowerCase().includes(term);
         const descMatch = e.description?.toLowerCase().includes(term);
         const explicitMatch = e.relatedKeywordIds?.includes(selectedKeyword.id);
         if (titleMatch || descMatch || explicitMatch) {
             let snippet = null;
             let context = explicitMatch ? '关联词条' : (titleMatch ? 'Title' : 'Description');
             if (descMatch && !snippet) snippet = getSnippet(e.description || '', term);
             else if (!snippet) snippet = e.title;
             refs.push({ type: 'EVENT', id: e.id, name: e.title, context: context, snippet: snippet || undefined, data: e });
         }
     });

     project.world.nodes.forEach(node => {
        if (node.name.toLowerCase().includes(term) || node.description?.toLowerCase().includes(term)) {
           const descMatch = node.description?.toLowerCase().includes(term);
           refs.push({ type: 'LOCATION', id: node.id, name: node.name, context: 'Location Name/Desc', snippet: descMatch ? getSnippet(node.description || '', term) : node.name, data: node });
        }
        node.floors.forEach(floor => {
           floor.rooms.forEach(room => {
              if (room.name.toLowerCase().includes(term) || room.description?.toLowerCase().includes(term)) {
                 const descMatch = room.description?.toLowerCase().includes(term);
                 refs.push({ type: 'LOCATION', id: room.id, name: `${node.name} - ${room.name}`, context: 'Room Name/Desc', snippet: descMatch ? getSnippet(room.description || '', term) : room.name, data: room });
              }
           });
        });
     });
     return refs;
  }, [selectedKeyword, project]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsEditing(false);
    expandPathToId(id);
  };

  const handleCreate = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const defaultCategory: KeywordCategory = activeCategory === 'ALL' ? 'ITEM' : activeCategory;
    const defaultParent = selectedId ? selectedId : undefined;
    setFormData({ id: newId, name: '新条目', category: defaultCategory, parentId: defaultParent, description: '', tags: [], attachments: [] });
    setSelectedId(newId);
    setIsEditing(true);
    setShowTreeView(false);
  };

  const handleEdit = () => {
    if (!selectedKeyword) return;
    setFormData({ ...selectedKeyword });
    setIsEditing(true);
    setShowTreeView(false);
  };

  const handleSave = () => {
    if (!formData.name || !formData.category) return;
    const newKeyword = { id: formData.id!, name: formData.name, category: formData.category as KeywordCategory, parentId: formData.parentId || undefined, description: formData.description || '', tags: formData.tags || [], relatedPersonIds: formData.relatedPersonIds || [], attachments: formData.attachments || [] };
    let newKeywords = [...keywords];
    const existingIdx = newKeywords.findIndex(k => k.id === newKeyword.id);
    if (existingIdx >= 0) newKeywords[existingIdx] = newKeyword;
    else newKeywords.push(newKeyword);
    onUpdateProject({ ...project, keywords: newKeywords });
    setIsEditing(false);
    setSelectedId(newKeyword.id);
    if (newKeyword.parentId) expandPathToId(newKeyword.parentId);
  };

  const handleDelete = () => { if (!selectedId) return; setDeleteConfirmId(selectedId); };

  const confirmDelete = () => {
     if (deleteConfirmId) {
        let newKeywords = keywords.filter(k => k.id !== deleteConfirmId);
        newKeywords = newKeywords.map(k => k.parentId === deleteConfirmId ? { ...k, parentId: undefined } : k);
        onUpdateProject({ ...project, keywords: newKeywords });
        setSelectedId(null);
        setIsEditing(false);
        setDeleteConfirmId(null);
     }
  };

  const handleAddRelatedPerson = (personId: string) => {
     const current = formData.relatedPersonIds || [];
     if (!current.includes(personId)) setFormData({ ...formData, relatedPersonIds: [...current, personId] });
  };

  const handleRemoveRelatedPerson = (personId: string) => {
     const current = formData.relatedPersonIds || [];
     setFormData({ ...formData, relatedPersonIds: current.filter(id => id !== personId) });
  };

  const getCategoryIcon = (cat: KeywordCategory) => {
    switch(cat) {
      case 'ITEM': return <Box size={14} />;
      case 'FACTION': return <Shield size={14} />;
      case 'SPELL': return <Zap size={14} />;
      case 'TERM': return <BookOpen size={14} />;
      case 'LOCATION_LORE': return <MapPin size={14} />;
      default: return <Tag size={14} />;
    }
  };

  const personOptions = useMemo(() => project.data.nodes.map(p => ({ label: p.name, value: p.id, group: p.familyId })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')), [project.data.nodes]);

  const parentOptions = useMemo(() => {
     if (!formData.id) return [];
     const getDescendants = (id: string): string[] => {
        const children = keywords.filter(k => k.parentId === id);
        let results: string[] = children.map(c => c.id);
        children.forEach(c => { results = [...results, ...getDescendants(c.id)]; });
        return results;
     };
     const invalidIds = new Set([formData.id, ...getDescendants(formData.id!)]);
     return keywords.filter(k => !invalidIds.has(k.id)).map(k => ({ label: k.name, value: k.id, group: KeywordCategoryLabels[k.category] })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [keywords, formData.id]);

  return (
    <div className="flex h-full bg-gray-950 text-slate-300">
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 shadow-2xl z-20">
         <div className="p-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
               <Book size={20} className="text-blue-500" />
               万物百科
            </h2>
            <div className="relative">
               <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
               <input className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:border-blue-500 outline-none" placeholder="搜索词条..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
         </div>
         <div className="flex gap-2 p-2 overflow-x-auto border-b border-gray-800 no-scrollbar">
            <button onClick={() => setActiveCategory('ALL')} className={`px-3 py-1 text-xs whitespace-nowrap rounded-full border ${activeCategory === 'ALL' ? 'bg-blue-900 border-blue-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>全部</button>
            {Object.entries(KeywordCategoryLabels).map(([key, label]) => (
               <button key={key} onClick={() => setActiveCategory(key as KeywordCategory)} className={`px-3 py-1 text-xs whitespace-nowrap rounded-full border ${activeCategory === key ? 'bg-blue-900 border-blue-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{label}</button>
            ))}
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isTreeView ? rootKeywords.map(root => (
                   <WikiTreeNode key={root.id} keyword={root} allKeywords={keywords} selectedId={selectedId} onSelect={handleSelect} level={0} expandedIds={expandedIds} toggleExpand={toggleExpand} />
                )) : filteredKeywords.map(k => (
                   <div key={k.id} onClick={() => handleSelect(k.id)} className={`p-3 rounded-lg cursor-pointer border flex items-center gap-3 transition-all ${selectedId === k.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'}`}>
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-gray-400 bg-gray-800 border border-gray-700`}>{getCategoryIcon(k.category)}</div>
                      <div className="flex-1 min-w-0">
                         <div className={`font-bold text-sm truncate ${selectedId === k.id ? 'text-blue-200' : 'text-gray-300'}`}>{k.name}</div>
                         <div className="text-[10px] text-gray-500 truncate">{KeywordCategoryLabels[k.category]}</div>
                      </div>
                   </div>
                ))}
            {(!isTreeView && filteredKeywords.length === 0) || (isTreeView && rootKeywords.length === 0) ? ( <div className="text-center py-8 text-gray-600 text-sm">{searchQuery ? '无匹配结果' : '暂无词条'}</div> ) : null}
         </div>
         <div className="p-4 border-t border-gray-800">
            <button onClick={handleCreate} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"><Plus size={16} /> 新建词条</button>
         </div>
      </div>

      <div className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden">
         {selectedKeyword && !isEditing && (
            <div className="h-14 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 shrink-0 z-10">
               <div className="flex bg-gray-800 rounded p-1 border border-gray-700 shadow-inner">
                  <button 
                    onClick={() => setShowTreeView(false)}
                    className={`px-4 py-1.5 text-xs flex items-center gap-2 rounded transition-all ${!showTreeView ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                     <FileText size={14}/> 文档视图
                  </button>
                  <button 
                    onClick={() => setShowTreeView(true)}
                    className={`px-4 py-1.5 text-xs flex items-center gap-2 rounded transition-all ${showTreeView ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                     <GitBranch size={14}/> 层级树状图
                  </button>
               </div>
               
               <div className="flex gap-2">
                  <button onClick={handleEdit} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-blue-400 border border-gray-700 text-xs font-bold flex items-center gap-1"><Edit3 size={14}/> 编辑</button>
                  <button onClick={handleDelete} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 rounded text-red-400 border border-gray-700 text-xs font-bold flex items-center gap-1"><Trash2 size={14}/> 删除</button>
               </div>
            </div>
         )}

         <div className="flex-1 overflow-hidden relative">
         {isEditing ? (
            <div className="h-full overflow-y-auto p-4 md:p-8">
               <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl animate-fade-in mb-20">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Edit3 size={20} className="text-blue-500"/> 编辑词条</h3>
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">名称</label><input className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="词条名称" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">分类</label><select className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as KeywordCategory })}>{Object.entries(KeywordCategoryLabels).map(([key, label]) => ( <option key={key} value={key}>{label}</option> ))}</select></div>
                     </div>
                     <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><FolderTree size={12} /> 所属父词条 (层级结构)</label><SearchableSelect options={parentOptions} value={formData.parentId || ''} onChange={(val) => setFormData({ ...formData, parentId: val || undefined })} placeholder="选择父节点 (可选，如：某学校 ->某班级)" darker={true} /><div className="text-[10px] text-gray-600 mt-1">设置父节点可以将此词条归档在另一个词条下。适用于“组织架构”、“地理层级”等场景。</div></div>
                     <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">详细描述</label><textarea className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white h-48 focus:border-blue-500 outline-none resize-none" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="输入详细的设定、历史、功能等..." /></div>
                     <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">标签 (逗号分隔)</label><input className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none" value={(formData.tags || []).join(', ')} onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="传说, 武器, 稀有..." /></div>
                     <div className="bg-gray-800/30 p-4 rounded border border-gray-800"><label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><UserPlus size={12}/> 关联人物 (Explicit Links)</label><div className="flex flex-wrap gap-2 mb-3">{(formData.relatedPersonIds || []).map(pid => { const person = project.data.nodes.find(p => p.id === pid); return ( <div key={pid} className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded border border-blue-800 flex items-center gap-1">{person?.name || 'Unknown'}<button onClick={() => handleRemoveRelatedPerson(pid)} className="hover:text-white"><X size={12}/></button></div> ); })} {(formData.relatedPersonIds || []).length === 0 && ( <span className="text-gray-600 text-xs italic">暂无手动关联</span> )}</div><div><SearchableSelect options={personOptions} value="" onChange={handleAddRelatedPerson} placeholder="添加人物关联..." darker={true} /></div></div>
                     <div className="bg-gray-800/30 p-4 rounded border border-gray-800"><AttachmentManager attachments={formData.attachments || []} onUpdate={(atts) => setFormData({ ...formData, attachments: atts })} /></div>
                     <div className="flex gap-4 pt-4"><button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-bold">保存</button><button onClick={() => { setIsEditing(false); if(selectedId && !keywords.find(k=>k.id===selectedId)) setSelectedId(null); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded">取消</button></div>
                  </div>
               </div>
            </div>
         ) : selectedKeyword ? (
            showTreeView && rootAncestor ? (
               <WikiTreeCanvas 
                  rootKeyword={rootAncestor}
                  allKeywords={keywords}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  width={window.innerWidth - 320}
                  height={window.innerHeight - 104}
               />
            ) : (
            <div className="p-8 overflow-y-auto h-full">
               <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                  {selectedKeyword.parentId && (
                     <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <FolderTree size={12}/>
                        {(() => {
                           const path = [];
                           let curr = keywords.find(k => k.id === selectedKeyword.parentId);
                           while(curr) { path.unshift(curr); curr = keywords.find(k => k.id === curr!.parentId); }
                           return path.map((p, i) => ( <React.Fragment key={p.id}><button onClick={() => handleSelect(p.id)} className="hover:text-blue-400 hover:underline">{p.name}</button><ChevronRight size={10}/></React.Fragment> ));
                        })()}
                        <span className="text-gray-300 font-bold">{selectedKeyword.name}</span>
                     </div>
                  )}

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-lg relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10">{getCategoryIcon(selectedKeyword.category)}</div>
                     <div className="flex items-start justify-between relative z-10">
                        <div>
                           <div className="flex items-center gap-3 mb-2"><span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800 font-bold uppercase tracking-wider">{KeywordCategoryLabels[selectedKeyword.category]}</span>{(selectedKeyword.tags || []).map(tag => ( <span key={tag} className="text-gray-500 text-xs italic">#{tag}</span> ))}</div>
                           <h1 className="text-4xl font-bold text-white mb-4">{selectedKeyword.name}</h1>
                        </div>
                     </div>
                     <div className="mt-8 prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedKeyword.description || <span className="text-gray-600 italic">暂无描述...</span>}</div>
                  </div>

                  {keywords.some(k => k.parentId === selectedKeyword.id) && (
                     <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><CornerDownRight size={14} /> 下级词条 / 子项</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                           {keywords.filter(k => k.parentId === selectedKeyword.id).map(child => (
                              <div key={child.id} onClick={() => handleSelect(child.id)} className="flex items-center gap-2 p-2 rounded border border-gray-800 bg-gray-800/30 hover:bg-gray-800 cursor-pointer transition-colors group">
                                 <div className="text-gray-500 group-hover:text-blue-400">{getCategoryIcon(child.category)}</div>
                                 <span className="text-sm text-gray-300 group-hover:text-white">{child.name}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {selectedKeyword.attachments && selectedKeyword.attachments.length > 0 && (
                     <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md"><h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Paperclip size={14} /> 附件资料</h4><AttachmentManager attachments={selectedKeyword.attachments} onUpdate={() => {}} readOnly /></div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 h-full flex flex-col shadow-md">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Scroll size={14} /> 引用记录 ({references.length})</h4>
                        {references.length > 0 ? ( <div className="space-y-2 max-h-60 overflow-y-auto pr-1"> {references.map((ref, idx) => ( <div key={`${ref.type}-${ref.id}-${idx}`} onClick={() => { if (ref.type === 'PERSON' && onJumpToPerson) onJumpToPerson(ref.id); if (ref.type === 'EVENT' && onJumpToEvent) onJumpToEvent(ref.id); if (ref.type === 'LOCATION' && onJumpToLocation) onJumpToLocation(ref.id); }} className="flex flex-col gap-1 p-2 rounded bg-gray-800/50 hover:bg-gray-800 cursor-pointer group border border-transparent hover:border-blue-900/50 transition-colors"> <div className="flex items-center gap-3"> <div className={`p-1.5 rounded-full ${ ref.type === 'PERSON' ? 'bg-indigo-900/50 text-indigo-400' : ref.type === 'EVENT' ? 'bg-orange-900/50 text-orange-400' : 'bg-green-900/50 text-green-400' }`}> {ref.type === 'PERSON' ? <User size={12}/> : ref.type === 'EVENT' ? <Calendar size={12}/> : <MapPin size={12}/>} </div> <div className="flex-1 min-w-0"> <div className="text-xs font-bold text-gray-300 group-hover:text-blue-300 truncate">{ref.name}</div> <div className="text-[10px] text-gray-500 truncate">{ref.context}</div> </div> <div className="opacity-0 group-hover:opacity-100 text-gray-500"> <Link size={12}/> </div> </div> {ref.snippet && ( <div className="mt-1 ml-8 text-[10px] text-gray-400 italic bg-gray-900/50 p-1.5 rounded border border-gray-800/50 flex gap-1"> <Quote size={8} className="shrink-0 mt-0.5 text-gray-600"/> {ref.snippet} </div> )} </div> ))} </div> ) : ( <div className="flex-1 flex flex-col items-center justify-center text-gray-600 italic text-xs py-4"> <Link size={20} className="mb-2 opacity-20" /> 该词条尚未关联到任何事件或人物。 <div className="mt-1 opacity-50 text-[10px]">在人物简介或日程描述中提及此名称即可关联。</div> </div> )}
                     </div>
                     <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 shadow-md">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Zap size={14} /> 数据统计</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs"><span className="text-gray-500">关联热度</span><span className="text-blue-400 font-mono">{references.length * 10 + (selectedKeyword.tags?.length || 0) * 5}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-500">字数统计</span><span className="text-gray-400 font-mono">{selectedKeyword.description?.length || 0}</span></div>
                            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, (references.length / 10) * 100)}%` }} /></div>
                            <div className="text-[10px] text-gray-600 text-right mt-1">关联度指数</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            )
         ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
               <BookOpen size={64} className="mb-4 opacity-20" />
               <p>选择左侧词条查看详情</p>
               <p className="text-sm mt-2">或点击“新建词条”创建设定</p>
            </div>
         )}
         </div>
      </div>

      {deleteConfirmId && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-red-900/50 rounded-xl shadow-2xl w-96 overflow-hidden">
               <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-red-900/20">
                  <h3 className="font-bold text-red-400 flex items-center gap-2"><Trash2 size={18} /> 确认删除</h3>
                  <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 hover:text-white"><X size={18}/></button>
               </div>
               <div className="p-6 space-y-4">
                  <div className="text-gray-300">确定要删除词条 <span className="font-bold text-white">{keywords.find(k => k.id === deleteConfirmId)?.name}</span> 吗？</div>
                  <div className="text-xs text-gray-500 bg-gray-800 p-3 rounded border border-gray-700 flex items-start gap-2"><AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" /><div>删除操作将移除该词条的所有数据，且子词条将变为独立词条（失去父级）。</div></div>
                  <div className="flex gap-3 mt-4"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-medium border border-gray-700">取消</button><button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold shadow-lg shadow-red-900/20">确认删除</button></div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
