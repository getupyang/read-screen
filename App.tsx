import React from 'react';
import { Layers, Inbox } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      {/* 顶部导航 */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Snapshot AI</h1>
          <p className="text-xs text-gray-500">Capture Now, Process Later</p>
        </div>
        <div className="p-2 bg-gray-100 rounded-full">
          <Layers className="w-6 h-6 text-gray-600" />
        </div>
      </header>

      {/* 主内容区：空状态展示 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Added animate-pulse to make the change visible */}
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Inbox className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">收件箱是空的</h2>
        <p className="text-gray-500 max-w-xs">
          去刷小红书吧！<br/>
          遇到喜欢的干货，截图并分享给 <span className="font-bold text-blue-600">Snapshot AI</span>。
        </p>
        
        {/* 模拟一条卡片占位符，展示未来的样子 */}
        <div className="mt-12 w-full max-w-sm opacity-50 blur-[1px] scale-95 pointer-events-none select-none">
           <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
              <div className="h-4 w-1/3 bg-gray-200 rounded mb-4"></div>
              <div className="h-32 bg-gray-100 rounded-xl mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-gray-200 rounded"></div>
                <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
              </div>
           </div>
           <p className="text-xs text-gray-400 mt-2">✨ 晚上回来看 AI 整理好的卡片</p>
        </div>
      </main>

      {/* 底部版本号，用于确认部署成功 */}
      <footer className="pb-6 text-center">
        <p className="text-[10px] text-gray-400 font-mono">v0.1.9 • Debugging Mode</p>
      </footer>
    </div>
  );
}

export default App;