import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router (with BrowserRouter, not a data router) doesn't reset scroll
// position on navigation — without this, navigating from a long page (e.g.
// the landing page) to a short one leaves the new page's content scrolled
// out of view above the fold.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return null;
}
