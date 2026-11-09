import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuthStore } from "./store/authStore";
import { useFavoritesStore } from "./store/favoritesStore";
import Landing from "./pages/Landing";
import Chat from "./pages/Chat";
import Recommend from "./pages/Recommend";
import Results from "./pages/Results";
import Explore from "./pages/Explore";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Favorites from "./pages/Favorites";
import Compare from "./pages/Compare";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

export default function App() {
  const user = useAuthStore((s) => s.user);
  const fetchFavorites = useFavoritesStore((s) => s.fetchFavorites);
  const clearFavorites = useFavoritesStore((s) => s.clear);

  useEffect(() => {
    if (user) fetchFavorites();
    else clearFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="chat" element={<Chat />} />
          <Route path="recommend" element={<Recommend />} />
          <Route path="results/:id" element={<Results />} />
          <Route path="explore" element={<Explore />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="catalog/:id" element={<ProductDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route
            path="favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route path="compare" element={<Compare />} />
          <Route
            path="history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
