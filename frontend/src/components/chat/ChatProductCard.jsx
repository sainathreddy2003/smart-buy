import { AppleProductCard } from "../product/AppleProductCard";

export function ChatProductCard({ pick }) {
  const { product, matchScore, rankingSource, reasoning, tradeoffs, rank } = pick;

  return (
    <div className="w-72 max-w-full flex-none">
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
