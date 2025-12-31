
import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface EditorHintsProps {
  items: string[];
  className?: string;
}

export const EditorHints: React.FC<EditorHintsProps> = ({ items, className = "top-16 right-4" }) => (
  <div className={`absolute z-[60] pointer-events-none select-none animate-fade-in ${className}`}>
    <div className="bg-blueprint-800/90 backdrop-blur-sm border border-blueprint-500/50 p-2.5 rounded shadow-lg text-xs text-blueprint-500 font-mono text-right space-y-1">
      {items.map((item, i) => <p key={i}>{item}</p>)}
    </div>
  </div>
);

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale?: number;
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ onZoomIn, onZoomOut, onReset, scale, className = "bottom-4 right-4" }) => (
  <div className={`absolute flex flex-col gap-2 bg-blueprint-800/90 p-1 rounded border border-blueprint-700 z-50 shadow-lg ${className}`}>
     <button onClick={onZoomIn} className="p-2 text-blueprint-500 hover:bg-blueprint-700 rounded transition-colors" title="放大">
        <ZoomIn size={18} />
     </button>
     <button onClick={onZoomOut} className="p-2 text-blueprint-500 hover:bg-blueprint-700 rounded transition-colors" title="缩小">
        <ZoomOut size={18} />
     </button>
     <button onClick={onReset} className="p-2 text-blueprint-500 hover:bg-blueprint-700 rounded transition-colors" title="重置视图">
        <Maximize size={18} />
     </button>
     {scale && (
        <div className="text-[10px] text-center text-blueprint-600 font-mono pt-1 border-t border-blueprint-700/50">
           {Math.round(scale * 100)}%
        </div>
     )}
  </div>
);
