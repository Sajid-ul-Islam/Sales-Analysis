"use client";

import React from 'react';

export function DeenLogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl shadow-xs aspect-square flex items-center justify-center bg-[#FF5500] ${className}`}>
      <img
        src="/deencommerce_logo.jpg"
        alt="DEEN Commerce Logo"
        className="w-full h-full object-cover select-none"
        loading="eager"
      />
    </div>
  );
}

export interface DeenLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function DeenLogo({
  className = "",
  size = 'md',
  showText = true
}: DeenLogoProps) {
  const markDimensions = size === 'sm' ? 'w-7 h-7 !rounded-lg' : size === 'lg' ? 'w-10 h-10 !rounded-xl' : 'w-8 h-8 !rounded-xl';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <DeenLogoMark className={markDimensions} />
      {showText && (
        <div className="flex flex-col">
          <span className="font-headline font-black text-sm tracking-tight text-slate-900 leading-none">
            DEEN COMMERCE
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Sales & Growth
          </span>
        </div>
      )}
    </div>
  );
}
