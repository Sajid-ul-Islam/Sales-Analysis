"use client";

import React, { useState, useRef, useEffect } from 'react';
import { SummaryAnalytics } from '@/types';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  Compass,
  ArrowRight,
  Key,
  Download,
  Trash2,
  Copy,
  Check,
  History,
  CornerDownLeft
} from 'lucide-react';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';
import { AIMarkdownMessage } from '@/components/ai/AIMarkdownMessage';
import {
  loadSavedChatHistory,
  saveChatHistory,
  clearSavedChatHistory,
  getPreviousUserQueries,
  exportChatTranscriptMarkdown,
  CopilotChatMessage
} from '@/lib/chatHistory';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SummaryAnalytics;
}

const QUICK_PROMPTS = [
  'Summarize our return risk and territory ratio',
  'What is our net realized revenue vs gross dispatched?',
  'Why is Outside Dhaka return rate higher than Dhaka?',
  'What actionable advice do you have for customer service?'
];

export function CopilotDrawer({ isOpen, onClose, summary }: CopilotDrawerProps) {
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showHistoryChips, setShowHistoryChips] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize messages from localStorage on mount
  useEffect(() => {
    const saved = loadSavedChatHistory();
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      const defaultWelcome: CopilotChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        text: `Hello! I am **DEEN Copilot**, your Executive AI Operations & Reconciliation Assistant.\n\nI have real-time access to your reconciled store metrics (**${summary?.grossOrders?.toLocaleString() || 0} gross orders**, **৳${Math.round(summary?.netDeliveredRevenue || 0).toLocaleString()} net sales**).\n\nAsk me anything about your returns, courier settlement gaps, linehaul territory ratios, or SKU profitability!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([defaultWelcome]);
      saveChatHistory([defaultWelcome]);
    }
  }, [summary?.grossOrders, summary?.netDeliveredRevenue]);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Listen for BYOK updates across components
  useEffect(() => {
    const handleBYOKUpdate = (e: any) => {
      if (e.detail) {
        setByokConfig(e.detail);
      }
    };
    window.addEventListener('deen_byok_updated', handleBYOKUpdate);
    return () => window.removeEventListener('deen_byok_updated', handleBYOKUpdate);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendQuery = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: CopilotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveChatHistory(updatedWithUser);
    setInputQuery('');
    setIsLoading(true);

    try {
      const currentBYOK = loadBYOKConfig();
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          summary,
          history: messages.slice(-8), // Pass recent conversation context
          byok: currentBYOK.isActive ? currentBYOK : undefined,
        })
      });

      const data = await res.json();
      const assistantText = data?.answer || 'I could not generate an answer at this time. Please try again.';

      const botMsg: CopilotChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data?.source || 'ai'
      };

      const finalMessages = [...updatedWithUser, botMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (err: any) {
      const errMsg: CopilotChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Network error communicating with AI server. Please verify your connection or API key.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedWithUser, errMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    clearSavedChatHistory();
    const freshWelcome: CopilotChatMessage = {
      id: `welcome-${Date.now()}`,
      sender: 'assistant',
      text: `Chat history cleared. Ready to analyze your **${summary?.grossOrders?.toLocaleString() || 0} reconciled orders** with clean context.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([freshWelcome]);
    saveChatHistory([freshWelcome]);
    setConfirmClear(false);
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleExportTranscript = () => {
    const markdown = exportChatTranscriptMarkdown(messages);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deen_copilot_chat_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extract previous user questions for 1-click reuse
  const previousQueries = getPreviousUserQueries(messages);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 z-10 animate-slideInRight">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-primary shadow-xs">
              <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-sm text-white">DEEN Copilot</h3>
                <button
                  type="button"
                  onClick={() => setIsBYOKModalOpen(true)}
                  className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                  title="Configure Bring Your Own Key"
                >
                  <Key className="w-2.5 h-2.5 text-indigo-300" />
                  <span>{byokConfig.isActive ? byokConfig.model : 'BYOK Key'}</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-300 block">
                Executive After-Sales & Reconciliation Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Export Transcript */}
            <button
              type="button"
              onClick={handleExportTranscript}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Export chat transcript (.md)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear History with Confirm */}
            {confirmClear ? (
              <div className="flex items-center gap-1 bg-rose-950/80 p-1 rounded-lg border border-rose-500/40 animate-fadeIn">
                <span className="text-[10px] text-rose-200 px-1 font-bold">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] hover:bg-slate-600"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="p-1.5 text-slate-400 hover:text-rose-300 rounded-lg hover:bg-white/10 transition-colors"
                title="Clear saved chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Suggestion Chips Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Suggestions:</span>
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuery(qp)}
                className="text-[11px] font-medium bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2.5 py-1 rounded-full border border-slate-200 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95"
              >
                <span>{qp}</span>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
              </button>
            ))}
          </div>

          {previousQueries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryChips(prev => !prev)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 transition-colors ${
                showHistoryChips
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
              title="Toggle previous questions from local storage"
            >
              <History className="w-3 h-3" />
              <span>History ({previousQueries.length})</span>
            </button>
          )}
        </div>

        {/* Re-usable Previous Queries Tray (from local storage) */}
        {showHistoryChips && previousQueries.length > 0 && (
          <div className="px-4 py-2 bg-indigo-50/40 border-b border-indigo-100/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 animate-fadeIn">
            <span className="text-[10px] uppercase font-bold text-indigo-900/60 shrink-0 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-indigo-600" />
              <span>Re-Use Past Questions:</span>
            </span>
            {previousQueries.slice(0, 5).map((qText, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => {
                  setInputQuery(qText);
                }}
                className="text-[10px] font-medium bg-white hover:bg-indigo-100 text-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-200/80 shrink-0 shadow-2xs transition-colors truncate max-w-[200px]"
                title={`Click to re-use: "${qText}"`}
              >
                &ldquo;{qText}&rdquo;
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages Log with Rich Markdown Formatting */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 text-xs">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} group`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 shadow-2xs leading-relaxed relative ${
                    isUser
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {/* Rich Markdown Formatter */}
                  <AIMarkdownMessage content={m.text} isUser={isUser} />

                  {/* Message Meta & Action Bar */}
                  <div
                    className={`flex items-center justify-between gap-3 mt-2.5 pt-2 border-t text-[10px] ${
                      isUser ? 'border-white/20 text-white/80' : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    <span className="font-mono">{m.timestamp}</span>

                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      {isUser ? (
                        <button
                          type="button"
                          onClick={() => setInputQuery(m.text)}
                          className="hover:underline flex items-center gap-1 text-[10px] text-white/90"
                          title="Re-use this prompt in input"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          <span>Re-ask</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(m.id, m.text)}
                          className="hover:text-slate-700 flex items-center gap-1 text-[10px]"
                          title="Copy message text"
                        >
                          {copiedMsgId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Answer</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-slate-500 text-xs py-3 pl-2 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Sparkles className="w-4 h-4 animate-spin text-primary" />
              </div>
              <div>
                <span className="font-bold text-slate-700 block">DEEN Copilot is calculating...</span>
                <span className="text-[10px] text-slate-400">Auditing territory ratio, SKUs & COD margins</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="p-3.5 border-t border-slate-200 bg-white flex items-center gap-2 shadow-sm"
        >
          <input
            type="text"
            placeholder="Ask anything about your sales, returns, linehaul territory, or SKU costs..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-300 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>

      </div>

      {/* BYOK Configuration Modal */}
      <BYOKModal
        isOpen={isBYOKModalOpen}
        onClose={() => setIsBYOKModalOpen(false)}
        onSaved={(cfg) => setByokConfig(cfg)}
      />
    </div>
  );
}
