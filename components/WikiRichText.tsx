import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, ArrowRight, Type, Check, X, Edit2, Save, Trash2, Image as ImageIcon, Upload, Paperclip, Plus, AlertCircle } from 'lucide-react';
import { Attachment } from '../types';

interface WikiRichTextProps {
  text: string;
  showRuby: boolean;
  showNotes: boolean;
  noteLayout: 'HOVER' | 'SIDE';
  attachments?: Attachment[];
  onAddAnnotation?: (original: string, replacement: string) => void;
  onUpdateNote?: (oldFullContent: string, newFullContent: string) => void;
  onRemoveAnnotation?: (oldFullContent: string, anchorText: string) => void;
  onUploadFile?: (file: File) => Promise<Attachment>; // 返回完整的附件对象
}

interface NoteData {
  id: string;
  anchorText: string;
  content: string;
  rawNoteValue: string; 
  rawImageUrl?: string; // 存储原始协议字符串 (如 att:123)
  resolvedImageUrl?: string; // 渲染用的真实路径
  index: number;
}

interface SyntaxNode {
  type: 'text' | 'note' | 'ruby';
  content: string | SyntaxNode[];
  value?: string;
  id?: string;
}

export const WikiRichText: React.FC<WikiRichTextProps> = ({ 
  text, 
  showRuby, 
  showNotes, 
  noteLayout, 
  attachments = [],
  onAddAnnotation, 
  onUpdateNote,
  onRemoveAnnotation,
  onUploadFile
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [sideNotesPortal, setSideNotesPortal] = useState<Element | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 状态管理 ---
  const [selectionInfo, setSelectionInfo] = useState<{text: string, rect: DOMRect} | null>(null);
  const [annoMode, setAnnoMode] = useState<'NONE' | 'SELECT' | 'RUBY_INPUT' | 'NOTE_INPUT'>('NONE');
  const [annoValue, setAnnoValue] = useState('');

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null); // 这里存的是 raw 协议或真实 URL
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const portal = document.getElementById('wiki-side-notes-container');
    setSideNotesPortal(portal);
  }, [noteLayout, showNotes]);

  // --- 协议解析逻辑 ---
  const resolveImageUrl = (rawPath: string | undefined): string | undefined => {
    if (!rawPath) return undefined;
    if (rawPath.startsWith('att:')) {
      const attId = rawPath.replace('att:', '');
      return attachments.find(a => a.id === attId)?.url;
    }
    return rawPath;
  };

  const handleMouseUp = () => {
    if (annoMode !== 'NONE' && annoMode !== 'SELECT') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionInfo(null);
      setAnnoMode('NONE');
      return;
    }
    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    if (containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
      setSelectionInfo({ text: selectedText, rect: range.getBoundingClientRect() });
      setAnnoMode('SELECT');
      setAnnoValue('');
    }
  };

  const handleApplyAnnotation = () => {
    if (!selectionInfo || !onAddAnnotation) return;
    let replacement = '';
    if (annoMode === 'RUBY_INPUT') replacement = `[${selectionInfo.text}]{ruby:${annoValue}}`;
    else if (annoMode === 'NOTE_INPUT') replacement = `[${selectionInfo.text}]{note:${annoValue}}`;
    if (replacement) onAddAnnotation(selectionInfo.text, replacement);
    setSelectionInfo(null);
    setAnnoMode('NONE');
    setAnnoValue('');
    window.getSelection()?.removeAllRanges();
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;
    try {
      const newAtt = await onUploadFile(file);
      // 使用协议引用，不存 base64
      setEditingImageUrl(`att:${newAtt.id}`);
    } catch (err) {
      console.error(err);
      alert("上传失败");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveSideEdit = (note: NoteData) => {
    if (!onUpdateNote) return;
    let newValue = editingValue;
    if (editingImageUrl) newValue = `${newValue}|img:${editingImageUrl}`;
    const oldFull = `[${note.anchorText}]{note:${note.rawNoteValue}}`;
    const newFull = `[${note.anchorText}]{note:${newValue}}`;
    onUpdateNote(oldFull, newFull);
    setEditingNoteId(null);
    setEditingValue('');
    setEditingImageUrl(null);
  };

  const handleDeleteAnnotation = (note: NoteData) => {
    if (!onRemoveAnnotation) return;
    const oldFull = `[${note.anchorText}]{note:${note.rawNoteValue}}`;
    onRemoveAnnotation(oldFull, note.anchorText);
    setDeletingNoteId(null);
  };

  // --- 解析语法树 ---
  const parseToTree = (input: string): SyntaxNode[] => {
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
            const [type, ...valParts] = meta.split(':');
            const value = valParts.join(':');
            if (type === 'note' || type === 'ruby') {
              nodes.push({ type: type as 'note' | 'ruby', content: parseToTree(innerText), value: value, id: `node-${i}-${j}-${k}` });
              i = k + 1; continue;
            }
          }
        }
      }
      let textContent = '';
      while (i < input.length && input[i] !== '[') { textContent += input[i]; i++; }
      if (textContent) nodes.push({ type: 'text', content: textContent });
    }
    return nodes;
  };

  const extractFlatNotes = (nodes: SyntaxNode[], list: NoteData[] = []) => {
    nodes.forEach(node => {
      if (node.type === 'note') {
        const rawVal = node.value || '';
        let content = rawVal;
        let rawImageUrl = undefined;
        if (content.includes('|img:')) {
          const [txt, imgPart] = content.split('|img:');
          content = txt;
          rawImageUrl = imgPart;
        }
        const getPlainText = (n: string | SyntaxNode[]): string => {
          if (typeof n === 'string') return n;
          return n.map(child => (child.type === 'text' ? child.content as string : getPlainText(child.content))).join('');
        };
        list.push({ 
          id: node.id!, 
          anchorText: getPlainText(node.content), 
          content, 
          rawNoteValue: rawVal, 
          rawImageUrl, 
          resolvedImageUrl: resolveImageUrl(rawImageUrl),
          index: list.length + 1 
        });
      }
      if (Array.isArray(node.content)) extractFlatNotes(node.content, list);
    });
    return list;
  };

  const { tree, flattenedNotes } = useMemo(() => {
    const t = parseToTree(text);
    const n = extractFlatNotes(t);
    return { tree: t, flattenedNotes: n };
  }, [text, attachments]); // 依赖附件列表，附件变化时重新解析 URL

  const renderTree = (nodes: SyntaxNode[]): React.ReactNode => {
    return nodes.map((node, idx) => {
      if (node.type === 'text') return <span key={idx}>{node.content as string}</span>;
      if (node.type === 'ruby') {
        return (
          <ruby key={node.id} className="px-0.5 border-b border-orange-500/20 transition-colors hover:border-orange-500">
            {renderTree(node.content as SyntaxNode[])}
            {showRuby && <rt className="text-[10px] text-orange-400 font-bold select-none">{node.value}</rt>}
          </ruby>
        );
      }
      if (node.type === 'note') {
        const noteInfo = flattenedNotes.find(n => n.id === node.id);
        const isActive = activeNoteId === node.id;
        const isHovered = hoveredNoteId === node.id;
        return (
          <span key={node.id} id={`anchor-${node.id}`}
            className={`relative cursor-pointer transition-all inline px-0.5 rounded ${showNotes ? 'border-b-2 border-dashed border-blue-500/40 hover:bg-blue-500/10' : ''} ${isActive ? 'bg-blue-500/30 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : ''} ${isHovered ? 'bg-blue-500/10' : ''}`}
            onMouseEnter={(e) => { e.stopPropagation(); showNotes && setHoveredNoteId(node.id!); }}
            onMouseLeave={() => setHoveredNoteId(null)}
            onClick={(e) => {
               if (!showNotes) return;
               e.stopPropagation();
               setActiveNoteId(node.id!);
               if (noteLayout === 'SIDE') {
                  const noteEl = document.getElementById(`side-card-${node.id}`);
                  noteEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
               }
            }}
          >
            {renderTree(node.content as SyntaxNode[])}
            {showNotes && <span className="text-[8px] font-bold text-blue-400 ml-0.5 align-top opacity-60">[{noteInfo?.index}]</span>}
            {showNotes && noteLayout === 'HOVER' && isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-blue-500 rounded-lg shadow-2xl z-50 animate-scale-in text-xs cursor-default">
                <div className="flex items-center gap-2 text-blue-400 font-bold mb-2 pb-1 border-b border-gray-800">
                  <MessageSquare size={12}/> 注释 [{noteInfo?.index}]
                </div>
                {noteInfo?.resolvedImageUrl ? (
                   <img src={noteInfo.resolvedImageUrl} className="w-full rounded mb-2 border border-gray-800" alt="Note" />
                ) : noteInfo?.rawImageUrl?.startsWith('att:') ? (
                   <div className="flex items-center gap-2 text-red-400 text-[10px] bg-red-900/10 p-2 rounded mb-2 border border-red-900/20">
                      <AlertCircle size={10}/> 引用附件已丢失
                   </div>
                ) : null}
                <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{noteInfo?.content}</p>
              </div>
            )}
          </span>
        );
      }
      return null;
    });
  };

  const sideNotesContent = (
    <div className="animate-fade-in space-y-4">
      {flattenedNotes.map(note => {
        const isEditing = editingNoteId === note.id;
        const isDeleting = deletingNoteId === note.id;
        // Fix: Changed 'node.id' to 'note.id' to correctly reference the current iteration variable in the map callback
        const isActive = activeNoteId === note.id;
        const imageAttachments = attachments.filter(a => a.type === 'IMAGE');
        const resolvedCurrentEditUrl = resolveImageUrl(editingImageUrl || '');

        return (
          <div key={note.id} id={`side-card-${note.id}`}
            className={`p-3 rounded-lg border transition-all duration-300 group cursor-pointer ${isActive ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/50' : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 hover:bg-gray-800/60'} ${hoveredNoteId === note.id ? 'border-gray-600' : ''} ${isDeleting ? 'border-red-500/50 bg-red-900/10' : ''}`}
            onMouseEnter={() => setHoveredNoteId(note.id)}
            onMouseLeave={() => setHoveredNoteId(null)}
            onClick={() => {
               setActiveNoteId(note.id);
               const anchorEl = document.getElementById(`anchor-${note.id}`);
               anchorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <div className="flex items-center justify-between mb-2">
               <div className={`flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                  <MessageSquare size={12}/> 注释 [{note.index}]
               </div>
               <div className="flex items-center gap-2">
                  {!isEditing && !isDeleting && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(note.id); setEditingValue(note.content); setEditingImageUrl(note.rawImageUrl || null); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-blue-400 transition-colors"><Edit2 size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingNoteId(note.id); }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
                    </>
                  )}
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleSaveSideEdit(note); }}
                        className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm transition-colors"><Save size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(null); setEditingImageUrl(null); }}
                        className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shadow-sm transition-colors"><X size={12}/></button>
                    </div>
                  )}
                  {isDeleting && (
                    <div className="flex items-center gap-1 bg-red-950/50 p-0.5 rounded border border-red-900/50">
                      <span className="text-[9px] text-red-400 px-1 font-bold">确认删除?</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(note); }}
                        className="p-1 bg-red-600 hover:bg-red-500 text-white rounded shadow-sm transition-colors"><Check size={12}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingNoteId(null); }}
                        className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded shadow-sm transition-colors"><X size={12}/></button>
                    </div>
                  )}
               </div>
            </div>

            <div className={`text-[11px] font-bold mb-1 line-clamp-1 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>原文: "{note.anchorText}"</div>

            {/* 图片预览区 */}
            {isEditing ? (
               resolvedCurrentEditUrl ? (
                  <div className="mb-2 rounded overflow-hidden border border-gray-700 shadow-inner bg-black/20 relative group">
                     <img src={resolvedCurrentEditUrl} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Note" />
                     <button onClick={(e) => { e.stopPropagation(); setEditingImageUrl(null); }} className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                  </div>
               ) : null
            ) : (
               note.resolvedImageUrl ? (
                  <div className="mb-2 rounded overflow-hidden border border-gray-700 shadow-inner bg-black/20">
                     <img src={note.resolvedImageUrl} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Note" />
                  </div>
               ) : note.rawImageUrl?.startsWith('att:') ? (
                  <div className="mb-2 flex items-center gap-2 text-red-400 text-[10px] bg-red-900/10 p-2 rounded border border-red-900/20">
                     <AlertCircle size={10}/> 引用附件已丢失
                  </div>
               ) : null
            )}

            {isEditing ? (
              <div className="space-y-3" onClick={e => e.stopPropagation()}>
                <textarea autoFocus className="w-full bg-gray-950 border border-blue-500/50 rounded p-2 text-xs text-white outline-none focus:border-blue-500 min-h-[60px] resize-none font-sans leading-relaxed"
                  value={editingValue} onChange={e => setEditingValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveSideEdit(note); if (e.key === 'Escape') { setEditingNoteId(null); setEditingImageUrl(null); } }} />
                
                {/* 快捷附件引用工具条 */}
                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1"><Paperclip size={10}/> 词条附件库 (快捷引用)</span>
                      <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 border border-blue-900/50 px-2 py-0.5 rounded bg-blue-900/10 transition-colors"><Plus size={10}/> 上传并引用</button>
                   </div>
                   <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar min-h-[44px]">
                      {imageAttachments.map(att => (
                         <div key={att.id} onClick={() => setEditingImageUrl(`att:${att.id}`)}
                            className={`w-10 h-10 rounded border shrink-0 cursor-pointer overflow-hidden transition-all relative ${editingImageUrl === `att:${att.id}` ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105 z-10' : 'border-gray-700 hover:border-gray-500'}`}>
                            <img src={att.url} className="w-full h-full object-cover" alt="Attachment" />
                            {editingImageUrl === `att:${att.id}` && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><Check size={14} className="text-white drop-shadow-md"/></div>}
                         </div>
                      ))}
                      {imageAttachments.length === 0 && <div className="text-[9px] text-gray-600 italic py-3 px-1">当前词条尚无图片附件</div>}
                   </div>
                </div>
              </div>
            ) : (
              <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>{note.content}</p>
            )}
          </div>
        );
      })}
      {flattenedNotes.length === 0 && <div className="text-center py-20 text-gray-600 italic text-xs">该词条描述中暂无注释内容</div>}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleQuickUpload} />
    </div>
  );

  return (
    <div className="relative w-full" ref={containerRef} onMouseUp={handleMouseUp}>
      <div className="prose prose-invert prose-sm max-none text-gray-300 leading-loose whitespace-pre-wrap font-sans">{renderTree(tree)}</div>
      {selectionInfo && annoMode !== 'NONE' && (
        <div className="fixed z-[100] animate-scale-in" style={{ left: selectionInfo.rect.left + (selectionInfo.rect.width / 2), top: selectionInfo.rect.top - 10, transform: 'translate(-50%, -100%)' }}>
          <div className="bg-gray-900 border border-blue-500 shadow-2xl rounded-lg flex items-center overflow-hidden h-10 px-1 gap-1">
            {annoMode === 'SELECT' ? (
              <><button onClick={() => setAnnoMode('RUBY_INPUT')} className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded transition-colors"><Type size={14}/> 注音</button><div className="w-px h-4 bg-gray-800" /><button onClick={() => setAnnoMode('NOTE_INPUT')} className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-gray-300 hover:bg-blue-600 hover:text-white rounded transition-colors"><MessageSquare size={14}/> 注释</button><button onClick={() => { setAnnoMode('NONE'); setSelectionInfo(null); }} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><X size={14}/></button></>
            ) : (
              <div className="flex items-center gap-1 px-1">
                <div className="text-[10px] text-blue-500 font-bold px-2 whitespace-nowrap">{annoMode === 'RUBY_INPUT' ? '注音:' : '注释:'}</div>
                <input autoFocus className="bg-transparent border-none outline-none text-sm text-white w-40 placeholder-gray-600" placeholder={annoMode === 'RUBY_INPUT' ? "输入拼音/音标..." : "输入注释正文..."} value={annoValue} onChange={e => setAnnoValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleApplyAnnotation(); if (e.key === 'Escape') setAnnoMode('SELECT'); }} />
                <button onClick={handleApplyAnnotation} disabled={!annoValue.trim()} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-30 transition-all"><Check size={14}/></button>
                <button onClick={() => setAnnoMode('SELECT')} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"><X size={14}/></button>
              </div>
            )}
          </div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-500 mx-auto" />
        </div>
      )}
      {showNotes && noteLayout === 'SIDE' && sideNotesPortal && ReactDOM.createPortal(sideNotesContent, sideNotesPortal)}
    </div>
  );
};