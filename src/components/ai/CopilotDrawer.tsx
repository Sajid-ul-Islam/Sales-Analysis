"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SummaryAnalytics } from '@/types';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import {
  computeBranchMetrics,
  computeCourierAuditSummary,
  computeSkuRiskSummary,
  computeCustomerRiskSummary,
  AnalyticsSlices
} from '@/lib/ai/semanticAnalytics';
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
import { getTabContext } from '@/lib/ai/contextualPrompts';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SummaryAnalytics;
  reconciliationResult?: ReconciliationResult;
  activeTab?: string;
}

export function CopilotDrawer({ isOpen, onClose, summary, reconciliationResult, activeTab }: CopilotDrawerProps) {
  const currentContext = getTabContext(activeTab);
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showHistoryChips, setShowHistoryChips] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Deterministically precompute analytical slices for high-precision query grounding
  const analyticsSlices: AnalyticsSlices | undefined = useMemo(() => {
    if (!reconciliationResult) return undefined;
    return {
      branches: computeBranchMetrics(reconciliationResult.reconciledOrders),
      courierAudit: computeCourierAuditSummary(reconciliationResult.courierMismatches),
      skuLoss: computeSkuRiskSummary(reconciliationResult.skuAnalytics),
      customerRisk: computeCustomerRiskSummary(reconciliationResult.customerRiskProfiles),
    };
  }, [reconciliationResult]);

  // Initialize messages from localStorage on mount and ensure welcome message is always fresh
  useEffect(() => {
    const defaultWelcome: CopilotChatMessage = {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am **DEEN Assistant**, your Executive E-Commerce & Reconciliation Analyst.\n\nI have real-time access to your reconciled store metrics (**${summary?.grossOrders?.toLocaleString() || 0} gross orders**, **৳${Math.round(summary?.netDeliveredRevenue || 0).toLocaleString()} net sales**).\n\nAsk me anything about your returns, courier settlement gaps, linehaul territory ratios, or SKU profitability!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const saved = loadSavedChatHistory();
    if (saved && saved.length > 0) {
      // If history contains an old welcome message, ensure it is refreshed to the DEEN Assistant identity
      const hasWelcome = saved.some(m => m.id === 'welcome');
      const refreshed = saved.map(m => (m.id === 'welcome' ? defaultWelcome : m));
      const finalInitial = hasWelcome ? refreshed : [defaultWelcome, ...refreshed];
      setMessages(finalInitial);
      saveChatHistory(finalInitial);
    } else {
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
          activeTab,
          tabLabel: currentContext.label,
          pageContext: currentContext.summaryFocus,
          analyticsSlices,
        })
      });

      const data = await res.json();
      const assistantText = data?.answer || 'I could not generate an answer at this time. Please try again.';

      const botMsg: CopilotChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data?.source || 'ai',
        appliedRules: data?.appliedRules || [],
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
    a.download = `deen_assistant_chat_${new Date().toISOString().slice(0, 10)}.md`;
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
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0A0A0A] shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-[#1F1F1F] z-10 animate-slideInRight">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 dark:border-[#1F1F1F] flex items-center justify-between bg-[#0F172A] dark:bg-[#000000] text-white shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EB5A19]/20 border border-[#EB5A19]/40 flex items-center justify-center text-[#EB5A19] shadow-xs">
              <Sparkles className="w-4 h-4 text-[#EB5A19] dark:text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-sm text-white">DEEN Assistant</h3>
                <button
                  type="button"
                  onClick={() => setIsBYOKModalOpen(true)}
                  className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                  title="Configure Bring Your Own Key (BYOK)"
                >
                  <Key className="w-2.5 h-2.5 text-orange-400" />
                  <span>{byokConfig.isActive ? byokConfig.model : 'BYOK Key'}</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-400 block font-normal">
                Executive Intelligence & Reconciliation Analyst
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Export Transcript */}
            <button
              type="button"
              onClick={handleExportTranscript}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
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
                  className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700 cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] hover:bg-slate-600 cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="p-1.5 text-slate-400 hover:text-rose-300 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear saved chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auto-detected Page Context Banner */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-[#0D0D0D] border-b border-slate-200 dark:border-[#1F1F1F] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              Context:
            </span>
            <span className="text-xs font-bold text-[#EB5A19] dark:text-orange-400 truncate">
              {currentContext.label}
            </span>
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-orange-100/70 dark:bg-orange-950/50 text-[#EB5A19] dark:text-orange-300 font-semibold border border-orange-200/50 dark:border-orange-900/50 shrink-0">
              {currentContext.badge}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
            Auto-adapted intelligence
          </span>
        </div>

        {/* Suggestion Chips Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-[#080808] border-b border-slate-100 dark:border-[#1F1F1F] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 shrink-0">Suggestions:</span>
            {currentContext.prompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuery(qp)}
                className="text-[11px] font-medium bg-white dark:bg-[#121212] hover:bg-orange-50 dark:hover:bg-[#1A1A1A] text-slate-700 dark:text-slate-200 hover:text-[#EB5A19] dark:hover:text-orange-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#262626] hover:border-orange-300 dark:hover:border-orange-500/30 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <span>{qp}</span>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
              </button>
            ))}
          </div>

          {previousQueries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryChips(prev => !prev)}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                showHistoryChips
                  ? 'bg-orange-50 dark:bg-[#1A1A1A] text-[#EB5A19] dark:text-orange-300 border-orange-200 dark:border-orange-500/30'
                  : 'bg-white dark:bg-[#121212] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#262626]'
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
          <div className="px-4 py-2 bg-slate-100/70 dark:bg-[#0D0D0D] border-b border-slate-200 dark:border-[#1F1F1F] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 animate-fadeIn">
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-[#EB5A19] dark:text-orange-400" />
              <span>Past Queries:</span>
            </span>
            {previousQueries.slice(0, 5).map((qText, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => {
                  setInputQuery(qText);
                }}
                className="text-[10px] font-medium bg-white dark:bg-[#141414] hover:bg-orange-50 dark:hover:bg-[#1F1F1F] text-slate-800 dark:text-slate-200 hover:text-[#EB5A19] dark:hover:text-orange-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#262626] hover:border-orange-300 dark:hover:border-orange-500/30 shrink-0 shadow-2xs transition-colors truncate max-w-[200px] cursor-pointer"
                title={`Click to re-use: "${qText}"`}
              >
                &ldquo;{qText}&rdquo;
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages Log with Rich Markdown Formatting */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-[#050505] text-xs">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} group`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#f26322] to-[#EB5A19] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 shadow-2xs leading-relaxed relative ${
                    isUser
                      ? 'bg-[#EB5A19] text-white rounded-tr-xs shadow-xs'
                      : 'bg-white dark:bg-[#0D0D0D] border border-slate-200 dark:border-[#1F1F1F] text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {/* Rich Markdown Formatter */}
                  <AIMarkdownMessage content={m.text} isUser={isUser} />

                  {/* Applied Business Rules & Policies Badge */}
                  {!isUser && m.appliedRules && m.appliedRules.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-[#1F1F1F]">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Rules Applied:
                      </span>
                      {m.appliedRules.map((rule, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-[#EB5A19] dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Meta & Action Bar */}
                  <div
                    className={`flex items-center justify-between gap-3 mt-2.5 pt-2 border-t text-[10px] ${
                      isUser ? 'border-white/20 text-white/80' : 'border-slate-100 dark:border-[#1F1F1F] text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="font-mono">{m.timestamp}</span>

                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      {isUser ? (
                        <button
                          type="button"
                          onClick={() => setInputQuery(m.text)}
                          className="hover:underline flex items-center gap-1 text-[10px] text-white/90 cursor-pointer"
                          title="Re-use this prompt in input"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          <span>Re-ask</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(m.id, m.text)}
                          className="hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 text-[10px] cursor-pointer"
                          title="Copy message text"
                        >
                          {copiedMsgId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
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
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#1F1F1F] text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 text-xs py-3 pl-2 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-[#141414] border border-orange-200/80 dark:border-[#262626] flex items-center justify-center text-[#EB5A19] dark:text-orange-400">
                <Sparkles className="w-4 h-4 animate-spin text-[#EB5A19] dark:text-orange-400" />
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">DEEN Assistant is analyzing...</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Auditing territory ratio, SKUs & COD margins</span>
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
          className="p-3.5 border-t border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] flex items-center gap-2 shadow-sm"
        >
          <input
            type="text"
            placeholder="Ask anything about your sales, returns, linehaul territory, or SKU costs..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#262626] bg-white dark:bg-[#0D0D0D] text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#EB5A19]/20 focus:border-[#EB5A19] disabled:bg-slate-50 dark:disabled:bg-[#141414] shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#EB5A19] hover:bg-[#d44e13] disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
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
