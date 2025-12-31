
import React from 'react';
import { Settings, X, FolderOpen, RefreshCw } from 'lucide-react';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetPath: string;
  onChangeAssetPath: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose, assetPath, onChangeAssetPath }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[500px] overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-blue-500" />
            系统设置
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-6">

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">资源存储路径 (Assets Path)</label>
            <div className="bg-black/50 p-3 rounded border border-gray-800 font-mono text-xs text-gray-300 break-all">
              {assetPath || "使用默认目录 (UserData/assets)"}
            </div>
            <div className="text-xs text-gray-500">
              所有上传的图片（头像、附件等）将存储在此目录中。更改目录不会自动迁移旧文件，请手动移动文件或确保新目录已准备好。
            </div>
            <button
              onClick={onChangeAssetPath}
              className="mt-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-3 py-2 rounded text-xs font-bold flex items-center gap-2"
            >
              <FolderOpen size={14} /> 更改存储目录
            </button>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">应用维护</h4>
            <button
              onClick={() => {
                if (window.electronAPI) window.electronAPI.reloadApp();
                else window.location.reload();
              }}
              className="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-800/50 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 w-full justify-center"
            >
              <RefreshCw size={16} /> 强制重载应用 (Reload Window)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
