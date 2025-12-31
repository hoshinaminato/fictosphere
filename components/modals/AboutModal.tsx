
import React from 'react';
import { Layout, Github, ExternalLink, Check, Copy, Bug, Shield, Heart, Sparkles } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [copySuccess, setCopySuccess] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText('https://github.com/hoshinaminato/fictosphere');
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[450px] overflow-hidden flex flex-col">
        {/* About Header */}
        <div className="p-8 flex flex-col items-center bg-gradient-to-b from-gray-800/50 to-gray-900 border-b border-gray-800">
          <div className="bg-gradient-to-tr from-blue-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4">
            <Layout size={32} />
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Fictosphere
          </h1>
          <div className="text-gray-500 font-mono text-xs mt-1">v1.0.2</div>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          <p className="text-sm text-center text-gray-300 leading-relaxed">
            一个高性能的关系网络与世界观构建系统。专为创作者打造的沉浸式构想空间。
          </p>

          {/* Credits */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-3 rounded border border-indigo-500/30 text-center relative overflow-hidden group">
              <div className="text-[10px] text-indigo-300 uppercase font-bold mb-1">AI Architect</div>
              <div className="text-white font-bold flex items-center justify-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" /> Gemini
              </div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded border border-gray-700 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Creator</div>
              <div className="text-white font-bold">星名凑</div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded border border-gray-700 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">License</div>
              <div className="text-white font-bold">MIT</div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded border border-gray-700 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Version</div>
              <div className="text-white font-bold">1.0.2</div>
            </div>
          </div>

          {/* GitHub */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 flex items-center gap-2">
              <Github size={12} /> Open Source
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-xs text-gray-400 font-mono truncate flex items-center justify-between group hover:border-gray-600 transition-colors">
                <a
                  href="https://github.com/hoshinaminato/fictosphere"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors truncate mr-2 flex items-center gap-2"
                >
                  github.com/hoshinaminato/fictosphere <ExternalLink size={10} />
                </a>
              </div>
              <button
                onClick={handleCopyUrl}
                className={`px-3 rounded border flex items-center justify-center transition-all ${copySuccess ? 'bg-green-900/50 border-green-700 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title="复制链接"
              >
                {copySuccess ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-2 flex justify-center">
              <a href="https://github.com/hoshinaminato/fictosphere/issues" target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                <Bug size={12} /> Report Issues
              </a>
            </div>
          </div>

          {/* Footer Info */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Shield size={14} className="shrink-0" />
              <div>
                <span className="font-bold text-gray-400">隐私声明：</span>
                本应用所有数据均存储在您的本地设备中，不会上传至任何云端服务器。
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Heart size={14} className="shrink-0 text-pink-500" />
              <div>
                <span className="font-bold text-gray-400">你的支持：</span>
                如果是本应用对你有帮助，欢迎在 GitHub 上点个 Star。
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 border-t border-gray-800 flex justify-center">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">关闭</button>
        </div>
      </div>
    </div>
  );
};
