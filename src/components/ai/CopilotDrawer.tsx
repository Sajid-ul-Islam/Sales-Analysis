"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SummaryAnalytics, RawOrderRow } from '@/types';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import {
  computeBranchMetrics,
  computeCourierAuditSummary,
  computeSkuRiskSummary,
  computeCustomerRiskSummary,
  computeLiveOpsSlice,
  AnalyticsSlices
} from '@/lib/ai/semanticAnalytics';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  RotateCcw,
  ArrowRight,
  Key,
  Download,
  Trash2,
  Copy,
  Check,
  History,
  CornerDownLeft,
  Tag,
  CheckCircle2,
  Database,
  Terminal,
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
  CopilotChatMessage,
} from '@/lib/chatHistory';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';
import { trimOrderRowsForSql } from '@/lib/edgeCache';
import { detectDirectSql } from '@/lib/ai/sqlEngine';
import { getTabContext } from '@/lib/ai/contextualPrompts';
import { detectAgenticIntent } from '@/lib/ai/agenticActions';
import { AgenticActionProposal } from '@/types';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SummaryAnalytics;
  reconciliationResult?: ReconciliationResult;
  liveOrders?: RawOrderRow[];
  activeTab?: string;
  initialQuery?: string;
  onClearInitialQuery?: () => void;
  onApplyAgenticAction?: (proposal: AgenticActionProposal) => void;
  onNavigateToTab?: (tab: string, filter?: string) => void;
}

export function CopilotDrawer({
  isOpen,
  onClose,
  summary,
  reconciliationResult,
  liveOrders,
  activeTab,
  initialQuery,
  onClearInitialQuery,
  onApplyAgenticAction,
  onNavigateToTab
}: CopilotDrawerProps) {
  const currentContext = getTabContext(activeTab);
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showHistoryChips, setShowHistoryChips] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [expandedSqlMsgs, setExpandedSqlMsgs] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleSqlExpand = (msgId: string) => {
    setExpandedSqlMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const orderPool = useMemo(() => {
    return (liveOrders && liveOrders.length > 0)
      ? liveOrders
      : (reconciliationResult?.reconciledOrders || []);
  }, [liveOrders, reconciliationResult]);

  // Deterministically precompute analytical slices for high-precision query grounding
  const analyticsSlices: AnalyticsSlices | undefined = useMemo(() => {
    const liveOps = orderPool.length > 0 ? computeLiveOpsSlice(orderPool as unknown as (Record<string, unknown> | RawOrderRow)[]) : undefined;

    if (!reconciliationResult && !liveOps) return undefined;

    return {
      branches: reconciliationResult ? computeBranchMetrics(reconciliationResult.reconciledOrders) : undefined,
      courierAudit: reconciliationResult ? computeCourierAuditSummary(reconciliationResult.courierMismatches) : undefined,
      skuLoss: reconciliationResult ? computeSkuRiskSummary(reconciliationResult.skuAnalytics) : undefined,
      customerRisk: reconciliationResult ? computeCustomerRiskSummary(reconciliationResult.customerRiskProfiles) : undefined,
      liveOps,
    };
  }, [reconciliationResult, orderPool]);

  // Initialize messages from localStorage on mount and ensure welcome message is always fresh
  useEffect(() => {
    const liveOps = analyticsSlices?.liveOps;
    const liveOpsHighlight = liveOps
      ? `\n\n⚡ **Live Ops & Fulfillment Pulse** (${liveOps.refDayName}, ${liveOps.referenceDate}):\n` +
        `• **Today's Shipped**: ${liveOps.todayShipped.ordersCount.toLocaleString()} parcels (৳${Math.round(liveOps.todayShipped.grossRevenue).toLocaleString()})\n` +
        `• **Warehouse Queue**: ${liveOps.queue.totalCount.toLocaleString()} pending (${liveOps.queue.processingCount} processing, ${liveOps.queue.holdCount} on hold)\n` +
        `• **Today's Total Orders**: ${liveOps.todaysOrders.totalCount.toLocaleString()} orders (shipped: ${liveOps.todaysOrders.shippedCount}, processing: ${liveOps.todaysOrders.processingCount})\n` +
        `• **Courier Telemetry**: ${liveOps.courierTelemetry.deliveredCount} delivered, ${liveOps.courierTelemetry.inTransitCount} in-transit, ${liveOps.courierTelemetry.discrepanciesCount} courier variances`
      : '';

    const defaultWelcome: CopilotChatMessage = {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am **DEEN Assistant**, your Executive E-Commerce & Reconciliation Analyst.\n\nI have real-time access to your store metrics (**${summary?.grossOrders?.toLocaleString() || 0} orders**, **৳${Math.round(summary?.netDeliveredRevenue || 0).toLocaleString()} net sales**).${liveOpsHighlight}\n\nAsk me anything about today's sales, queue dispatches, courier delivery telemetry, returns, or 7-day rolling baselines!`,
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
  }, [summary?.grossOrders, summary?.netDeliveredRevenue, analyticsSlices?.liveOps]);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Listen for BYOK updates across components
  useEffect(() => {
    const handleBYOKUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BYOKConfig>;
      if (customEvent.detail) {
        setByokConfig(customEvent.detail);
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

    const detectedAction = reconciliationResult ? detectAgenticIntent(q, reconciliationResult) : null;

    try {
      const currentBYOK = loadBYOKConfig();
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          query: q,
          summary,
          history: messages.slice(-8), // Pass recent conversation context
          byok: currentBYOK.isActive ? currentBYOK : undefined,
          activeTab,
          tabLabel: currentContext.label,
          pageContext: currentContext.summaryFocus,
          analyticsSlices,
          orders: (orderPool && orderPool.length > 0 && detectDirectSql(q))
            ? (trimOrderRowsForSql(orderPool.slice(0, 1500) as Record<string, unknown>[]) as RawOrderRow[])
            : undefined,
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
        agenticAction: detectedAction || data?.agenticAction,
        sqlMeta: data?.sqlMeta,
      };

      const finalMessages = [...updatedWithUser, botMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch {
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

  // Automatically execute query if triggered externally (e.g. from Header search or Command Palette)
  useEffect(() => {
    if (isOpen && initialQuery && initialQuery.trim()) {
      const q = initialQuery.trim();
      onClearInitialQuery?.();
      handleSendQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialQuery]);

  const handleExecuteAgenticAction = (messageId: string, action: AgenticActionProposal) => {
    if (onApplyAgenticAction) {
      onApplyAgenticAction(action);
    }
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.agenticAction) {
          return {
            ...msg,
            agenticAction: { ...msg.agenticAction, isApplied: true },
          };
        }
        return msg;
      })
    );
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

  // Close on Escape key if BYOK modal is not open
  useEffect(() => {
    if (!isOpen || isBYOKModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBYOKModalOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-2xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DEEN Assistant Copilot"
        className="relative w-full max-w-xl bg-white dark:bg-[#0A0A0A] shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-[#1F1F1F] z-10 animate-slideInRight"
      >
        
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
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Export chat transcript (.md)"
              aria-label="Export chat transcript"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear History with Confirm */}
            {confirmClear ? (
              <div className="flex items-center gap-1.5 bg-rose-950/80 p-1 rounded-lg border border-rose-500/40 animate-fadeIn">
                <span className="text-[10px] text-rose-200 px-1 font-bold">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="min-h-[32px] px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-black hover:bg-rose-700 cursor-pointer inline-flex items-center justify-center"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[32px] px-2.5 py-1 rounded bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 cursor-pointer inline-flex items-center justify-center"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-rose-300 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear saved chat history"
                aria-label="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close drawer"
              aria-label="Close copilot drawer"
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
            <span className="text-xs font-bold text-primary-dark dark:text-orange-400 truncate">
              {currentContext.label}
            </span>
            <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-orange-100/70 dark:bg-orange-950/50 text-primary-dark dark:text-orange-300 font-semibold border border-orange-200/50 dark:border-orange-900/50 shrink-0">
              {currentContext.badge}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
            Auto-adapted intelligence
          </span>
        </div>

        {/* Suggestion Chips Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-deepBlack-sidebar border-b border-slate-100 dark:border-deepBlack-border flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] uppercase font-bold text-slate-400 dark:text-slate-500 shrink-0">Suggestions:</span>
            {currentContext.prompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuery(qp)}
                className="text-[11px] font-medium bg-white dark:bg-deepBlack-card hover:bg-orange-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-200 hover:text-primary-dark dark:hover:text-orange-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-deepBlack-border hover:border-orange-300 dark:hover:border-orange-500/30 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <span>{qp}</span>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
              </button>
            ))}

            <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
              Live Ops:
            </span>
            <button
              type="button"
              onClick={() => handleSendQuery("What are today's sales, revenue, and shipped order numbers?")}
              className="text-[11px] font-medium bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>📊 Today&apos;s Sales</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("What is the real-time courier delivery status and discrepancy report?")}
              className="text-[11px] font-medium bg-cyan-50/80 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>🚚 Courier Telemetry</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("How many orders are in the queue and what is the processing status?")}
              className="text-[11px] font-medium bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>📦 Queue Status</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("Compare today's sales and dispatch performance with the 7-day baseline")}
              className="text-[11px] font-medium bg-purple-50/80 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>📈 7-Day Baseline</span>
            </button>

            <span className="text-[11px] uppercase font-bold text-primary-dark dark:text-orange-400 shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
              Agentic:
            </span>
            <button
              type="button"
              onClick={() => handleSendQuery("Tag all orders with courier variance > 100 as 'Pathao Discrepancy'")}
              className="text-[11px] font-medium bg-orange-50/80 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-primary-dark dark:text-orange-300 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>🏷️ Tag Pathao Discrepancies</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("Tag high-risk return orders as 'Hold for Advance'")}
              className="text-[11px] font-medium bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>🏷️ Tag High-Risk RTOs</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("Tag all Outside Dhaka returned orders as 'Outside Logistics Review'")}
              className="text-[11px] font-medium bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>🏷️ Tag Outside Returns</span>
            </button>

            <span className="text-[11px] uppercase font-bold text-cyan-600 dark:text-cyan-400 shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
              SQL Engine:
            </span>
            <button
              type="button"
              onClick={() => handleSendQuery("SELECT sku, itemName, SUM(quantity) AS unitsSold, SUM(totalPrice) AS totalRevenue FROM orders WHERE isReturn = 0 GROUP BY sku, itemName ORDER BY unitsSold DESC LIMIT 5")}
              className="text-[11px] font-medium bg-cyan-50/80 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer font-mono"
            >
              <span>⚡ Top Sellers (SQL)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("SELECT sku, itemName, SUM(quantity) AS returnedUnits, SUM(returnedValue) AS totalLoss FROM orders WHERE isReturn = 1 GROUP BY sku, itemName ORDER BY totalLoss DESC LIMIT 5")}
              className="text-[11px] font-medium bg-cyan-50/80 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer font-mono"
            >
              <span>⚡ Top Returns (SQL)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("SELECT sipInventory, COUNT(*) AS dispatches, SUM(totalPrice) AS totalSales, SUM(isReturn) AS returns FROM orders GROUP BY sipInventory ORDER BY dispatches DESC")}
              className="text-[11px] font-medium bg-cyan-50/80 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer font-mono"
            >
              <span>⚡ SIP Inventory (SQL)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendQuery("SELECT districtArea, COUNT(*) AS ordersCount, SUM(totalPrice) AS revenue, SUM(isReturn) AS returns FROM orders GROUP BY districtArea")}
              className="text-[11px] font-medium bg-cyan-50/80 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/60 shrink-0 shadow-2xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer font-mono"
            >
              <span>⚡ Territory (SQL)</span>
            </button>
          </div>

          {previousQueries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryChips(prev => !prev)}
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                showHistoryChips
                  ? 'bg-orange-50 dark:bg-deepBlack-hover text-primary-dark dark:text-orange-300 border-orange-200 dark:border-orange-500/30'
                  : 'bg-white dark:bg-deepBlack-card text-slate-500 dark:text-slate-400 border-slate-200 dark:border-deepBlack-border'
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
          <div className="px-4 py-2 bg-slate-100/70 dark:bg-deepBlack-sidebar border-b border-slate-200 dark:border-deepBlack-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 animate-fadeIn">
            <span className="text-[11px] uppercase font-bold text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-primary-dark dark:text-orange-400" />
              <span>Past Queries:</span>
            </span>
            {previousQueries.slice(0, 5).map((qText, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => {
                  setInputQuery(qText);
                }}
                className="text-[11px] font-medium bg-white dark:bg-deepBlack-card hover:bg-orange-50 dark:hover:bg-deepBlack-hover text-slate-800 dark:text-slate-200 hover:text-primary-dark dark:hover:text-orange-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-deepBlack-border hover:border-orange-300 dark:hover:border-orange-500/30 shrink-0 shadow-2xs transition-colors truncate max-w-[200px] cursor-pointer"
                title={`Click to re-use: "${qText}"`}
              >
                &ldquo;{qText}&rdquo;
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages Log with Rich Markdown Formatting */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-deepBlack-canvas text-xs">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} group`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#f26322] to-primary text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 shadow-2xs leading-relaxed relative ${
                    isUser
                      ? 'bg-primary text-white rounded-tr-xs shadow-xs'
                      : 'bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {/* Rich Markdown Formatter */}
                  <AIMarkdownMessage content={m.text} isUser={isUser} />

                  {/* In-Memory SQL Execution Pill & Expandable Query View */}
                  {!isUser && m.sqlMeta && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-deepBlack-border">
                      <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border rounded-lg px-2.5 py-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 font-mono text-cyan-700 dark:text-cyan-300">
                          <Database className="w-3.5 h-3.5 text-cyan-500" />
                          <span className="font-semibold">In-Memory SQL:</span>
                          <span>{m.sqlMeta.rowCount} rows</span>
                          <span className="text-slate-400">({m.sqlMeta.executionTimeMs}ms)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSqlExpand(m.id)}
                          className="text-[10px] font-semibold text-primary-dark dark:text-orange-400 hover:underline cursor-pointer"
                        >
                          {expandedSqlMsgs.has(m.id) ? 'Hide SQL' : 'View SQL'}
                        </button>
                      </div>

                      {expandedSqlMsgs.has(m.id) && (
                        <div className="mt-1.5 p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-[11px] font-mono relative group/sql">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="w-3 h-3 text-cyan-400" />
                              <span>AlaSQL Engine (Read-Only)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(`sql-${m.id}`, m.sqlMeta!.query)}
                              className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                              title="Copy SQL Query"
                            >
                              {copiedMsgId === `sql-${m.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy SQL</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap text-cyan-300 selection:bg-cyan-900 selection:text-white">
                            {m.sqlMeta.query}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Applied Business Rules & Policies Badge */}
                  {!isUser && m.appliedRules && m.appliedRules.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-deepBlack-border">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Rules Applied:
                      </span>
                      {m.appliedRules.map((rule, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-primary-dark dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Agentic Action Proposal Card */}
                  {!isUser && m.agenticAction && (
                    <div className="mt-3 p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200/90 dark:border-orange-800/40 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-md bg-primary text-white flex items-center justify-center font-bold text-[10px]">
                            ⚡
                          </div>
                          <span className="font-bold text-navy-deep dark:text-orange-200 text-xs">
                            {m.agenticAction.type === 'CLEAR_TAGS' ? 'Clear Tags Proposal' : 'Agentic Dataset Action Proposed'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-deepBlack-card border border-orange-300 dark:border-orange-700 text-primary-dark dark:text-orange-400">
                          {m.agenticAction.affectedCount} orders affected
                        </span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 font-medium text-[11px] mb-2 leading-relaxed">
                        {m.agenticAction.description}
                      </p>

                      {/* Order Previews */}
                      {m.agenticAction.previewOrders && m.agenticAction.previewOrders.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {m.agenticAction.previewOrders.slice(0, 4).map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white dark:bg-deepBlack-hover border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-200"
                              title={`${p.customerName}: ${p.reason}`}
                            >
                              #{p.orderId}
                            </span>
                          ))}
                          {m.agenticAction.affectedCount > 4 && (
                            <span className="text-[11px] text-slate-400 self-center">
                              +{m.agenticAction.affectedCount - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Execution Button */}
                      <div className="flex items-center gap-2 pt-2 border-t border-orange-200/60 dark:border-orange-900/40">
                        {m.agenticAction.isApplied ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs py-0.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Changes Applied to Active Dataset</span>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleExecuteAgenticAction(m.id, m.agenticAction!)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>{m.agenticAction.type === 'CLEAR_TAGS' ? 'Clear Tags from Dataset' : 'Apply to Excel Dataset'}</span>
                            </button>
                            {onNavigateToTab && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('tabOrders')}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-navy-deep hover:bg-white dark:hover:bg-deepBlack-hover border border-slate-200 dark:border-deepBlack-border transition-colors cursor-pointer"
                              >
                                View in Orders
                              </button>
                            )}
                          </>
                        )}
                      </div>
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
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-deepBlack-hover text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 text-xs py-3 pl-2 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-deepBlack-card border border-orange-200/80 dark:border-deepBlack-border flex items-center justify-center text-primary-dark dark:text-orange-400">
                <Sparkles className="w-4 h-4 animate-spin text-primary-dark dark:text-orange-400" />
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">DEEN Assistant is analyzing...</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Auditing territory ratio, SKUs & COD margins</span>
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
          className="p-3.5 border-t border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card flex items-center gap-2 shadow-sm"
        >
          <input
            type="text"
            placeholder="Ask anything about your sales, returns, linehaul territory, or SKU costs..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-sidebar text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 dark:disabled:bg-deepBlack-hover shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
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
