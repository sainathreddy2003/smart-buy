import { ArrowUpRight, Clapperboard, Gamepad2, Laptop } from "lucide-react";
import { Link } from "react-router-dom";

const edits = [
  { title: "Gaming", description: "Find a setup for the games you actually play.", draft: "I’m looking for a gaming laptop. My budget is ", icon: Gamepad2, color: "mint" },
  { title: "Video & creation", description: "Find gear for shooting, editing, and publishing.", draft: "I’m looking for a phone for shooting video. My budget is ", icon: Clapperboard, color: "peach" },
  { title: "Everyday use", description: "Find dependable tech for work, school, and home.", draft: "I’m looking for a laptop for everyday use. My budget is ", icon: Laptop, color: "lilac" },
];

export function ShoppingEdits() {
  return (
    <div className="shop-edits">
      {edits.map(({ title, description, draft, icon: Icon, color }) => (
        <Link to="/chat" state={{ draft }} className={`shop-edit shop-edit-${color}`} key={title}>
          <Icon size={36} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <ArrowUpRight className="shop-edit-arrow" size={20} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
