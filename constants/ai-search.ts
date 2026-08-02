import {
  MovieIntentResult,
  parseMovieIntentFallback,
} from './movie-intent';

export const parseMovieIntent = async (
  query: string,
  _preferences?: MovieIntentResult['filters']
): Promise<MovieIntentResult & { source: string }> => {
  return {
    ...parseMovieIntentFallback(query),
    source: 'local',
  };
};
