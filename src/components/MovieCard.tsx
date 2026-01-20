import React from 'react';
import { Calendar, Star } from 'lucide-react';

interface MovieData {
  title: string;
  originalTitle?: string;
  year: string;
  poster: string | null;
  overview: string;
  genres: string[];
  tmdbRating: number | null;
  doubanRating: number | null;
  runtime: number | null;
}

interface MovieCardProps {
  id: string;
  voiceInput: string;
  movieData: MovieData;
  createdAt: string;
}

export const MovieCard: React.FC<MovieCardProps> = ({ id, voiceInput, movieData, createdAt }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-400';
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4 hover:shadow-xl transition-shadow">
      {/* 海报和基本信息 */}
      <div className="flex">
        {/* 左侧海报 */}
        {movieData.poster ? (
          <img
            src={movieData.poster}
            alt={movieData.title}
            className="w-28 h-40 object-cover"
          />
        ) : (
          <div className="w-28 h-40 bg-gray-200 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}

        {/* 右侧信息 */}
        <div className="flex-1 p-4">
          {/* 标题 */}
          <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1">
            {movieData.title}
          </h3>
          {movieData.originalTitle && movieData.originalTitle !== movieData.title && (
            <p className="text-xs text-gray-500 mb-2">{movieData.originalTitle}</p>
          )}

          {/* 年份和类型 */}
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600">{movieData.year}</span>
            {movieData.genres && movieData.genres.length > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-xs text-gray-600">
                  {movieData.genres.slice(0, 2).join(', ')}
                </span>
              </>
            )}
          </div>

          {/* 评分 */}
          <div className="flex items-center gap-3">
            {movieData.tmdbRating && (
              <div className="flex items-center gap-1">
                <Star className={`w-4 h-4 ${getRatingColor(movieData.tmdbRating)} fill-current`} />
                <span className={`text-sm font-semibold ${getRatingColor(movieData.tmdbRating)}`}>
                  {movieData.tmdbRating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">TMDB</span>
              </div>
            )}
            {movieData.doubanRating && (
              <div className="flex items-center gap-1">
                <Star className={`w-4 h-4 ${getRatingColor(movieData.doubanRating)} fill-current`} />
                <span className={`text-sm font-semibold ${getRatingColor(movieData.doubanRating)}`}>
                  {movieData.doubanRating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">豆瓣</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 语音输入原文 */}
      <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
        <p className="text-sm text-blue-800">
          <span className="font-medium">🎤 </span>
          "{voiceInput}"
        </p>
        <p className="text-xs text-blue-600 mt-1">{formatDate(createdAt)}</p>
      </div>

      {/* 简介（可选） */}
      {movieData.overview && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-700 line-clamp-2">
            {movieData.overview}
          </p>
        </div>
      )}
    </div>
  );
};
