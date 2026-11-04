import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name: string, defVal: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return defVal;
}

const targetDays = getArg('days', '7');
let targetUrl = getArg('url', 'http://localhost:3000/api/sync/cron');

// Append days query parameter
const parsedUrl = new URL(targetUrl);
if (!parsedUrl.searchParams.has('days')) {
  parsedUrl.searchParams.set('days', targetDays);
}
targetUrl = parsedUrl.toString();

// Load CRON_SECRET from .env.local if not already in process.env
let cronSecret = process.env.CRON_SECRET || '';
if (!cronSecret) {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('CRON_SECRET=')) {
        cronSecret = trimmed.slice('CRON_SECRET='.length).replace(/["']/g, '').trim();
        break;
      }
    }
  }
}

async function runCronSync() {
  console.log('========================================================');
  console.log('⚡ DEEN COMMERCE — AUTOMATED BACKGROUND CRON SYNC RUNNER');
  console.log('========================================================');
  console.log(`Target Endpoint : ${targetUrl}`);
  console.log(`Sync Time Window: Last ${targetDays} Days`);
  console.log(`Cron Secret Set : ${cronSecret ? '✅ Detected (' + cronSecret.slice(0, 4) + '***)' : '❌ Not Found'}`);
  console.log('--------------------------------------------------------\n');

  if (!cronSecret) {
    console.error('❌ Error: CRON_SECRET is missing. Please set it in .env.local or pass it as an environment variable.');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('📡 Sending authenticated request to cron endpoint...');

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      console.error(`\n❌ Cron sync failed with HTTP status ${res.status}:`);
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log(`\n✅ CRON SYNC COMPLETED SUCCESSFULLY IN ${elapsed}s!`);
    console.log('--------------------------------------------------------');
    console.log(`📦 New WooCommerce Order Items : ${data.newWcOrdersCount ?? 0}`);
    console.log(`🚚 Pathao Consignments Checked : ${data.updatedPathaoCount ?? 0}`);
    console.log(`🏬 Total Orders In Store       : ${data.totalOrdersInStore ?? 0}`);
    console.log(`☁️ Cloud Blob Saved            : ${data.blobSaved ? '✅ Yes' : 'ℹ️ Local/Fallback'}`);
    console.log('--------------------------------------------------------');
    console.log('\nDetailed Execution Log:');
    if (Array.isArray(data.log)) {
      data.log.forEach((l: string, idx: number) => {
        console.log(`  ${idx + 1}. ${l}`);
      });
    }
    console.log('\n========================================================');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Network / Execution Error connecting to ${targetUrl}:`, msg);
    console.error('Note: Ensure your Next.js local server is running (npm run dev) or pass --url with your production URL.');
    process.exit(1);
  }
}

runCronSync();
