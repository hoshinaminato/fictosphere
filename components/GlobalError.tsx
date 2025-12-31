
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShieldAlert, Database } from 'lucide-react';
import { dbDeleteProject, loadAllData } from '../services/storage';

interface GlobalErrorProps {
  children?: ReactNode;
}

interface GlobalErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
}

/**
 * Global error boundary to catch and handle application-level crashes.
 */
// Fix: Use standard inheritance from React.Component to resolve state/props/setState access errors.
export class GlobalError extends React.Component<GlobalErrorProps, GlobalErrorState> {
  public state: GlobalErrorState = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRecovering: false
  };

  constructor(props: GlobalErrorProps) {
    super(props);
  }

  // Static method for state update on error.
  static getDerivedStateFromError(error: Error): Partial<GlobalErrorState> {
    return { hasError: true, error, errorInfo: null, isRecovering: false };
  }

  // Lifecycle method for error catching.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Fix: Use this.setState to correctly update component state.
    this.setState({ errorInfo });
  }

  // 直接操作数据库删除当前可能损坏的工程
  handleEmergencyReset = async () => {
    if (!confirm("确定要执行紧急重置吗？这将清空所有数据并恢复到初始状态。")) return;
    
    // Fix: Use this.setState to indicate recovery mode.
    this.setState({ isRecovering: true });
    try {
      // 1. Clear DB
      const req = indexedDB.deleteDatabase('FictosphereSystemDB');
      req.onsuccess = () => {
         // 2. Reload page to re-seed
         window.location.reload();
      };
      req.onerror = () => {
         alert("数据库删除失败，请手动清除浏览器缓存。");
         window.location.reload();
      };
    } catch (e) {
      console.error(e);
      alert("重置失败。");
      // Fix: Reset recovery state on failure.
      this.setState({ isRecovering: false });
    }
  };

  // 尝试只删除最后访问的项目（通常是导致崩溃的那个）
  handleDeleteActiveProject = async () => {
     // Fix: Use this.setState to indicate recovery mode.
     this.setState({ isRecovering: true });
     try {
        const data = await loadAllData();
        if (data && data.currentProjectId) {
           await dbDeleteProject(data.currentProjectId);
           alert(`已尝试删除导致崩溃的工程 ID: ${data.currentProjectId}`);
           window.location.reload();
        } else {
           alert("无法读取当前工程信息，请尝试【完全重置】。");
           // Fix: Use this.setState to reset state on error.
           this.setState({ isRecovering: false });
        }
     } catch (e) {
        console.error(e);
        alert("操作失败，请尝试【完全重置】。");
        // Fix: Use this.setState to reset state on error.
        this.setState({ isRecovering: false });
     }
  };

  render() {
    // Fix: Access state property from this instance.
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center p-8 text-gray-300 font-mono">
          <div className="max-w-2xl w-full bg-gray-900 border border-red-900/50 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-red-900/20 border-b border-red-900/30 flex items-center gap-3">
               <ShieldAlert size={32} className="text-red-500" />
               <div>
                  <h1 className="text-xl font-bold text-white">系统严重错误 (System Critical Failure)</h1>
                  <p className="text-red-300 text-sm">应用程序遇到无法恢复的错误，UI 已终止渲染。</p>
               </div>
            </div>
            
            <div className="p-6 space-y-6">
               <div className="bg-black/50 p-4 rounded border border-gray-800 font-mono text-xs text-red-400 overflow-auto max-h-32">
                  <div className="flex items-center gap-2 mb-2 font-bold underline">
                     <AlertTriangle size={14} /> 错误堆栈信息:
                  </div>
                  {this.state.error && this.state.error.toString()}
                  <br/>
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
               </div>

               <div className="text-sm text-gray-400">
                  <p className="mb-2">这通常是由于导入了损坏的数据结构导致的。请尝试以下恢复选项：</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                     onClick={() => window.location.reload()}
                     className="flex items-center justify-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-white transition-colors"
                  >
                     <RefreshCw size={16} /> 刷新页面 (重试)
                  </button>

                  <button 
                     onClick={this.handleDeleteActiveProject}
                     disabled={this.state.isRecovering}
                     className="flex items-center justify-center gap-2 p-3 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-800 text-orange-200 rounded transition-colors"
                  >
                     <Trash2 size={16} /> 删除当前工程 (保留其他)
                  </button>
               </div>
               
               <div className="pt-4 border-t border-gray-800">
                  <button 
                     onClick={this.handleEmergencyReset}
                     disabled={this.state.isRecovering}
                     className="w-full flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg shadow-red-900/20 transition-colors"
                  >
                     <Database size={16} /> 完全重置系统 (清空所有数据)
                  </button>
                  <p className="text-xs text-center text-gray-600 mt-2">
                     注意：完全重置将清除 IndexedDB 中的所有工程。
                  </p>
               </div>
            </div>
          </div>
        </div>
      );
    }

    // Fix: Access children from this.props.
    return this.props.children;
  }
}
