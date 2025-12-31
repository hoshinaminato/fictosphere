
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

export interface Option {
  label: string;
  value: string;
  group?: string;
  sub?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  darker?: boolean; // For different visual contexts (Sidebar vs Inspector)
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...", 
  className = "",
  darker = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(lower) || 
      o.group?.toLowerCase().includes(lower) ||
      o.sub?.toLowerCase().includes(lower)
    );
  }, [options, search]);

  const bgClass = darker ? "bg-gray-900 border-gray-700 hover:border-gray-500" : "bg-blueprint-900 border-blueprint-700 hover:border-blueprint-500";
  // Updated: Use bg-gray-900 instead of blueprint-950 to ensure opacity as blueprint-950 might be undefined
  const dropdownBgClass = darker ? "bg-gray-950 border-gray-700" : "bg-gray-900 border-blueprint-700";
  const textClass = darker ? "text-gray-300" : "text-slate-300";
  const highlightClass = darker ? "bg-blue-900/30 text-blue-300" : "bg-blueprint-800 text-blueprint-400";
  const hoverClass = darker ? "hover:bg-gray-800" : "hover:bg-blueprint-900 hover:text-white";

  return (
    <div className={`w-full relative ${className}`} ref={containerRef}>
      {/* Trigger */}
      <div 
        onClick={() => { setIsOpen(!isOpen); if(!isOpen) setSearch(""); }}
        className={`${bgClass} border rounded p-2 text-sm flex items-center justify-between cursor-pointer transition-colors`}
      >
        <span className={`truncate ${textClass}`}>
          {selectedOption ? selectedOption.label : <span className="opacity-50">{placeholder}</span>}
        </span>
        {isOpen ? <ChevronUp size={14} className="opacity-50"/> : <ChevronDown size={14} className="opacity-50"/>}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute top-full left-0 right-0 mt-1 ${dropdownBgClass} border rounded overflow-hidden animate-fade-in shadow-xl z-50`}>
           {/* Search Input */}
           <div className={`p-2 border-b ${darker ? 'border-gray-800' : 'border-blueprint-800'} flex items-center gap-2`}>
              <Search size={12} className="opacity-50" />
              <input 
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索..."
                className="bg-transparent border-none text-xs text-white focus:ring-0 w-full outline-none placeholder-opacity-50"
              />
           </div>
           
           {/* List */}
           <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
              {value && (
                 <div 
                   onClick={() => { onChange(""); setIsOpen(false); }}
                   className={`px-2 py-1.5 text-xs opacity-60 ${hoverClass} rounded cursor-pointer flex items-center gap-2 italic`}
                 >
                    <X size={12}/> 清除选择
                 </div>
              )}

              {filteredOptions.length === 0 ? (
                 <div className="px-2 py-2 text-xs opacity-50 text-center">无匹配项</div>
              ) : (
                 filteredOptions.map((opt) => (
                    <div 
                      key={opt.value}
                      onClick={() => { onChange(opt.value); setIsOpen(false); }}
                      className={`px-2 py-1.5 text-xs rounded cursor-pointer flex flex-col ${opt.value === value ? highlightClass : `${textClass} ${hoverClass}`}`}
                    >
                       <div className="flex items-center justify-between">
                          <span className="font-bold">{opt.label}</span>
                          {opt.value === value && <Check size={12}/>}
                       </div>
                       {(opt.group || opt.sub) && (
                          <div className="text-[10px] opacity-50 flex gap-1">
                             {opt.group && <span>{opt.group}</span>}
                             {opt.sub && <span>• {opt.sub}</span>}
                          </div>
                       )}
                    </div>
                 ))
              )}
           </div>
        </div>
      )}
    </div>
  );
};
