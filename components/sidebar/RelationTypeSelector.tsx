import React from 'react';
import { RelationCategories, RelationLabels, RelationDefinition, RelationType, RelationCategory } from '../../types';

interface RelationTypeSelectorProps {
  category: string;
  setCategory: (cat: string) => void;
  type: string;
  setType: (type: string) => void;
  customDefinitions: RelationDefinition[];
  onShowManager: () => void;
  isEditingLink?: boolean;
}

export const RelationTypeSelector: React.FC<RelationTypeSelectorProps> = ({
  category,
  setCategory,
  type,
  setType,
  customDefinitions,
  onShowManager,
  isEditingLink = false
}) => {

  const onCatChange = (val: string) => {
     setCategory(val);
     let firstType = '';
     if (val === 'CUSTOM_PROJECT') {
         if (customDefinitions.length > 0) firstType = customDefinitions[0].name;
     } else {
         const cat = RelationCategories[val as keyof typeof RelationCategories] as RelationCategory;
         if (cat && cat.types.length > 0) firstType = cat.types[0];
     }
     
     if (firstType) {
         setType(firstType);
     }
  };

  const onTypeChange = (val: string) => {
      setType(val);
  };

  return (
     <div className="space-y-3 p-3 bg-gray-900/50 rounded border border-gray-700/50 relative">
         <div className="flex justify-between items-center">
             <label className="text-xs text-gray-500 font-bold uppercase">关系大类</label>
             <button 
                onClick={onShowManager}
                className="text-[10px] text-blue-400 hover:text-white underline"
                title="管理自定义关系"
             >
                管理自定义
             </button>
         </div>
         
         <select 
            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
            value={category}
            onChange={(e) => onCatChange(e.target.value)}
         >
            {Object.entries(RelationCategories).map(([key, cat]) => (
               <option key={key} value={key}>{(cat as RelationCategory).label}</option>
            ))}
            <option value="CUSTOM_PROJECT">自定义 (Custom)</option>
         </select>

         <div>
            <label className="text-xs text-gray-500 block mb-1 font-bold">具体关系</label>
            {category === 'CUSTOM_PROJECT' ? (
                 customDefinitions.length > 0 ? (
                    <select 
                       className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                       value={type}
                       onChange={(e) => onTypeChange(e.target.value)}
                    >
                       {customDefinitions.map(def => (
                           <option key={def.id} value={def.name}>{def.name}</option>
                       ))}
                    </select>
                 ) : (
                    <div className="text-xs text-gray-500 p-2 border border-dashed border-gray-700 rounded text-center">
                       暂无自定义关系。
                       <br/>
                       <button onClick={onShowManager} className="text-blue-400 underline mt-1">点击添加</button>
                    </div>
                 )
            ) : (
                <select 
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                    value={type}
                    onChange={(e) => onTypeChange(e.target.value)}
                >
                    {(RelationCategories[category as keyof typeof RelationCategories] as RelationCategory).types.map(t => (
                       <option key={t} value={t}>{RelationLabels[t] || t}</option>
                    ))}
                </select>
            )}
         </div>
     </div>
  );
};
