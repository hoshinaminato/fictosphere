

import React from 'react';
import { MapNode, Floor, Room } from '../types';
import { Layers, Plus, ArrowRight, MapPin, Trash2, Edit3, Building } from 'lucide-react';

interface ContainerData {
  id: string;
  name: string;
  description?: string;
  floors?: Floor[];
}

interface BuildingViewProps {
  container: ContainerData;
  selectedFloorId?: string;
  onAddFloor: () => void;
  onSelectFloor: (id: string) => void;
  onDeleteFloor: (id: string) => void;
}

export const BuildingView: React.FC<BuildingViewProps> = ({
  container,
  selectedFloorId,
  onAddFloor,
  onSelectFloor,
  onDeleteFloor
}) => {
  // Sort floors by level (descending for display usually: 2F, 1F, B1)
  const sortedFloors = [...(container.floors || [])].sort((a, b) => b.level - a.level);

  return (
    <div className="w-64 bg-blueprint-900 border-r border-blueprint-700 flex flex-col shrink-0 z-10">
      {/* Building Header */}
      <div className="p-4 border-b border-blueprint-700 bg-blueprint-800/50">
         <div className="flex items-center gap-2 text-blueprint-500 mb-1">
            <Building size={16} />
            <span className="text-xs font-mono uppercase tracking-wider">当前建筑 / 区域</span>
         </div>
         <h2 className="text-xl font-mono font-bold text-white truncate" title={container.name}>{container.name}</h2>
         <p className="text-xs text-slate-500 mt-1 line-clamp-2">{container.description || '暂无描述'}</p>
      </div>

      {/* Floors List Header */}
      <div className="p-3 bg-blueprint-800/30 border-b border-blueprint-700 flex items-center justify-between">
         <div className="flex items-center gap-2 text-slate-400">
            <Layers size={14} />
            <span className="text-xs font-mono font-bold">楼层配置</span>
         </div>
         <button 
            onClick={onAddFloor}
            className="p-1 hover:bg-blueprint-700 rounded text-blueprint-500 transition-colors"
            title="添加楼层"
         >
            <Plus size={14} />
         </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
         {sortedFloors.length === 0 ? (
            <div className="text-center py-8 opacity-30">
               <Layers size={24} className="mx-auto mb-2" />
               <p className="text-[10px] font-mono">暂无楼层</p>
               <button onClick={onAddFloor} className="mt-2 text-xs text-blueprint-500 hover:text-white underline">点击添加</button>
            </div>
         ) : sortedFloors.map(floor => {
            const isSelected = floor.id === selectedFloorId;
            return (
               <div 
                  key={floor.id}
                  onClick={() => onSelectFloor(floor.id)}
                  className={`group flex items-center gap-3 p-3 rounded border cursor-pointer transition-all
                    ${isSelected 
                      ? 'bg-blueprint-800 border-blueprint-500 shadow-[0_0_10px_rgba(56,189,248,0.1)]' 
                      : 'bg-blueprint-900 border-blueprint-700 hover:border-blueprint-600 hover:bg-blueprint-800/50'
                    }`}
               >
                  {/* Level Badge */}
                  <div className={`w-8 h-8 flex items-center justify-center rounded font-mono font-bold text-sm border shrink-0
                     ${isSelected ? 'bg-blueprint-500 text-blueprint-900 border-blueprint-500' : 'bg-blueprint-950 text-slate-500 border-blueprint-800'}
                  `}>
                     {floor.level > 0 ? `${floor.level}` : floor.level === 0 ? 'G' : `B${Math.abs(floor.level)}`}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                     <div className={`font-mono text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {floor.name}
                     </div>
                     <div className="text-[10px] text-slate-600 truncate">
                        {floor.rooms.length} 个子房间
                     </div>
                  </div>
                  
                  {isSelected && <ArrowRight size={14} className="text-blueprint-500" />}
               </div>
            );
         })}
      </div>
    </div>
  );
};