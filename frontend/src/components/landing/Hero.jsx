import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Headphones, Laptop, Pause, Play, Search, Smartphone, Watch } from "lucide-react";

const categories = [
  { label: "Laptops", icon: Laptop, draft: "I’m looking for a laptop. My budget is " },
  { label: "Phones", icon: Smartphone, draft: "I’m looking for a phone. My budget is " },
  { label: "Headphones", icon: Headphones, draft: "I’m looking for headphones. My budget is " },
  { label: "Smartwatches", icon: Watch, draft: "I’m looking for a smartwatch. My budget is " },
];

const slides = [
  { device: "laptop", name: "Laptops", title: "Find your next upgrade.", description: "From gaming to video editing, find a laptop that fits what you do and what you want to spend.", placeholder: "Gaming laptop under ₹70,000" },
  { device: "phone", name: "Phones", title: "Find a phone that fits.", description: "Tell us what matters most, from camera quality to battery life. Compare live offers within your budget.", placeholder: "Camera phone under ₹40,000" },
  { device: "headphones", name: "Headphones", title: "Find your next pair.", description: "Compare headphones for commuting, calls, or getting lost in music. Start with what you want to spend.", placeholder: "Noise-cancelling headphones under ₹10,000" },
];

export function Hero() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const slide = slides[index];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || paused || engaged || query.trim()) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % slides.length);
    }, 4400);
    return () => window.clearInterval(timer);
  }, [visible, paused, engaged, query, index]);

  function submit(event) {
    event.preventDefault();
    if (query.trim()) navigate("/chat", { state: { initialQuery: query.trim() } });
  }

  return (
    <>
      <nav className="shop-categories" aria-label="Shop by device">
        {categories.map(({ label, icon: Icon, draft }) => (
          <Link key={label} to="/chat" state={{ draft }}><Icon size={19} strokeWidth={1.7} />{label}</Link>
        ))}
      </nav>
      <section className="shop-hero" aria-label="Find your next upgrade" ref={sectionRef}>
        <div className="shop-hero-art" aria-hidden="true">
          <img key={slide.device} className="shop-device-photo" src={`/devices/${slide.device}.png`} alt="" />
        </div>
        <div className="shop-hero-copy">
          <div className="shop-hero-story">
            <div className="shop-hero-chapter" key={slide.device}>
              <p className="shop-hero-number">{String(index + 1).padStart(2, "0")}.</p>
              <h1>{slide.title}</h1>
              <p className="shop-hero-description">{slide.description}</p>
            </div>
          </div>
          <form className="shop-search" onSubmit={submit} role="search" aria-label="Find tech">
            <Search size={21} aria-hidden="true" />
            <input aria-label="What are you shopping for?" value={query} onFocus={() => setEngaged(true)} onBlur={() => setEngaged(false)} onChange={(event) => setQuery(event.target.value)} placeholder={slide.placeholder} maxLength={500} />
            <button type="submit" aria-label="Find picks" disabled={!query.trim()}><ArrowRight size={21} /></button>
          </form>
          <div className="shop-hero-actions">
            <Link className="shop-text-link" to="/recommend">Try guided search <ArrowRight size={16} /></Link>
            <div className="shop-hero-controls" role="group" aria-label="Featured devices">
              {slides.map(({ name }, position) => (
                <button type="button" key={name} aria-label={`Show ${name}`} aria-pressed={index === position} onClick={() => {
                  setIndex(position);
                  setPaused(true);
                }}><span /></button>
              ))}
              <button type="button" aria-label={paused ? "Play showcase" : "Pause showcase"} onClick={() => setPaused((current) => !current)}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
