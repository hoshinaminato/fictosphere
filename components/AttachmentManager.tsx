
import React, { useRef, useState } from 'react';
import { Attachment } from '../types';
import { Paperclip, Image, Film, Music, File, Link as LinkIcon, Trash2, Plus, X, Upload, ExternalLink, MessageSquare } from 'lucide-react';

interface AttachmentManagerProps {
  attachments: Attachment[];
  onUpdate: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ attachments = [], onUpdate, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let url = '';
      
      // Try Electron upload
      if (window.electronAPI) {
         try {
            const buffer = await file.arrayBuffer();
            url = await window.electronAPI.saveAsset(buffer, file.name);
         } catch (err) {
            console.error("Upload failed", err);
            alert(`文件 ${file.name} 上传失败`);
            continue;
         }
      } else {
         // Browser Fallback (Base64) - mostly for dev
         const reader = new FileReader();
         url = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
         });
      }

      // Determine Type
      let type: Attachment['type'] = 'FILE';
      if (file.type.startsWith('image/')) type = 'IMAGE';
      else if (file.type.startsWith('video/')) type = 'VIDEO';
      else if (file.type.startsWith('audio/')) type = 'AUDIO';

      newAttachments.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type,
        url,
        date: new Date().toISOString(),
        size: (file.size / 1024).toFixed(1) + ' KB',
        description: '' // Init empty description
      });
    }

    onUpdate([...attachments, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = () => {
    if (!newLinkUrl) return;
    const name = newLinkName || newLinkUrl;
    const newAtt: Attachment = {
       id: Math.random().toString(36).substr(2, 9),
       name: name,
       type: 'LINK',
       url: newLinkUrl,
       date: new Date().toISOString(),
       description: newLinkDesc
    };
    onUpdate([...attachments, newAtt]);
    setNewLinkUrl('');
    setNewLinkName('');
    setNewLinkDesc('');
    setIsAddingLink(false);
  };

  const handleDelete = (id: string) => {
    onUpdate(attachments.filter(a => a.id !== id));
  };

  const handleUpdateDescription = (id: string, desc: string) => {
    const newAttachments = attachments.map(a => a.id === id ? { ...a, description: desc } : a);
    onUpdate(newAttachments);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'IMAGE': return <Image size={16} className="text-purple-400" />;
      case 'VIDEO': return <Film size={16} className="text-red-400" />;
      case 'AUDIO': return <Music size={16} className="text-green-400" />;
      case 'LINK': return <LinkIcon size={16} className="text-blue-400" />;
      default: return <File size={16} className="text-gray-400" />;
    }
  };

  const renderPreview = (att: Attachment) => {
     if (att.type === 'IMAGE') {
        return (
           <div className="w-16 h-16 bg-gray-900 rounded border border-gray-700 overflow-hidden shrink-0 relative group">
              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <a href={att.url} target="_blank" rel="noreferrer" title="查看原图"><ExternalLink size={12} className="text-white"/></a>
              </div>
           </div>
        );
     }
     if (att.type === 'VIDEO') {
        return (
           <div className="w-32 h-20 bg-black rounded border border-gray-700 overflow-hidden shrink-0 relative group">
              <video src={att.url} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <Film size={20} className="text-white/70" />
              </div>
              <a href={att.url} target="_blank" rel="noreferrer" className="absolute inset-0 z-10 block" title="播放视频"></a>
           </div>
        );
     }
     if (att.type === 'AUDIO') {
        return (
           <div className="w-full bg-gray-900 rounded p-2 border border-gray-700">
              <audio src={att.url} controls className="w-full h-6" />
           </div>
        );
     }
     return null;
  };

  return (
    <div className="space-y-3">
       {/* Header / Controls */}
       {!readOnly && (
         <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 flex-1">
               <Paperclip size={12}/> 附件 ({attachments.length})
            </h4>
            <button 
               onClick={() => setIsAddingLink(!isAddingLink)}
               className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-gray-700"
               title="添加链接"
            >
               <LinkIcon size={12}/>
            </button>
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 hover:text-white rounded border border-blue-800"
               title="上传文件 (支持多选)"
            >
               <Upload size={12}/>
            </button>
            <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               multiple 
               onChange={handleFileUpload}
            />
         </div>
       )}

       {/* Link Input */}
       {isAddingLink && (
          <div className="bg-gray-800 p-2 rounded border border-gray-700 space-y-2 animate-fade-in">
             <input 
                value={newLinkName}
                onChange={e => setNewLinkName(e.target.value)}
                placeholder="标题 (可选)"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
             />
             <div className="flex gap-2">
                <input 
                   value={newLinkUrl}
                   onChange={e => setNewLinkUrl(e.target.value)}
                   placeholder="URL (https://...)"
                   className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                />
             </div>
             <textarea 
                value={newLinkDesc}
                onChange={e => setNewLinkDesc(e.target.value)}
                placeholder="描述..."
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white resize-none h-16"
             />
             <div className="flex justify-end">
                <button onClick={handleAddLink} disabled={!newLinkUrl} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">添加</button>
             </div>
          </div>
       )}

       {/* List */}
       <div className="space-y-2">
          {attachments.map((att) => (
             <div key={att.id} className="bg-gray-800/40 border border-gray-700 rounded p-2 text-sm group">
                <div className="flex items-start gap-2 mb-2">
                   <div className="mt-0.5">{getIcon(att.type)}</div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <a href={att.url} target="_blank" rel="noreferrer" className="font-medium text-gray-300 hover:text-blue-400 truncate underline decoration-gray-600 hover:decoration-blue-400">
                           {att.name}
                         </a>
                         {!readOnly && (
                           <button onClick={() => handleDelete(att.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={12}/>
                           </button>
                         )}
                      </div>
                      <div className="text-[10px] text-gray-600 flex gap-2">
                         <span>{att.type}</span>
                         {att.size && <span>{att.size}</span>}
                         <span>{new Date(att.date || '').toLocaleDateString()}</span>
                      </div>
                   </div>
                </div>
                
                {/* Previews Area */}
                {(att.type === 'IMAGE' || att.type === 'VIDEO' || att.type === 'AUDIO') && (
                   <div className="mt-1 mb-2">
                      {renderPreview(att)}
                   </div>
                )}

                {/* Description Input */}
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                   {readOnly ? (
                      att.description ? (
                         <div className="text-xs text-gray-400 italic flex gap-1">
                            <MessageSquare size={10} className="mt-0.5 shrink-0"/>
                            {att.description}
                         </div>
                      ) : null
                   ) : (
                      <div className="relative">
                         <MessageSquare size={10} className="absolute left-2 top-2 text-gray-500"/>
                         <textarea
                            value={att.description || ''}
                            onChange={(e) => handleUpdateDescription(att.id, e.target.value)}
                            placeholder="添加描述..."
                            className="w-full bg-gray-900/50 border border-gray-700 rounded pl-6 pr-2 py-1 text-xs text-gray-300 focus:border-blue-500 outline-none resize-none overflow-hidden min-h-[30px]"
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                               const target = e.target as HTMLTextAreaElement;
                               target.style.height = 'auto';
                               target.style.height = `${target.scrollHeight}px`;
                            }}
                         />
                      </div>
                   )}
                </div>
             </div>
          ))}

          {attachments.length === 0 && !readOnly && (
             <div className="text-center py-4 text-xs text-gray-600 border border-dashed border-gray-800 rounded">
                暂无附件。点击上方按钮添加图片、音视频或文件。
             </div>
          )}
       </div>
    </div>
  );
};
