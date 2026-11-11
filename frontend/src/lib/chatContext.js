export const SEARCH_QUERY_LIMIT = 500;
export const ADVISOR_MESSAGE_LIMIT = 1000;

// Keep the latest request intact while retaining as much earlier context as fits.
export function buildSearchQuery(queries) {
  const latest = (queries.at(-1) || "").trim().slice(0, SEARCH_QUERY_LIMIT);
  const previous = queries.slice(0, -1).join(". ").trim();
  const remaining = SEARCH_QUERY_LIMIT - latest.length - 2;
  return previous && remaining > 0
    ? `${previous.slice(0, remaining)}. ${latest}`
    : latest;
}

export function buildChatHistory(messages) {
  return messages
    .filter((message) => !message.error && ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: (message.content ?? message.text ?? message.intro ?? "").trim().slice(0, 2000),
    }))
    .filter(({ content }) => content)
    .slice(-8);
}
