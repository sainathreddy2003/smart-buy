import { AppleProductCard } from "../product/AppleProductCard";

export function ChatProductCard({ pick }) {
  const { product, matchScore, reasoning, tradeoffs, rank } = pick;

  return (
    <div className="w-72 max-w-full flex-none">
      <AppleProductCard
        product={product}
        rank={rank}
        matchScore={matchScore}
        reasoning={reasoning}
        tradeoffs={tradeoffs}
      />
    </div>
  );
}