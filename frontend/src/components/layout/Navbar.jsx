import { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Clock, Heart, LogOut, Menu, Search, X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useCompareStore } from "../../store/compareStore";
import { api } from "../../lib/api";

export function Brand() {
  return <Link to="/" className="shop-brand" aria-label="SmartBuy home">smartbuy<span>.</span></Link>;
}

export function Navbar() {
  const [openPath, setOpenPath] = useState(null);
  const { user, clearSession } = useAuthStore();
  const compareCount = useCompareStore((state) => state.ids.length);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const open = openPath === pathname;

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
      navigate("/");
    }
  }

  return (
    <header className="shop-header">
      <div className="shop-nav">
        <Brand />
        <nav className="shop-nav-links" aria-label="Main navigation">
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/chat">Shopping assistant</NavLink>
          <NavLink to="/compare">Compare{compareCount > 0 && ` (${compareCount})`}</NavLink>
        </nav>
        <div className="shop-nav-actions">
          <Link className="shop-icon" to="/chat" aria-label="Search products"><Search size={19} /></Link>
          {user ? (
            <>
              <NavLink className="shop-icon" to="/favorites" aria-label="Saved products"><Heart size={19} /></NavLink>
              <NavLink className="shop-icon" to="/history" aria-label="Search history"><Clock size={19} /></NavLink>
              <button className="shop-icon" type="button" onClick={handleLogout} aria-label="Sign out"><LogOut size={19} /></button>
            </>
          ) : <Link className="shop-button shop-button-small" to="/login">Sign in</Link>}
          <button className="shop-icon shop-menu" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpenPath(open ? null : pathname)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="shop-mobile-nav" aria-label="Mobile navigation">
          <NavLink to="/explore" onClick={() => setOpenPath(null)}>Explore</NavLink>
          <NavLink to="/chat" onClick={() => setOpenPath(null)}>Shopping assistant</NavLink>
          <NavLink to="/compare" onClick={() => setOpenPath(null)}>Compare{compareCount > 0 && ` (${compareCount})`}</NavLink>
          <NavLink to="/recommend" onClick={() => setOpenPath(null)}>Guided search</NavLink>
        </nav>
      )}
    </header>
  );
}
