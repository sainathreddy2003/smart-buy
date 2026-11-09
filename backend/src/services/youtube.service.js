import { env } from "../config/env.js";
import { wrap } from "./cache.service.js";

const BASE_URL = "https://youtube138.p.rapidapi.com";

// Videos whose titles suggest they're actually reviews/comparisons/benchmarks
// are ranked above generic results — spec §20's "prioritize reviews, then
// long-term reviews, comparisons, benchmarks."
const REVIEW_SIGNAL = /review|vs\.?|comparison|benchmark|unbox|long.?term|hands.?on/i;

function toReviewCard(video) {
  const thumbnail = video.thumbnails?.[video.thumbnails.length - 1]?.url || video.thumbnails?.[0]?.url;
  return {
    videoId: video.videoId,
    title: video.title,
    channel: video.author?.title,
    publishedTimeText: video.publishedTimeText,
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    thumbnail,
    durationSeconds: video.lengthSeconds,
    views: video.stats?.views,
  };
}

function fallbackFor(query) {
  return {
    fallback: true,
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    videos: [],
  };
}

/**
 * Searches for review videos for a product via RapidAPI's YouTube138 API.
 * Falls back to a plain "search on YouTube" link (no embedded videos) when
 * RAPIDAPI_KEY is unset or the request fails — never breaks the page, and
 * never fabricates a video that wasn't actually returned by the API.
 */
export async function searchReviews(productName, { limit = 6 } = {}) {
  const query = `${productName} review`;

  if (!env.rapidApi.key) {
    return fallbackFor(query);
  }

  try {
    return await wrap(`youtube:${query}`, 6 * 60 * 60 * 1000, async () => {
      const url = new URL(`${BASE_URL}/search/`);
      url.searchParams.set("q", query);
      url.searchParams.set("hl", "en");
      url.searchParams.set("gl", "IN");

      const response = await fetch(url, {
        headers: {
          "x-rapidapi-key": env.rapidApi.key,
          "x-rapidapi-host": "youtube138.p.rapidapi.com",
        },
      });

      if (!response.ok) throw new Error(`YouTube138 request failed (${response.status})`);

      const json = await response.json();
      const videos = (json.contents || [])
        .filter((c) => c.type === "video" && c.video?.videoId)
        .map((c) => c.video)
        .sort((a, b) => (REVIEW_SIGNAL.test(b.title) ? 1 : 0) - (REVIEW_SIGNAL.test(a.title) ? 1 : 0))
        .slice(0, limit)
        .map(toReviewCard);

      console.log(`[YOUTUBE] ${videos.length} videos found for "${query}"`);
      return { fallback: false, searchUrl: null, videos };
    });
  } catch (err) {
    console.warn(`[YOUTUBE] search failed, falling back to search link: ${err.message}`);
    return fallbackFor(query);
  }
}
