'use client';

import React from 'react';
import { SearchX, RotateCcw, HelpCircle } from 'lucide-react';

export interface NoSearchResultsProps {
  searchTerm?: string;
  categoryFilter?: string;
  statusFilter?: string;
  onClearFilters?: () => void;
  onReset?: () => void;
  onSelectSuggestion?: (suggestedText: string) => void;
  viewName?: string;
}

export function NoSearchResults({
  searchTerm,
  categoryFilter,
  statusFilter,
  onClearFilters,
  onReset,
  onSelectSuggestion,
  viewName = 'Orders Ledger',
}: NoSearchResultsProps) {
  const handleReset = onClearFilters || onReset;
  const hasFilters = Boolean(
    (searchTerm && searchTerm.trim().length > 0) ||
    (categoryFilter && categoryFilter !== 'ALL') ||
    (statusFilter && statusFilter !== 'ALL') ||
    handleReset
  );

  return (
    <div className="w-full my-6 p-8 rounded-2xl bg-[#0A0A0A] border border-neutral-800 text-center flex flex-col items-center animate-fadeIn">
      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mb-4">
        <SearchX className="w-6 h-6 text-neutral-400" />
      </div>

      <h4 className="text-base font-bold text-white mb-1.5">
        No orders match your search criteria
      </h4>

      <p className="text-xs text-neutral-400 max-w-md mb-5 leading-relaxed">
        {searchTerm ? (
          <>
            No records found for <span className="text-orange-400 font-mono font-semibold">&ldquo;{searchTerm}&rdquo;</span> in {viewName}.
          </>
        ) : (
          `No records match the active filters in ${viewName}.`
        )}
      </p>

      {/* Smart Suggestions instead of Dead-End */}
      <div className="w-full max-w-md p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 mb-5 text-left text-xs">
        <div className="flex items-center gap-1.5 text-neutral-300 font-bold mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
          <span>Helpful Search Suggestions:</span>
        </div>
        <ul className="space-y-1.5 text-neutral-400 text-[11px] list-disc list-inside">
          <li>Search by 5-digit order number (e.g., <code className="text-neutral-300 font-mono bg-neutral-900 px-1 py-0.5 rounded">17263</code> or <code className="text-neutral-300 font-mono bg-neutral-900 px-1 py-0.5 rounded">17263 c</code>)</li>
          <li>Search by 11-digit customer phone (e.g., <code className="text-neutral-300 font-mono bg-neutral-900 px-1 py-0.5 rounded">017XXXXXXXX</code>)</li>
          <li>Search by exact Pathao consignment code</li>
          <li>Check if the active date scope (e.g. 7d / 30d) excludes earlier orders</li>
        </ul>

        {onSelectSuggestion && (
          <div className="mt-3 pt-2.5 border-t border-neutral-900 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Quick Suggestions:</span>
            {['Cumilla', 'Wari', 'Sylhet', 'Mirpur', 'Delivered', 'Returned'].map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => onSelectSuggestion(sug)}
                className="px-2 py-0.5 rounded text-[10px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasFilters && handleReset && (
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/40 transition-all flex items-center gap-2 hover:scale-[1.02]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Search & Category Filters</span>
        </button>
      )}
    </div>
  );
}
