import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, ArrowRight, Type, Check, X, Edit2, Save, Trash2, Image as ImageIcon, Upload, Paperclip, Plus, AlertCircle, Maximize2, Copy, Target, ZoomIn, User, MapPin, Calendar, Link as LinkIcon } from 'lucide-react';
import { Attachment, AnnotationDefinition } from '../types';
import { SearchableSelect, Option } from './SearchableSelect';

interface WikiRichTextProps {
  text: string;
  showRuby: boolean;
  showNotes: boolean;
  noteLayout: 'HOVER' | 'SIDE';
  annotations: Record<string, AnnotationDefinition>;
  attachments?: Attachment[];
  onAddAnnotation?: (startIndex: number, oldLength: number, anchorText: string, ruby?: string, note?: string) => void;
  onUpdateNote?: (id: string, ruby?: string, note?: string, newItemUrls?: string[], personIds?: string[], locationIds?: string[], eventIds?: string[], keywordIds?: string[]) => void;
  onRemoveAnnotation?: (startIndex: number, oldLength: number, anchorText: string, annoId?: string) => void;
  onUploadFile?: (file: File) => Promise<Attachment>;
  // 实体选项数据源
  personOptions?: Option[];
  locationOptions?: Option[];
  eventOptions?: Option[];
  keywordOptions?: Option[];
  // 实体跳转回调
  onJumpToPerson?: (id: string) => void;
  onJumpToLocation?: (id: string) => void;
  onJumpToEvent?: (id: string) => void;
  onJumpToKeyword?: (id: string) => void;
}

interface NoteData {
  id: string;
  anchorText: string;
  rawAnchor: string; 
  content: string;
  ruby?: string;
  rawNoteValue: string; 
  rawImageUrls: string[]; 
  resolvedImageUrls: string[]; 
  personIds: string[];
  locationIds: string[];
  eventIds: string[];
  keywordIds: string[];
  index: number;
  sourceIndex: number;
  sourceLength: number;
}

interface SyntaxNode {
  type: 'text' | 'annotation' | 'ruby' | 'note'; 
  content: string | SyntaxNode[];
  value?: string;
  id?: string;
  refId?: string; 
  sourceIndex: number;
  sourceLength: number;
}

export const WikiRichText: React.FC<WikiRichTextProps> = ({ 
  text, 
  showRuby, 
  showNotes, 
  noteLayout, 
  annotations = {},
  attachments = [],
  onAddAnnotation, 
  onUpdateNote,
  onRemoveAnnotation,
  onUploadFile,
  personOptions = [],
  locationOptions = [],
  eventOptions = [],
  keywordOptions = [],
  onJumpToPerson,
  onJumpToLocation,
  onJumpToEvent,
  onJumpToKeyword
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  
  const [activeRubyId, setActiveRubyId] = useState<string | null>(null);
  const [rubyEditValue, setRubyEditValue] = useState('');
  const [rubyToolbarPos, setRubyToolbarPos] = useState<{left: number, top: number} | null>(null);

  const [sideNotesPortal, setSideNotesPortal] = useState<Element | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<{text: string, rect: DOMRect, sourceStartIndex: number} | null>(null);
  const [annoMode, setAnnoMode] = useState<'NONE' | 'SELECT' | 'INPUT'>('NONE');
  const [annoValues, setAnnoValues] = useState<{ruby: string, note: string}>({ruby: '', note: ''});

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingRuby, setEditingRuby] = useState('');
  const [editingImageUrls, setEditingImageUrls] = useState<string[]>([]);
  const [editingPersonIds, setEditingPersonIds] = useState<string[]>([]);
  const [editingLocationIds, setEditingLocationIds] = useState<string[]>([]);
  const [editingEventIds, setEditingEventIds] = useState<string[]>([]);
  const [editingKeywordIds, setEditingKeywordIds] = useState<string[]>([]);

  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);

  // 二次确认状态
  const [confirmingRubyDelete, setConfirmingRubyDelete] = useState(false);
  const [confirmingNoteDeleteId, setConfirmingNoteDeleteId] = useState<string | null>(null);
  // Fix: Use any type for the timer ref to avoid 'NodeJS' namespace error in browser environments.
  const confirmTimerRef = useRef<any>(null);

  useEffect(() => {
    const portal = document.getElementById('wiki-side-notes-container');
    setSideNotesPortal(portal);
  }, [noteLayout, showNotes]);

  // 当操作目标改变时重置确认状态
  useEffect(() => {
    setConfirmingRubyDelete(false);
  }, [activeRubyId]);

  useEffect(() => {
    setConfirmingNoteDeleteId(null);
  }, [activeNoteId, editingNoteId]);

  const startConfirmTimer = (callback: () => void) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(callback, 3000);
  };

  const resolveImageUrl = (rawPath: string | undefined): string | undefined => {
    if (!rawPath) return undefined;
    if (rawPath.startsWith('att:')) {
      const attId = rawPath.replace('att:', '');
      return attachments.find(a => a.id === attId)?.url;
    }
    return rawPath;
  };

  const getSourceOffsetFromDOM = (targetNode: Node, domOffset: number): number => {
    if (!containerRef.current) return 0;
    let walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const sourceBase = parent?.getAttribute('data-source-idx');
      if (node === targetNode) {
        if (sourceBase) return parseInt(sourceBase) + domOffset;
        break;
      }
    }
    return -1;
  };

  const handleMouseUp = () => {
    if (annoMode !== 'NONE' && annoMode !== 'SELECT') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionInfo(null);
      setAnnoMode('NONE');
      return;
    }
    
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const hasExistingAnnotation = fragment.querySelector('[id^="anchor-"], [id^="ruby-"]');
    
    if (hasExistingAnnotation) {
        setSelectionInfo(null);
        setAnnoMode('NONE');
        return;
    }

    const selectedText = selection.toString().trim();
    if (containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
      const sourceStartIndex = getSourceOffsetFromDOM(range.startContainer, range.startOffset);
      if (sourceStartIndex !== -1) {
        setSelectionInfo({ 
          text: selectedText, 
          rect: range.getBoundingClientRect(),
          sourceStartIndex
        });
        setAnnoMode('SELECT');
        setAnnoValues({ruby: '', note: ''});
        setActiveRubyId(null);
      }
    }
  };

  const handleApplyAnnotation = () => {
    if (!selectionInfo || !onAddAnnotation) return;
    onAddAnnotation(
        selectionInfo.sourceStartIndex, 
        selectionInfo.text.length, 
        selectionInfo.text, 
        annoValues.ruby || undefined, 
        annoValues.note || undefined
    );
    setSelectionInfo(null);
    setAnnoMode('NONE');
    setAnnoValues({ruby: '', note: ''});
    window.getSelection()?.removeAllRanges();
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;
    try {
      const newAtt = await onUploadFile(file);
      setEditingImageUrls(prev => [...prev, `att:${newAtt.id}`]);
    } catch (err) {
      console.error(err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateRuby = (node: SyntaxNode) => {
    if (!onUpdateNote || !node.refId) return;
    const anno = annotations[node.refId];
    onUpdateNote(node.refId, rubyEditValue, anno?.note, anno?.imageUrls, anno?.personIds, anno?.locationIds, anno?.eventIds, anno?.keywordIds);
    setActiveRubyId(null);
  };

  const handleDeleteRubyConfirm = (node: SyntaxNode) => {
    if (!confirmingRubyDelete) {
      setConfirmingRubyDelete(true);
      startConfirmTimer(() => setConfirmingRubyDelete(false));
      return;
    }
    
    if (!onRemoveAnnotation || !node.refId) return;
    const anno = annotations[node.refId];
    if (anno && anno.note) {
        onUpdateNote?.(node.refId, undefined, anno.note, anno.imageUrls, anno.personIds, anno.locationIds, anno.eventIds, anno.keywordIds);
    } else {
        onRemoveAnnotation(node.sourceIndex, node.sourceLength, getPlainText(node.content), node.refId);
    }
    setActiveRubyId(null);
    setConfirmingRubyDelete(false);
  };

  const getPlainText = (n: string | SyntaxNode[]): string => {
    if (typeof n === 'string') return n;
    return n.map(child => (child.type === 'text' ? child.content as string : getPlainText(child.content))).join('');
  };

  const handleSaveSideEdit = (note: NoteData) => {
    if (!onUpdateNote) return;
    onUpdateNote(note.id, editingRuby || undefined, editingValue || undefined, editingImageUrls, editingPersonIds, editingLocationIds, editingEventIds, editingKeywordIds);
    setEditingNoteId(null);
  };

  const handleRemoveAnnotationConfirm = (note: NoteData) => {
    if (confirmingNoteDeleteId !== note.id) {
      setConfirmingNoteDeleteId(note.id);
      startConfirmTimer(() => setConfirmingNoteDeleteId(null));
      return;
    }
    
    onRemoveAnnotation?.(note.sourceIndex, note.sourceLength, note.anchorText, note.id);
    setConfirmingNoteDeleteId(null);
  };

  const scrollToAnchor = (id: string) => {
    const el = document.getElementById(`anchor-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setJumpHighlightId(id);
      setTimeout(() => setJumpHighlightId(null), 2000);
      setActiveNoteId(id);
    }
  };

  const parseToTree = (input: string, baseOffset: number = 0): SyntaxNode[] => {
    const nodes: SyntaxNode[] = [];
    let i = 0;
    while (i < input.length) {
      if (input[i] === '[') {
        let bracketLevel = 1;
        let j = i + 1;
        while (j < input.length && bracketLevel > 0) {
          if (input[j] === '[') bracketLevel++;
          if (input[j] === ']') bracketLevel--;
          j++;
        }
        if (j < input.length && input[j] === '{') {
          const k = input.indexOf('}', j);
          if (k !== -1) {
            const innerText = input.substring(i + 1, j - 1);
            const meta = input.substring(j + 1, k); 
            const [typeLabel, ...valParts] = meta.split(':');
            const value = valParts.join(':');
            const fullLength = (k + 1) - i;

            if (typeLabel === 'id' || typeLabel === 'ref') {
               const anno = annotations[value];
               if (anno) {
                  nodes.push({
                    type: 'annotation',
                    content: parseToTree(innerText, baseOffset + i + 1),
                    value: anno.ruby || anno.note, 
                    refId: anno.id,
                    id: `node-${baseOffset + i}`,
                    sourceIndex: baseOffset + i,
                    sourceLength: fullLength
                  });
                  i = k + 1; continue;
               }
            }
            
            if (typeLabel === 'note' || typeLabel === 'ruby') {
              nodes.push({ 
                type: typeLabel as 'note' | 'ruby', 
                content: parseToTree(innerText, baseOffset + i + 1), 
                value: value, 
                id: `node-${baseOffset + i}`,
                sourceIndex: baseOffset + i,
                sourceLength: fullLength
              });
              i = k + 1; continue;
            }
          }
        }
      }
      let textContent = '';
      const startTextIdx = i;
      while (i < input.length && input[i] !== '[') { textContent += input[i]; i++; }
      if (textContent) {
        nodes.push({ 
          type: 'text', 
          content: textContent,
          sourceIndex: baseOffset + startTextIdx,
          sourceLength: textContent.length
        });
      }
    }
    return nodes;
  };

  const extractFlatNotes = (nodes: SyntaxNode[], list: NoteData[] = []) => {
    nodes.forEach(node => {
      const isAnnoWithNote = node.type === 'annotation' && node.refId && annotations[node.refId]?.note;
      const isLegacyNote = node.type === 'note';

      if (isAnnoWithNote || isLegacyNote) {
        let content = '';
        let ruby = undefined;
        let rawImageUrls: string[] = [];
        let resolvedImageUrls: string[] = [];
        let personIds: string[] = [];
        let locationIds: string[] = [];
        let eventIds: string[] = [];
        let keywordIds: string[] = [];
        let rawVal = node.value || '';

        if (node.refId) {
            const anno = annotations[node.refId];
            content = anno.note || '';
            ruby = anno.ruby;
            rawImageUrls = anno.imageUrls || [];
            resolvedImageUrls = rawImageUrls.map(url => resolveImageUrl(url)).filter(u => !!u) as string[];
            personIds = anno.personIds || [];
            locationIds = anno.locationIds || [];
            eventIds = anno.eventIds || [];
            keywordIds = anno.keywordIds || [];
        } else {
            content = rawVal;
        }

        list.push({ 
          id: node.refId || node.id!, 
          anchorText: getPlainText(node.content), 
          rawAnchor: innerTextAsRaw(node.content), 
          content, 
          ruby,
          rawNoteValue: rawVal, 
          rawImageUrls, 
          resolvedImageUrls,
          personIds,
          locationIds,
          eventIds,
          keywordIds,
          index: list.length + 1,
          sourceIndex: node.sourceIndex,
          sourceLength: node.sourceLength
        });
      }
      if (Array.isArray(node.content)) extractFlatNotes(node.content, list);
    });
    return list;
  };

  const innerTextAsRaw = (n: string | SyntaxNode[]): string => {
      if (typeof n === 'string') return n;
      return n.map(child => {
          if (child.type === 'text') return child.content as string;
          return getPlainText(child.content); 
      }).join('');
  };

  const { tree, flattenedNotes } = useMemo(() => {
    const t = parseToTree(text);
    const n = extractFlatNotes(t);
    return { tree: t, flattenedNotes: n };
  }, [text, annotations, attachments]);

  const renderTree = (nodes: SyntaxNode[]): React.ReactNode => {
    return nodes.map((node, idx) => {
      if (node.type === 'text') {
        return <span key={idx} data-source-idx={node.sourceIndex}>{node.content as string}</span>;
      }
      
      const nodeId = node.refId || node.id!;
      const anno = node.refId ? annotations[node.refId] : null;
      const hasRuby = node.type === 'ruby' || (anno && !!anno.ruby);
      const rubyVal = anno ? anno.ruby : node.value;
      const hasNote = node.type === 'note' || (anno && !!anno.note);
      
      let inner = renderTree(node.content as SyntaxNode[]);

      const isActiveRuby = activeRubyId === node.id;
      const isActiveNote = activeNoteId === nodeId;
      const isHoveredNote = hoveredNoteId === nodeId;
      const isJumpHighlighted = jumpHighlightId === nodeId;
      const noteInfo = hasNote ? flattenedNotes.find(n => n.id === nodeId) : null;

      if (hasRuby) {
          inner = (
            <ruby 
                key={`${node.id}-ruby`} id={`ruby-${node.id}`}
                onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setRubyToolbarPos({ left: rect.left + rect.width / 2, top: rect.top });
                    setActiveRubyId(node.id!);
                    setRubyEditValue(rubyVal || '');
                    setAnnoMode('NONE');
                }}
                className={`px-0.5 border-b border-orange-500/20 transition-all cursor-pointer hover:border-orange-500 ${isActiveRuby ? 'bg-orange-500/10 ring-1 ring-orange-500/30' : ''}`}
            >
                {inner}
                {showRuby && <rt className="text-[10px] text-orange-400 font-bold select-none">{rubyVal}</rt>}
            </ruby>
          );
      }

      if (hasNote) {
          return (
            <span key={nodeId} id={`anchor-${nodeId}`}
              className={`relative cursor-pointer transition-all inline px-0.5 rounded
                ${showNotes ? 'border-b-2 border-dashed border-blue-500/40 hover:bg-blue-500/10' : ''} 
                ${isActiveNote ? 'bg-blue-500/30 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : ''} 
                ${isHoveredNote ? 'bg-blue-500/10' : ''}
                ${isJumpHighlighted ? 'ring-2 ring-blue-400 bg-blue-500/40 animate-pulse' : ''}
              `}
              onMouseEnter={(e) => { e.stopPropagation(); showNotes && setHoveredNoteId(nodeId); }}
              onMouseLeave={() => setHoveredNoteId(null)}
              onClick={(e) => {
                 if (!showNotes) return;
                 e.stopPropagation();
                 setActiveNoteId(nodeId);
                 setActiveRubyId(null); 
                 if (noteLayout === 'SIDE') {
                    const noteEl = document.getElementById(`side-card-${nodeId}`);
                    noteEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
              }}
            >
              {inner}
              {showNotes && <span className="text-[8px] font-bold text-blue-400 ml-0.5 align-top opacity-60">[{noteInfo?.index}]</span>}
              {showNotes && noteLayout === 'HOVER' && isHoveredNote && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 border border-blue-500 rounded-lg shadow-2xl z-50 animate-scale-in text-xs cursor-default">
                  <div className="flex items-center gap-2 text-blue-400 font-bold mb-2 pb-1 border-b border-gray-800">
                    <MessageSquare size={12}/> 注释 [{noteInfo?.index}]
                  </div>
                  
                  {noteInfo && noteInfo.resolvedImageUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                       {noteInfo.resolvedImageUrls.map((url, i) => (
                          <div key={i} className="relative group/mini cursor-zoom-in rounded overflow-hidden border border-gray-800" onClick={() => setFullScreenImageUrl(url)}>
                            <img src={url} className="w-full h-16 object-cover" alt="Note" />
                          </div>
                       ))}
                    </div>
                  )}
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{noteInfo?.content}</p>
                  
                  {/* Hover Mode Entity Links */}
                  {(noteInfo?.personIds.length || 0) + (noteInfo?.locationIds.length || 0) + (noteInfo?.eventIds.length || 0) + (noteInfo?.keywordIds.length || 0) > 0 && (
                     <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-800 pt-2">
                        {noteInfo?.personIds.map(id => <span key={id} className="bg-blue-900/40 text-[9px] px-1 rounded flex items-center gap-1 text-blue-300"><User size={8}/>{personOptions.find(o => o.value === id)?.label}</span>)}
                        {noteInfo?.locationIds.map(id => <span key={id} className="bg-emerald-900/40 text-[9px] px-1 rounded flex items-center gap-1 text-emerald-300"><MapPin size={8}/>{locationOptions.find(o => o.value === id)?.label}</span>)}
                        {noteInfo?.eventIds.map(id => <span key={id} className="bg-orange-900/40 text-[9px] px-1 rounded flex items-center gap-1 text-orange-300"><Calendar size={8}/>{eventOptions.find(o => o.value === id)?.label}</span>)}
                        {noteInfo?.keywordIds.map(id => <span key={id} className="bg-indigo-900/40 text-[9px] px-1 rounded flex items-center gap-1 text-indigo-300"><LinkIcon size={8}/>{keywordOptions.find(o => o.value === id)?.label}</span>)}
                     </div>
                  )}
                </div>
              )}
            </span>
          );
      }

      return inner;
    });
  };

  const sideNotesContent = (
    <div className="animate-fade-in space-y-4">
      {flattenedNotes.map(note => {
        const isEditing = editingNoteId === note.id;
        const isActive = activeNoteId === note.id;
        const imageAttachments = attachments.filter(a => a.type === 'IMAGE');
        const isConfirmingDelete = confirmingNoteDeleteId === note.id;

        return (
          <div key={note.id} id={`side-card-${note.id}`}
            className={`p-3 rounded-lg border transition-all duration-300 group cursor-pointer ${isActive ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/50' : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 hover:bg-gray-800/60'} ${hoveredNoteId === note.id ? 'border-gray-600' : ''}`}
            onMouseEnter={() => setHoveredNoteId(note.id)}
            onMouseLeave={() => setHoveredNoteId(null)}
            onClick={() => setActiveNoteId(note.id)}
          >
            <div className="flex items-center justify-between mb-2">
               <div className={`flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
                  <MessageSquare size={12}/> 注释 [{note.index}]
               </div>
               <div className="flex items-center gap-1">
                  {!isEditing && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); scrollToAnchor(note.id); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-green-400 transition-colors" title="反向定位到原文">
                        <Target size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(note.id); setEditingValue(note.content); setEditingRuby(note.ruby || ''); setEditingImageUrls(note.rawImageUrls); setEditingPersonIds(note.personIds); setEditingLocationIds(note.locationIds); setEditingEventIds(note.eventIds); setEditingKeywordIds(note.keywordIds); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-blue-400 transition-colors"><Edit2 size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveAnnotationConfirm(note); }}
                        className={`p-1 rounded transition-all flex items-center gap-1 ${isConfirmingDelete ? 'bg-red-600 text-white' : 'hover:bg-gray-700 text-gray-500 hover:text-red-400'}`}>
                        {isConfirmingDelete ? <span className="text-[9px] font-bold px-1">再次点击确认</span> : <Trash2 size={12}/>}
                      </button>
                    </>
                  )}
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleSaveSideEdit(note); }}
                        className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm transition-colors"><Save size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(null); setEditingImageUrls([]); }}
                        className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shadow-sm transition-colors"><X size={12}/></button>
                    </div>
                  )}
               </div>
            </div>

            <div className={`text-[11px] font-bold mb-1 line-clamp-1 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>原文: "{note.anchorText}"</div>

            {isEditing ? (
               <div className="space-y-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 bg-gray-950 border border-orange-500/30 rounded p-1.5">
                      <Type size={12} className="text-orange-400 shrink-0" />
                      <input className="bg-transparent border-none outline-none text-xs text-orange-200 w-full" placeholder="注音内容" value={editingRuby} onChange={e => setEditingRuby(e.target.value)} />
                  </div>
                  <textarea autoFocus className="w-full bg-gray-950 border border-blue-500/50 rounded p-2 text-xs text-white outline-none focus:border-blue-500 min-h-[60px] resize-none"
                    value={editingValue} onChange={e => setEditingValue(e.target.value)} placeholder="注释内容" />
                  
                  {/* Entity Pickers for Editing Note */}
                  <div className="space-y-2 border-t border-gray-800 pt-2">
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1"><User size={10}/> 人物链接</label>
                        <SearchableSelect options={personOptions} value="" onChange={id => id && !editingPersonIds.includes(id) && setEditingPersonIds([...editingPersonIds, id])} placeholder="添加人物..." darker={true} />
                        <div className="flex flex-wrap gap-1">{editingPersonIds.map(id => <span key={id} className="bg-blue-900/30 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-blue-300">{personOptions.find(o => o.value === id)?.label}<button onClick={() => setEditingPersonIds(editingPersonIds.filter(i => i !== id))}><X size={8}/></button></span>)}</div>
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1"><MapPin size={10}/> 地点链接</label>
                        <SearchableSelect options={locationOptions} value="" onChange={id => id && !editingLocationIds.includes(id) && setEditingLocationIds([...editingLocationIds, id])} placeholder="添加地点..." darker={true} />
                        <div className="flex flex-wrap gap-1">{editingLocationIds.map(id => <span key={id} className="bg-emerald-900/30 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-emerald-300">{locationOptions.find(o => o.value === id)?.label}<button onClick={() => setEditingLocationIds(editingLocationIds.filter(i => i !== id))}><X size={8}/></button></span>)}</div>
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1"><Calendar size={10}/> 日程链接</label>
                        <SearchableSelect options={eventOptions} value="" onChange={id => id && !editingEventIds.includes(id) && setEditingEventIds([...editingEventIds, id])} placeholder="添加日程..." darker={true} />
                        <div className="flex flex-wrap gap-1">{editingEventIds.map(id => <span key={id} className="bg-orange-900/30 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-orange-300">{eventOptions.find(o => o.value === id)?.label}<button onClick={() => setEditingEventIds(editingEventIds.filter(i => i !== id))}><X size={8}/></button></span>)}</div>
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1"><LinkIcon size={10}/> 百科链接</label>
                        <SearchableSelect options={keywordOptions} value="" onChange={id => id && !editingKeywordIds.includes(id) && setEditingKeywordIds([...editingKeywordIds, id])} placeholder="添加词条..." darker={true} />
                        <div className="flex flex-wrap gap-1">{editingKeywordIds.map(id => <span key={id} className="bg-indigo-900/30 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-indigo-300">{keywordOptions.find(o => o.value === id)?.label}<button onClick={() => setEditingKeywordIds(editingKeywordIds.filter(i => i !== id))}><X size={8}/></button></span>)}</div>
                     </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] text-gray-500 font-bold uppercase">选择关联图片</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar min-h-[44px] bg-black/20 p-1 rounded border border-gray-800">
                       {imageAttachments.map(att => {
                          const rawId = `att:${att.id}`;
                          const isSelected = editingImageUrls.includes(rawId);
                          return (
                            <div key={att.id} onClick={() => setEditingImageUrls(prev => isSelected ? prev.filter(u => u !== rawId) : [...prev, rawId])}
                               className={`w-10 h-10 rounded border shrink-0 cursor-pointer overflow-hidden transition-all relative ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700 hover:border-gray-500'}`}>
                               <img src={att.url} className="w-full h-full object-cover" alt="Attachment" />
                               {isSelected && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><Check size={16} className="text-white drop-shadow-md"/></div>}
                            </div>
                          );
                       })}
                       <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded border border-dashed border-gray-700 flex items-center justify-center text-gray-600 hover:text-blue-400 hover:border-blue-500"><Plus size={16}/></button>
                    </div>
                  </div>
               </div>
            ) : (
               <>
                  {note.resolvedImageUrls.length > 0 && (
                     <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {note.resolvedImageUrls.map((url, i) => (
                           <div key={i} className="relative group/side-img cursor-zoom-in rounded overflow-hidden border border-gray-700 aspect-video bg-black/20" onClick={(e) => { e.stopPropagation(); setFullScreenImageUrl(url); }}>
                              <img src={url} className="w-full h-full object-cover" alt="Static Note" />
                           </div>
                        ))}
                     </div>
                  )}
                  {note.ruby && (
                      <div className="text-[10px] text-orange-400/80 font-bold mb-1">注音: {note.ruby}</div>
                  )}
                  <p className={`text-xs leading-relaxed whitespace-pre-wrap mb-2 ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>{note.content}</p>
                  
                  {/* Display Links in Side Note */}
                  {(note.personIds.length + note.locationIds.length + note.eventIds.length + note.keywordIds.length) > 0 && (
                     <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-800">
                        {note.personIds.map(id => <button key={id} onClick={() => onJumpToPerson?.(id)} className="bg-blue-900/30 hover:bg-blue-900/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-blue-300 transition-colors"><User size={8}/>{personOptions.find(o => o.value === id)?.label}</button>)}
                        {note.locationIds.map(id => <button key={id} onClick={() => onJumpToLocation?.(id)} className="bg-emerald-900/30 hover:bg-emerald-900/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-emerald-300 transition-colors"><MapPin size={8}/>{locationOptions.find(o => o.value === id)?.label}</button>)}
                        {note.eventIds.map(id => <button key={id} onClick={() => onJumpToEvent?.(id)} className="bg-orange-900/30 hover:bg-orange-900/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-orange-300 transition-colors"><Calendar size={8}/>{eventOptions.find(o => o.value === id)?.label}</button>)}
                        {note.keywordIds.map(id => <button key={id} onClick={() => onJumpToKeyword?.(id)} className="bg-indigo-900/30 hover:bg-indigo-900/50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-indigo-300 transition-colors"><LinkIcon size={8}/>{keywordOptions.find(o => o.value === id)?.label}</button>)}
                     </div>
                  )}
               </>
            )}
          </div>
        );
      })}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleQuickUpload} />
    </div>
  );

  const activeRubyNode = useMemo(() => {
    const findInTree = (nodes: SyntaxNode[]): SyntaxNode | undefined => {
      for(const node of nodes) {
        if(node.id === activeRubyId) return node;
        if(Array.isArray(node.content)) {
          const found = findInTree(node.content);
          if(found) return found;
        }
      }
    };
    return findInTree(tree);
  }, [tree, activeRubyId]);

  return (
    <div className="relative w-full" ref={containerRef} onMouseUp={handleMouseUp} onClick={() => { setActiveRubyId(null); setActiveNoteId(null); }}>
      <div className="prose prose-invert prose-sm max-none text-gray-300 leading-loose whitespace-pre-wrap font-sans">{renderTree(tree)}</div>
      
      {activeRubyId && activeRubyNode && rubyToolbarPos && (
        <div className="fixed z-[100] animate-scale-in" style={{ left: rubyToolbarPos.left, top: rubyToolbarPos.top - 10, transform: 'translate(-50%, -100%)' }} onClick={e => e.stopPropagation()}>
           <div className="bg-gray-900 border border-orange-500 shadow-2xl rounded-lg flex items-center h-10 px-1 gap-1">
              <div className="flex items-center gap-1 px-1">
                {!confirmingRubyDelete ? (
                   <input autoFocus className="bg-transparent border-none outline-none text-sm text-white w-28 ml-1" 
                    value={rubyEditValue} onChange={e => setRubyEditValue(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateRuby(activeRubyNode); if (e.key === 'Escape') setActiveRubyId(null); }} />
                ) : (
                   <span className="text-[10px] text-red-400 font-bold px-3 select-none">确定删除读音？</span>
                )}
                
                {!confirmingRubyDelete && (
                  <button onClick={() => handleUpdateRuby(activeRubyNode)} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded"><Check size={14}/></button>
                )}
                <button onClick={() => handleDeleteRubyConfirm(activeRubyNode)} className={`p-1.5 rounded transition-all ${confirmingRubyDelete ? 'text-red-500 bg-red-500/10' : 'text-red-400 hover:bg-red-500/10'}`}>
                  {confirmingRubyDelete ? <AlertCircle size={14} className="animate-pulse" /> : <Trash2 size={14}/>}
                </button>
                <button onClick={() => setActiveRubyId(null)} className="p-1.5 text-gray-500"><X size={14}/></button>
              </div>
           </div>
           <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-orange-500 mx-auto" />
        </div>
      )}

      {selectionInfo && annoMode !== 'NONE' && (
        <div className="fixed z-[100] animate-scale-in" style={{ left: selectionInfo.rect.left + (selectionInfo.rect.width / 2), top: selectionInfo.rect.top - 10, transform: 'translate(-50%, -100%)' }}>
          <div className={`bg-gray-900 border border-blue-500 shadow-2xl rounded-xl p-3 flex flex-col gap-3 ${annoMode === 'SELECT' ? 'items-center' : 'w-72'}`}>
            {annoMode === 'SELECT' ? (
              <button onClick={() => setAnnoMode('INPUT')} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95">
                 <Plus size={16}/> 添加标注
              </button>
            ) : (
              <div className="space-y-3 animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-orange-400 uppercase tracking-wider"><Type size={12}/> 注音 (Ruby)</div>
                   <input autoFocus className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-orange-500" placeholder="在此输入注音..." value={annoValues.ruby} onChange={e => setAnnoValues({...annoValues, ruby: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleApplyAnnotation()} />
                </div>
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider"><MessageSquare size={12}/> 注释 (Note)</div>
                   <textarea className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500 h-20 resize-none" placeholder="在此输入注释..." value={annoValues.note} onChange={e => setAnnoValues({...annoValues, note: e.target.value})} />
                </div>
                <div className="flex gap-2 pt-1">
                   <button onClick={handleApplyAnnotation} disabled={!annoValues.ruby && !annoValues.note} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all">
                      <Check size={14}/> 确定
                   </button>
                   <button onClick={() => setAnnoMode('SELECT')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-1.5 rounded-lg text-xs">取消</button>
                </div>
              </div>
            )}
            {annoMode === 'SELECT' && (
                <button onClick={() => { setAnnoMode('NONE'); setSelectionInfo(null); }} className="absolute -top-2 -right-2 bg-gray-800 border border-gray-700 rounded-full p-1 text-gray-500 hover:text-white shadow-xl"><X size={12}/></button>
            )}
          </div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-500 mx-auto" />
        </div>
      )}

      {fullScreenImageUrl && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in cursor-zoom-out"
          onClick={() => setFullScreenImageUrl(null)}
        >
          <button 
            className="absolute top-8 right-8 p-2 bg-gray-800/50 hover:bg-gray-700 text-white rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setFullScreenImageUrl(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={fullScreenImageUrl} 
            className="max-w-full max-h-full object-contain shadow-2xl animate-scale-in border border-gray-800" 
            alt="Full screen" 
          />
        </div>
      )}

      {showNotes && noteLayout === 'SIDE' && sideNotesPortal && ReactDOM.createPortal(sideNotesContent, sideNotesPortal)}
    </div>
  );
};