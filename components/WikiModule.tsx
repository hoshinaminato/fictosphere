import React, { useState, useMemo } from 'react';
import { Project, Keyword, KeywordCategory, KeywordCategoryLabels, Attribute, Attachment } from '../types';
import { Book, Search, Plus, Tag, Edit3, Trash2, BookOpen, Scroll, Shield, Zap, MapPin, Box, Check, X, User, Calendar, Link, UserPlus, Quote, AlertTriangle, Paperclip, ChevronRight, ChevronDown, CornerDownRight, FolderTree, GitBranch, FileText, MessageSquare, Type } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { AttachmentManager } from './AttachmentManager';
import { WikiTreeCanvas } from './WikiTreeCanvas';
import { WikiRichText } from './WikiRichText';

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
  
  // New State for editing attributes
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // 阅读偏好设置
  const [showRuby, setShowRuby] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [noteLayout, setNoteLayout] = useState<'HOVER' | 'SIDE'>('SIDE');

  const keywords = project.keywords || [];
  const selectedKeyword = keywords.find(k => k.id === selectedId);

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

  const isTreeViewList = !searchQuery && activeCategory === 'ALL';
  
  const rootKeywords = useMemo(() => {
     return keywords.filter(k => !k.parentId).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [keywords]);

  // --- 系统引用追踪逻辑 ---
  const references = useMemo(() => {
    if (!selectedKeyword) return [];
    const results: { type: 'PERSON' | 'EVENT' | 'LOCATION', id: string, name: string, context: string, snippet?: string }[] = [];
    const kName = selectedKeyword.name;

    project.data.nodes.forEach(p => {
       if (p.bio?.includes(kName)) {
          const idx = p.bio.indexOf(kName);
          results.push({ 
            type: 'PERSON', id: p.id, name: p.name, 
            context: '人物生平引用', 
            snippet: p.bio.substring(Math.max(0, idx - 10), Math.min(p.bio.length, idx + 40)) + '...' 
          });
       }
       if (selectedKeyword.relatedPersonIds?.includes(p.id)) {
          results.push({ type: 'PERSON', id: p.id, name: p.name, context: '显式关联' });
       }
    });

    project.events.forEach(e => {
       if (e.description?.includes(kName) || e.title.includes(kName)) {
          const idx = e.description?.indexOf(kName) || 0;
          results.push({ 
            type: 'EVENT', id: e.id, name: e.title, 
            context: '日程描述引用', 
            snippet: e.description ? (e.description.substring(Math.max(0, idx - 10), Math.min(e.description.length, idx + 40)) + '...') : undefined
          });
       }
       if (selectedKeyword.relatedEventIds?.includes(e.id)) {
          results.push({ type: 'EVENT', id: e.id, name: e.title, context: '显式关联' });
       }
    });

    project.world.nodes.forEach(n => {
       if (n.description?.includes(kName) || n.name.includes(kName)) {
          const idx = n.description?.indexOf(kName) || 0;
          results.push({ 
            type: 'LOCATION', id: n.id, name: n.name, context: '地理描述引用' 
          });
       }
       if (selectedKeyword.relatedLocationIds?.includes(n.id)) {
          results.push({ type: 'LOCATION', id: n.id, name: n.name, context: '显式关联' });
       }
    });

    const seen = new Set();
    return results.filter(r => {
       const key = `${r.type}-${r.id}-${r.context}`;
       if (seen.has(key)) return false;
       seen.add(key);
       return true;
    });
  }, [selectedKeyword, project]);

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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsEditing(false);
    expandPathToId(id);
  };

  const handleCreate = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const defaultCategory: KeywordCategory = activeCategory === 'ALL' ? 'ITEM' : activeCategory;
    const defaultParent = selectedId ?? undefined;
    setFormData({ 
       id: newId, 
       name: '新条目', 
       category: defaultCategory, 
       parentId: defaultParent, 
       description: '', 
       tags: [], 
       attributes: [],
       attachments: [],
       relatedPersonIds: [],
       relatedLocationIds: [],
       relatedEventIds: [],
       relatedKeywordIds: []
    });
    setSelectedId(newId);
    setIsEditing(true);
    setShowTreeView(false);
  };

  const handleEdit = () => {
    if (!selectedKeyword) return;
    setFormData({ 
       ...selectedKeyword,
       attributes: selectedKeyword.attributes || [],
       relatedPersonIds: selectedKeyword.relatedPersonIds || [],
       relatedLocationIds: selectedKeyword.relatedLocationIds || [],
       relatedEventIds: selectedKeyword.relatedEventIds || [],
       relatedKeywordIds: selectedKeyword.relatedKeywordIds || [],
       attachments: selectedKeyword.attachments || []
    });
    setIsEditing(true);
    setShowTreeView(false);
  };

  const handleSave = () => {
    if (!formData.name || !formData.category) return;
    const newKeyword: Keyword = { 
      id: formData.id!, 
      name: formData.name, 
      category: formData.category as KeywordCategory, 
      parentId: formData.parentId ?? undefined, 
      description: formData.description || '', 
      tags: formData.tags || [], 
      attributes: formData.attributes || [],
      relatedPersonIds: formData.relatedPersonIds || [], 
      relatedLocationIds: formData.relatedLocationIds || [],
      relatedEventIds: formData.relatedEventIds || [],
      relatedKeywordIds: formData.relatedKeywordIds || [],
      attachments: formData.attachments || [] 
    };
    saveKeyword(newKeyword);
    setIsEditing(false);
    setSelectedId(newKeyword.id);
    if (newKeyword.parentId) expandPathToId(newKeyword.parentId);
  };

  const saveKeyword = (newKeyword: Keyword) => {
    let newKeywords = [...keywords];
    const existingIdx = newKeywords.findIndex(k => k.id === newKeyword.id);
    if (existingIdx >= 0) newKeywords[existingIdx] = newKeyword;
    else newKeywords.push(newKeyword);
    onUpdateProject({ ...project, keywords: newKeywords });
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

  // 处理查看模式下的快速标注
  const handleQuickAnnotation = (original: string, replacement: string) => {
    if (!selectedKeyword) return;
    const desc = selectedKeyword.description || '';
    const newDesc = desc.replace(original, replacement);
    if (newDesc !== desc) {
       const updated: Keyword = { ...selectedKeyword, description: newDesc };
       saveKeyword(updated);
    }
  };

  // 处理对已有标注内容的更新
  const handleUpdateNote = (oldFull: string, newFull: string) => {
    if (!selectedKeyword) return;
    const desc = selectedKeyword.description || '';
    const newDesc = desc.replace(oldFull, newFull);
    if (newDesc !== desc) {
      const updated: Keyword = { ...selectedKeyword, description: newDesc };
      saveKeyword(updated);
    }
  };

  // 处理对标注语法的移除（剥离语法保留文本）
  const handleRemoveAnnotation = (oldFull: string, anchorText: string) => {
    if (!selectedKeyword) return;
    const desc = selectedKeyword.description || '';
    const newDesc = desc.replace(oldFull, anchorText);
    if (newDesc !== desc) {
      const updated: Keyword = { ...selectedKeyword, description: newDesc };
      saveKeyword(updated);
    }
  };

  // 侧栏注释编辑器发起的上传资产请求
  const handleNoteUploadFile = async (file: File): Promise<Attachment> => {
    if (!selectedKeyword) throw new Error("No active keyword");
    
    let url = '';
    if (window.electronAPI) {
      const buffer = await file.arrayBuffer();
      url = await window.electronAPI.saveAsset(buffer, file.name);
    } else {
      const reader = new FileReader();
      url = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    // 将新图片作为附件永久保存到词条中
    const newAttachment: Attachment = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: 'IMAGE',
      url,
      date: new Date().toISOString(),
      size: (file.size / 1024).toFixed(1) + ' KB',
      description: '来自注释快捷上传'
    };

    const updated: Keyword = {
      ...selectedKeyword,
      attachments: [...(selectedKeyword.attachments || []), newAttachment]
    };
    saveKeyword(updated);

    return newAttachment;
  };

  const insertSyntax = (syntaxType: 'ruby' | 'note') => {
    const textarea = document.getElementById('wiki-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textValue = textarea.value;
    const selection = textValue.substring(start, end);
    
    let replacement = '';
    if (syntaxType === 'ruby') {
      replacement = `[${selection || '文字'}]{ruby:注音}`;
    } else {
      replacement = `[${selection || '文字或图片地址'}]{note:注释内容}`;
    }

    const newValue = textValue.substring(0, start) + replacement + textValue.substring(end);
    setFormData({ ...formData, description: newValue });
    
    setTimeout(() => {
      textarea.focus();
      const newPos = start + (syntaxType === 'ruby' ? replacement.length - 3 : replacement.length - 5);
      textarea.setSelectionRange(newPos, newPos + (syntaxType === 'ruby' ? 2 : 4));
    }, 0);
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

  const handleAddAttribute = () => {
    if (!newAttrKey.trim()) return;
    const current = formData.attributes || [];
    setFormData({ ...formData, attributes: [...current, { key: newAttrKey, value: newAttrValue }] });
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleRemoveAttribute = (idx: number) => {
    const current = [...(formData.attributes || [])];
    current.splice(idx, 1);
    setFormData({ ...formData, attributes: current });
  };

  const handleUpdateAttribute = (idx: number, field: 'key' | 'value', val: string) => {
    const current = [...(formData.attributes || [])];
    current[idx] = { ...current[idx], [field]: val };
    setFormData({ ...formData, attributes: current });
  };

  const personOptions = useMemo(() => project.data.nodes.map(p => ({ label: p.name, value: p.id, group: p.familyId })), [project.data.nodes]);
  const parentOptions = useMemo(() => keywords.filter(k => k.id !== formData.id).map(k => ({ label: k.name, value: k.id, group: KeywordCategoryLabels[k.category] })), [keywords, formData.id]);
  const keywordSelectOptions = useMemo(() => keywords.filter(k => k.id !== formData.id).map(k => ({ label: k.name, value: k.id, group: KeywordCategoryLabels[k.category] })), [keywords, formData.id]);
  const eventOptions = useMemo(() => project.events.map(e => ({ label: e.title, value: e.id, sub: e.displayDate || e.start.split('T')[0] })), [project.events]);
  const locationOptions = useMemo(() => {
     const opts: any[] = [];
     project.world.nodes.forEach(node => {
        opts.push({ label: node.name, value: node.id, group: '世界节点' });
        node.floors.forEach(f => {
           f.rooms.forEach(r => opts.push({ label: r.name, value: r.id, group: node.name, sub: f.name }));
        });
     });
     return opts;
  }, [project.world.nodes]);

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
            {isTreeViewList ? rootKeywords.map(root => (
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
         </div>
         <div className="p-4 border-t border-gray-800">
            <button onClick={handleCreate} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"><Plus size={16} /> 新建词条</button>
         </div>
      </div>

      <div className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden">
         {selectedKeyword && !isEditing && (
            <div className="h-14 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 shrink-0 z-30">
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

               <div className="flex items-center gap-4 bg-gray-800/80 px-3 py-1 rounded-lg border border-gray-700">
                  <button 
                    onClick={() => setShowRuby(!showRuby)}
                    className={`flex items-center gap-1 text-xs font-bold transition-colors ${showRuby ? 'text-orange-400' : 'text-gray-500'}`}
                    title="注音显隐"
                  >
                    <Type size={14} /> 注音{showRuby ? '开' : '关'}
                  </button>
                  <div className="w-px h-4 bg-gray-700" />
                  <button 
                    onClick={() => setShowNotes(!showNotes)}
                    className={`flex items-center gap-1 text-xs font-bold transition-colors ${showNotes ? 'text-blue-400' : 'text-gray-500'}`}
                    title="注释显隐"
                  >
                    <MessageSquare size={14} /> 注释{showNotes ? '开' : '关'}
                  </button>
                  {showNotes && (
                    <button 
                      onClick={() => setNoteLayout(noteLayout === 'HOVER' ? 'SIDE' : 'HOVER')}
                      className="ml-2 text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-gray-300"
                    >
                      {noteLayout === 'SIDE' ? '侧栏模式' : '悬浮模式'}
                    </button>
                  )}
               </div>
               
               <div className="flex gap-2">
                  <button onClick={handleEdit} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-blue-400 border border-gray-700 text-xs font-bold flex items-center gap-1"><Edit3 size={14}/> 编辑</button>
                  <button onClick={handleDelete} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 rounded text-red-400 border border-gray-700 text-xs font-bold flex items-center gap-1"><Trash2 size={14}/> 删除</button>
               </div>
            </div>
         )}

         <div className="flex-1 overflow-hidden relative">
         {isEditing ? (
            <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar pb-32">
               <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl animate-fade-in mb-20">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Edit3 size={20} className="text-blue-500"/> 编辑词条</h3>
                    <div className="flex gap-2">
                       <button onClick={() => insertSyntax('ruby')} className="px-3 py-1 bg-gray-800 hover:bg-orange-900/30 text-orange-400 border border-gray-700 rounded text-xs font-bold flex items-center gap-1"><Type size={12}/> 添加注音</button>
                       <button onClick={() => insertSyntax('note')} className="px-3 py-1 bg-gray-800 hover:bg-blue-900/30 text-blue-400 border border-gray-700 rounded text-xs font-bold flex items-center gap-1"><MessageSquare size={12}/> 添加注释</button>
                    </div>
                  </div>

                  <div className="space-y-8">
                     <section className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">名称</label><input className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="词条名称" /></div>
                           <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">分类</label><select className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as KeywordCategory })}>{Object.entries(KeywordCategoryLabels).map(([key, label]) => ( <option key={key} value={key}>{label}</option> ))}</select></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><FolderTree size={12} /> 归属关系 (层级父项)</label><SearchableSelect options={parentOptions} value={formData.parentId || ''} onChange={(val) => setFormData({ ...formData, parentId: val || undefined })} placeholder="选择上级节点 (可选)" darker={true} /></div>
                     </section>

                     <section className="bg-gray-800/20 p-6 rounded-xl border border-gray-800">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 tracking-wider">
                           <Tag size={14} className="text-blue-400"/> 设定属性 (独特字段)
                        </label>
                        <div className="space-y-3 mb-4">
                           {(formData.attributes || []).map((attr, idx) => (
                              <div key={idx} className="flex gap-2 group">
                                 <input 
                                    className="w-1/3 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                                    placeholder="属性名"
                                    value={attr.key}
                                    onChange={e => handleUpdateAttribute(idx, 'key', e.target.value)}
                                 />
                                 <input 
                                    className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300"
                                    placeholder="数值"
                                    value={attr.value}
                                    onChange={e => handleUpdateAttribute(idx, 'value', e.target.value)}
                                 />
                                 <button onClick={() => handleRemoveAttribute(idx)} className="text-gray-600 hover:text-red-400 p-1"><X size={16}/></button>
                              </div>
                           ))}
                           {(!formData.attributes || formData.attributes.length === 0) && (
                              <div className="text-xs text-gray-600 italic">暂无自定义属性设定。</div>
                           )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-800/50">
                           <input 
                              className="w-1/3 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs"
                              placeholder="新属性名"
                              value={newAttrKey}
                              onChange={e => setNewAttrKey(e.target.value)}
                           />
                           <input 
                              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs"
                              placeholder="数值内容"
                              value={newAttrValue}
                              onChange={e => setNewAttrValue(e.target.value)}
                           />
                           <button onClick={handleAddAttribute} disabled={!newAttrKey.trim()} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 px-4 rounded text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none">添加</button>
                        </div>
                     </section>

                     <section>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">设定描述</label>
                       <textarea id="wiki-editor-textarea" className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-white h-48 focus:border-blue-500 outline-none resize-none font-mono text-sm leading-relaxed" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="输入设定详情..." />
                     </section>

                     <section className="bg-gray-800/20 p-6 rounded-xl border border-gray-800">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 tracking-wider">
                           <Paperclip size={14} className="text-blue-400"/> 附件资料
                        </label>
                        <AttachmentManager 
                           attachments={formData.attachments || []}
                           onUpdate={(atts) => setFormData({ ...formData, attachments: atts })}
                        />
                     </section>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-800">
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><User size={14}/> 关联人物</label>
                           <div className="flex flex-wrap gap-2 mb-3">{(formData.relatedPersonIds || []).map(pid => ( <div key={pid} className="bg-indigo-900/30 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-800 flex items-center gap-1">{project.data.nodes.find(p => p.id === pid)?.name || 'Unknown'}<button onClick={() => setFormData({ ...formData, relatedPersonIds: formData.relatedPersonIds?.filter(id => id !== pid) })} className="hover:text-white"><X size={12}/></button></div> ))}</div>
                           <SearchableSelect options={personOptions} value="" onChange={(pid) => pid && !formData.relatedPersonIds?.includes(pid) && setFormData({ ...formData, relatedPersonIds: [...(formData.relatedPersonIds || []), pid] })} placeholder="关联人物..." darker={true} />
                        </div>
                        <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-800">
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><MapPin size={14}/> 关联地点</label>
                           <div className="flex flex-wrap gap-2 mb-3">{(formData.relatedLocationIds || []).map(lid => ( <div key={lid} className="bg-emerald-900/30 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">{locationOptions.find(o => o.value === lid)?.label || 'Unknown'}<button onClick={() => setFormData({ ...formData, relatedLocationIds: formData.relatedLocationIds?.filter(id => id !== lid) })} className="hover:text-white"><X size={12}/></button></div> ))}</div>
                           <SearchableSelect options={locationOptions} value="" onChange={(lid) => lid && !formData.relatedLocationIds?.includes(lid) && setFormData({ ...formData, relatedLocationIds: [...(formData.relatedLocationIds || []), lid] })} placeholder="关联地点..." darker={true} />
                        </div>
                        <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-800">
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Calendar size={14}/> 涉及日程</label>
                           <div className="flex flex-wrap gap-2 mb-3">{(formData.relatedEventIds || []).map(eid => ( <div key={eid} className="bg-orange-900/30 text-orange-300 text-[10px] px-2 py-0.5 rounded border border-orange-800 flex items-center gap-1">{project.events.find(e => e.id === eid)?.title || 'Unknown'}<button onClick={() => setFormData({ ...formData, relatedEventIds: formData.relatedEventIds?.filter(id => id !== eid) })} className="hover:text-white"><X size={12}/></button></div> ))}</div>
                           <SearchableSelect options={eventOptions} value="" onChange={(eid) => eid && !formData.relatedEventIds?.includes(eid) && setFormData({ ...formData, relatedEventIds: [...(formData.relatedEventIds || []), eid] })} placeholder="关联日程..." darker={true} />
                        </div>
                        <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-800">
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Link size={14}/> 相关百科</label>
                           <div className="flex flex-wrap gap-2 mb-3">{(formData.relatedKeywordIds || []).map(kid => ( <div key={kid} className="bg-blue-900/30 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">{keywords.find(k => k.id === kid)?.name || 'Unknown'}<button onClick={() => setFormData({ ...formData, relatedKeywordIds: formData.relatedKeywordIds?.filter(id => id !== kid) })} className="hover:text-white"><X size={12}/></button></div> ))}</div>
                           <SearchableSelect options={keywordSelectOptions} value="" onChange={(kid) => kid && !formData.relatedKeywordIds?.includes(kid) && setFormData({ ...formData, relatedKeywordIds: [...(formData.relatedKeywordIds || []), kid] })} placeholder="关联其他条目..." darker={true} />
                        </div>
                     </div>

                     <div className="flex gap-4 pt-8 border-t border-gray-800">
                        <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95">保存条目</button>
                        <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-all">取消</button>
                     </div>
                  </div>
               </div>
            </div>
         ) : selectedKeyword ? (
            showTreeView && rootAncestor ? (
               <WikiTreeCanvas rootKeyword={rootAncestor} allKeywords={keywords} selectedId={selectedId} onSelect={handleSelect} width={window.innerWidth - 320} height={window.innerHeight - 104} />
            ) : (
            <div className="h-full flex overflow-hidden">
               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-32">
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
                        <div className="relative z-10">
                           <div className="flex items-center gap-3 mb-2">
                              <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800 font-bold uppercase tracking-wider">{KeywordCategoryLabels[selectedKeyword.category]}</span>
                              {(selectedKeyword.tags || []).map(tag => ( <span key={tag} className="text-gray-500 text-xs italic">#{tag}</span> ))}
                           </div>
                           <h1 className="text-4xl font-bold text-white mb-4">{selectedKeyword.name}</h1>
                           
                           {selectedKeyword.attributes && selectedKeyword.attributes.length > 0 && (
                              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-gray-800 pt-6">
                                 {selectedKeyword.attributes.map((attr, idx) => (
                                    <div key={idx} className="bg-gray-800/40 p-3 rounded-lg border border-gray-800/50 hover:border-blue-900/50 transition-colors">
                                       <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 truncate" title={attr.key}>{attr.key}</div>
                                       <div className="text-sm text-blue-100 font-medium break-words">{attr.value}</div>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                        <div className="mt-8 border-t border-gray-800 pt-6">
                           <WikiRichText 
                             text={selectedKeyword.description || ''} 
                             showRuby={showRuby} 
                             showNotes={showNotes} 
                             noteLayout={noteLayout} 
                             attachments={selectedKeyword.attachments}
                             onAddAnnotation={handleQuickAnnotation}
                             onUpdateNote={handleUpdateNote}
                             onRemoveAnnotation={handleRemoveAnnotation}
                             onUploadFile={handleNoteUploadFile}
                           />
                        </div>
                     </div>

                     {keywords.some(k => k.parentId === selectedKeyword.id) && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2"><CornerDownRight size={14} /> 下级词条</h4>
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {keywords.filter(k => k.parentId === selectedKeyword.id).map(child => (
                                 <div key={child.id} onClick={() => handleSelect(child.id)} className="flex items-center gap-2 p-3 rounded-lg border border-gray-800 bg-gray-800/30 hover:bg-gray-800 cursor-pointer transition-colors group">
                                    <div className="text-gray-500 group-hover:text-blue-400">{getCategoryIcon(child.category)}</div>
                                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">{child.name}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}

                     {(selectedKeyword.relatedLocationIds || []).length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2"><MapPin size={14} className="text-emerald-500"/> 空间关联</h4>
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {selectedKeyword.relatedLocationIds!.map(lid => {
                                 const loc = locationOptions.find(o => o.value === lid);
                                 return loc ? (
                                    <div key={lid} onClick={() => onJumpToLocation?.(lid)} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 bg-emerald-900/10 hover:bg-emerald-900/20 cursor-pointer transition-colors group">
                                       <div className="p-2 bg-emerald-900/30 rounded text-emerald-400"><MapPin size={14}/></div>
                                       <div className="min-w-0"><div className="text-sm text-gray-200 font-bold truncate group-hover:text-emerald-300">{loc.label}</div><div className="text-[9px] text-gray-600 truncate">{loc.group}</div></div>
                                    </div>
                                 ) : null;
                              })}
                           </div>
                        </div>
                     )}

                     {(selectedKeyword.relatedEventIds || []).length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2"><Calendar size={14} className="text-orange-500"/> 剧情足迹</h4>
                           <div className="space-y-2">
                              {selectedKeyword.relatedEventIds!.map(eid => {
                                 const event = project.events.find(e => e.id === eid);
                                 return event ? (
                                    <div key={eid} onClick={() => onJumpToEvent?.(eid)} className="flex items-center gap-4 p-3 rounded-lg border border-gray-800 bg-orange-900/10 hover:bg-orange-900/20 cursor-pointer transition-colors group">
                                       <div className="text-xs font-mono text-orange-600 bg-orange-950 px-2 py-1 rounded shrink-0">{event.displayDate || event.start.split('T')[0]}</div>
                                       <div className="flex-1 min-w-0"><div className="text-sm text-gray-200 font-bold group-hover:text-orange-300 truncate">{event.title}</div><div className="text-[10px] text-gray-600 truncate">{event.description}</div></div>
                                       <ChevronRight size={14} className="text-gray-700 group-hover:text-orange-500"/>
                                    </div>
                                 ) : null;
                              })}
                           </div>
                        </div>
                     )}

                     {(selectedKeyword.relatedKeywordIds || []).length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 border-b border-gray-800 pb-2"><Link size={14} className="text-blue-500"/> 相关百科</h4>
                           <div className="flex flex-wrap gap-2">
                              {selectedKeyword.relatedKeywordIds!.map(kid => {
                                 const k = keywords.find(item => item.id === kid);
                                 return k ? (
                                    <button key={kid} onClick={() => handleSelect(kid)} className="px-3 py-1.5 bg-gray-800 hover:bg-blue-900/30 text-gray-300 hover:text-blue-300 border border-gray-700 rounded-full text-xs transition-colors flex items-center gap-2 shadow-sm">
                                       {getCategoryIcon(k.category)}
                                       {k.name}
                                    </button>
                                 ) : null;
                              })}
                           </div>
                        </div>
                     )}

                     {selectedKeyword.attachments && selectedKeyword.attachments.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md"><h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 border-b border-gray-800 pb-2"><Paperclip size={14} /> 附件资料</h4><AttachmentManager attachments={selectedKeyword.attachments} onUpdate={() => {}} readOnly /></div>
                     )}

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 shadow-md flex flex-col">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 border-b border-gray-800 pb-2"><User size={14} className="text-indigo-400"/> 关联人物</h4>
                           <div className="flex-1 min-h-0 space-y-2 max-h-60 overflow-y-auto pr-1">
                              {(selectedKeyword.relatedPersonIds || []).map(pid => {
                                 const p = project.data.nodes.find(person => person.id === pid);
                                 return p ? (
                                    <div key={pid} onClick={() => onJumpToPerson?.(pid)} className="flex items-center gap-3 p-2 rounded bg-indigo-900/10 hover:bg-indigo-900/20 cursor-pointer group transition-colors">
                                       <div className="w-6 h-6 rounded-full bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-400">{p.avatar ? <img src={p.avatar} className="w-full h-full rounded-full object-cover"/> : p.name.charAt(0)}</div>
                                       <span className="text-xs text-gray-300 group-hover:text-indigo-300 font-medium">{p.name}</span>
                                    </div>
                                 ) : null;
                              })}
                              {(selectedKeyword.relatedPersonIds || []).length === 0 && <div className="text-[10px] text-gray-600 italic py-4 text-center">暂无关联人物记录</div>}
                           </div>
                        </div>

                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 shadow-md flex flex-col">
                           <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 border-b border-gray-800 pb-2"><Scroll size={14} /> 系统引用追踪</h4>
                           <div className="flex-1 min-h-0 space-y-2 max-h-60 overflow-y-auto pr-1">
                              {references.filter(r => r.context !== '显式关联').map((ref, idx) => (
                                 <div key={`${ref.type}-${ref.id}-${idx}`} onClick={() => { if (ref.type === 'PERSON' && onJumpToPerson) onJumpToPerson(ref.id); if (ref.type === 'EVENT' && onJumpToEvent) onJumpToEvent(ref.id); if (ref.type === 'LOCATION' && onJumpToLocation) onJumpToLocation(ref.id); }} className="flex flex-col gap-1 p-2 rounded bg-gray-800/30 hover:bg-gray-800 cursor-pointer group transition-colors">
                                    <div className="flex items-center gap-3">
                                       <div className={`p-1.5 rounded-full ${ ref.type === 'PERSON' ? 'bg-indigo-900/50 text-indigo-400' : ref.type === 'EVENT' ? 'bg-orange-900/50 text-orange-400' : 'bg-green-900/50 text-green-400' }`}> {ref.type === 'PERSON' ? <User size={10}/> : ref.type === 'EVENT' ? <Calendar size={10}/> : <MapPin size={10}/>} </div>
                                       <div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-gray-300 truncate">{ref.name}</div><div className="text-[9px] text-gray-500 truncate">{ref.context}</div></div>
                                    </div>
                                    {ref.snippet && <div className="mt-1 ml-7 text-[9px] text-gray-500 italic bg-black/20 p-1.5 rounded flex gap-1"><Quote size={8} className="shrink-0 mt-0.5 opacity-30"/> {ref.snippet}</div>}
                                 </div>
                              ))}
                              {references.length === 0 && <div className="text-[10px] text-gray-600 italic py-4 text-center">未检测到系统内引用关联</div>}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {showNotes && noteLayout === 'SIDE' && (
                  <div className="w-[350px] border-l border-gray-800 bg-gray-900/20 overflow-y-auto scroll-smooth custom-scrollbar relative">
                     <div className="p-4 border-b border-gray-800 bg-gray-900/40 sticky top-0 z-20 backdrop-blur">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest"><MessageSquare size={14} className="text-blue-500"/> 词条注释</div>
                     </div>
                     <div id="wiki-side-notes-container" className="p-4 space-y-4 pb-32" />
                  </div>
               )}
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
                  <div className="flex gap-3 mt-4"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-medium border border-gray-700">取消</button><button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold shadow-lg shadow-red-900/20">确认删除</button></div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};