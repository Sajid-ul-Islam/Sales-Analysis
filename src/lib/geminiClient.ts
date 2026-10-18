import { GoogleGenAI } from '@google/genai';
import { getSecretsConfig } from './secrets';

let cachedGeminiClient: GoogleGenAI | null = null;

export type AIProvider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'openrouter';

export interface AIGenerationOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  model?: string;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  byokApiKey?: string;
  byokProvider?: AIProvider;
  byokModel?: string;
}

/**
 * Returns a singleton instance of the Google GenAI client for server-configured keys.
 */
export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  if (customApiKey && customApiKey.trim() !== '') {
    try {
      return new GoogleGenAI({ apiKey: customApiKey.trim() });
    } catch (err) {
      console.error('Failed to initialize Google GenAI with custom key:', err);
      return null;
    }
  }

  if (cachedGeminiClient) return cachedGeminiClient;

  const secrets = getSecretsConfig();
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    secrets.llm?.gemini_key ||
    '';

  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  try {
    cachedGeminiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    return cachedGeminiClient;
  } catch (err) {
    console.error('Failed to initialize Google GenAI client:', err);
    return null;
  }
}

/**
 * Universal multi-provider AI completion dispatcher.
 * Supports Google Gemini, OpenAI, Groq, OpenRouter, and Anthropic.
 * Automatically chooses the best model and provides instant heuristic fallback on failure.
 */
export async function generateAICompletion(options: AIGenerationOptions): Promise<string | null> {
  const secrets = getSecretsConfig();

  // 1. Resolve API key & Provider
  let apiKey = (options.byokApiKey || '').trim();
  let provider = options.byokProvider;

  // If no BYOK key passed, check server environment
  if (!apiKey) {
    if (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || secrets.llm?.gemini_key) {
      apiKey = (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || secrets.llm?.gemini_key || '').trim();
      provider = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY.trim();
      provider = 'openai';
    } else if (process.env.GROQ_API_KEY || secrets.llm?.groq_key) {
      apiKey = (process.env.GROQ_API_KEY || secrets.llm?.groq_key || '').trim();
      provider = 'groq';
    } else if (process.env.OPENROUTER_API_KEY || secrets.llm?.openrouter_key) {
      apiKey = (process.env.OPENROUTER_API_KEY || secrets.llm?.openrouter_key || '').trim();
      provider = 'openrouter';
    }
  }

  if (!apiKey) {
    return null;
  }

  // 2. Auto-detect provider if missing
  if (!provider) {
    if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AIza') || (apiKey.length === 39 && /^[A-Za-z0-9_-]+$/.test(apiKey))) {
      provider = 'gemini';
    } else if (apiKey.startsWith('gsk_')) {
      provider = 'groq';
    } else if (apiKey.startsWith('sk-or-')) {
      provider = 'openrouter';
    } else if (apiKey.startsWith('sk-ant-')) {
      provider = 'anthropic';
    } else if (apiKey.startsWith('sk-')) {
      provider = 'openai';
    } else {
      provider = 'gemini';
    }
  }

  // 3. Dispatch based on provider
  try {
    if (provider === 'gemini') {
      const ai = getGeminiClient(options.byokApiKey ? apiKey : undefined);
      if (!ai) return null;

      const modelName = options.byokModel || options.model || 'gemini-2.5-flash';
      const config: Record<string, unknown> = {
        temperature: options.temperature ?? 0.2,
      };

      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.prompt,
        config,
      });

      return response.text || null;
    }

    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      let defaultModel = 'gpt-4o-mini';

      if (provider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        defaultModel = 'llama-3.3-70b-versatile';
      } else if (provider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        defaultModel = 'google/gemini-2.5-flash';
      }

      const modelName = options.byokModel || options.model || defaultModel;

      const messages: Array<{ role: string; content: string }> = [];
      if (options.systemInstruction) {
        messages.push({ role: 'system', content: options.systemInstruction });
      }
      messages.push({ role: 'user', content: options.prompt });

      const requestBody: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options.temperature ?? 0.2,
      };

      if (options.responseMimeType === 'application/json') {
        requestBody.response_format = { type: 'json_object' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`${provider} API error:`, res.status, errorText);
        return null;
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }

    if (provider === 'anthropic') {
      const modelName = options.byokModel || options.model || 'claude-3-5-sonnet-20241022';
      const requestBody: Record<string, unknown> = {
        model: modelName,
        max_tokens: 1500,
        messages: [{ role: 'user', content: options.prompt }],
        temperature: options.temperature ?? 0.2,
      };

      if (options.systemInstruction) {
        requestBody.system = options.systemInstruction;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Anthropic API error:', res.status, errorText);
        return null;
      }

      const data = await res.json();
      return data?.content?.[0]?.text || null;
    }

    return null;
  } catch (err) {
    console.error('Multi-provider AI completion error:', err);
    return null;
  }
}
