import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InboxItem } from '../types/card';

export const useInbox = () => {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取收件箱数据
  const fetchInbox = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('inbox')
        .select('*')
        .eq('status', 'ready') // 只获取已分析完成的
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setItems(data || []);
    } catch (err: any) {
      console.error('获取数据失败:', err);
      setError(err.message || '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 触发未处理图片的分析
  const triggerAnalysis = async () => {
    try {
      const { data: uploadedItems } = await supabase
        .from('inbox')
        .select('id, image_url')
        .eq('status', 'uploaded');

      if (!uploadedItems || uploadedItems.length === 0) {
        console.log('没有待处理的图片');
        return;
      }

      console.log(`找到 ${uploadedItems.length} 张待处理图片，触发分析...`);

      // 触发分析API
      const baseUrl = window.location.origin;

      for (const item of uploadedItems) {
        try {
          await fetch(`${baseUrl}/api/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: item.id,
              imageUrl: item.image_url
            })
          });
          console.log(`✅ 已触发分析: ${item.id}`);
        } catch (err) {
          console.error(`❌ 触发失败 ${item.id}:`, err);
        }
      }

      // 等待几秒后刷新
      setTimeout(() => {
        fetchInbox();
      }, 3000);
    } catch (err) {
      console.error('触发分析失败:', err);
    }
  };

  // 删除卡片（左滑）
  const deleteCard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inbox')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // 从本地状态中移除
      setItems((prev) => prev.filter((item) => item.id !== id));
      console.log('🗑️ 已删除:', id);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  // 保存卡片（右滑）- 后续可以扩展为存入knowledge库
  const saveCard = async (id: string) => {
    try {
      // 目前只是简单地标记为已处理，从inbox移除
      // 未来可以添加到单独的"知识库"表
      const { error } = await supabase
        .from('inbox')
        .update({ status: 'saved' })
        .eq('id', id);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== id));
      console.log('💾 已保存:', id);
    } catch (err) {
      console.error('保存失败:', err);
    }
  };

  useEffect(() => {
    // 初始加载
    fetchInbox();

    // 自动触发待处理图片的分析（静默处理）
    triggerAnalysis();

    // 每30秒自动刷新一次，获取新生成的卡片
    const interval = setInterval(() => {
      fetchInbox();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    items,
    loading,
    error,
    deleteCard,
    saveCard,
    triggerAnalysis,
    refresh: fetchInbox
  };
};
