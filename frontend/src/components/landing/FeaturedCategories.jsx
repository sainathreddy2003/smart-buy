import { useNavigate } from "react-router-dom";
import { Smartphone, Laptop, Headphones, Watch, ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";

const categories = [
  { key: "laptop", label: "Laptops", subtitle: "Ultrabooks, Creator & Gaming Rigs", icon: Laptop, count: 6 },
  { key: "smartphone", label: "Smartphones", subtitle: "Flagships, Cameras & Battery Champs", icon: Smartphone, count: 6 },
  { key: "headphones", label: "Headphones", subtitle: "Studio Monitors & ANC Commuters", icon: Headphones, count: 5 },
  { key: "smartwatch", label: "Smartwatches", subtitle: "Fitness Trackers & Luxury Wearables", icon: Watch, count: 5 },
];

export function FeaturedCategories() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-[#050505] py-28 border-t border-[#29231D]">
      <div className="relative mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#D99A51] px-3 py-1 rounded-full border border-[#D99A51]/30 bg-[#D99A51]/10">
            Curated Ecosystems
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-normal tracking-tight text-[#F5F0E8]">
            Explore by hardware category.
          </h2>
          <p className="mt-4 text-base text-[#A39A8C]">
            Filter verified models, compare spec sheets, and track live price drops.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, i) => (
            <Reveal key={cat.key} delay={i * 0.08}>
              <button
                type="button"
                onClick={() => navigate(`/catalog?category=${cat.key}`)}
                className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border border-[#29231D] bg-[#0A0908] p-8 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-[#D99A51]/60 hover:bg-[#11100F] hover:shadow-[0_0_30px_rgba(33,12,2,0.18)] cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#3D332B] bg-[#11100F] text-[#E6C18A] transition-all duration-300 group-hover:scale-110 group-hover:border-[#D99A51]/60 group-hover:bg-[#181614]">
                      <cat.icon size={22} strokeWidth={1.8} />
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#29231D] bg-[#11100F] text-[#A39A8C] transition-colors group-hover:border-[#D99A51]/40 group-hover:text-[#E6C18A]">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-normal text-[#F5F0E8] tracking-tight">
                    {cat.label}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#A39A8C]">
                    {cat.subtitle}
                  </p>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-[#29231D]/80 pt-4 text-xs">
                  <span className="text-[#6B6358] group-hover:text-[#A39A8C] transition-colors">
                    {cat.count} curated items
                  </span>
                  <span className="font-medium text-[#D99A51] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    View Catalog →
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
