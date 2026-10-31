import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  EmptyState,
  LoadingProgress,
  TableSkeleton,
  NoSearchResults,
  ErrorCard,
  PermissionDeniedModal,
  FormFieldError,
  SuccessCelebrationModal,
  SuffixHygieneBadge,
} from '@/components/common';

describe('10 Golden UX States & Operational Hygiene Architecture', () => {
  it('State 1: EmptyState renders informative onboarding and 1-click baseline action', () => {
    const html = renderToString(
      React.createElement(EmptyState, {
        title: 'Reconciliation Terminal Ready',
        description: 'No orders loaded yet.',
        onLoadBaseline: () => {},
      })
    );
    expect(html).toContain('Reconciliation Terminal Ready');
    expect(html).toContain('No orders loaded yet.');
    expect(html).toContain('Load Baseline');
    expect(html).toContain('0ms Instant Load');
  });

  it('State 2: LoadingProgress renders active phase and progressive tracker', () => {
    const html = renderToString(
      React.createElement(LoadingProgress, {
        isLoading: true,
        message: 'Reconciling Ledger...',
      })
    );
    expect(html).toContain('Reconciling Ledger...');
    expect(html).toContain('role="status"');
    expect(html).toContain('bg-gradient-to-r');
  });

  it('State 2 Skeleton: TableSkeleton renders accessible placeholder containment', () => {
    const html = renderToString(
      React.createElement(TableSkeleton, { rows: 4, cols: 5 })
    );
    expect(html).toContain('animate-pulse');
  });

  it('State 3: ErrorCard renders plain-English message and recovery actions', () => {
    const html = renderToString(
      React.createElement(ErrorCard, {
        title: 'WooCommerce Connection Timeout',
        message: 'Server did not respond within 25 seconds.',
        technicalDetails: 'ETIMEDOUT on port 443',
        onRetry: () => {},
        onFallbackBaseline: () => {},
      })
    );
    expect(html).toContain('WooCommerce Connection Timeout');
    expect(html).toContain('Retry Operation');
    expect(html).toContain('Load Offline Baseline');
  });

  it('State 6: NoSearchResults renders helpful suggestions and reset button', () => {
    const html = renderToString(
      React.createElement(NoSearchResults, {
        searchTerm: '19999',
        onClearFilters: () => {},
        viewName: 'Dispatched Ledger',
      })
    );
    expect(html).toContain('No orders match your search criteria');
    expect(html).toContain('19999');
    expect(html).toContain('Helpful Search Suggestions:');
    expect(html).toContain('Reset All Search &amp; Category Filters');
  });

  it('State 7: PermissionDeniedModal explains role hierarchy and recovery path', () => {
    const html = renderToString(
      React.createElement(PermissionDeniedModal, {
        isOpen: true,
        onClose: () => {},
        requiredRole: 'Superadmin',
        currentRole: 'Read-Only Auditor',
        actionAttempted: 'modify cloud API credentials',
      })
    );
    expect(html).toContain('Elevated Access Required');
    expect(html).toContain('modify cloud API credentials');
    expect(html).toContain('Superadmin');
    expect(html).toContain('Switch Account (Login)');
  });

  it('State 9: FormFieldError renders error chip or verified status correctly', () => {
    const errorHtml = renderToString(
      React.createElement(FormFieldError, { error: 'Invalid WooCommerce Consumer Key format (ck_...)' })
    );
    expect(errorHtml).toContain('Invalid WooCommerce Consumer Key format');

    const validHtml = renderToString(
      React.createElement(FormFieldError, { isValid: true })
    );
    expect(validHtml).toContain('Verified valid format');
  });

  it('State 10: SuccessCelebrationModal confirms numbers and renders next actions', () => {
    const html = renderToString(
      React.createElement(SuccessCelebrationModal, {
        isOpen: true,
        onClose: () => {},
        title: 'Month-End Net Sales Close Generated!',
        metrics: [
          { label: 'Total Orders', value: '1,026' },
          { label: 'Net Revenue', value: '৳2,450,000' },
        ],
        nextActions: [
          { label: 'View SKU Leaderboard', onClick: () => {}, primary: true },
        ],
      })
    );
    expect(html).toContain('Month-End Net Sales Close Generated!');
    expect(html).toContain('1,026');
    expect(html).toContain('৳2,450,000');
    expect(html).toContain('View SKU Leaderboard');
  });

  it('Hygiene: SuffixHygieneBadge validates clean IDs and flags malformed branch suffixes', () => {
    const cleanHtml = renderToString(
      React.createElement(SuffixHygieneBadge, { orderId: '17263 c' })
    );
    expect(cleanHtml).toContain('17263 c');

    const malformedHtml = renderToString(
      React.createElement(SuffixHygieneBadge, { orderId: '17263c' })
    );
    expect(malformedHtml).toContain('17263c');
    expect(malformedHtml).toContain('Format: 17263 c');
  });
});
