import React, { useState } from 'react';
import { Layers, Camera, Film } from 'lucide-react';
import { MovieList } from './src/components/MovieList';

type TabType = 'screenshots' | 'movies';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('movies');

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

      {/* Tab导航 */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('screenshots')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'screenshots'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span className="font-medium">截图</span>
          </button>
          <button
            onClick={() => setActiveTab('movies')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'movies'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Film className="w-4 h-4" />
            <span className="font-medium">电影</span>
          </button>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'screenshots' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Camera className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">截图功能即将上线</h2>
            <p className="text-gray-500 max-w-xs">
              敬请期待知识卡片功能
            </p>
          </div>
        ) : (
          <MovieList />
        )}
      </main>

      {/* 底部版本号 */}
      <footer className="pb-6 text-center bg-white border-t border-gray-100">
        <p className="text-[10px] text-gray-400 font-mono">v0.2.0 • Voice + Movie</p>
      </footer>
    </div>
  );
}

export default App;