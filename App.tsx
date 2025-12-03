import React, { useState } from 'react';
import { Layers, Inbox, RefreshCw, AlertCircle } from 'lucide-react';
import { CardStack } from './src/components/CardStack';
import { useInbox } from './src/hooks/useInbox';

function App() {
  const { items, loading, error, deleteCard, saveCard, triggerAnalysis, refresh } = useInbox();
  const [isTriggering, setIsTriggering] = useState(false);

  // 将InboxItem转换为CardStack需要的格式
  const cards = items
    .filter(item => item.analysis_result?.cards && item.analysis_result.cards.length > 0)
    .flatMap(item =>
      item.analysis_result!.cards.map(card => ({
        id: item.id,
        card,
        imageUrl: item.image_url
      }))
    );

  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    await triggerAnalysis();
    setIsTriggering(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col relative overflow-hidden">
      {/* 顶部导航 */}
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/80 backdrop-blur-sm shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Snapshot AI</h1>
          <p className="text-xs text-gray-500">Capture Now, Process Later</p>
        </div>
        <button
          onClick={refresh}
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-6 h-6 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 加载状态 */}
        {loading && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
            <p className="text-gray-600">正在加载卡片...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">连接失败</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={refresh}
              className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {/* 空状态：有待处理的图片 */}
        {!loading && !error && cards.length === 0 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse mx-auto">
              <Inbox className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">收件箱是空的</h2>
            <p className="text-gray-500 max-w-xs mb-6">
              去刷小红书吧！<br/>
              遇到喜欢的干货，截图并分享给 <span className="font-bold text-blue-600">Snapshot AI</span>。
            </p>

            {/* 触发分析按钮 */}
            <button
              onClick={handleTriggerAnalysis}
              disabled={isTriggering}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="w-5 h-5 inline mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                '🔍 检查待处理图片'
              )}
            </button>

            {/* 模拟卡片预览 */}
            <div className="mt-12 w-full max-w-sm opacity-50 blur-[1px] scale-95 pointer-events-none select-none">
              <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
                <div className="h-4 w-1/3 bg-gray-200 rounded mb-4"></div>
                <div className="h-32 bg-gray-100 rounded-xl mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-gray-200 rounded"></div>
                  <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">✨ AI 整理好的卡片会在这里显示</p>
            </div>
          </div>
        )}

        {/* 卡片展示 */}
        {!loading && !error && cards.length > 0 && (
          <div className="w-full">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                今日收获 <span className="font-bold text-blue-600">{cards.length}</span> 张卡片
              </p>
            </div>
            <CardStack
              cards={cards}
              onSwipeLeft={deleteCard}
              onSwipeRight={saveCard}
            />
          </div>
        )}
      </main>

      {/* 底部版本号 */}
      <footer className="pb-6 text-center">
        <p className="text-[10px] text-gray-400 font-mono">v0.2.0 • Full Experience</p>
      </footer>
    </div>
  );
}

export default App;