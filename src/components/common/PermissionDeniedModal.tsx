'use client';

import React from 'react';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export interface PermissionDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredRole?: string;
  currentRole?: string;
  actionAttempted?: string;
}

export function PermissionDeniedModal({
  isOpen,
  onClose,
  requiredRole = 'Superadmin or Store Operator',
  currentRole = 'Read-Only Auditor',
  actionAttempted = 'perform this action',
}: PermissionDeniedModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#0A0A0A] border border-neutral-800 p-6 shadow-2xl relative animate-scaleUp">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-white mb-2">
            Elevated Access Required
          </h3>
          <p className="text-xs text-neutral-300 leading-relaxed mb-4">
            You do not have permission to <span className="text-amber-300 font-semibold">{actionAttempted}</span>.
          </p>

          <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-left text-xs space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-neutral-400">Current Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-200">
                {currentRole}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-neutral-400">Required Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {requiredRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
            }}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Switch Account (Login)</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
