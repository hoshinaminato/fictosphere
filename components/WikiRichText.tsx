import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';

interface WikiRichTextProps {
  text: string;
  showRuby: boolean;
  showNotes: boolean;
  noteLayout: 'HOVER' | 'SIDE';
}

interface NoteData {
  id: string;
  anchorText: string;
  content: string;
  imageUrl?: string;
  index: number;
}

// 定义语法树节点类型
interface SyntaxNode {
  type: 'text' | 'note' | 'ruby';
  content: string | SyntaxNode[]; // 文本节点存字符串，容器节点存子节点数组
  value?: string;
  id?: string;
}

export const WikiRichText: React.FC<WikiRichTextProps> = ({ text, showRuby, showNotes, noteLayout }) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [sideNotesPortal, setSideNotesPortal] = useState<Element | null>(null);

  useEffect(() => {
    const portal = document.getElementById('wiki-side-notes-container');
    setSideNotesPortal(portal);
  }, [noteLayout, showNotes]);

  /**
   * 递归解析器：将 [content]{type:value} 结构解析为树
   */
  const parseToTree = (input: string): SyntaxNode[] => {
    const nodes: SyntaxNode[] = [];
    let i = 0;

    while (i < input.length) {
      if (input[i] === '[') {
        // 1. 寻找匹配的闭合括号 ] (考虑嵌套)
        let bracketLevel = 1;
        let j = i + 1;
        while (j < input.length && bracketLevel > 0) {
          if (input[j] === '[') bracketLevel++;
          if (input[j] === ']') bracketLevel--;
          j++;
        }

        // 2. 检查紧随其后的元数据 {type:value}
        if (j < input.length && input[j] === '{') {
          const k = input.indexOf('}', j);
          if (k !== -1) {
            const innerText = input.substring(i + 1, j - 1);
            const meta = input.substring(j + 1, k); // "note:xxx" 或 "ruby:xxx"
            const [type, ...valParts] = meta.split(':');
            const value = valParts.join(':');

            if (type === 'note' || type === 'ruby') {
              nodes.push({
                type: type as 'note' | 'ruby',
                content: parseToTree(innerText), // 递归解析内部文本
                value: value,
                id: `node-${i}-${j}-${k}` // 唯一标识
              });
              i = k + 1;
              continue;
            }
          }
        }
      }
      
      // 处理普通文本段落
      let textContent = '';
      while (i < input.length && input[i] !== '[') {
        textContent += input[i];
        i++;
      }
      if (textContent) nodes.push({ type: 'text', content: textContent });
    }
    return nodes;
  };

  /**
   * 递归提取所有注释条目，用于侧边栏平铺显示
   */
  const extractFlatNotes = (nodes: SyntaxNode[], list: NoteData[] = []) => {
    nodes.forEach(node => {
      if (node.type === 'note') {
        let content = node.value || '';
        let imageUrl = undefined;
        if (content.includes('|img:')) {
          const [txt, imgPart] = content.split('|img:');
          content = txt;
          imageUrl = imgPart;
        }

        // 递归获取锚点文本的纯文本形式
        const getPlainText = (n: string | SyntaxNode[]): string => {
          if (typeof n === 'string') return n;
          return n.map(child => (child.type === 'text' ? child.content as string : getPlainText(child.content))).join('');
        };

        list.push({
          id: node.id!,
          anchorText: getPlainText(node.content),
          content: content,
          imageUrl: imageUrl,
          index: list.length + 1
        });
      }
      if (Array.isArray(node.content)) {
        extractFlatNotes(node.content, list);
      }
    });
    return list;
  };

  const { tree, flattenedNotes } = useMemo(() => {
    const t = parseToTree(text);
    const n = extractFlatNotes(t);
    return { tree: t, flattenedNotes: n };
  }, [text]);

  /**
   * 递归渲染语法树
   */
  const renderTree = (nodes: SyntaxNode[]): React.ReactNode => {
    return nodes.map((node, idx) => {
      if (node.type === 'text') {
        return <span key={idx}>{node.content as string}</span>;
      }

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
          <span 
            key={node.id} 
            id={`anchor-${node.id}`}
            className={`
              relative cursor-pointer transition-all inline px-0.5 rounded
              ${showNotes ? 'border-b-2 border-dashed border-blue-500/40 hover:bg-blue-500/10' : ''}
              ${isActive ? 'bg-blue-500/30 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : ''}
              ${isHovered ? 'bg-blue-500/10' : ''}
            `}
            onMouseEnter={(e) => { e.stopPropagation(); showNotes && setHoveredNoteId(node.id!); }}
            onMouseLeave={() => setHoveredNoteId(null)}
            onClick={(e) => {
               if (!showNotes) return;
               e.stopPropagation(); // 阻止点击事件向上传递给父级注释
               setActiveNoteId(node.id!);
               if (noteLayout === 'SIDE') {
                  const noteEl = document.getElementById(`side-card-${node.id}`);
                  noteEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
               }
            }}
          >
            {renderTree(node.content as SyntaxNode[])}
            
            {showNotes && (
               <span className="text-[8px] font-bold text-blue-400 ml-0.5 align-top opacity-60">[{noteInfo?.index}]</span>
            )}

            {showNotes && noteLayout === 'HOVER' && isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-blue-500 rounded-lg shadow-2xl z-50 animate-scale-in text-xs cursor-default">
                <div className="flex items-center gap-2 text-blue-400 font-bold mb-2 pb-1 border-b border-gray-800">
                  <MessageSquare size={12}/> 注释 [{noteInfo?.index}]
                </div>
                {noteInfo?.imageUrl && <img src={noteInfo.imageUrl} className="w-full rounded mb-2 border border-gray-800" alt="Note" />}
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
      {flattenedNotes.map(note => (
        <div 
          key={note.id}
          id={`side-card-${note.id}`}
          className={`
            p-3 rounded-lg border transition-all duration-300 group cursor-pointer
            ${activeNoteId === note.id 
               ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/50' 
               : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 hover:bg-gray-800/60'}
            ${hoveredNoteId === note.id ? 'border-gray-600' : ''}
          `}
          onMouseEnter={() => setHoveredNoteId(note.id)}
          onMouseLeave={() => setHoveredNoteId(null)}
          onClick={() => {
             setActiveNoteId(note.id);
             const anchorEl = document.getElementById(`anchor-${note.id}`);
             anchorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <div className="flex items-center justify-between mb-2">
             <div className={`flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${activeNoteId === note.id ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                <MessageSquare size={12}/> 注释 [{note.index}]
             </div>
             {activeNoteId === note.id && (
                <div className="text-[9px] text-blue-500 flex items-center gap-1 animate-pulse">
                   当前聚焦 <ArrowRight size={10}/>
                </div>
             )}
          </div>
          <div className={`text-[11px] font-bold mb-1 line-clamp-1 ${activeNoteId === note.id ? 'text-blue-200' : 'text-gray-400'}`}>
             原文: "{note.anchorText}"
          </div>
          {note.imageUrl && (
             <div className="mb-2 rounded overflow-hidden border border-gray-700 shadow-inner bg-black/20">
                <img src={note.imageUrl} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Note" />
             </div>
          )}
          <p className={`text-xs leading-relaxed whitespace-pre-wrap ${activeNoteId === note.id ? 'text-gray-200' : 'text-gray-400'}`}>
             {note.content}
          </p>
        </div>
      ))}
      {flattenedNotes.length === 0 && (
         <div className="text-center py-20 text-gray-600 italic text-xs">
            该词条描述中暂无注释内容
         </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full">
      <div className="prose prose-invert prose-sm max-none text-gray-300 leading-loose whitespace-pre-wrap font-sans">
        {renderTree(tree)}
      </div>

      {showNotes && noteLayout === 'SIDE' && sideNotesPortal && 
        ReactDOM.createPortal(sideNotesContent, sideNotesPortal)}
    </div>
  );
};