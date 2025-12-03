/**
 * 知识卡片类型定义
 */

export enum CardType {
  CONCEPT = 'CONCEPT',       // 概念解释
  INSIGHT = 'INSIGHT',       // 深度洞察
  TUTORIAL = 'TUTORIAL',     // 教程/方法
  QUOTE = 'QUOTE',           // 金句
  FACT = 'FACT'              // 事实/数据
}

export interface Card {
  type: CardType;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  color: string;
}

export interface InboxItem {
  id: string;
  image_url: string;
  status: 'uploaded' | 'ready' | 'error';
  source: string;
  created_at: string;
  analysis_result?: {
    cards: Card[];
  };
}
