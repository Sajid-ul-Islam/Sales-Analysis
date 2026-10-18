import { NextResponse } from 'next/server';
import { getSecretsWithOverrides, SecretsOverrides } from '@/lib/secrets';
import { getPathaoToken, getPathaoStores, PathaoStore } from '@/lib/pathaoClient';
import { testWooCommerceConnection } from '@/lib/woocommerceClient';
import { testGA4Connection } from '@/lib/ga4Client';
import { testMetaConnection } from '@/lib/metaClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

async function resolveStatus(overrides?: SecretsOverrides) {
  const secrets = getSecretsWithOverrides(overrides);

  // Test Pathao
  const pathaoStatus = {
    configured: !!(secrets.pathao.client_id && secrets.pathao.username),
    connected: false,
    username: secrets.pathao.username,
    storesCount: 0,
    stores: [] as { id: number | string; name: string; address?: string }[],
    message: '',
  };

  try {
    const token = await getPathaoToken(overrides?.pathao);
    if (token) {
      const stores = await getPathaoStores(overrides?.pathao);
      pathaoStatus.connected = true;
      pathaoStatus.storesCount = stores.length;
      pathaoStatus.stores = stores.map((s: PathaoStore) => ({
        id: s.store_id,
        name: s.store_name,
        address: s.store_address,
      }));
      pathaoStatus.message = `Authenticated with Pathao Hermes API. ${stores.length} merchant stores verified.`;
    }
  } catch (err: unknown) {
    pathaoStatus.message = err instanceof Error ? err.message : 'Failed to authenticate with Pathao';
  }

  // Test WooCommerce
  let wcStatus = {
    configured: !!(secrets.woocommerce.consumer_key && secrets.woocommerce.consumer_secret),
    connected: false,
    storeUrl: secrets.woocommerce.store_url,
    statusCode: 0,
    message: '',
  };

  try {
    const wcTest = await testWooCommerceConnection(overrides?.woocommerce);
    wcStatus = {
      configured: !!(secrets.woocommerce.consumer_key && secrets.woocommerce.consumer_secret),
      connected: wcTest.success,
      storeUrl: secrets.woocommerce.store_url,
      statusCode: wcTest.status,
      message: wcTest.message,
    };
  } catch (err: unknown) {
    wcStatus.message = err instanceof Error ? err.message : 'Failed to connect to WooCommerce store';
  }

  // Test GA4 & Meta in parallel
  const [ga4Status, metaStatus] = await Promise.all([
    testGA4Connection().catch((err: unknown) => ({
      connected: false,
      propertyId: secrets.ga4.property_id || '',
      clientEmail: secrets.gcp_service_account.client_email || '',
      message: err instanceof Error ? err.message : 'GA4 connection test failed',
      latencyMs: 0,
    })),
    testMetaConnection({
      overrideToken: overrides?.meta?.access_token,
      overridePixelId: overrides?.meta?.pixel_id,
      overrideAdAccountId: overrides?.meta?.ad_account_id,
    }).catch((err: unknown) => ({
      connected: false,
      pixelId: secrets.meta.pixel_id || '',
      adAccountId: secrets.meta.ad_account_id || '',
      isTokenExpired: false,
      message: err instanceof Error ? err.message : 'Meta connection test failed',
      latencyMs: 0,
    })),
  ]);

  return {
    pathao: pathaoStatus,
    woocommerce: wcStatus,
    ga4: ga4Status,
    meta: metaStatus,
  };
}

export async function GET(req: Request) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.message }, { status: auth.statusCode });
  }

  const status = await resolveStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  // 1. Admin Auth Check for dynamic override testing
  const auth = validateApiRequest(req, { requiredRole: 'admin', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.message }, { status: auth.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  const status = await resolveStatus(body);
  return NextResponse.json(status);
}
