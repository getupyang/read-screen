import React, { useEffect, useState } from 'react';
import { Film, Loader } from 'lucide-react';
import { MovieCard } from './MovieCard';

interface Movie {
  id: string;
  voice_input: string;
  movie_data: any;
  created_at: string;
}

export const MovieList: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/movies?status=ready');
      const data = await response.json();

      if (data.success) {
        setMovies(data.movies || []);
      } else {
        setError('Failed to load movies');
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={fetchMovies}
            className="text-blue-600 text-sm underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-6">
          <Film className="w-12 h-12 text-purple-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">还没有电影记录</h2>
        <p className="text-gray-500 max-w-xs">
          下拉控制中心，点击 🎤 按钮<br />
          说出想看的电影名称
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          电影清单 <span className="text-sm text-gray-500">({movies.length})</span>
        </h2>
      </div>
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          id={movie.id}
          voiceInput={movie.voice_input}
          movieData={movie.movie_data}
          createdAt={movie.created_at}
        />
      ))}
    </div>
  );
};
