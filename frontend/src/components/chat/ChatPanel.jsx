import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { api, getErrorMessage } from "../../lib/api";
import { Spinner } from "../ui/Spinner";
import { ADVISOR_MESSAGE_LIMIT, buildChatHistory } from "../../lib/chatContext";

export function ChatPanel({ recommendationId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hey! I'm SmartBuy AI. Ask me anything about your shortlisted recommendations — spec differences, battery endurance, or which one offers maximum value for your exact budget.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e) {
    e.preventDefault();
    const message = input.trim().slice(0, ADVISOR_MESSAGE_LIMIT);
    if (!message || loading) return;

    const history = buildChatHistory(messages);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post("/chat", { recommendationId, message, history });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex h-13 w-13 items-center justify-center rounded-full border border-[#653ad7]/80 bg-gradient-to-tr from-[#653ad7] to-[#191626] text-white shadow-[0_0_25px_rgba(33,12,2,0.35)] cursor-pointer"
        aria-label="Toggle buying assistant chat"
      >
        {open ? <X size={20} strokeWidth={2.5} /> : <MessageCircle size={20} strokeWidth={2.5} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-22 right-6 z-40 flex h-[520px] w-[370px] sm:w-[400px] flex-col overflow-hidden rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] shadow-sm backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e3e0ea] bg-[#f3f2f7] px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ccc6dc] bg-[#edeaf6] text-[#191626]">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#191626]">Recommendation Advisor</h4>
                  <p className="text-[10px] text-[#5e596c]">Grounded spec comparisons</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#5e596c] hover:text-[#191626] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message Thread */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-xs scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                      m.role === "user"
                        ? "border border-[#ccc6dc] bg-[#edeaf6] text-[#191626]"
                        : "border border-[#e3e0ea] bg-[#f3f2f7] text-[#191626]"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#191626] pl-1">
                  <Spinner size={14} />
                  <span>Thinking through spec trade-offs...</span>
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-[#A92C34]/30 bg-[#A92C34]/10 p-2 text-center text-xs text-[#A92C34]">
                  {error}
                </p>
              )}
            </div>

            {/* Input Composer */}
            <form onSubmit={sendMessage} className="border-t border-[#e3e0ea] bg-[#f3f2f7] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={ADVISOR_MESSAGE_LIMIT}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about these picks..."
                  className="flex-1 rounded-lg border border-[#e3e0ea] bg-[#FFFFFF] px-3 py-2 text-xs text-[#191626] placeholder:text-[#696378] focus:border-[#653ad7]/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[#653ad7]/70 bg-gradient-to-r from-[#653ad7] to-[#191626] text-white disabled:opacity-40 transition-transform active:scale-95 cursor-pointer font-bold"
                >
                  <Send size={13} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
