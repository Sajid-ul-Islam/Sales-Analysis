"use client";

import React, { useState, useEffect } from 'react';
import {
  Key,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Zap,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Server,
  Laptop,
  Info
} from 'lucide-react';
import {
  AIProvider,
  BYOKConfig,
  PROVIDERS_METADATA,
  detectAIProvider,
  loadBYOKConfig,
  saveBYOKConfig,
  clearBYOKConfig,
} from '@/lib/byok';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';

interface BYOKModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: BYOKConfig) => void;
}

export function BYOKModal({ isOpen, onClose, onSaved }: BYOKModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [showKeyText, setShowKeyText] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'IDLE' | 'SUCCESS' | 'ERROR';
    message: string;
    latencyMs?: number;
  }>({ status: 'IDLE', message: '' });

  const [activeTab, setActiveTab] = useState<'instant' | 'server'>('instant');
  const [existingConfig, setExistingConfig] = useState<BYOKConfig | null>(null);

  // Load existing config on open
  useEffect(() => {
    if (isOpen) {
      const cfg = loadBYOKConfig();
      setExistingConfig(cfg);
      if (cfg.apiKey) {
        setApiKey(cfg.apiKey);
        setSelectedProvider(cfg.provider);
        setSelectedModel(cfg.model);
        if (cfg.status === 'CONNECTED') {
          setTestResult({
            status: 'SUCCESS',
            message: cfg.statusMessage || `Active & Connected to ${cfg.provider.toUpperCase()} (${cfg.model})`,
          });
        }
      } else {
        setApiKey('');
        setSelectedProvider('gemini');
        setSelectedModel('gemini-2.5-flash');
        setTestResult({ status: 'IDLE', message: '' });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time Dynamic Detection on key keystroke / paste
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    setTestResult({ status: 'IDLE', message: '' });

    if (val.trim()) {
      const detected = detectAIProvider(val.trim());
      setSelectedProvider(detected.provider);
      setSelectedModel(detected.model);
    }
  };

  const detectedInfo = detectAIProvider(apiKey);
  const providerMeta = PROVIDERS_METADATA[selectedProvider];

  const handleTestAndSave = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setTestResult({
        status: 'ERROR',
        message: 'Please paste an API key before testing.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ status: 'IDLE', message: 'Testing connection to AI provider...' });

    try {
      const res = await fetch('/api/ai/byok/test', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          apiKey: cleanKey,
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const saved = saveBYOKConfig({
          apiKey: cleanKey,
          provider: selectedProvider,
          model: selectedModel,
          status: 'CONNECTED',
          lastTestedAt: new Date().toISOString(),
          statusMessage: `Connected in ${data.latencyMs}ms (${selectedModel})`,
        });

        setTestResult({
          status: 'SUCCESS',
          message: `Connected successfully in ${data.latencyMs}ms! Saved to your browser vault.`,
          latencyMs: data.latencyMs,
        });

        setExistingConfig(saved);
        onSaved?.(saved);
      } else {
        saveBYOKConfig({
          apiKey: cleanKey,
          provider: selectedProvider,
          model: selectedModel,
          status: 'ERROR',
          lastTestedAt: new Date().toISOString(),
          statusMessage: data.error || 'Connection failed',
        });

        setTestResult({
          status: 'ERROR',
          message: data.error || 'Failed to connect. Please verify your API key.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error while testing connection.';
      setTestResult({
        status: 'ERROR',
        message: msg,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearBYOKConfig();
    setApiKey('');
    setExistingConfig(null);
    setTestResult({
      status: 'IDLE',
      message: 'Key removed. System has reverted to offline heuristic fallback mode.',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-fadeIn cursor-pointer"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bring Your Own Key"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-[#0A0A0A] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1F1F1F] overflow-hidden flex flex-col max-h-[92vh] cursor-default"
      >
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 dark:border-[#1F1F1F] bg-[#0F172A] dark:bg-[#000000] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#f26322] to-[#EB5A19] flex items-center justify-center text-white shadow-md">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-base sm:text-lg text-white">
                  Bring Your Own Key (BYOK)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Zero Extra Cost
                </span>
              </div>
              <p className="text-xs text-slate-300 dark:text-slate-400 mt-0.5">
                Paste any key: Auto-detects Google Gemini, OpenAI, Groq, or OpenRouter with zero setup.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* Dynamic Detection Key Input Card */}
          <div className="bg-slate-50 dark:bg-[#0D0D0D] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" />
                <span>Paste Your API Key (Auto-Detects Provider & Model)</span>
              </label>

              {detectedInfo.isRecognized && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Recognized: {detectedInfo.name}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type={showKeyText ? 'text' : 'password'}
                placeholder="Paste key: AIzaSy... (Gemini) or sk-proj-... (OpenAI) or gsk_... (Groq)"
                value={apiKey}
                onChange={handleKeyChange}
                className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-300 dark:border-[#262626] text-xs font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-[#141414] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-slate-400 dark:placeholder-slate-500 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowKeyText(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
              >
                {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-semibold">{showKeyText ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            {/* Live Provider & Model Auto-Detected Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Detected Engine:</span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {providerMeta?.name || 'Google Gemini'}
                </span>

                {/* Model Selector Pill */}
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] text-slate-800 dark:text-slate-200 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs cursor-pointer"
                >
                  {providerMeta?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {providerMeta?.isFreeTierAvailable && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  ✨ 100% Free Tier Supported
                </span>
              )}
            </div>

            {/* Test Connection Result Box */}
            {testResult.message && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.status === 'SUCCESS'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : testResult.status === 'ERROR'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                {testResult.status === 'SUCCESS' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : testResult.status === 'ERROR' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.latencyMs && (
                    <span className="text-[10px] opacity-75 mt-0.5 block">
                      Auditor response latency: {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 1: WHERE TO GET THE KEY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#EB5A19]" />
                <span>1. Where to Get Your API Key</span>
              </h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Takes under 60 seconds</span>
            </div>

            {/* Primary Recommended: Google AI Studio */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50/60 via-amber-50/40 to-white dark:from-orange-950/20 dark:via-deepBlack-card dark:to-deepBlack-card border border-orange-200/80 dark:border-orange-800/40 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-headline">
                      Google AI Studio (Gemini 2.5 Flash)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EB5A19] text-white shadow-2xs">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    100% Free with 15 requests/minute. <strong>No credit card required</strong>. Perfect for daily return diagnosis, courier audits, and assistant inquiries.
                  </p>
                </div>

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#EB5A19] hover:bg-[#d44e13] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                >
                  <span>Get Free Gemini Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-orange-100 dark:border-orange-950/60 text-[10px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#EB5A19] dark:text-orange-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Sign in with Google</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#EB5A19] dark:text-orange-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Click &quot;Create API Key&quot;</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#EB5A19] dark:text-orange-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Copy & paste key above</span>
                </div>
              </div>
            </div>

            {/* Alternate Key Providers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white dark:bg-[#141414] hover:bg-slate-50 dark:hover:bg-[#1c1c1c] border border-slate-200 dark:border-[#262626] text-left transition-colors group shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <span>Groq Cloud</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Llama 3.3 • Free tier</span>
              </a>

              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white dark:bg-[#141414] hover:bg-slate-50 dark:hover:bg-[#1c1c1c] border border-slate-200 dark:border-[#262626] text-left transition-colors group shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <span>OpenAI</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">GPT-4o mini</span>
              </a>

              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white dark:bg-[#141414] hover:bg-slate-50 dark:hover:bg-[#1c1c1c] border border-slate-200 dark:border-[#262626] text-left transition-colors group shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <span>OpenRouter</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Multi-model gateway</span>
              </a>

              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white dark:bg-[#141414] hover:bg-slate-50 dark:hover:bg-[#1c1c1c] border border-slate-200 dark:border-[#262626] text-left transition-colors group shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-xs mb-1">
                  <span>Anthropic</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Claude 3.5 Sonnet</span>
              </a>
            </div>
          </div>

          {/* SECTION 2: WHERE TO PUT THE KEY */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>2. Where to Put Your Key (Two Flexible Options)</span>
            </h4>

            {/* Toggle tabs for Option A vs Option B */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: In-App Browser Vault */}
              <div
                onClick={() => setActiveTab('instant')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  activeTab === 'instant'
                    ? 'border-[#EB5A19] bg-orange-50/40 dark:bg-orange-950/20 ring-2 ring-[#EB5A19]/10 shadow-xs'
                    : 'border-slate-200 dark:border-[#262626] bg-white dark:bg-[#141414] hover:bg-slate-50/60 dark:hover:bg-[#1c1c1c]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-[#EB5A19] dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block font-headline">Option A: Instant Browser Vault</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Recommended • Zero Deployment</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Paste directly into the input above and click <strong>Test & Save</strong>. Your key is stored locally in your browser storage and passed directly for AI analysis.
                </p>
              </div>

              {/* Option B: Server / Vercel Environment */}
              <div
                onClick={() => setActiveTab('server')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  activeTab === 'server'
                    ? 'border-[#EB5A19] bg-orange-50/40 dark:bg-orange-950/20 ring-2 ring-[#EB5A19]/10 shadow-xs'
                    : 'border-slate-200 dark:border-[#262626] bg-white dark:bg-[#141414] hover:bg-slate-50/60 dark:hover:bg-[#1c1c1c]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-deepBlack-hover text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block font-headline">Option B: Server / Vercel Env</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Team / Global Setup</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Add <code className="bg-slate-100 dark:bg-deepBlack-hover px-1 py-0.5 rounded text-[10px] text-slate-800 dark:text-slate-200 font-mono">GEMINI_API_KEY=AIzaSy...</code> to your <code className="bg-slate-100 dark:bg-deepBlack-hover px-1 py-0.5 rounded text-[10px] text-slate-800 dark:text-slate-200 font-mono">.env.local</code> file or Vercel Environment Variables.
                </p>
              </div>
            </div>

            {/* Explanatory Code Snippet for Server Option */}
            {activeTab === 'server' && (
              <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-black text-slate-100 font-mono text-[11px] leading-relaxed space-y-2 border border-slate-800 dark:border-[#1F1F1F]">
                <div className="text-slate-400 text-[10px] font-sans">
                  # In your project root `.env.local` or Vercel Dashboard Settings:
                </div>
                <div className="text-emerald-400 font-bold">
                  GEMINI_API_KEY=&quot;{apiKey || 'AIzaSyYourGeminiKeyHere'}&quot;
                </div>
                <div className="text-slate-400 text-[10px] font-sans pt-1">
                  Once set in Vercel or .env.local, all users of your deployment automatically get AI support with zero client configuration.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-[#1F1F1F] bg-slate-50/80 dark:bg-[#080808] flex items-center justify-between gap-3">
          {existingConfig?.apiKey ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect Key</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Keys never leave your browser / server</span>
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#262626] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#141414] transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={isTesting || !apiKey.trim()}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Test & Save Key</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
