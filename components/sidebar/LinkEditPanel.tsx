
import React, { useMemo } from 'react';
import { Relationship, RelationDefinition, TimeSystem, Project, CalendarEvent } from '../../types';
import { Save, Trash2, Clock, X, Calendar, MessageSquare } from 'lucide-react';
import { RelationTypeSelector } from './RelationTypeSelector';
import { SearchableSelect } from '../SearchableSelect';

interface LinkEditPanelProps {
  link: Relationship;
  sourceName: string;
  targetName: string;
  editLinkForm: Partial<Relationship>;
  setEditLinkForm: (val: Partial<Relationship> | ((prev: Partial<Relationship>) => Partial<Relationship>)) => void;
  relationCategory: string;
  setRelationCategory: (cat: string) => void;
  relationType: string;
  setRelationType: (type: string) => void;
  customDefinitions: RelationDefinition[];
  onShowRelManager: () => void;
  onSave: () => void;
  onDelete: () => void;
  successMsg: string | null;
  timeConfig?: Project['timeConfig'];
  allEvents: CalendarEvent[];
}

export const LinkEditPanel: React.FC<LinkEditPanelProps> = ({
  link, sourceName, targetName, editLinkForm, setEditLinkForm,
  relationCategory, setRelationCategory, relationType, setRelationType,
  customDefinitions, onShowRelManager, onSave, onDelete, successMsg,
  timeConfig, allEvents
}) => {
  const timeSystem = timeConfig?.system || TimeSystem.REAL;

  const eventOptions = useMemo(() => {
     return allEvents.map(e => ({
        label: e.title,
        value: e.id,
        sub: e.displayDate || e.start.split('T')[0]
     })).sort((a,b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [allEvents]);

  const handleAddEventLink = (eventId: string) => {
     if (!eventId) return;
     const current = editLinkForm.relatedEventIds || [];
     if (!current.includes(eventId)) {
        setEditLinkForm(prev => ({ ...prev, relatedEventIds: [...current, eventId] }));
     }
  };

  const handleRemoveEventLink = (eventId: string) => {
     const current = editLinkForm.relatedEventIds || [];
     setEditLinkForm(prev => ({ ...prev, relatedEventIds: current.filter(id => id !== eventId) }));
  };

  return (
     <div key={link.id} className="bg-gray-800 p-4 rounded-xl space-y-4 border border-yellow-600/30 animate-fade-in">
         <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">关系编辑</div>
         <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
            <span className="font-bold text-white truncate max-w-[100px]">{sourceName}</span>
            <span className="text-yellow-500 mx-2 flex-shrink-0">→</span>
            <span className="font-bold text-white truncate max-w-[100px]">{targetName}</span>
         </div>
         
         <RelationTypeSelector 
            category={relationCategory}
            setCategory={setRelationCategory}
            type={relationType}
            setType={(t) => { setRelationType(t); setEditLinkForm(prev => ({ ...prev, type: t })); }}
            customDefinitions={customDefinitions}
            onShowManager={onShowRelManager}
            isEditingLink={true}
         />

         {/* Time Information Section */}
         <div className="space-y-3 bg-gray-900/50 p-3 rounded border border-gray-700/50">
            <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1">
                   <Clock size={12}/> 时间属性 (可选)
                </label>
                {(editLinkForm.startDate || editLinkForm.endDate || editLinkForm.displayDate) && (
                   <button 
                     onClick={() => setEditLinkForm(prev => ({ ...prev, startDate: '', endDate: '', displayDate: '' }))}
                     className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                   >
                      <X size={10}/> 清除
                   </button>
                )}
            </div>

            {timeSystem === TimeSystem.REAL ? (
               <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                     <div>
                        <label className="text-[10px] text-gray-600 block mb-1">起始时间</label>
                        <div className="relative">
                           <input 
                              type="text"
                              placeholder="如: 2021"
                              className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 pr-6 text-xs text-white outline-none focus:border-blue-500"
                              value={editLinkForm.startDate || ''}
                              onChange={e => setEditLinkForm(prev => ({ ...prev, startDate: e.target.value }))}
                           />
                           <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600"><Calendar size={10}/></div>
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] text-gray-600 block mb-1">结束时间</label>
                        <div className="relative">
                           <input 
                              type="text"
                              placeholder="如: 2025-01"
                              className="w-full bg-gray-950 border border-gray-700 rounded p-1.5 pr-6 text-xs text-white outline-none focus:border-blue-500"
                              value={editLinkForm.endDate || ''}
                              onChange={e => setEditLinkForm(prev => ({ ...prev, endDate: e.target.value }))}
                           />
                           <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600"><Calendar size={10}/></div>
                        </div>
                     </div>
                  </div>
                  <div className="text-[9px] text-gray-600 leading-tight">
                     * 可输入具体日期 (YYYY-MM-DD) 或模糊年份。无结束时间则视为持续中。
                  </div>
               </div>
            ) : timeSystem !== TimeSystem.NONE ? (
               <div>
                  <label className="text-[10px] text-gray-600 block mb-1">自定义时间描述</label>
                  <input 
                     type="text"
                     placeholder={timeConfig?.label ? `输入该纪元下的时间点或范围...` : "如: 第三章 ~ 第五章"}
                     className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500"
                     value={editLinkForm.displayDate || ''}
                     onChange={e => setEditLinkForm(prev => ({ ...prev, displayDate: e.target.value }))}
                  />
               </div>
            ) : (
               <div className="text-[10px] text-gray-600 italic text-center py-1">当前项目未启用时间系统。</div>
            )}
         </div>

         {/* NEW: Related Events Section */}
         <div className="space-y-3 bg-gray-900/50 p-3 rounded border border-gray-700/50">
            <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1">
               <Calendar size={12}/> 关联事件 (可选)
            </label>
            <div className="space-y-2">
               <div className="flex flex-wrap gap-1.5">
                  {(editLinkForm.relatedEventIds || []).map(eid => {
                      const evt = allEvents.find(e => e.id === eid);
                      return (
                         <div key={eid} className="bg-blue-900/30 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                            <span className="truncate max-w-[120px]">{evt?.title || 'Unknown Event'}</span>
                            <button onClick={() => handleRemoveEventLink(eid)} className="hover:text-white"><X size={10}/></button>
                         </div>
                      );
                  })}
                  {(editLinkForm.relatedEventIds || []).length === 0 && (
                     <div className="text-[10px] text-gray-600 italic">尚未关联任何起因或结果事件。</div>
                  )}
               </div>
               <SearchableSelect 
                  options={eventOptions}
                  value=""
                  onChange={handleAddEventLink}
                  placeholder="搜索并关联事件..."
                  darker={true}
               />
            </div>
            <div className="text-[9px] text-gray-600">
               描述该关系的产生、转折或终结相关的历史大事件。
            </div>
         </div>

         <div className="space-y-2">
            <div className="flex justify-between items-center">
               <label className="text-xs text-gray-500 font-bold">关系强度 (1-10)</label>
               <span className="text-xs bg-gray-900 px-2 py-0.5 rounded text-yellow-500 font-mono font-bold">
                  {editLinkForm.strength ?? 5}
               </span>
            </div>
            <input 
              type="range" min="1" max="10"
              className="w-full accent-yellow-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              value={editLinkForm.strength ?? 5}
              onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setEditLinkForm(prev => ({...prev, strength: val}));
              }}
            />
         </div>

         <div className="flex gap-2 mt-4">
             <button 
                onClick={onSave} 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
             >
                <Save size={16}/> 保存
             </button>
             <button 
                onClick={onDelete} 
                className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 py-2 rounded-lg border border-red-900/50 flex justify-center items-center gap-2 transition-colors"
             >
                <Trash2 size={14}/> 删除
             </button>
         </div>
         {successMsg && (
            <div className="mt-2 text-center text-xs text-green-400 font-bold animate-fade-in bg-green-900/30 py-1 rounded border border-green-800">
               {successMsg}
            </div>
         )}
     </div>
  );
};
