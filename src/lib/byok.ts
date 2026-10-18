export type AIProvider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'openrouter';

export interface BYOKConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
  isActive: boolean;
  lastTestedAt?: string;
  status?: 'CONNECTED' | 'ERROR' | 'UNCONFIGURED';
  statusMessage?: string;
}

export interface ProviderMetadata {
  id: AIProvider;
  name: string;
  badge: string;
  defaultModel: string;
  models: { id: string; label: string; description: string }[];
  isFreeTierAvailable: boolean;
  keyPrefix: string;
  keyUrl: string;
  keyUrlLabel: string;
  whereToPutGuidance: {
    inApp: string;
    envVar: string;
    envFile: string;
  };
}

export const PROVIDERS_METADATA: Record<AIProvider, ProviderMetadata> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Recommended • 100% Free',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Ultra-fast, lowest latency & high accuracy' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Deep reasoning for complex reconciliation' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'High stability fallback model' },
    ],
    isFreeTierAvailable: true,
    keyPrefix: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyUrlLabel: 'Get Free Gemini Key in Google AI Studio',
    whereToPutGuidance: {
      inApp: 'Paste your key in the BYOK input below (stored locally in browser localStorage with client-side device salting; never saved to backend servers).',
      envVar: 'GEMINI_API_KEY=AIzaSy...',
      envFile: '.env.local (in root directory) or Vercel Environment Variables',
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    badge: 'Official API',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast, cost-efficient everyday after-sales auditor' },
      { id: 'gpt-4o', label: 'GPT-4o', description: 'Flagship multimodal reasoning' },
    ],
    isFreeTierAvailable: false,
    keyPrefix: 'sk-proj-... / sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'Get API Key from OpenAI Platform',
    whereToPutGuidance: {
      inApp: 'Paste your OpenAI key in the input below.',
      envVar: 'OPENAI_API_KEY=sk-...',
      envFile: '.env.local or Vercel Environment Variables',
    },
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Lightning Fast LPU',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', description: 'Ultra-fast open source intelligence' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', description: 'High speed MoE processing' },
    ],
    isFreeTierAvailable: true,
    keyPrefix: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    keyUrlLabel: 'Get Free Groq Key from Groq Console',
    whereToPutGuidance: {
      inApp: 'Paste your Groq API key in the input below.',
      envVar: 'GROQ_API_KEY=gsk_...',
      envFile: '.env.local or Vercel Environment Variables',
    },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Multi-Model Gateway',
    defaultModel: 'google/gemini-2.5-flash',
    models: [
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OpenRouter)', description: 'Fast unified gateway' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat V3', description: 'High capability cost-effective analysis' },
    ],
    isFreeTierAvailable: true,
    keyPrefix: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    keyUrlLabel: 'Get API Key from OpenRouter',
    whereToPutGuidance: {
      inApp: 'Paste your OpenRouter API key in the input below.',
      envVar: 'OPENROUTER_API_KEY=sk-or-...',
      envFile: '.env.local or Vercel Environment Variables',
    },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Claude 3.5 Sonnet',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Industry benchmark reasoning & analysis' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Ultra-fast concise response model' },
    ],
    isFreeTierAvailable: false,
    keyPrefix: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'Get Claude API Key from Anthropic Console',
    whereToPutGuidance: {
      inApp: 'Paste your Anthropic API key in the input below.',
      envVar: 'ANTHROPIC_API_KEY=sk-ant-...',
      envFile: '.env.local or Vercel Environment Variables',
    },
  },
};

/**
 * Dynamically detects which AI provider and model to choose based on key signatures.
 * Requires ZERO configuration from user: pasting any key automatically configures the provider.
 */
export function detectAIProvider(apiKey: string): {
  provider: AIProvider;
  model: string;
  name: string;
  isRecognized: boolean;
} {
  const cleanKey = (apiKey || '').trim();

  if (!cleanKey) {
    return {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      name: 'Google Gemini',
      isRecognized: false,
    };
  }

  // 1. Google Gemini Key: Typically starts with AIzaSy... or AIza...
  if (cleanKey.startsWith('AIzaSy') || cleanKey.startsWith('AIza') || (cleanKey.length === 39 && /^[A-Za-z0-9_-]+$/.test(cleanKey))) {
    return {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      name: 'Google Gemini',
      isRecognized: true,
    };
  }

  // 2. Groq Cloud Key: Starts with gsk_
  if (cleanKey.startsWith('gsk_')) {
    return {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      name: 'Groq Cloud',
      isRecognized: true,
    };
  }

  // 3. OpenRouter Key: Starts with sk-or-
  if (cleanKey.startsWith('sk-or-')) {
    return {
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash',
      name: 'OpenRouter',
      isRecognized: true,
    };
  }

  // 4. Anthropic Key: Starts with sk-ant-
  if (cleanKey.startsWith('sk-ant-')) {
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      name: 'Anthropic Claude',
      isRecognized: true,
    };
  }

  // 5. OpenAI Key: Starts with sk-proj- or standard sk-
  if (cleanKey.startsWith('sk-proj-') || cleanKey.startsWith('sk-')) {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      name: 'OpenAI (ChatGPT)',
      isRecognized: true,
    };
  }

  // Fallback: Default to Google Gemini (primary native engine)
  return {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    name: 'Google Gemini (Assumed)',
    isRecognized: false,
  };
}

const STORAGE_KEY = 'deen_byok_config_v1';

/**
 * Derives a local device/origin salt to obfuscate stored API keys
 * and prevent trivial plaintext exposure in localStorage.
 */
function getDeviceSalt(): string {
  if (typeof window === 'undefined') return 'deen_server_salt_fallback';
  const nav = window.navigator || {} as Navigator;
  return `${window.location.origin || 'deen'}|${(nav.userAgent || '').slice(0, 32)}|${nav.language || 'en'}`;
}

function obfuscateKey(plaintext: string): string {
  if (!plaintext) return '';
  const salt = getDeviceSalt();
  let result = '';
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result += String.fromCharCode(charCode);
  }
  return 'v1:' + (typeof btoa !== 'undefined' ? btoa(result) : Buffer.from(result, 'binary').toString('base64'));
}

function deobfuscateKey(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('v1:')) {
    // Backwards compatibility: raw plaintext from older versions
    return stored;
  }
  try {
    const b64 = stored.slice(3);
    const decoded = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const salt = getDeviceSalt();
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return stored;
  }
}

export function loadBYOKConfig(): BYOKConfig {
  if (typeof window === 'undefined') {
    return {
      apiKey: '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      isActive: false,
      status: 'UNCONFIGURED',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        apiKey: '',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        isActive: false,
        status: 'UNCONFIGURED',
      };
    }
    const parsed = JSON.parse(raw);
    const storedKey = parsed.encryptedKey || parsed.apiKey || '';
    const resolvedKey = deobfuscateKey(storedKey);

    return {
      apiKey: resolvedKey,
      provider: parsed.provider || 'gemini',
      model: parsed.model || 'gemini-2.5-flash',
      isActive: Boolean(resolvedKey && resolvedKey.trim() !== ''),
      lastTestedAt: parsed.lastTestedAt,
      status: parsed.status || (resolvedKey ? 'CONNECTED' : 'UNCONFIGURED'),
      statusMessage: parsed.statusMessage,
    };
  } catch (e) {
    console.error('Failed to load BYOK config from storage:', e);
    return {
      apiKey: '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      isActive: false,
      status: 'UNCONFIGURED',
    };
  }
}

export function saveBYOKConfig(config: Partial<BYOKConfig>): BYOKConfig {
  if (typeof window === 'undefined') {
    return {
      apiKey: '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      isActive: false,
      ...config,
    };
  }

  const existing = loadBYOKConfig();
  const apiKey = (config.apiKey !== undefined ? config.apiKey : existing.apiKey).trim();

  // If user passed a key, dynamically detect provider & default model if not explicitly specified
  let provider = config.provider || existing.provider;
  let model = config.model || existing.model;

  if (config.apiKey !== undefined && (!config.provider || config.provider === existing.provider)) {
    const detected = detectAIProvider(apiKey);
    provider = detected.provider;
    model = detected.model;
  }

  const updated: BYOKConfig = {
    apiKey,
    provider,
    model,
    isActive: Boolean(apiKey && apiKey.length > 0),
    lastTestedAt: config.lastTestedAt || existing.lastTestedAt,
    status: config.status || (apiKey ? 'CONNECTED' : 'UNCONFIGURED'),
    statusMessage: config.statusMessage || existing.statusMessage,
  };

  try {
    // Obfuscate key before persisting to localStorage
    const storagePayload = {
      ...updated,
      apiKey: '', // Never store plaintext key in localStorage
      encryptedKey: obfuscateKey(apiKey),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storagePayload));
    // Dispatch custom event for real-time reactivity across all open cards
    window.dispatchEvent(new CustomEvent('deen_byok_updated', { detail: updated }));
  } catch (e) {
    console.error('Failed to save BYOK config:', e);
  }

  return updated;
}

export function clearBYOKConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('deen_byok_updated', {
      detail: {
        apiKey: '',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        isActive: false,
        status: 'UNCONFIGURED'
      }
    }));
  } catch (e) {
    console.error('Failed to clear BYOK config:', e);
  }
}
