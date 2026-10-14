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
  Key
} from 'lucide-react';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SummaryAnalytics;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'Summarize our return risk and territory ratio',
  'What is our net realized revenue vs gross dispatched?',
  'Why is Outside Dhaka return rate higher than Dhaka?',
  'What actionable advice do you have for customer service?'
];

export function CopilotDrawer({ isOpen, onClose, summary }: CopilotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am **DEEN Copilot**, your Executive AI Operations & Reconciliation Assistant powered by Google Gemini.\n\nI have real-time access to your reconciled store metrics (${summary?.grossOrders?.toLocaleString() || 0} orders, ৳${Math.round(summary?.netDeliveredRevenue || 0).toLocaleString()} net sales). Ask me anything about your returns, linehaul territory, or SKU margins!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
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
          byok: currentBYOK.isActive ? currentBYOK : undefined,
        })
      });

      const data = await res.json();
      const assistantText = data?.answer || 'I could not generate an answer at this time. Please try again.';

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Network error communicating with AI server. Please verify your connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Chat reset. Ready to answer questions on your ${summary?.grossOrders?.toLocaleString() || 0} reconciled orders.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 z-10 animate-slideInRight">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-sm text-white">DEEN Copilot</h3>
                <button
                  type="button"
                  onClick={() => setIsBYOKModalOpen(true)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-400/30 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                  title="Configure Bring Your Own Key"
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>{byokConfig.isActive ? byokConfig.model : 'BYOK Key'}</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-300 block">AI Operations & Data Assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsBYOKModalOpen(true)}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors flex items-center gap-1"
              title="Configure Bring Your Own Key"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">BYOK</span>
            </button>
            <button
              type="button"
              onClick={handleResetChat}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Suggestions:</span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendQuery(qp)}
              className="text-[11px] font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-2.5 py-1 rounded-full border border-slate-200/80 shrink-0 shadow-2xs transition-colors flex items-center gap-1"
            >
              <span>{qp}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/30 text-xs">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-2xs leading-relaxed ${
                    isUser
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-line text-xs font-normal">
                    {m.text}
                  </div>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      isUser ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-2 pl-2">
              <Bot className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="font-semibold text-slate-600">DEEN Copilot is analyzing store data...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask anything about your sales, returns, or territory..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-300 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 active:scale-95"
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
