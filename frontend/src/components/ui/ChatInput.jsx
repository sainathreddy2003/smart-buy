import { createContext, useContext } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTextareaResize } from "../../hooks/useTextareaResize";

const ChatInputContext = createContext({});

export function ChatInput({
  children,
  className,
  value,
  onChange,
  onSubmit,
  loading,
  onStop,
  rows = 1,
}) {
  return (
    <ChatInputContext.Provider value={{ value, onChange, onSubmit, loading, onStop, rows }}>
      <div
        className={cn(
          "flex w-full items-end gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)] transition-colors focus-within:border-[var(--color-accent)]/60",
          className
        )}
      >
        {children}
      </div>
    </ChatInputContext.Provider>
  );
}

export function ChatInputTextArea({ placeholder, className, ...props }) {
  const { value = "", onChange, onSubmit, rows } = useContext(ChatInputContext);
  const textareaRef = useTextareaResize(value, rows);

  function handleKeyDown(e) {
    if (!onSubmit) return;
    if (e.key === "Enter" && !e.shiftKey) {
      if (!value.trim()) return;
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "max-h-48 min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]",
        className
      )}
      {...props}
    />
  );
}

export function ChatInputSubmit({ className }) {
  const { value = "", onSubmit, loading, onStop } = useContext(ChatInputContext);
  const isDisabled = !value.trim();

  if (loading && onStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop"
        className={cn(
          "flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border-strong)]",
          className
        )}
      >
        <Square size={14} fill="currentColor" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled || loading}
      onClick={(e) => {
        e.preventDefault();
        if (!isDisabled) onSubmit?.();
      }}
      aria-label="Send"
      className={cn(
        "flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-contrast)] transition-opacity hover:brightness-110 disabled:opacity-35",
        className
      )}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <ArrowUp size={16} strokeWidth={2.25} />
      )}
    </button>
  );
}
