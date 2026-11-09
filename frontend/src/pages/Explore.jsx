import { Link } from "react-router-dom";
import { ShoppingEdits } from "../components/landing/ShoppingEdits";

export default function Explore() {
  return (
    <section className="shop-wrap shop-section shop-explore">
      <p className="shop-kicker">SmartBuy Explore</p>
      <h1>Shop by what you do.</h1>
      <p>Choose a use case, add your budget, and find live listings that fit.</p>
      <ShoppingEdits />
      <Link className="shop-text-link" to="/catalog">Browse the product index</Link>
    </section>
  );
}
