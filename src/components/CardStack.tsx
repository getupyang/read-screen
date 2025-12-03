import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { KnowledgeCard } from './KnowledgeCard';
import { Card } from '../types/card';
import { Trash2, Heart } from 'lucide-react';

interface CardStackProps {
  cards: Array<{ card: Card; imageUrl?: string; id: string }>;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
}

export const CardStack: React.FC<CardStackProps> = ({
  cards,
  onSwipeLeft,
  onSwipeRight
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState<number>(0);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-25, 0, 25]);
  const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5]);

  // 左侧删除指示器透明度
  const leftIndicatorOpacity = useTransform(x, [-150, 0], [1, 0]);
  // 右侧保存指示器透明度
  const rightIndicatorOpacity = useTransform(x, [0, 150], [0, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;

    if (Math.abs(info.offset.x) > threshold) {
      // 判断滑动方向
      const direction = info.offset.x > 0 ? 1 : -1;
      setExitX(direction * 300);

      // 触发回调
      const currentCard = cards[currentIndex];
      if (direction === 1) {
        onSwipeRight(currentCard.id);
      } else {
        onSwipeLeft(currentCard.id);
      }

      // 延迟切换到下一张卡片
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setExitX(0);
        x.set(0);
      }, 200);
    } else {
      // 回弹
      x.set(0);
    }
  };

  if (currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
        >
          <Heart className="w-12 h-12 text-green-600" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎉 收件箱已清空！
        </h2>
        <p className="text-gray-600">
          所有卡片已处理完毕<br />
          继续去刷手机吧~
        </p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[600px] flex items-center justify-center">
      {/* 左滑删除指示器 */}
      <motion.div
        style={{ opacity: leftIndicatorOpacity }}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-0"
      >
        <div className="bg-red-500 rounded-full p-4 shadow-lg">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      {/* 右滑保存指示器 */}
      <motion.div
        style={{ opacity: rightIndicatorOpacity }}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-0"
      >
        <div className="bg-green-500 rounded-full p-4 shadow-lg">
          <Heart className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      {/* 可拖拽的卡片 */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{
          x,
          rotate,
          opacity,
        }}
        animate={exitX !== 0 ? { x: exitX, opacity: 0 } : {}}
        onDragEnd={handleDragEnd}
        className="cursor-grab active:cursor-grabbing z-10"
      >
        <KnowledgeCard
          card={currentCard.card}
          imageUrl={currentCard.imageUrl}
        />
      </motion.div>

      {/* 背景的下一张卡片（预览） */}
      {currentIndex + 1 < cards.length && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0.5 }}
          animate={{ scale: 0.95, opacity: 0.8 }}
          className="absolute top-4 z-0 pointer-events-none"
        >
          <KnowledgeCard
            card={cards[currentIndex + 1].card}
            imageUrl={cards[currentIndex + 1].imageUrl}
          />
        </motion.div>
      )}

      {/* 进度指示器 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? 'w-8 bg-blue-600'
                : i < currentIndex
                ? 'w-2 bg-green-500'
                : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
