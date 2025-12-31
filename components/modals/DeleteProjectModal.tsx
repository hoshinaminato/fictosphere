
import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ isOpen, onClose, onConfirm, projectName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-red-900/50 rounded-xl shadow-2xl w-96 overflow-hidden">
        <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-red-900/20">
          <h3 className="font-bold text-red-400 flex items-center gap-2">
            <Trash2 size={18} />
            确认删除
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-gray-300">
            确定要删除工程 <span className="font-bold text-white">{projectName}</span> 吗？
          </div>
          <div className="text-xs text-gray-500 bg-gray-800 p-3 rounded border border-gray-700 flex items-start gap-2">
            <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <div>
              此操作将永久删除该工程的所有数据（关系、蓝图、日程），且<span className="text-red-400 font-bold ml-1">不可恢复</span>。
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-medium border border-gray-700"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold shadow-lg shadow-red-900/20"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
