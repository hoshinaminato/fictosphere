
import React, { useState } from 'react';
import { Upload, X, Check, Sparkles, Copy, ArrowLeft, FileJson, AlertTriangle, PackageOpen } from 'lucide-react';
import { Project, ExportData } from '../../types';
import { validateProject } from '../../services/validator';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingImportData: ExportData | null;
  projects: Project[];
  currentProjectId: string;
  importMode: 'OVERWRITE' | 'NEW_USER' | 'SELECT_USER';
  setImportMode: (mode: 'OVERWRITE' | 'NEW_USER' | 'SELECT_USER') => void;
  targetImportId: string;
  setTargetImportId: (id: string) => void;
  onConfirmImport: () => void;
  onTriggerFileUpload?: () => void;
}

const AI_PROMPT_TEMPLATE = `你是一个名为 "Fictosphere" 的世界观构建系统的辅助 AI... (略)`;

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen, onClose, pendingImportData, projects, currentProjectId,
  importMode, setImportMode, targetImportId, setTargetImportId, onConfirmImport, onTriggerFileUpload
}) => {
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const currentProject = projects.find(p => p.id === currentProjectId);

  // 验证当前挂起的数据
  let validationError = null;
  let validatedProject: Project | null = null;
  
  if (pendingImportData) {
      const result = validateProject(pendingImportData);
      if (!result.isValid) {
          validationError = result.error;
      } else {
          validatedProject = result.sanitizedProject!;
      }
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className={`bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in transition-all ${showAiPrompt ? 'w-[600px]' : 'w-96'}`}>
        
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            {showAiPrompt ? (
               <><Sparkles size={18} className="text-purple-500" /> AI 数据生成助手</>
            ) : (
               <><Upload size={18} className="text-blue-500" /> 导入数据</>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {showAiPrompt ? (
             <div className="space-y-4 animate-fade-in">
                {/* AI Prompt UI 保持不变... */}
                <div className="text-sm text-gray-400 leading-relaxed">
                   复制下方的提示词 (Prompt)，将其发送给 AI 模型。
                </div>
                <div className="relative">
                   <textarea readOnly className="w-full h-64 bg-black/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-purple-500" value={AI_PROMPT_TEMPLATE} />
                   <button onClick={handleCopyPrompt} className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded border border-gray-600 shadow-lg flex items-center gap-2 text-xs transition-colors">
                      {copySuccess ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                      {copySuccess ? "已复制" : "复制"}
                   </button>
                </div>
                <div className="flex gap-3 pt-2">
                   <button onClick={() => setShowAiPrompt(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                      <ArrowLeft size={16}/> 返回导入
                   </button>
                </div>
             </div>
          ) : (
             <>
                {pendingImportData && validatedProject ? (
                   <>
                      <div className="bg-blue-900/10 border border-blue-800/50 p-3 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                             <PackageOpen size={16} /> 识别到工程包
                          </div>
                          <div className="text-xs text-gray-400">
                             名称: <span className="text-white">{validatedProject.name}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 italic">
                             包含 {validatedProject.data.nodes.length} 名人物及相关附件资源
                          </div>
                      </div>

                      <div className="space-y-2 mt-4">
                          <label className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-gray-800/50 border-gray-700">
                            <input type="radio" name="importMode" checked={importMode === 'OVERWRITE'} onChange={() => setImportMode('OVERWRITE')} className="text-blue-500 focus:ring-0 bg-gray-900 border-gray-600" />
                            <div className="text-sm">
                                <div className="text-white font-bold">覆盖当前工程</div>
                                <div className="text-[10px] text-gray-500">替换 "{currentProject?.name}" 的所有数据和资源</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-gray-800/50 border-gray-700">
                            <input type="radio" name="importMode" checked={importMode === 'SELECT_USER'} onChange={() => setImportMode('SELECT_USER')} className="text-blue-500 focus:ring-0 bg-gray-900 border-gray-600" />
                            <div className="text-sm w-full">
                                <div className="text-white font-bold">覆盖其他工程</div>
                                {importMode === 'SELECT_USER' && (
                                <select value={targetImportId} onChange={(e) => setTargetImportId(e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-2 w-full bg-gray-950 border border-gray-600 rounded p-1 text-xs text-white">
                                    <option value="">选择目标...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                )}
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-gray-800/50 border-gray-700">
                            <input type="radio" name="importMode" checked={importMode === 'NEW_USER'} onChange={() => setImportMode('NEW_USER')} className="text-blue-500 focus:ring-0 bg-gray-900 border-gray-600" />
                            <div className="text-sm">
                                <div className="text-white font-bold">创建为新工程</div>
                                <div className="text-[10px] text-gray-500">保留现有工程，导入为全新档案</div>
                            </div>
                          </label>
                      </div>

                      <button onClick={onConfirmImport} disabled={importMode === 'SELECT_USER' && !targetImportId} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded font-bold flex items-center justify-center gap-2 mt-4 transition-all">
                          <Check size={16} /> 开始导入并解压资源
                      </button>
                   </>
                ) : (
                   <div className="flex flex-col items-center justify-center py-8 space-y-6">
                      {validationError && (
                         <div className="bg-red-900/20 border border-red-800 p-3 rounded-lg flex gap-2 text-red-300 text-xs w-full">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span>{validationError}</span>
                         </div>
                      )}
                      <div className="p-4 bg-blue-900/10 rounded-full border border-blue-500/30 cursor-pointer hover:bg-blue-900/20 transition-colors" onClick={onTriggerFileUpload}>
                         <FileJson size={48} className="text-blue-500 opacity-80"/>
                      </div>
                      <div className="text-center">
                         <button onClick={onTriggerFileUpload} className="text-blue-400 hover:text-blue-300 text-sm font-bold underline decoration-blue-500/50">点击上传工程包 (.fictosphere)</button>
                         <p className="text-gray-500 text-[10px] mt-1">支持包含资产的压缩包或单个 JSON 文件</p>
                      </div>
                      <div className="w-full border-t border-gray-800 pt-6 mt-2">
                         <button onClick={() => setShowAiPrompt(true)} className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-900/60 p-4 rounded-xl transition-all text-left border border-purple-500/30">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Sparkles size={20} /></div>
                               <div>
                                  <div className="text-white font-bold text-sm">AI 文本转工程</div>
                                  <div className="text-gray-400 text-[10px] mt-0.5">获取提示词，让 AI 帮你从文本中提取设定</div>
                               </div>
                            </div>
                         </button>
                      </div>
                   </div>
                )}
             </>
          )}
        </div>
      </div>
    </div>
  );
};
