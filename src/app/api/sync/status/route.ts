import { NextResponse } from 'next/server';
import { getSecretsConfig } from '@/lib/secrets';
import { getPathaoToken, getPathaoStores } from '@/lib/pathaoClient';
import { testWooCommerceConnection } from '@/lib/woocommerceClient';
import { testGA4Connection } from '@/lib/ga4Client';
import { testMetaConnection } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const secrets = getSecretsConfig();

  // Test Pathao
  let pathaoStatus = {
    configured: !!(secrets.pathao.client_id && secrets.pathao.username),
    connected: false,
    username: secrets.pathao.username,
    storesCount: 0,
    stores: [] as any[],
    message: '',
  };

  try {
    const token = await getPathaoToken();
    if (token) {
      const stores = await getPathaoStores();
      pathaoStatus.connected = true;
      pathaoStatus.storesCount = stores.length;
      pathaoStatus.stores = stores.map((s: any) => ({
        id: s.store_id,
        name: s.store_name,
        address: s.store_address,
      }));
      pathaoStatus.message = `Authenticated with Pathao Hermes API. ${stores.length} merchant stores verified.`;
    }
  } catch (err: any) {
    pathaoStatus.message = err?.message || 'Failed to authenticate with Pathao';
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
    const wcTest = await testWooCommerceConnection();
    wcStatus = {
      configured: !!(secrets.woocommerce.consumer_key && secrets.woocommerce.consumer_secret),
      connected: wcTest.success,
      storeUrl: secrets.woocommerce.store_url,
      statusCode: wcTest.status,
      message: wcTest.message,
    };
  } catch (err: any) {
    wcStatus.message = err?.message || 'Failed to connect to WooCommerce store';
  }

  // Test GA4 & Meta in parallel
  const [ga4Status, metaStatus] = await Promise.all([
    testGA4Connection().catch((err: any) => ({
      connected: false,
      propertyId: secrets.ga4.property_id || '',
      clientEmail: secrets.gcp_service_account.client_email || '',
      message: err?.message || 'GA4 connection test failed',
      latencyMs: 0,
    })),
    testMetaConnection().catch((err: any) => ({
      connected: false,
      pixelId: secrets.meta.pixel_id || '',
      adAccountId: secrets.meta.ad_account_id || '',
      isTokenExpired: false,
      message: err?.message || 'Meta connection test failed',
      latencyMs: 0,
    })),
  ]);

  return NextResponse.json({
    pathao: pathaoStatus,
    woocommerce: wcStatus,
    ga4: ga4Status,
    meta: metaStatus,
  });
}
