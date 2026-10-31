'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FormFieldErrorProps {
  error?: string;
  hint?: string;
  isValid?: boolean;
}

export function FormFieldError({ error, hint, isValid }: FormFieldErrorProps) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-red-400 animate-fadeIn">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (isValid) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-emerald-400 animate-fadeIn">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Verified valid format</span>
      </div>
    );
  }

  if (hint) {
    return (
      <p className="mt-1 text-[11px] text-neutral-400 leading-tight">
        {hint}
      </p>
    );
  }

  return null;
}
