export interface CopilotChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
}

const STORAGE_KEY = 'deen_copilot_chat_history_v1';
const MAX_SAVED_MESSAGES = 100;

export function loadSavedChatHistory(): CopilotChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to load chat history from localStorage:', err);
    return [];
  }
}

export function saveChatHistory(messages: CopilotChatMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Keep only the most recent MAX_SAVED_MESSAGES
    const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save chat history to localStorage:', err);
  }
}

export function clearSavedChatHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear chat history from localStorage:', err);
  }
}

/**
 * Extracts unique previous user questions for quick 1-click re-use.
 */
export function getPreviousUserQueries(messages: CopilotChatMessage[]): string[] {
  const userQueries = messages
    .filter((m) => m.sender === 'user' && m.text.trim().length > 0)
    .map((m) => m.text.trim());

  // Return unique queries in reverse chronological order
  const unique = Array.from(new Set(userQueries));
  return unique.reverse().slice(0, 10);
}

/**
 * Exports chat conversation transcript as formatted Markdown text.
 */
export function exportChatTranscriptMarkdown(messages: CopilotChatMessage[]): string {
  const timestamp = new Date().toLocaleString();
  let markdown = `# DEEN Copilot Chat Transcript\n`;
  markdown += `*Exported on ${timestamp}*\n\n---\n\n`;

  for (const msg of messages) {
    const role = msg.sender === 'user' ? '👤 **Merchant**' : '🤖 **DEEN Copilot**';
    markdown += `### ${role} (${msg.timestamp})\n\n`;
    markdown += `${msg.text.trim()}\n\n---\n\n`;
  }

  return markdown;
}
