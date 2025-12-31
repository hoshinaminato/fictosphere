
import React, { useRef } from 'react';
import { Person, Gender, ProjectTimeConfig, TimeSystem } from '../../types';
import { UserPlus, Upload, X, Save } from 'lucide-react';
import { AttributeEditor } from './AttributeEditor';
import { AttachmentManager } from '../AttachmentManager';

interface PersonEditFormProps {
  editForm: Partial<Person>;
  setEditForm: (val: Partial<Person> | ((prev: Partial<Person>) => Partial<Person>)) => void;
  onSave: () => void;
  onCancel: () => void;
  expanded?: boolean;
  globalAttributeKeys: string[];
  timeConfig?: ProjectTimeConfig;
}

export const PersonEditForm: React.FC<PersonEditFormProps> = ({ 
  editForm, setEditForm, onSave, onCancel, expanded = false, globalAttributeKeys, timeConfig
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Default to REAL if not set
  const timeSystem = timeConfig?.system || TimeSystem.REAL;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (window.electronAPI) {
        try {
           const buffer = await file.arrayBuffer();
           const savedPath = await window.electronAPI.saveAsset(buffer, file.name);
           
           setEditForm(prev => ({ ...prev, avatar: savedPath }));
           e.target.value = ''; // Reset input
        } catch (err) {
           console.error("Upload failed", err);
           alert("图片上传失败: " + err);
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAvatar = () => {
    setEditForm(prev => ({ ...prev, avatar: undefined }));
  };

  const getTimeLabel = () => {
     switch(timeSystem) {
        case TimeSystem.ERA: return '出生年份 / 纪元';
        case TimeSystem.CHAPTER: return '登场章节 / 进度';
        case TimeSystem.RELATIVE: return '相对时间点';
        case TimeSystem.SEASONAL: return '出生季节';
        default: return '出生/登场时间';
     }
  };

  return (
     <div className={`${expanded ? 'bg-gray-900 p-6' : 'bg-gray-800 p-4'} rounded-xl space-y-3 border border-blue-900`}>
        {/* Avatar Section */}
        <div className="flex justify-center mb-4">
           <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className={`rounded-full bg-gray-700 overflow-hidden border-2 border-gray-600 flex items-center justify-center ${expanded ? 'w-24 h-24' : 'w-16 h-16'}`}>
                 {editForm.avatar ? (
                    <img src={editForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                    <UserPlus size={24} className="text-gray-500"/>
                 )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Upload size={16} className="text-white"/>
              </div>
              <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*"
                 onChange={handleAvatarUpload}
              />
              {editForm.avatar && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); removeAvatar(); }}
                   className="absolute top-0 right-0 bg-red-600 rounded-full p-1 text-white shadow-sm hover:scale-110"
                 >
                    <X size={10} />
                 </button>
              )}
           </div>
        </div>

        <div className={`grid ${expanded ? 'grid-cols-2 gap-4' : 'grid-cols-2 gap-2'}`}>
            <div className="space-y-1">
               <label className="text-[10px] text-gray-500 uppercase font-bold">姓名</label>
               <input 
                 value={editForm.name || ''} 
                 onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))}
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                 placeholder="姓名"
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] text-gray-500 uppercase font-bold">家族 ID</label>
               <input 
                 value={editForm.familyId || ''} 
                 onChange={e => setEditForm(prev => ({...prev, familyId: e.target.value}))}
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                 placeholder="家族"
               />
            </div>
        </div>
        <div className={`grid ${expanded ? 'grid-cols-2 gap-4' : 'grid-cols-1 gap-2'}`}>
            <div className="space-y-1">
               <label className="text-[10px] text-gray-500 uppercase font-bold">性别</label>
               <select 
                   className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                   value={editForm.gender}
                   onChange={e => setEditForm(prev => ({...prev, gender: e.target.value as Gender}))}
                >
                   <option value={Gender.UNKNOWN}>未知</option>
                   <option value={Gender.MALE}>男</option>
                   <option value={Gender.FEMALE}>女</option>
                </select>
            </div>
            
            {/* Conditional Date Input */}
            <div className="space-y-1">
               <label className="text-[10px] text-gray-500 uppercase font-bold">
                  {timeSystem === TimeSystem.REAL ? '出生日期 (年-月-日)' : getTimeLabel()}
               </label>
               
               {timeSystem === TimeSystem.REAL ? (
                  <div className="flex gap-1">
                     <input 
                       type="text"
                       className="w-1/2 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center"
                       value={editForm.birthYear || ''}
                       onChange={e => setEditForm(prev => ({...prev, birthYear: e.target.value}))}
                       placeholder="YYYY"
                     />
                     <input 
                       type="text"
                       className="w-1/4 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center"
                       value={editForm.birthMonth || ''}
                       onChange={e => setEditForm(prev => ({...prev, birthMonth: e.target.value}))}
                       placeholder="MM"
                     />
                     <input 
                       type="text"
                       className="w-1/4 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-center"
                       value={editForm.birthDay || ''}
                       onChange={e => setEditForm(prev => ({...prev, birthDay: e.target.value}))}
                       placeholder="DD"
                     />
                  </div>
               ) : timeSystem === TimeSystem.SEASONAL ? (
                  <select
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                     value={editForm.customBirthDate || ''}
                     onChange={e => setEditForm(prev => ({...prev, customBirthDate: e.target.value}))}
                  >
                     <option value="">(未知)</option>
                     <option value="春">春 (Spring)</option>
                     <option value="夏">夏 (Summer)</option>
                     <option value="秋">秋 (Autumn)</option>
                     <option value="冬">冬 (Winter)</option>
                  </select>
               ) : timeSystem !== TimeSystem.NONE ? (
                  <input 
                     type="text"
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                     value={editForm.customBirthDate || ''}
                     onChange={e => setEditForm(prev => ({...prev, customBirthDate: e.target.value}))}
                     placeholder={timeConfig?.label ? `例如: ${timeConfig.label} 20年` : "自定义时间描述"}
                  />
               ) : (
                  <div className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-500 italic">
                     (当前世界观无需时间记录)
                  </div>
               )}
            </div>
        </div>

        <div className="space-y-1">
           <label className="text-[10px] text-gray-500 uppercase font-bold">生平简介</label>
           <textarea 
             value={editForm.bio || ''}
             onChange={e => setEditForm(prev => ({...prev, bio: e.target.value}))}
             className={`w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm ${expanded ? 'h-48' : 'h-24'}`}
             placeholder="生平"
           />
        </div>

        <div className="border-t border-gray-700 pt-3">
            <AttributeEditor 
              person={editForm} 
              onUpdate={(updated) => setEditForm(prev => ({...prev, ...updated}))} 
              globalKeys={globalAttributeKeys}
              expanded={expanded}
            />
        </div>
        
        <div className={`mt-4 pt-4 border-t border-gray-700 ${expanded ? 'bg-gray-800/50 p-6 rounded-lg' : ''}`}>
             <AttachmentManager 
               attachments={editForm.attachments || []}
               onUpdate={(atts) => setEditForm(prev => ({ ...prev, attachments: atts }))}
             />
        </div>

        <div className="flex gap-2 mt-4">
           <button onClick={onSave} className="flex-1 bg-blue-600 py-1.5 rounded text-sm flex justify-center items-center gap-1"><Save size={14}/> 保存</button>
           <button 
             onClick={onCancel} 
             className="flex-1 bg-gray-700 py-1.5 rounded text-sm"
           >
             取消
           </button>
        </div>
     </div>
  );
};
