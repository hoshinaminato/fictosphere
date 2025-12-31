
import React, { useState } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { Person } from '../../types';

interface AttributeEditorProps {
  person: Partial<Person>;
  onUpdate: (updated: Partial<Person>) => void;
  globalKeys: string[];
  expanded: boolean;
}

export const AttributeEditor: React.FC<AttributeEditorProps> = ({ person, onUpdate, globalKeys, expanded }) => {
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  const handleAddAttribute = () => {
    if(!newAttrKey) return;
    const currentAttrs = person.attributes || [];
    const exists = currentAttrs.find(a => a.key === newAttrKey);
    if (exists) {
       alert("属性名已存在");
       return;
    }
    const newAttrs = [...currentAttrs, { key: newAttrKey, value: newAttrValue }];
    onUpdate({ ...person, attributes: newAttrs });
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleDeleteAttribute = (idx: number) => {
     const currentAttrs = person.attributes || [];
     const newAttrs = currentAttrs.filter((_, i) => i !== idx);
     onUpdate({ ...person, attributes: newAttrs });
  };
  
  const handleUpdateAttributeValue = (key: string, val: string) => {
     const currentAttrs = person.attributes ? [...person.attributes] : [];
     const index = currentAttrs.findIndex(a => a.key === key);
     
     if (index !== -1) {
        currentAttrs[index] = { ...currentAttrs[index], value: val };
     } else {
        currentAttrs.push({ key, value: val });
     }
     onUpdate({ ...person, attributes: currentAttrs });
  };

  const getAttributeValue = (key: string) => {
     return person.attributes?.find(a => a.key === key)?.value || '';
  };

  const personAttrs = person.attributes || [];
  const customAttrs = personAttrs.filter(a => !globalKeys.includes(a.key));

  return (
     <div className={`space-y-4 ${expanded ? 'bg-gray-800/50 p-6 rounded-lg border border-gray-700' : ''}`}>
         <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Tag size={12}/> 属性设定
         </h4>

         {globalKeys.length > 0 && (
            <div className={`grid ${expanded ? 'grid-cols-2 gap-4' : 'grid-cols-1 gap-2'}`}>
               {globalKeys.map(key => (
                  <div key={key} className="space-y-1">
                     <label className="text-[10px] text-gray-500 uppercase font-bold">{key}</label>
                     <input 
                        value={getAttributeValue(key)}
                        onChange={(e) => handleUpdateAttributeValue(key, e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none"
                        placeholder="未设定"
                     />
                  </div>
               ))}
            </div>
         )}
         
         {globalKeys.length > 0 && <div className="border-t border-gray-700 my-2"></div>}

         <div className="space-y-2">
            {customAttrs.map((attr, idx) => {
                // Find real index in full array to delete correctly
                const realIndex = personAttrs.findIndex(a => a.key === attr.key && a.value === attr.value);
                return (
                  <div key={idx} className="flex gap-1 items-center">
                     <div className="bg-gray-800/50 px-2 py-1.5 rounded text-xs text-gray-400 border border-gray-700 w-1/3 truncate" title={attr.key}>
                        {attr.key}
                     </div>
                     <input 
                       value={attr.value}
                       onChange={e => handleUpdateAttributeValue(attr.key, e.target.value)}
                       className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                     />
                     <button onClick={() => handleDeleteAttribute(realIndex)} className="text-red-400 hover:bg-gray-800 p-1 rounded"><X size={14}/></button>
                  </div>
               );
            })}
         </div>

         <div className="flex gap-1 pt-2">
            <input 
               value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)}
               className="w-1/3 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
               placeholder="新属性"
            />
            <input 
               value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)}
               className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
               placeholder="数值"
            />
            <button onClick={handleAddAttribute} disabled={!newAttrKey} className="bg-gray-700 hover:bg-green-700 text-white rounded px-2 disabled:opacity-50"><Plus size={14}/></button>
         </div>
     </div>
  );
};
