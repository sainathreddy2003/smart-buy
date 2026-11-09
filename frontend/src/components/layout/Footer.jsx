import { Link } from "react-router-dom";
import { Brand } from "./Navbar";

export function Footer() {
  return (
    <footer className="shop-footer">
      <div className="shop-wrap shop-footer-inner">
        <div>
          <Brand />
          <p>Find the tech that fits your life and budget.</p>
        </div>
        <nav aria-label="Footer">
          <Link to="/explore">Explore</Link>
          <Link to="/recommend">Guided search</Link>
          <Link to="/favorites">Saved products</Link>
          <Link to="/history">Search history</Link>
        </nav>
        <small>© {new Date().getFullYear()} SmartBuy AI</small>
      </div>
    </footer>
  );
}
