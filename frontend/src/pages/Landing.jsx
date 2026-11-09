import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "../components/landing/Hero";
import { ShoppingEdits } from "../components/landing/ShoppingEdits";

export default function Landing() {
  return (
    <div className="shop-wrap">
      <Hero />
      <section className="shop-section" aria-labelledby="edits-title">
        <div className="shop-section-heading">
          <div>
            <p className="shop-kicker">The shopping edits</p>
            <h2 id="edits-title">What are you buying for?</h2>
          </div>
          <Link to="/explore" className="shop-text-link">Explore <ArrowUpRight size={17} /></Link>
        </div>
        <ShoppingEdits />
      </section>
    </div>
  );
}
