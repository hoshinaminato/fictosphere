
import React from 'react';
import { X, Layout, Sparkles, ScrollText, Zap, Rocket } from 'lucide-react';
import { ProjectTemplate } from '../../services/mockData';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (template: ProjectTemplate) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const templates: { id: ProjectTemplate, title: string, desc: string, icon: React.ReactNode, color: string }[] = [
    {
      id: 'EMPTY',
      title: '空白工程',
      desc: '从零开始构建你的世界。包含最基础的配置。',
      icon: <Layout size={24} />,
      color: 'bg-gray-700'
    },
    {
      id: 'SONG_DYNASTY',
      title: '大宋风云：王安石变法',
      desc: '历史题材演示。使用【现实时间】系统（公元纪年），包含真实的日历事件、政治关系网。',
      icon: <ScrollText size={24} />,
      color: 'bg-amber-700'
    },
    {
      id: 'THREE_BODY',
      title: '三体：地球往事',
      desc: '科幻题材演示。使用【虚构纪元】系统（危机纪元/威慑纪元），展示跨越数百年的宏大叙事。',
      icon: <Rocket size={24} />,
      color: 'bg-blue-900'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-blue-500" />
            新建工程
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        
        <div className="p-8 overflow-y-auto">
           <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">选择模版</h4>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map(t => (
                 <button 
                    key={t.id}
                    onClick={() => onConfirm(t.id)}
                    className="flex flex-col text-left bg-gray-800 border border-gray-700 hover:border-blue-500 hover:bg-gray-750 rounded-xl p-5 transition-all group h-full shadow-lg hover:shadow-blue-900/20 hover:-translate-y-1"
                 >
                    <div className={`w-12 h-12 rounded-lg ${t.color} flex items-center justify-center text-white mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                       {t.icon}
                    </div>
                    <div className="font-bold text-white text-lg mb-2">{t.title}</div>
                    <div className="text-sm text-gray-400 leading-relaxed">{t.desc}</div>
                 </button>
              ))}
           </div>
        </div>
        
        <div className="p-4 bg-gray-800/30 text-center text-xs text-gray-500 border-t border-gray-800">
           提示：创建后可在设置中随时更改时间观与全局属性。
        </div>
      </div>
    </div>
  );
};
