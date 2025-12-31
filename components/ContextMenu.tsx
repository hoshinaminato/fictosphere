
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Scissors, Trash2, ClipboardPaste } from 'lucide-react';

interface ContextMenuProps {
  // 可以根据需要添加全局配置
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  isEditable: boolean;
  hasSelection: boolean;
  target: HTMLElement | null;
}

export const ContextMenu: React.FC<ContextMenuProps> = () => {
  const [menu, setMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    isEditable: false,
    hasSelection: false,
    target: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    // 检查点击目标
    const target = e.target as HTMLElement;
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    const isContentEditable = target.isContentEditable;
    const selection = window.getSelection()?.toString();
    
    // 如果不是文本或输入框，且没有选中任何文本，则不显示自定义菜单
    if (!isInput && !isContentEditable && (!selection || selection.length === 0)) {
        setMenu(prev => ({ ...prev, visible: false }));
        return;
    }

    e.preventDefault();

    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      isEditable: isInput || isContentEditable,
      hasSelection: !!selection && selection.length > 0,
      target: target,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', closeMenu);
    document.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('scroll', closeMenu, true);
    };
  }, [handleContextMenu, closeMenu]);

  // 执行命令
  const executeCommand = async (command: string) => {
    if (!menu.target) return;
    
    const target = menu.target;
    target.focus();

    if (command === 'paste') {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart || 0;
          const end = target.selectionEnd || 0;
          const val = target.value;
          
          // 更新 DOM 元素的值
          target.value = val.substring(0, start) + text + val.substring(end);
          
          // 设置新的光标位置
          const newPos = start + text.length;
          target.setSelectionRange(newPos, newPos);

          // 关键：触发 input 事件，让 React 监听到变化并更新 state
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (target.isContentEditable) {
          // 对可编辑元素执行插入
          document.execCommand('insertText', false, text);
        }
      } catch (err) {
        console.error('粘贴失败，可能未授予剪贴板权限:', err);
      }
    } else {
      // 复制、剪切、删除通常可以通过 execCommand 工作（因为它们不需要读取权限）
      try {
        document.execCommand(command);
        // 如果是删除或剪切，手动触发 input 事件以同步状态
        if (command === 'delete' || command === 'cut') {
            target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (err) {
        console.error('执行命令失败:', err);
      }
    }
    closeMenu();
  };

  if (!menu.visible) return null;

  // 调整菜单位置，防止溢出屏幕
  const menuWidth = 160;
  const menuHeight = 160;
  const x = menu.x + menuWidth > window.innerWidth ? menu.x - menuWidth : menu.x;
  const y = menu.y + menuHeight > window.innerHeight ? menu.y - menuHeight : menu.y;

  const MenuItem = ({ icon: Icon, label, onClick, disabled = false, danger = false }: any) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
        ${disabled ? 'opacity-30 cursor-not-allowed text-gray-500' : 
          danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-200 hover:bg-blue-600/20 hover:text-blue-400'}
      `}
    >
      <Icon size={14} />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden py-1 animate-scale-in"
      style={{ left: x, top: y }}
    >
      <MenuItem 
        icon={Copy} 
        label="复制" 
        onClick={() => executeCommand('copy')} 
        disabled={!menu.hasSelection && !menu.isEditable} 
      />
      
      {menu.isEditable && (
        <>
          <MenuItem 
            icon={Scissors} 
            label="剪切" 
            onClick={() => executeCommand('cut')} 
            disabled={!menu.hasSelection} 
          />
          <MenuItem 
            icon={ClipboardPaste} 
            label="粘贴" 
            onClick={() => executeCommand('paste')} 
          />
          <div className="h-px bg-gray-800 my-1 mx-2" />
          <MenuItem 
            icon={Trash2} 
            label="删除" 
            onClick={() => executeCommand('delete')} 
            disabled={!menu.hasSelection}
            danger={true}
          />
        </>
      )}
    </div>
  );
};
