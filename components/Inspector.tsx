




import React, { useState, useMemo } from 'react';
import { Selection, MapNode, MapEdge, Floor, Room, Item, Person, RoomType, NodeType, Attribute, WorldData, Gender, GenderLabels } from '../types';
import { Settings, Tag, Hash, Users, LogOut, Plus, Trash2, X, MapPin, Search, ChevronDown, ChevronUp, UserPlus, Check, Paperclip } from 'lucide-react';
import { SearchableSelect, Option } from './SearchableSelect';
import { AttachmentManager } from './AttachmentManager';

interface InspectorProps {
  selection: Selection;
  data: any; // The actual object being edited
  onUpdate: (field: string, value: any) => void;
  onDelete: () => void;
  peopleInSelection?: Person[]; // For Nodes
  allPeople?: Person[]; // For adding people to rooms
  onJumpToPerson?: (personId: string) => void;
  worldData?: WorldData; // Added for location selection
  onUpdatePerson?: (person: Person) => void; // To update person's location from Room view
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selection, 
  data, 
  onUpdate, 
  onDelete, 
  peopleInSelection = [],
  allPeople = [],
  onJumpToPerson,
  worldData,
  onUpdatePerson
}) => {
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Prepare Options for Locations
  const locationOptions = useMemo(() => {
     if (!worldData) return [];
     const opts: Option[] = [];
     worldData.nodes.forEach(node => {
        opts.push({ label: `[地点] ${node.name}`, value: node.id, group: 'Root Location' });
        node.floors.forEach(f => {
           f.rooms.forEach(r => {
              opts.push({ label: r.name, value: r.id, group: node.name, sub: `${f.name}` });
           });
        });
     });
     return opts;
  }, [worldData]);

  // Prepare Options for People (Adding to room)
  const peopleOptions = useMemo(() => {
     return allPeople.map(p => ({
        label: p.name,
        value: p.id,
        group: p.familyId,
        // sub: `Gen ${p.generation}`  <-- Removed
     })).sort((a,b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [allPeople]);

  if (!selection || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center border-l border-blueprint-700 bg-blueprint-800 w-80 shrink-0">
        <Settings size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-mono text-slate-400">选择元素以查看属性</p>
        <p className="text-xs mt-2 opacity-30">点击左侧蓝图中的区域</p>
      </div>
    );
  }

  // --- Attribute Helpers ---
  const handleAddAttribute = () => {
    if(!newAttrKey) return;
    const currentAttrs = data.attributes || [];
    const newAttrs = [...currentAttrs, { key: newAttrKey, value: newAttrValue }];
    onUpdate('attributes', newAttrs);
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleUpdateAttribute = (idx: number, key: string, val: string) => {
     const currentAttrs = data.attributes ? [...data.attributes] : [];
     currentAttrs[idx] = { key, value: val };
     onUpdate('attributes', currentAttrs);
  };

  const handleDeleteAttribute = (idx: number) => {
     const currentAttrs = data.attributes || [];
     const newAttrs = currentAttrs.filter((_: any, i: number) => i !== idx);
     onUpdate('attributes', newAttrs);
  };

  const renderAttributesEditor = () => (
      <div className="mb-6 border-t border-blueprint-700 pt-4">
        <div className="flex items-center gap-2 text-blueprint-400 mb-2">
            <Tag size={14} />
            <span className="text-xs font-mono font-bold uppercase">自定义属性 / 设定 (Key-Value)</span>
        </div>
        <div className="space-y-2 mb-2">
            {(data.attributes || []).map((attr: Attribute, idx: number) => (
                <div key={idx} className="flex gap-1 group">
                    <input 
                        value={attr.key}
                        onChange={e => handleUpdateAttribute(idx, e.target.value, attr.value)}
                        className="w-1/3 bg-blueprint-900 border border-blueprint-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blueprint-500 focus:outline-none"
                        placeholder="Key"
                    />
                    <input 
                        value={attr.value}
                        onChange={e => handleUpdateAttribute(idx, attr.key, e.target.value)}
                        className="flex-1 bg-blueprint-900 border border-blueprint-700 rounded px-2 py-1 text-xs text-slate-300 focus:border-blueprint-500 focus:outline-none"
                        placeholder="Value"
                    />
                    <button onClick={() => handleDeleteAttribute(idx)} className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                </div>
            ))}
        </div>
        <div className="flex gap-1">
            <input 
                value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)}
                className="w-1/3 bg-blueprint-900/50 border border-blueprint-700/50 rounded px-2 py-1 text-xs text-slate-400 focus:border-blueprint-500 focus:outline-none"
                placeholder="新属性名"
            />
            <input 
                value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)}
                className="flex-1 bg-blueprint-900/50 border border-blueprint-700/50 rounded px-2 py-1 text-xs text-slate-400 focus:border-blueprint-500 focus:outline-none"
                placeholder="数值 / 描述"
            />
            <button onClick={handleAddAttribute} disabled={!newAttrKey} className="bg-blueprint-700 hover:bg-blueprint-600 text-white rounded px-2 disabled:opacity-50"><Plus size={12}/></button>
        </div>
      </div>
  );

  const renderAttachmentsEditor = () => (
      <div className="mb-6 border-t border-blueprint-700 pt-4">
         <div className="flex items-center gap-2 text-blueprint-400 mb-2">
            <Paperclip size={14} />
            <span className="text-xs font-mono font-bold uppercase">多媒体附件 / 资料</span>
         </div>
         <AttachmentManager 
            attachments={data.attachments || []}
            onUpdate={(atts) => onUpdate('attachments', atts)}
         />
      </div>
  );

  const renderField = (label: string, key: string, type: 'text' | 'number' | 'textarea' = 'text') => (
    <div className="mb-4">
      <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase tracking-wider">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={data[key] ?? ''}
          onChange={(e) => onUpdate(key, e.target.value)}
          className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 focus:border-blueprint-500 focus:outline-none font-mono h-24 resize-none"
        />
      ) : (
        <input
          type={type}
          value={data[key] ?? ''}
          onChange={(e) => onUpdate(key, type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 focus:border-blueprint-500 focus:outline-none font-mono"
        />
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-blueprint-800 border-l border-blueprint-700 w-80 shadow-xl shrink-0 z-20">
      <div className="p-4 border-b border-blueprint-700 bg-blueprint-900/50">
        <div className="flex items-center gap-2 text-blueprint-500 mb-1">
          <Hash size={14} />
          <span className="text-xs font-mono opacity-70 uppercase">{selection.type} 属性</span>
        </div>
        <h2 className="text-lg font-bold text-white font-mono truncate">
          {data.name || data.label || 'Untitled'}
        </h2>
        <div className="text-xs text-slate-500 font-mono mt-1">ID: {data.id.substring(0, 8)}...</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Common Fields */}
        {'name' in data && renderField('名称 / 标识', 'name')}
        {'label' in data && renderField('标签 (距离)', 'label')}
        
        {/* Specific Fields */}
        {selection.type === 'NODE' && (
          <>
            <div className="mb-4">
              <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">类型</label>
              <select 
                value={data.type}
                onChange={(e) => onUpdate('type', e.target.value)}
                className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 font-mono"
              >
                <optgroup label="基础 / 现代">
                  <option value={NodeType.LOCATION}>地点 (建筑)</option>
                  <option value={NodeType.HUB}>枢纽 (路口/广场)</option>
                  <option value={NodeType.TRANSIT}>中转站 (车站)</option>
                  <option value={NodeType.ROAD}>道路 (Road)</option>
                </optgroup>
                <optgroup label="自然 / 地形">
                  <option value={NodeType.MOUNTAIN}>山脉</option>
                  <option value={NodeType.RIVER}>河流</option>
                  <option value={NodeType.OCEAN}>海洋 (Ocean)</option>
                  <option value={NodeType.BRIDGE}>桥梁</option>
                  <option value={NodeType.FOREST}>森林</option>
                  <option value={NodeType.ISLAND}>岛屿</option>
                </optgroup>
                <optgroup label="西幻 (Fantasy)">
                  <option value={NodeType.CASTLE}>城堡 (Castle)</option>
                  <option value={NodeType.TOWER}>法师塔/高塔 (Tower)</option>
                  <option value={NodeType.VILLAGE}>村庄 (Village)</option>
                  <option value={NodeType.DUNGEON}>地牢/遗迹 (Dungeon)</option>
                </optgroup>
                <optgroup label="仙侠 (Eastern)">
                  <option value={NodeType.SECT}>宗门 (Sect)</option>
                  <option value={NodeType.PAGODA}>宝塔 (Pagoda)</option>
                  <option value={NodeType.CAVE}>洞府 (Cave)</option>
                </optgroup>
                <optgroup label="科幻 / 赛博 (Sci-Fi)">
                  <option value={NodeType.CITY_BLOCK}>都会街区</option>
                  <option value={NodeType.SLUM}>贫民窟</option>
                  <option value={NodeType.FACTORY}>工厂/工业区</option>
                </optgroup>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
               {renderField('宽度', 'w', 'number')}
               {renderField('高度', 'h', 'number')}
            </div>
            
            {renderField('描述', 'description', 'textarea')}
            
            {renderAttributesEditor()}
            {renderAttachmentsEditor()}

            {/* People List (Node) */}
            <div className="mt-6 border-t border-blueprint-700 pt-4">
               <div className="flex items-center gap-2 text-blueprint-400 mb-3">
                  <Users size={14} />
                  <span className="text-xs font-mono font-bold uppercase">当前人员 ({peopleInSelection.length})</span>
               </div>
               <div className="bg-blueprint-900 rounded p-2 max-h-48 overflow-y-auto space-y-1">
                  {peopleInSelection.length === 0 ? (
                    <div className="text-xs text-slate-600 text-center py-2">此区域无人</div>
                  ) : peopleInSelection.map(p => (
                    <div key={p.id} className="text-xs text-slate-300 flex items-center gap-2 p-1 hover:bg-blueprint-800 rounded">
                       <div className="w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center text-[8px]">{p.name.charAt(0)}</div>
                       {p.name}
                    </div>
                  ))}
               </div>
            </div>
          </>
        )}

        {selection.type === 'FLOOR' && (
           <>
             {renderField('区域 / 楼层层级', 'level', 'number')}
             <div className="text-[10px] text-slate-500 mb-4">提示: 0 表示地面/区域，正数为楼层，负数为地下。</div>
           </>
        )}

        {selection.type === 'ROOM' && (
           <>
             <div className="mb-4">
              <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">区域类型</label>
              <select 
                value={data.type || RoomType.ROOM}
                onChange={(e) => onUpdate('type', e.target.value)}
                className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 font-mono"
              >
                <option value={RoomType.ROOM}>普通房间</option>
                <option value={RoomType.BUILDING}>内部建筑</option>
                <option value={RoomType.OUTDOOR}>户外区域 (绿化/广场)</option>
                <option value={RoomType.WATER}>水域 (河流/池塘)</option>
              </select>
             </div>
             {renderField('描述', 'description', 'textarea')}
             <div className="grid grid-cols-2 gap-2">
                {renderField('宽度 (网格)', 'w', 'number')}
                {renderField('高度 (网格)', 'h', 'number')}
             </div>
             <div className="grid grid-cols-2 gap-2">
                {renderField('X 坐标', 'x', 'number')}
                {renderField('Y 坐标', 'y', 'number')}
             </div>
             
             {renderAttributesEditor()}
             {renderAttachmentsEditor()}

             {/* Room Occupants Management */}
             <div className="mt-6 border-t border-blueprint-700 pt-4">
               <div className="flex items-center gap-2 text-blueprint-400 mb-3">
                  <Users size={14} />
                  <span className="text-xs font-mono font-bold uppercase">区域人员</span>
               </div>
               
               {/* Add Person To Room */}
               {onUpdatePerson && (
                  <div className="mb-3 bg-blueprint-900/50 p-2 rounded border border-blueprint-700/50">
                    <label className="text-[10px] text-slate-500 mb-1 block flex items-center gap-1"><UserPlus size={10}/> 添加常驻人员</label>
                    <SearchableSelect 
                      options={peopleOptions}
                      value=""
                      onChange={(val) => {
                         const person = allPeople.find(p => p.id === val);
                         if (person && onUpdatePerson) {
                            onUpdatePerson({ ...person, defaultLocationId: data.id });
                         }
                      }}
                      placeholder="搜索姓名以添加..."
                    />
                  </div>
               )}

               {/* List current people */}
               <div className="bg-blueprint-900 rounded p-2 mb-3 space-y-1">
                 {allPeople.filter(p => p.defaultLocationId === data.id).length === 0 ? (
                    <div className="text-xs text-slate-600 text-center py-2">暂无常驻人员</div>
                 ) : allPeople.filter(p => p.defaultLocationId === data.id).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-xs bg-blueprint-800 p-1.5 rounded">
                       <span className="text-slate-300">{p.name}</span>
                       <button 
                         onClick={() => {
                            if (onUpdatePerson) onUpdatePerson({ ...p, defaultLocationId: '' });
                         }} 
                         className="text-red-400 hover:text-white" title="移出此房间"
                       >
                          <LogOut size={12}/>
                       </button>
                    </div>
                 ))}
               </div>

               <div className="text-[10px] text-slate-500 mb-2">提示: 这里的操作会修改人物的“常驻位置”。</div>
             </div>
           </>
        )}

        {selection.type === 'ITEM' && (
           <>
             <div className="mb-4">
                <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">物品类型</label>
                <select 
                  value={data.type}
                  onChange={(e) => onUpdate('type', e.target.value)}
                  className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 font-mono"
                >
                  <option value="DOOR">门</option>
                  <option value="WINDOW">窗</option>
                  <option value="BED">床</option>
                  <option value="CHEST">箱子 / 存储</option>
                  <option value="TABLE">桌子</option>
                  <option value="NPC">NPC 生成点</option>
                  <option value="STAIRS">楼梯 / 连接点</option>
                  <option value="ROAD">道路地砖 (Road)</option>
                  <option value="WATER">水景 (Water)</option>
                </select>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {renderField('X 坐标', 'x', 'number')}
                {renderField('Y 坐标', 'y', 'number')}
             </div>
           </>
        )}

        {selection.type === 'PERSON' && (
           <>
             {renderField('姓名', 'name')}
             
             <div className="mb-4">
               <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">性别</label>
               <select 
                   className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 font-mono"
                   value={data.gender}
                   onChange={e => onUpdate('gender', e.target.value as Gender)}
                >
                   <option value={Gender.UNKNOWN}>未知</option>
                   <option value={Gender.MALE}>男</option>
                   <option value={Gender.FEMALE}>女</option>
                </select>
             </div>

             {onJumpToPerson && (
                <button 
                   onClick={() => onJumpToPerson(data.id)}
                   className="w-full mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs py-2 rounded flex items-center justify-center gap-2 shadow-sm"
                >
                   <Users size={12} /> 在关系中查看
                </button>
             )}

             <div className="mb-4">
                <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">常驻位置 (Location)</label>
                <div className="mb-2">
                   {worldData ? (
                     <SearchableSelect 
                        options={locationOptions}
                        value={data.defaultLocationId || ''}
                        onChange={(val) => onUpdate('defaultLocationId', val)}
                        placeholder="搜索位置..."
                     />
                   ) : (
                      <input
                        type="text"
                        value={data.defaultLocationId || ''}
                        onChange={(e) => onUpdate('defaultLocationId', e.target.value)}
                        className="w-full bg-blueprint-900 border border-blueprint-700 rounded p-2 text-sm text-slate-300 font-mono"
                        placeholder="Location ID"
                      />
                   )}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex gap-1">
                   <MapPin size={10} className="mt-0.5"/>
                   <span>
                      {data.defaultLocationId ? '已设置固定位置。' : '未分配固定位置 (流浪)。'}
                   </span>
                </div>
             </div>

             <div className="mb-4">
                <label className="block text-xs text-blueprint-500 font-mono mb-1 uppercase">家族</label>
                <div className="p-2 bg-blueprint-900 rounded border border-blueprint-700 text-sm text-slate-300">
                   {data.familyId}
                </div>
             </div>
             
             {renderField('生平简介', 'bio', 'textarea')}
             
             {renderAttributesEditor()}
             {renderAttachmentsEditor()}
           </>
        )}
        
        {selection.type !== 'PERSON' && (
           <div className="mt-8 pt-4 border-t border-blueprint-700">
              <button 
                onClick={onDelete}
                className="w-full py-2 px-4 bg-red-900/30 border border-red-800 text-red-400 text-xs font-mono hover:bg-red-900/50 rounded transition-colors uppercase"
              >
                删除对象
              </button>
           </div>
        )}
      </div>
    </div>
  );
};
