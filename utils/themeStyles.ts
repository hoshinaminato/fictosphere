
import { ThemeMode } from '../types';

export const getGlobalThemeCSS = (theme: ThemeMode) => {
  const commonOverrides = `
    .app-wrapper { transition: background-color 0.5s, color 0.5s; }
  `;

  switch(theme) {
    case 'SCRAPBOOK':
      return `
        ${commonOverrides}
        .app-wrapper { font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', sans-serif; letter-spacing: 0.5px; }
        .app-wrapper .bg-gray-950, .bg-blueprint-900, .bg-gray-900\/30, .bg-gray-900\/50 { 
           background-color: #fffef9 !important; 
           background-image: 
             linear-gradient(#e5e7eb 1px, transparent 1px), 
             linear-gradient(90deg, #e5e7eb 1px, transparent 1px) !important;
           background-size: 20px 20px !important;
        }
        .app-wrapper .bg-gray-900, .app-wrapper .bg-gray-800, .bg-blueprint-800, .bg-gray-700, .bg-gray-800\/50, .bg-gray-800\/30 {
           background-color: #ffffff !important;
           border: 2px solid #f3f4f6 !important;
           border-radius: 4px !important;
           box-shadow: 3px 3px 0px rgba(0,0,0,0.05) !important;
           color: #4b5563 !important;
        }
        .app-wrapper .bg-gray-700, .bg-blue-900\/50, .bg-green-900\/50 {
           background-color: #fef3c7 !important;
           color: #92400e !important;
           border: 2px dashed #f59e0b !important;
        }
        .border-blueprint-700, .border-gray-700, .border-gray-800, .border-gray-600 { border-color: #e5e7eb !important; }
        .app-wrapper .text-white, .app-wrapper .text-slate-300, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { 
           color: #57534e !important; 
        }
        .app-wrapper .text-blue-400, .text-blue-500, .text-blueprint-500 { 
           color: #db2777 !important; 
        }
        .app-wrapper .text-green-500, .text-green-400 { color: #059669 !important; } 
        .app-wrapper button {
           border: none !important;
           font-weight: bold;
        }
        .app-wrapper button.rounded-lg, .app-wrapper button.rounded-md {
           border: 2px solid transparent !important;
        }
        .app-wrapper button:hover {
           background-color: #f3f4f6 !important;
           color: #000 !important;
           transform: rotate(-1deg);
        }
        .blueprint-grid {
           background-image: none !important;
        }
      `;

    case 'INK':
      return `
        ${commonOverrides}
        .app-wrapper { font-family: 'KaiTi', 'STKaiti', serif; }
        .app-wrapper { filter: contrast(1.1); }
        .app-wrapper .bg-gray-950, .app-wrapper .bg-gray-900, .bg-blueprint-900, .bg-blueprint-950, .bg-gray-900\/30, .bg-gray-900\/50 {
           background-color: #f5f5f7 !important;
           color: #000000 !important;
        }
        .app-wrapper .bg-gray-800, .bg-blueprint-800, .bg-gray-700, .bg-gray-800\/50, .bg-gray-800\/30 {
           background-color: #ffffff !important;
           border: 1px solid #000 !important;
        }
        .border-blueprint-700, .border-gray-700, .border-gray-800, .border-gray-600 { border-color: #999 !important; }
        .app-wrapper .text-white, .app-wrapper .text-slate-300, .text-blueprint-500, .text-gray-200, .text-gray-300, .text-gray-400 { color: #000 !important; }
        .app-wrapper .text-gray-500, .app-wrapper .text-slate-500 { color: #333 !important; }
        .app-wrapper button, .app-wrapper input, .app-wrapper select, .app-wrapper textarea {
           background-color: #fff !important;
           border: 1px solid #000 !important;
           color: #000 !important;
        }
        .blueprint-grid {
           background-image: linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px) !important;
           opacity: 0.3;
        }
      `;

    case 'CYBERPUNK':
      return `
        ${commonOverrides}
        .app-wrapper { font-family: 'Courier New', monospace; letter-spacing: 1px; }
        .app-wrapper .bg-gray-950, .bg-blueprint-900 { background-color: #050505 !important; }
        .app-wrapper .bg-gray-900, .app-wrapper .bg-gray-800, .bg-blueprint-800, .bg-gray-900\/30 {
           background-color: rgba(10, 10, 10, 0.95) !important;
           border: 1px solid #00ffff !important;
           box-shadow: 0 0 5px rgba(0, 255, 255, 0.2);
        }
        .border-blueprint-700, .border-gray-700, .border-gray-800, .border-gray-600 { border-color: #005555 !important; }
        .app-wrapper .text-white, .app-wrapper .text-slate-300, .text-gray-200 { color: #e0faff !important; text-shadow: 0 0 2px #00ffff; }
        .app-wrapper .text-gray-400, .text-gray-500 { color: #00aaaa !important; }
        .app-wrapper .text-blue-400, .app-wrapper .text-blue-500, .text-blueprint-500 { color: #ff00ff !important; text-shadow: 0 0 5px #ff00ff; }
        .app-wrapper button:hover {
           background-color: rgba(0, 255, 255, 0.1) !important;
          }
        .blueprint-grid {
           background-image: linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px) !important;
        }
      `;

    case 'CARTOON':
      return `
        ${commonOverrides}
        .app-wrapper { font-family: 'Arial Rounded MT Bold', 'Verdana', sans-serif; }
        .app-wrapper .bg-gray-950, .bg-blueprint-900 { background-color: #87ceeb !important; }
        .app-wrapper .bg-gray-900, .app-wrapper .bg-gray-800, .bg-blueprint-800, .bg-gray-700, .bg-gray-800\/50, .bg-gray-900\/50 {
           background-color: #ffffff !important;
           border: 3px solid #000000 !important;
           border-radius: 12px !important;
           box-shadow: 4px 4px 0px #000000 !important;
           color: #000 !important;
        }
        .border-blueprint-700, .border-gray-700, .border-gray-800, .border-gray-600 { border-color: #000 !important; border-width: 2px !important; }
        .app-wrapper .text-white, .app-wrapper .text-slate-300, .text-blueprint-500, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500 { 
           color: #000 !important; 
           text-shadow: none !important;
        }
        .app-wrapper .text-blue-400, .text-blue-500 { color: #0000ff !important; }
        .app-wrapper button {
           background-color: #ffdd00 !important;
           border: 2px solid #000 !important;
           border-radius: 8px !important;
           font-weight: bold;
           color: #000 !important;
           box-shadow: 2px 2px 0px #000 !important;
        }
        .app-wrapper button:active { transform: translate(2px, 2px); box-shadow: none !important; }
        .blueprint-grid {
           background-image: linear-gradient(rgba(255,255,255,0.4) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.4) 2px, transparent 2px) !important;
        }
      `;

    default: // BLUEPRINT
       return `
          ${commonOverrides}
          .blueprint-grid {
             background-image: 
              linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px) !important;
          }
       `;
  }
};
