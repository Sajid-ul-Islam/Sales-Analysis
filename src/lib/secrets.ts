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
}

/**
 * Parses secrets.toml into a structured config object.
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

  // 2. Initialize config from environment variables (.env.local or Vercel)
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
  };

  // If local secrets.toml exists (e.g. local dev), populate missing fields
  const filePath = path.join(process.cwd(), '.streamlit', 'secrets.toml');
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

        const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"(.*)"$/);
        if (kvMatch && currentSection) {
          const key = kvMatch[1].trim();
          const val = kvMatch[2].trim();

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
          }
        }
      }
    } catch (err) {
      console.error('Error reading secrets.toml:', err);
    }
  }

  return config;
}
