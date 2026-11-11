import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RotateCcw, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, getErrorMessage } from "../lib/api";
import { categoryLabel, formatPrice } from "../lib/utils";
import { ChatProductCard } from "../components/chat/ChatProductCard";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ADVISOR_MESSAGE_LIMIT, SEARCH_QUERY_LIMIT, buildChatHistory, buildSearchQuery } from "../lib/chatContext";

let nextId = 1;
const uid = () => nextId++;
const productCategories = ["laptop", "smartphone", "headphones", "smartwatch", "tablet", "monitor"];

function requirementChips(requirement) {
  const chips = [];
  if (requirement.category) chips.push(categoryLabel(requirement.category));
  if (requirement.budget?.max) chips.push(`≤ ${formatPrice(requirement.budget.max)}`);
  if (requirement.useCases?.length) chips.push(requirement.useCases.join(", "));
  return chips;
}

export default function Chat() {
  const location = useLocation();
  const productId = new URLSearchParams(location.search).get("productId");
  return <ChatSession key={productId || "search"} productId={productId} />;
}

function ChatSession({ productId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => location.state?.draft || "");
  const [busy, setBusy] = useState(false);
  const [productLoading, setProductLoading] = useState(Boolean(productId));
  const [productName, setProductName] = useState("");
  const [advisorTarget, setAdvisorTarget] = useState(() => productId ? { productId } : null);
  const [selectedCategory, setSelectedCategory] = useState(() => productCategories.includes(location.state?.category) ? location.state.category : "all");
  const scrollRef = useRef(null);
  const conversationRef = useRef([]);
  const clarifyStreakRef = useRef(0);
  const sentInitialRef = useRef(false);
  const loading = busy || productLoading;

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    api.get(`/products/${encodeURIComponent(productId)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const product = data.product;
        setProductName(product.name);
        if (productCategories.includes(product.category)) {
          setSelectedCategory(product.category);
        }
        setMessages([{
          id: uid(),
          role: "assistant",
          kind: "text",
          text: `Let's talk about ${product.name}. Ask about its specifications, available prices, or whether it fits your needs.`,
        }]);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setMessages([{ id: uid(), role: "assistant", kind: "text", text: getErrorMessage(err), error: true }]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductLoading(false);
      });
    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    const transcript = scrollRef.current;
    const latest = transcript?.lastElementChild;
    if (latest) {
      // Show the start of a tall reply so its summary is visible before scrolling through the cards.
      transcript.scrollTop = latest.offsetTop - 16;
    }
  }, [messages, loading]);

  useEffect(() => {
    const initial = location.state?.initialQuery;
    if (!productId && initial && !sentInitialRef.current) {
      sentInitialRef.current = true;
      send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushMessage(msg) {
    setMessages((prev) => [...prev, { id: uid(), ...msg }]);
  }

  function handleReset(category = "all", draft = "") {
    setMessages([]);
    conversationRef.current = [];
    clarifyStreakRef.current = 0;
    setAdvisorTarget(null);
    setProductName("");
    setSelectedCategory(category);
    setInput(draft);
    if (productId) navigate("/chat", { replace: true, state: { category, draft } });
  }

  function handleCategoryChange(category) {
    if (loading) return;
    handleReset(category, input);
  }

  async function send(text) {
    const trimmed = text.trim().slice(0, advisorTarget ? ADVISOR_MESSAGE_LIMIT : SEARCH_QUERY_LIMIT);
    if (!trimmed || loading) return;

    const history = buildChatHistory(messages);
    pushMessage({ role: "user", text: trimmed });
    setInput("");
    setBusy(true);

    try {
      if (advisorTarget) {
        const { data } = await api.post("/chat", { ...advisorTarget, message: trimmed, history });
        pushMessage({ role: "assistant", kind: "text", text: data.reply });
        return;
      }

      let contextualQuery = trimmed;
      const prefix = `${categoryLabel(selectedCategory)}: `;
      if (selectedCategory !== "all" && !trimmed.toLowerCase().includes(selectedCategory) && prefix.length + trimmed.length <= SEARCH_QUERY_LIMIT) {
        contextualQuery = `${prefix}${trimmed}`;
      }
      conversationRef.current = [...conversationRef.current, contextualQuery];
      const fullContext = buildSearchQuery(conversationRef.current);
      const { data: analysis } = await api.post("/ai/analyze-requirement", {
        query: fullContext,
      });
      const requirement = analysis.requirement;
      if (selectedCategory && selectedCategory !== "all") {
        requirement.category = selectedCategory;
        requirement.clarificationNeeded = false;
      }

      if (requirement.clarificationNeeded) {
        clarifyStreakRef.current += 1;
        if (clarifyStreakRef.current >= 2) {
          pushMessage({
            role: "assistant",
            kind: "text",
            text: "I still don't have enough to go on — let's switch to the guided step-by-step flow instead.",
          });
          setTimeout(() => navigate("/recommend"), 1200);
        } else {
          pushMessage({ role: "assistant", kind: "text", text: requirement.clarifyingQuestion });
        }
        setBusy(false);
        return;
      }

      clarifyStreakRef.current = 0;
      const { clarificationNeeded: _c, clarifyingQuestion: _q, source: _s, ...body } = requirement;
      const { data } = await api.post("/recommendations", { ...body, query: fullContext });
      const rec = data.recommendation;
      setAdvisorTarget({ recommendationId: rec._id });

      pushMessage({
        role: "assistant",
        kind: "products",
        intro: rec.summary || "Here is your ranked shortlist evaluated across live specs and current market prices:",
        chips: requirementChips(requirement),
        picks: [...rec.picks].sort((a, b) => a.rank - b.rank),
        recommendationId: rec._id,
      });
    } catch (err) {
      pushMessage({ role: "assistant", kind: "text", text: getErrorMessage(err), error: true });
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = messages.length === 0 && !productId;

  return (
    <div className={`relative flex flex-col bg-[#fafafc] text-[#191626] ${isEmpty
      ? "min-h-[calc(100vh-4rem)]"
      : "chat-session min-h-0 flex-1"}`}>
      {/* Top Header Bar when conversation is active */}
      {!isEmpty && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e3e0ea] bg-[#fafafc] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="shop-chat-symbol"><Search size={17} /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-medium text-[#191626] tracking-tight">
                  SmartBuy AI
                </span>
                <span className="rounded-full bg-[#653ad7]/15 border border-[#653ad7]/30 px-2 py-0.5 text-[10px] font-semibold text-[#191626]">
                  {selectedCategory !== "all" ? categoryLabel(selectedCategory) : "All Hardware"}
                </span>
              </div>
              <p className="max-w-[min(60vw,28rem)] truncate text-[11px] text-[#5e596c]">{productId ? productName || "Product advisor" : advisorTarget ? "Your shortlist advisor" : "Active Recommendation Session"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleReset()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-[#e3e0ea] bg-[#f3f2f7] px-3 py-1.5 text-xs text-[#5e596c] hover:border-[#653ad7]/50 hover:bg-[#edeaf6] hover:text-[#191626] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>New Session</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Chat Content Area */}
      {isEmpty ? (
        <div className="chat-showcase">
          <div className="chat-showcase-pair chat-showcase-top" aria-hidden="true">
            <img src="/devices/laptop.png" alt="" />

          </div>
          <div className="chat-showcase-tile chat-showcase-left" aria-hidden="true">
            <img src="/devices/phone.png" alt="" />
            <span>Phones</span>
          </div>
          <div className="chat-showcase-tile chat-showcase-right" aria-hidden="true">
            <img src="/devices/headphones.png" alt="" />
            <span>Headphones</span>
          </div>
          <div className="chat-showcase-pair chat-showcase-bottom" aria-hidden="true">
            <img src="/devices/controller.png" alt="" />

          </div>
          <div className="chat-showcase-tile chat-showcase-camera" aria-hidden="true">
            <img src="/devices/camera.png" alt="" />
            <span>Cameras</span>
          </div>
          <div className="chat-showcase-tile chat-showcase-watch" aria-hidden="true">
            <img src="/devices/watch.png" alt="" />
            <span>Smartwatches</span>
          </div>
          <ChatComposer
            input={input}
            setInput={setInput}
            onSend={send}
            loading={loading}
            isHero={true}
            selectedCategory={selectedCategory}
            setSelectedCategory={handleCategoryChange}
          />
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
          <div
            ref={scrollRef}
            role="region"
            aria-label="Conversation"
            tabIndex={0}
            className="relative min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-4 py-4"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChatMessage msg={msg} />
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-sm text-[#5e596c] py-2 pl-2"
              >
                <span className="shop-chat-symbol"><Search size={16} /></span>
                <span className="animate-pulse text-xs tracking-wide text-[#191626]">
                  {productLoading ? "Loading product details…" : advisorTarget ? "Checking the product details for your answer…" : "Checking live offers against your request…"}
                </span>
              </motion.div>
            )}
          </div>

          <div className="chat-session-composer relative z-10 flex shrink-0 justify-center border-t border-[#e3e0ea] bg-[#fafafc] px-4 pb-3 pt-2">
            <ChatComposer
              input={input}
              setInput={setInput}
              onSend={send}
              loading={loading}
              isHero={false}
              selectedCategory={selectedCategory}
              setSelectedCategory={handleCategoryChange}
              advisor={Boolean(advisorTarget)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] wrap-anywhere rounded-2xl rounded-br-sm border border-[#ccc6dc] bg-[#f3f2f7] px-4.5 py-3 text-sm text-[#191626] shadow-lg leading-relaxed font-sans">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3.5">
      <div className="flex-none mt-1">
        <span className="shop-chat-symbol"><Search size={16} /></span>
      </div>
      <div className="min-w-0 flex-1">
        {msg.kind === "text" && (
          <div className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm border border-[#e3e0ea] bg-[#FFFFFF] px-4.5 py-3 text-sm text-[#191626] shadow-sm backdrop-blur-md leading-relaxed font-sans">
            {msg.text}
          </div>
        )}

        {msg.kind === "products" && (
          <div className="space-y-3.5">
            <div className="inline-block rounded-2xl rounded-tl-sm border border-[#e3e0ea] bg-[#FFFFFF] px-4.5 py-3 text-sm text-[#191626] shadow-sm backdrop-blur-md leading-relaxed">
              {msg.intro}
            </div>

            {msg.chips?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {msg.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#653ad7]/30 bg-[#f3f2f7] px-2.5 py-0.5 text-xs font-medium text-[#191626] shadow-sm"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4 pb-4 pt-1">
              {msg.picks.map((pick) => (
                <ChatProductCard key={pick.product._id} pick={pick} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
