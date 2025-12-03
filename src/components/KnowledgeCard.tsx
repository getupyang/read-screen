import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardType } from '../types/card';
import { Book, Lightbulb, Code, Quote, FileText } from 'lucide-react';

interface KnowledgeCardProps {
  card: Card;
  imageUrl?: string;
}

const getCardIcon = (type: CardType) => {
  switch (type) {
    case CardType.CONCEPT:
      return <Book className="w-5 h-5" />;
    case CardType.INSIGHT:
      return <Lightbulb className="w-5 h-5" />;
    case CardType.TUTORIAL:
      return <Code className="w-5 h-5" />;
    case CardType.QUOTE:
      return <Quote className="w-5 h-5" />;
    case CardType.FACT:
      return <FileText className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

const getTypeLabel = (type: CardType) => {
  const labels = {
    [CardType.CONCEPT]: '概念',
    [CardType.INSIGHT]: '洞察',
    [CardType.TUTORIAL]: '教程',
    [CardType.QUOTE]: '金句',
    [CardType.FACT]: '事实'
  };
  return labels[type] || '内容';
};

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({ card, imageUrl }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: card.color || '#ffffff' }}
    >
      {/* 顶部标签栏 */}
      <div className="bg-white/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gray-100 rounded-full">
            {getCardIcon(card.type)}
          </div>
          <span className="text-sm font-semibold text-gray-700">
            {getTypeLabel(card.type)}
          </span>
        </div>
        <div className="flex gap-2">
          {card.tags.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="px-6 py-6 bg-white">
        {/* 标题 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
          {card.title}
        </h2>

        {/* 摘要 */}
        <p className="text-gray-600 mb-4 leading-relaxed">
          {card.summary}
        </p>

        {/* 分隔线 */}
        <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4"></div>

        {/* 详细内容 */}
        <div
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: card.content.replace(/\n/g, '<br>') }}
        />

        {/* 原始截图缩略图（可选） */}
        {imageUrl && (
          <div className="mt-6 rounded-xl overflow-hidden border border-gray-200">
            <img
              src={imageUrl}
              alt="原始截图"
              className="w-full h-32 object-cover opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-6 py-4 bg-gray-50 text-center">
        <p className="text-xs text-gray-500">
          👈 左滑删除 · 右滑保存 👉
        </p>
      </div>
    </motion.div>
  );
};
