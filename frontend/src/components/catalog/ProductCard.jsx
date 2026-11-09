import { AppleProductCard } from "../product/AppleProductCard";

export function ProductCard({ product, index = 0 }) {
  return <AppleProductCard product={product} index={index} />;
}
