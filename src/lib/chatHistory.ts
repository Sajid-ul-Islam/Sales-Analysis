export interface CopilotChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
  appliedRules?: string[];
}

const CURRENT_STORAGE_KEY = 'deen_assistant_chat_history_v2';
const LEGACY_STORAGE_KEY = 'deen_copilot_chat_history_v1';
const MAX_SAVED_MESSAGES = 100;

export function loadSavedChatHistory(): CopilotChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    let raw = localStorage.getItem(CURRENT_STORAGE_KEY);
    let isLegacy = false;

    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) isLegacy = true;
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    if (isLegacy) {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (_) {}
    }

    const sanitized = parsed
      .map((msg: CopilotChatMessage) => {
        if (!msg || typeof msg.text !== 'string') return msg;

        // Discard legacy welcome message so fresh DEEN Assistant welcome is generated
        if (
          msg.id === 'welcome' &&
          (msg.text.includes('DEEN Copilot') ||
            msg.text.includes('Business Assistant') ||
            msg.text.includes('Operations & Reconciliation Assistant'))
        ) {
          return null;
        }

        const cleanText = msg.text
          .replace(/DEEN Copilot/g, 'DEEN Assistant')
          .replace(/Business Assistant/g, 'DEEN Assistant')
          .replace(/Operations & Reconciliation Assistant/g, 'Executive E-Commerce & Reconciliation Analyst');

        return {
          ...msg,
          text: cleanText,
        };
      })
      .filter(Boolean) as CopilotChatMessage[];

    if (isLegacy || sanitized.length !== parsed.length) {
      saveChatHistory(sanitized);
    }

    return sanitized;
  } catch (err) {
    console.error('Failed to load chat history from localStorage:', err);
    return [];
  }
}

export function saveChatHistory(messages: CopilotChatMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
    localStorage.setItem(CURRENT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save chat history to localStorage:', err);
  }
}

export function clearSavedChatHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CURRENT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
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
  let markdown = `# DEEN Assistant Chat Transcript\n`;
  markdown += `*Exported on ${timestamp}*\n\n---\n\n`;

  for (const msg of messages) {
    const role = msg.sender === 'user' ? '👤 **Merchant**' : '🤖 **DEEN Assistant**';
    markdown += `### ${role} (${msg.timestamp})\n\n`;
    markdown += `${msg.text.trim()}\n\n---\n\n`;
  }

  return markdown;
}
