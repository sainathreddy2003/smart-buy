import { AppleProductCard } from "../product/AppleProductCard";

export function ChatProductCard({ pick }) {
  const { product, matchScore, rankingSource, reasoning, tradeoffs, rank } = pick;

  return (
    <div className="min-w-0 w-full">
      <AppleProductCard
        product={product}
        rank={rank}
        matchScore={matchScore}
        rankingSource={rankingSource}
        reasoning={reasoning}
        tradeoffs={tradeoffs}
      />
    </div>
  );
}
