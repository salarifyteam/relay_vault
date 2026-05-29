export type ByokProvider = "openai" | "google" | "anthropic" | "xai" | "zai";

export interface ByokValidationResult {
  ok: boolean;
  error?: string;
  models?: string[];
}

export function maskByokKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}...`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-3)}`;
}

function normalizeModelId(
  provider: ByokProvider,
  rawId: string | undefined | null
): string {
  if (!rawId) return "";
  if (provider === "google") {
    const segments = rawId.split("/");
    return segments[segments.length - 1] || rawId;
  }
  return rawId;
}

function extractModelIds(provider: ByokProvider, body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  if (provider === "openai" || provider === "anthropic") {
    const data = (body as { data?: Array<{ id?: string }> }).data;
    if (!Array.isArray(data)) return [];
    return data
      .map((model) => normalizeModelId(provider, model?.id))
      .filter((id): id is string => Boolean(id));
  }

  if (provider === "google") {
    const models = (body as { models?: Array<{ name?: string; id?: string }> })
      .models;
    if (!Array.isArray(models)) return [];
    return models
      .map((model) => normalizeModelId(provider, model?.name || model?.id))
      .filter((id): id is string => Boolean(id));
  }

  return [];
}

export async function validateByokKey(
  provider: ByokProvider,
  apiKey: string
): Promise<ByokValidationResult> {
  try {
    if (!apiKey) {
      return { ok: false, error: "API 키가 필요합니다." };
    }

    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } })?.error?.message ||
          "OpenAI API 키 검증 실패";
        return { ok: false, error: message };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: true, models: extractModelIds(provider, body) };
    }

    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } })?.error?.message ||
          "Claude API 키 검증 실패";
        return { ok: false, error: message };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: true, models: extractModelIds(provider, body) };
    }

    if (provider === "google") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } })?.error?.message ||
          "Google AI Studio API 키 검증 실패";
        return { ok: false, error: message };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: true, models: extractModelIds(provider, body) };
    }

    if (provider === "xai") {
      const response = await fetch("https://api.x.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } })?.error?.message ||
          "xAI API 키 검증 실패";
        return { ok: false, error: message };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: true, models: extractModelIds("openai", body) };
    }

    if (provider === "zai") {
      const response = await fetch("https://api.z.ai/api/paas/v4/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { error?: { message?: string } })?.error?.message ||
          "z.ai API 키 검증 실패";
        return { ok: false, error: message };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: true, models: extractModelIds("openai", body) };
    }

    return { ok: false, error: "지원되지 않는 프로바이더입니다." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "API 키 검증 실패",
    };
  }
}
