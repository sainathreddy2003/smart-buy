import { useEffect, useRef } from "react";

// Grows a textarea to fit its content (up to CSS max-height, which clips to a
// scrollbar beyond that) instead of staying a fixed number of rows.
//
// The resize/measure happens inside requestAnimationFrame rather than
// synchronously: reading scrollHeight right after a style mutation can catch
// a flex-basis:0 item mid-layout (e.g. between StrictMode's double effect
// invocation) at a collapsed width, which inflates scrollHeight from wrapped
// placeholder text. Waiting a frame guarantees layout has settled first.
export function useTextareaResize(value, minRows = 1) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const frame = requestAnimationFrame(() => {
      el.style.height = "auto";
      const lineHeight = parseInt(window.getComputedStyle(el).lineHeight, 10) || 20;
      const minHeight = lineHeight * minRows;
      el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    });

    return () => cancelAnimationFrame(frame);
  }, [value, minRows]);

  return ref;
}
