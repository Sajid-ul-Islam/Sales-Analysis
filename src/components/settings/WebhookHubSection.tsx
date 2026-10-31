'use client';

import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Copy,
  Check,
  Send,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getLiveWebhookUpdates } from '@/lib/pathaoWebhookEngine';

export function WebhookHubSection() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [webhookCount, setWebhookCount] = useState(0);
  const [showWpGuide, setShowWpGuide] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://deencommerce.com';
  const wcWebhookUrl = `${origin}/api/sync/woocommerce/webhook`;
  const pathaoWebhookUrl = `${origin}/api/sync/pathao/webhook`;

  useEffect(() => {
    const updates = getLiveWebhookUpdates();
    setWebhookCount(updates.size);

    const interval = setInterval(() => {
      const live = getLiveWebhookUpdates();
      setWebhookCount(live.size);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await fetch('/api/sync/woocommerce/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wc-webhook-topic': 'ping',
        },
        body: JSON.stringify({ ping: true, timestamp: new Date().toISOString() }),
      });
      if (res.ok) {
        setPingStatus('🟢 Receiver Active: Inbound webhook handshake acknowledged (200 OK)');
      } else {
        setPingStatus(`⚠️ Webhook receiver returned HTTP ${res.status}`);
      }
    } catch {
      setPingStatus('❌ Connection error reaching webhook receiver');
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="w-full my-6 p-6 rounded-3xl bg-[#0A0A0A] border border-neutral-800 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 mb-5 border-b border-neutral-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Real-Time Webhook Hub & Ingest Engine</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                Push Ingest Active
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Eliminate polling by pushing order updates directly from WooCommerce & Pathao in &lt;1 second.
            </p>
          </div>
        </div>

        <button
          onClick={handleTestPing}
          disabled={isPinging}
          className="py-2 px-3.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white transition-all flex items-center gap-2 self-stretch sm:self-auto justify-center"
        >
          <Send className={`w-3.5 h-3.5 ${isPinging ? 'animate-bounce text-orange-400' : 'text-neutral-400'}`} />
          <span>{isPinging ? 'Pinging Receiver...' : 'Test Webhook Receiver'}</span>
        </button>
      </div>

      {pingStatus && (
        <div className="mb-5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono animate-fadeIn flex items-center justify-between">
          <span>{pingStatus}</span>
          <span className="text-[10px] text-neutral-500">Live test</span>
        </div>
      )}

      {/* Webhook URLs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* WooCommerce Webhook Box */}
        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>WooCommerce Webhook Delivery URL</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
              order.created & order.updated
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 mb-2.5 font-mono text-xs text-neutral-300 overflow-hidden">
            <span className="truncate flex-1">{wcWebhookUrl}</span>
            <button
              onClick={() => copyToClipboard(wcWebhookUrl, 'wc')}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors shrink-0"
              title="Copy URL"
            >
              {copiedKey === 'wc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed">
            In WP Admin → WooCommerce → Settings → Advanced → Webhooks: set Status to <span className="text-neutral-300 font-semibold">Active</span> and Topic to <span className="text-neutral-300 font-semibold">Order Created</span> / <span className="text-neutral-300 font-semibold">Order Updated</span>.
          </p>
        </div>

        {/* Pathao Courier Webhook Box */}
        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Pathao Courier Webhook URL</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
              delivery status updates
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 mb-2.5 font-mono text-xs text-neutral-300 overflow-hidden">
            <span className="truncate flex-1">{pathaoWebhookUrl}</span>
            <button
              onClick={() => copyToClipboard(pathaoWebhookUrl, 'pathao')}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors shrink-0"
              title="Copy URL"
            >
              {copiedKey === 'pathao' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>In-Memory Webhook Telemetry Cache:</span>
            <span className="font-bold text-emerald-400 font-mono">{webhookCount} Active Events</span>
          </div>
        </div>
      </div>

      {/* WordPress DB Optimization Guide Accordion */}
      <div className="pt-4 border-t border-neutral-800/80">
        <button
          type="button"
          onClick={() => setShowWpGuide(!showWpGuide)}
          className="w-full flex items-center justify-between text-left text-xs font-bold text-neutral-300 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-400" />
            <span>WordPress Transients & Action Scheduler Optimization Guide (Speed up REST API to &lt;500ms)</span>
          </div>
          {showWpGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showWpGuide && (
          <div className="mt-3 p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed space-y-2.5 animate-fadeIn">
            <p>
              High order volume creates thousands of transient rows in <code className="text-orange-400 font-mono">wp_options</code> and completed action logs in <code className="text-orange-400 font-mono">wp_actionscheduler_actions</code>. Pruning them once a month ensures the WooCommerce REST API responds in <span className="text-emerald-400 font-bold">&lt; 500ms</span>.
            </p>
            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-neutral-400 space-y-1">
              <p className="text-neutral-200 font-semibold mb-1">Recommended WP-CLI maintenance command:</p>
              <p className="text-orange-300">wp transient delete --expired</p>
              <p className="text-orange-300">wp action-scheduler clean --batch-size=1000 --status=complete</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
