import { NextResponse } from 'next/server';
import { getSecretsConfig } from '@/lib/secrets';
import { getPathaoToken, getPathaoStores } from '@/lib/pathaoClient';
import { testWooCommerceConnection } from '@/lib/woocommerceClient';

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

  return NextResponse.json({
    pathao: pathaoStatus,
    woocommerce: wcStatus,
  });
}
