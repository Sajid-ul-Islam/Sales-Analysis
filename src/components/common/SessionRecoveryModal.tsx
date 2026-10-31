'use client';

import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface SessionRecoveryModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function SessionRecoveryModal({
  isOpen,
  onSuccess,
  onCancel,
}: SessionRecoveryModalProps) {
  const { loginWithPasscode } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setErrorMsg('Please enter a 4-digit PIN');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await loginWithPasscode(pin);
      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.message || 'Invalid PIN. Please try again.');
      }
    } catch {
      setErrorMsg('Network error verifying PIN. Check connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="w-full max-w-sm rounded-3xl bg-[#0A0A0A] border border-neutral-800 p-6 shadow-2xl text-center animate-scaleUp">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4 mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1.5">
          Session Expired
        </h3>

        <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
          Your active working state and filter settings have been <span className="text-emerald-400 font-semibold">safely preserved</span>. Enter your Quick PIN to resume instantly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Enter 4-Digit Quick PIN (e.g. 1234)"
              className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-orange-500 text-center font-mono text-lg tracking-widest text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isVerifying || pin.length < 4}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white shadow-lg shadow-orange-950/40 transition-all flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resume Workspace</span>
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-[11px] text-neutral-500 hover:text-neutral-300 py-1 transition-colors"
              >
                Log Out to Main Screen
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
