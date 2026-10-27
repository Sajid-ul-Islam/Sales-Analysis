'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Store,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const { loginWithPasscode, loginWithWooCommerce } = useAuth();

  // Mode: WOOCOMMERCE vs PASSCODE
  const [activeTab, setActiveTab] = useState<'WOOCOMMERCE' | 'PASSCODE'>('WOOCOMMERCE');

  // WooCommerce form state
  const [wcUsername, setWcUsername] = useState('');
  const [wcPassword, setWcPassword] = useState('');
  const [showWcPassword, setShowWcPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Passcode form state
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Status & loading
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle WooCommerce Staff Login
  const handleWcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wcUsername.trim() || !wcPassword) {
      setErrorMessage('Please enter both your WordPress username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await loginWithWooCommerce(wcUsername, wcPassword, rememberMe);
    if (res.success) {
      setSuccessMessage(res.message || 'Authenticated successfully! Redirecting...');
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 500);
    } else {
      setErrorMessage(res.message || 'Invalid username or password.');
      setLoading(false);
    }
  };

  // Handle Passcode / PIN Login
  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMessage('Please enter an admin passcode or PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await loginWithPasscode(passcode);
    if (res.success) {
      setSuccessMessage(res.message || 'Passcode accepted! Redirecting...');
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 500);
    } else {
      setErrorMessage(res.message || 'Invalid passcode or PIN.');
      setLoading(false);
    }
  };

  // Instant 1-Click Quick PIN Login
  const handleQuickPin = async (pinValue: string) => {
    setPasscode(pinValue);
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await loginWithPasscode(pinValue);
    if (res.success) {
      setSuccessMessage(res.message || 'Passcode accepted! Redirecting...');
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 300);
    } else {
      setErrorMessage(res.message || 'Invalid passcode or PIN.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black dark:bg-[#0A0A0A] border border-slate-200/80 dark:border-[#1F1F1F] shadow-lg mb-4 p-1.5 transition-transform hover:scale-105">
          <Image
            src="/deencommerce_logo.jpg"
            alt="DEEN Commerce"
            width={52}
            height={52}
            className="rounded-xl object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-headline">
          DEEN COMMERCE
        </h1>
        <p className="text-xs font-semibold text-primary mt-0.5 tracking-wider uppercase font-mono">
          Reconciliation & Operations Terminal
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Authorized Operations Access Only</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-xl p-6 sm:p-7 space-y-6">
        {/* Dual Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('WOOCOMMERCE');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'WOOCOMMERCE'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
            <span>Store Staff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('PASSCODE');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'PASSCODE'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>Quick PIN</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 font-bold">{successMessage}</div>
          </div>
        )}

        {/* Form 1: WooCommerce Staff Credentials */}
        {activeTab === 'WOOCOMMERCE' && (
          <form onSubmit={handleWcSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                WordPress Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={wcUsername}
                  onChange={(e) => setWcUsername(e.target.value)}
                  placeholder="e.g. username@deencommerce.com"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200/90 dark:border-[#222222] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showWcPassword ? 'text' : 'password'}
                  value={wcPassword}
                  onChange={(e) => setWcPassword(e.target.value)}
                  placeholder="Enter store account password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200/90 dark:border-[#222222] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowWcPassword(!showWcPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showWcPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300 dark:border-[#333] dark:bg-[#181818]"
                />
                <span>Keep me signed in (30 days)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Store Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <span>Mirpur, Cumilla, Wari & Sylhet Cashiers Supported</span>
              </div>
            </div>
          </form>
        )}

        {/* Form 2: Master Passcode / PIN Login */}
        {activeTab === 'PASSCODE' && (
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Admin Passcode or PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter Passcode or PIN (e.g. 2026)"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  autoFocus
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-[#121212] border border-slate-200/90 dark:border-[#222222] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick PIN Quick-Click Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                Quick Preset Shortcuts:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickPin('2026')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors text-left flex flex-col gap-0.5 cursor-pointer active:scale-95"
                  title="Click to sign in instantly as Operations Admin"
                >
                  <span className="font-semibold text-[11px] truncate">👑 Admin</span>
                  <span className="font-mono text-slate-400 text-[10px]">Admin@2026</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPin('7742')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors text-left flex flex-col gap-0.5 cursor-pointer active:scale-95"
                  title="Click to sign in instantly as Executive Director (15% sample view)"
                >
                  <span className="font-semibold text-[11px] truncate">👔 Director</span>
                  <span className="font-mono text-slate-400 text-[10px]">Director@7742</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPin('1234')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] transition-colors text-left flex flex-col gap-0.5 cursor-pointer active:scale-95"
                  title="Click to sign in instantly as Warehouse Operator"
                >
                  <span className="font-semibold text-[11px] truncate">📦 Ops</span>
                  <span className="font-mono text-slate-400 text-[10px]">Ops@1234</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Passcode...</span>
                </>
              ) : (
                <>
                  <span>Sign In with PIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center mt-6 text-[11px] text-slate-400 dark:text-slate-500">
        <p>DEEN Commerce Analytics Platform • Encrypted HMAC-SHA256 Sessions</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#000000] flex flex-col justify-center items-center px-4 py-12 transition-colors">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading authentication gateway...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
