import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { api } from "../../lib/api";
import { onImageError } from "../../lib/utils";

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function YouTubeReviews({ query }) {
  const [state, setState] = useState({ loading: true, videos: [], fallback: false, searchUrl: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    api
      .get("/youtube/search", { params: { q: query } })
      .then(({ data }) => {
        if (!cancelled) setState({ loading: false, videos: data.videos || [], fallback: data.fallback, searchUrl: data.searchUrl });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            loading: false,
            videos: [],
            fallback: true,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (state.loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF]">
            <div className="aspect-video bg-[#f3f2f7]" />
            <div className="space-y-2 p-4">
              <div className="h-3.5 w-3/4 rounded bg-[#f3f2f7]" />
              <div className="h-3 w-1/2 rounded bg-[#f3f2f7]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (state.fallback || state.videos.length === 0) {
    return (
      <a
        href={state.searchUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2.5 rounded-xl border border-[#e3e0ea] bg-[#FFFFFF] px-5 py-3.5 text-xs sm:text-sm text-[#5e596c] transition-all hover:border-[#653ad7]/50 hover:bg-[#f3f2f7] hover:text-[#191626]"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#653ad7]/20 text-[#191626]">
          <Play size={12} fill="currentColor" />
        </div>
        <span>Search video benchmarks and teardowns on YouTube</span>
        <ExternalLink size={13} className="text-[#696378]" />
      </a>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {state.videos.map((video) => (
        <a
          key={video.videoId}
          href={video.url}
          target="_blank"
          rel="noreferrer noopener"
          className="group overflow-hidden rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] transition-all duration-300 hover:border-[#653ad7]/50 hover:shadow-[0_0_25px_rgba(33,12,2,0.15)] hover:-translate-y-1"
        >
          <div className="relative aspect-video overflow-hidden bg-[#f3f2f7]">
            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                onError={onImageError}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#191626]/60 bg-[#653ad7]/80 text-white shadow-lg">
                <Play size={20} fill="#fafafc" className="ml-0.5" />
              </div>
            </div>
            {video.durationSeconds && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/85 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white">
                {formatDuration(video.durationSeconds)}
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="line-clamp-2 text-xs sm:text-sm font-medium text-[#191626] group-hover:text-[#191626] transition-colors leading-snug">
              {video.title}
            </p>
            <p className="mt-2 text-[11px] text-[#696378]">
              {video.channel} {video.publishedTimeText ? `· ${video.publishedTimeText}` : ""}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
