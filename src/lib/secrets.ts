import fs from 'fs';
import path from 'path';

export interface SecretsConfig {
  woocommerce: {
    store_url: string;
    consumer_key: string;
    consumer_secret: string;
  };
  pathao: {
    base_url: string;
    client_id: string;
    client_secret: string;
    username: string;
    password: string;
  };
  llm: {
    openrouter_key?: string;
    gemini_key?: string;
    groq_key?: string;
    huggingface_key?: string;
  };
  ga4: {
    property_id: string;
  };
  gcp_service_account: {
    type?: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id?: string;
    auth_uri?: string;
    token_uri?: string;
    auth_provider_x509_cert_url?: string;
    client_x509_cert_url?: string;
    universe_domain?: string;
  };
  meta: {
    pixel_id: string;
    ad_account_id: string;
    access_token: string;
  };
  gcs?: {
    bucket_name?: string;
    namespace?: string;
  };
}

/**
 * Normalizes private key strings by converting literal "\n" to real newlines.
 */
function normalizePrivateKey(rawKey: string): string {
  if (!rawKey) return '';
  let formatted = rawKey.trim();
  if ((formatted.startsWith('"') && formatted.endsWith('"')) || (formatted.startsWith("'") && formatted.endsWith("'"))) {
    formatted = formatted.substring(1, formatted.length - 1);
  }
  return formatted.replace(/\\n/g, '\n');
}

/**
 * Normalizes GA4 property ID (removes optional 'properties/' prefix for standard numeric ID).
 */
export function normalizeGa4PropertyId(propId: string): string {
  if (!propId) return '';
  return propId.replace(/^properties\//i, '').trim();
}

/**
 * Parses environment variables and secrets.toml into a structured config object.
 */
export function getSecretsConfig(): SecretsConfig {
  // 1. If .env.local exists, ensure its keys are in process.env (even in standalone scripts)
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Initialize config from environment variables (.env.local, .env, or Vercel)
  const config: SecretsConfig = {
    woocommerce: {
      store_url:
        process.env.WOOCOMMERCE_STORE_URL ||
        process.env.WC_STORE_URL ||
        'https://deencommerce.com',
      consumer_key:
        process.env.WOOCOMMERCE_CONSUMER_KEY ||
        process.env.WC_CONSUMER_KEY ||
        '',
      consumer_secret:
        process.env.WOOCOMMERCE_CONSUMER_SECRET ||
        process.env.WC_CONSUMER_SECRET ||
        '',
    },
    pathao: {
      base_url:
        process.env.PATHAO_BASE_URL ||
        'https://api-hermes.pathao.com',
      client_id:
        process.env.PATHAO_CLIENT_ID ||
        '',
      client_secret:
        process.env.PATHAO_CLIENT_SECRET ||
        '',
      username:
        process.env.PATHAO_USERNAME ||
        '',
      password:
        process.env.PATHAO_PASSWORD ||
        '',
    },
    llm: {
      openrouter_key:
        process.env.OPENROUTER_KEY ||
        process.env.OPENROUTER_API_KEY ||
        '',
      gemini_key:
        process.env.GEMINI_KEY ||
        process.env.GEMINI_API_KEY ||
        '',
      groq_key:
        process.env.GROQ_KEY ||
        process.env.GROQ_API_KEY ||
        '',
      huggingface_key:
        process.env.HUGGINGFACE_KEY ||
        process.env.HUGGINGFACE_API_KEY ||
        '',
    },
    ga4: {
      property_id: normalizeGa4PropertyId(process.env.GA4_PROPERTY_ID || ''),
    },
    gcp_service_account: {
      type: process.env.GCP_TYPE || 'service_account',
      project_id: process.env.GCP_PROJECT_ID || '',
      private_key_id: process.env.GCP_PRIVATE_KEY_ID || '',
      private_key: normalizePrivateKey(process.env.GCP_PRIVATE_KEY || ''),
      client_email: process.env.GCP_CLIENT_EMAIL || '',
      client_id: process.env.GCP_CLIENT_ID || '',
      auth_uri: process.env.GCP_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.GCP_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL || '',
      universe_domain: process.env.GCP_UNIVERSE_DOMAIN || 'googleapis.com',
    },
    meta: {
      pixel_id: process.env.META_PIXEL_ID || '',
      ad_account_id: process.env.META_AD_ACCOUNT_ID || '',
      access_token: process.env.META_ACCESS_TOKEN || '',
    },
    gcs: {
      bucket_name: process.env.GCS_BUCKET_NAME || 'deen-bi-cache',
      namespace: process.env.PERSISTENT_CACHE_NAMESPACE || 'shared',
    },
  };

  // 3. Check for secrets.toml in root or .streamlit folder to populate missing fields
  const candidateFiles = [
    path.join(process.cwd(), 'secrets.toml'),
    path.join(process.cwd(), '.streamlit', 'secrets.toml'),
  ];

  for (const filePath of candidateFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let currentSection = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const sectionMatch = trimmed.match(/^\[(.*)\]$/);
          if (sectionMatch) {
            currentSection = sectionMatch[1].trim().toLowerCase();
            continue;
          }

          // Top-level or section key-value pair
          const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"(.*)"$/);
          if (kvMatch) {
            const key = kvMatch[1].trim();
            const val = kvMatch[2].trim();

            if (!currentSection) {
              // Top-level variables
              if (key === 'META_PIXEL_ID' && !config.meta.pixel_id) {
                config.meta.pixel_id = val;
              } else if (key === 'META_AD_ACCOUNT_ID' && !config.meta.ad_account_id) {
                config.meta.ad_account_id = val;
              } else if (key === 'META_ACCESS_TOKEN' && !config.meta.access_token) {
                config.meta.access_token = val;
              } else if (key === 'GCS_BUCKET_NAME' && config.gcs) {
                config.gcs.bucket_name = val;
              }
              continue;
            }

            if (currentSection === 'woocommerce') {
              const current = (config.woocommerce as any)[key];
              if (!current || current === 'https://deencommerce.com') {
                (config.woocommerce as any)[key] = val;
              }
            } else if (currentSection === 'pathao') {
              const current = (config.pathao as any)[key];
              if (!current || current === 'https://api-hermes.pathao.com') {
                (config.pathao as any)[key] = val;
              }
            } else if (currentSection === 'llm') {
              const current = (config.llm as any)[key];
              if (!current) {
                (config.llm as any)[key] = val;
              }
            } else if (currentSection === 'ga4') {
              if (key === 'property_id' && !config.ga4.property_id) {
                config.ga4.property_id = normalizeGa4PropertyId(val);
              }
            } else if (currentSection === 'gcp_service_account') {
              if (key === 'private_key') {
                if (!config.gcp_service_account.private_key) {
                  config.gcp_service_account.private_key = normalizePrivateKey(val);
                }
              } else if (!(config.gcp_service_account as any)[key]) {
                (config.gcp_service_account as any)[key] = val;
              }
            } else if (currentSection === 'meta') {
              if (key === 'pixel_id' && !config.meta.pixel_id) {
                config.meta.pixel_id = val;
              } else if (key === 'ad_account_id' && !config.meta.ad_account_id) {
                config.meta.ad_account_id = val;
              } else if (key === 'access_token' && !config.meta.access_token) {
                config.meta.access_token = val;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error reading secrets.toml:', err);
      }
    }
  }

  return config;
}
