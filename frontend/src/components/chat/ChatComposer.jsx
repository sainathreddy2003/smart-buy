import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Mic, MicOff, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { CategorySelect } from "./CategorySelect";
import { ADVISOR_MESSAGE_LIMIT, SEARCH_QUERY_LIMIT } from "../../lib/chatContext";

export function ChatComposer({ input, setInput, onSend, loading, isHero, selectedCategory, setSelectedCategory, advisor = false }) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const messageLimit = advisor ? ADVISOR_MESSAGE_LIMIT : SEARCH_QUERY_LIMIT;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) setInput((previous) => previous ? `${previous} ${transcript}` : transcript);
    };
    recognition.onerror = () => setVoiceError("Voice input is unavailable. You can type your request below.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [setInput, messageLimit]);

  function toggleVoice() {
    const recognition = recognitionRef.current;
    setVoiceError("");
    if (!recognition) {
      setVoiceError("This browser does not support voice input.");
      return;
    }
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      setVoiceError("Voice input could not start. Try again or type your request.");
    }
  }

  function submit(event) {
    event.preventDefault();
    if (input.trim() && !loading) onSend(input);
  }

  return (
    <div className="w-full max-w-3xl">
      {isHero && (
        <h1 className="chat-showcase-heading">smartbuy<span>.</span></h1>
      )}
      <form className={isHero ? "shop-composer shop-composer-start" : "shop-composer"} onSubmit={submit}>
        <textarea
          aria-label={advisor ? "Question for your advisor" : "Shopping request"}
          placeholder={listening ? "Listening…" : advisor ? "Ask about price, specifications, or which one to buy…" : isHero ? "What are you shopping for today?" : "Example: Laptop for video editing under ₹80,000"}
          rows={isHero ? 1 : 2}
          maxLength={messageLimit}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
        />
        {isHero && <button type="submit" className="shop-send" disabled={loading || !input.trim()} aria-label="Send shopping request"><ArrowRight size={20} /></button>}
        {voiceError && <p role="status" className="px-2 pb-2 text-xs text-[var(--color-danger)]">{voiceError}</p>}
        <div className="shop-composer-actions">
          <CategorySelect value={selectedCategory} onChange={setSelectedCategory} disabled={loading} />
          <div className="flex items-center gap-1">
            <button type="button" className="shop-icon" onClick={toggleVoice} aria-label={listening ? "Stop voice input" : "Use voice input"} aria-pressed={listening}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {!isHero && <button type="submit" className="shop-send" disabled={loading || !input.trim()} aria-label="Send shopping request"><ArrowUp size={20} /></button>}
          </div>
        </div>
      </form>
      {advisor && <p className="mt-2 px-2 text-xs text-[#696378]">Start a new session or choose a category to search for other products.</p>}
      {isHero && <Link to="/recommend" className="shop-text-link chat-guided-link"><SlidersHorizontal size={16} /> Try guided search</Link>}
    </div>
  );
}
