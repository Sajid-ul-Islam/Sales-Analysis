import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { AuthProvider } from '@/context/AuthContext';

describe('SettingsTab Profile & Cloud Sync Hub', () => {
  it('renders operator profile with security credentials and access permissions', () => {
    render(
      <AuthProvider>
        <SettingsTab
          excludeAugust={false}
          setExcludeAugust={() => {}}
          excludePOS={false}
          setExcludePOS={() => {}}
        />
      </AuthProvider>
    );

    // Profile card checks
    expect(screen.getByText(/Active Access Privileges & Security Scope/i)).toBeDefined();
    expect(screen.getByText(/Commercial Realization/i)).toBeDefined();
    expect(screen.getByText(/Live Ops & Pack Queue/i)).toBeDefined();
    expect(screen.getByText(/Real-Time Cloud Sync/i)).toBeDefined();
    expect(screen.getByText(/Month-End Net Sales \(\.xlsx\)/i)).toBeDefined();
    expect(screen.getByText(/SIP Omnichannel Routing/i)).toBeDefined();
    expect(screen.getByText(/Customer Risk Intelligence/i)).toBeDefined();
    expect(screen.getByText(/AI Operations Copilot/i)).toBeDefined();
    expect(screen.getByText(/System Secrets & BYOK/i)).toBeDefined();

    // Token telemetry
    expect(screen.getByText(/HMAC-SHA256 \(Edge\)/i)).toBeDefined();
    expect(screen.getByText(/HttpOnly • SameSite=Lax/i)).toBeDefined();

    // Cloud Sync & Omnichannel Hub checks
    expect(screen.getByText(/Cloud Sync & Omnichannel Hub/i)).toBeDefined();
    expect(screen.getByText(/Direct synchronization with WooCommerce web checkout & Pathao Hermes courier APIs/i)).toBeDefined();
  });
});
