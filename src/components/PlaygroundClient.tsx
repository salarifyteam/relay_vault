"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Card, Button, CodeBlock, Field, TextInput, Textarea, Select } from "@/components/ui";

type Endpoint = "chat" | "embeddings" | "registration-token";

const CHAT_MODELS = ["gpt-4o-mini", "gpt-4o", "claude-haiku-4-5", "gemini-2.0-flash"];
const EMBED_MODELS = ["text-embedding-3-small", "text-embedding-3-large", "gemini-embedding-001"];
const PROVIDERS = ["", "openai", "anthropic", "google", "xai", "zai"];

interface PlaygroundResult {
  status: number;
  requestId?: string;
  json?: unknown;
  raw?: string;
}

export function PlaygroundClient() {
  const [endpoint, setEndpoint] = useState<Endpoint>("chat");
  const [endUserLabel, setEndUserLabel] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0]);
  const [prompt, setPrompt] = useState("Say hello in one short sentence.");
  const [input, setInput] = useState("The quick brown fox.");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = { endpoint, endUserLabel };
      if (endpoint === "chat") {
        payload.body = { model, messages: [{ role: "user", content: prompt }] };
      } else if (endpoint === "embeddings") {
        payload.body = { model, input };
      } else {
        payload.provider = provider || undefined;
      }

      const r = await fetch("/api/console/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await r.text();
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        /* 비JSON */
      }
      setResult({ status: r.status, requestId: r.headers.get("x-relay-request-id") || undefined, json, raw });
    } finally {
      setBusy(false);
    }
  };

  const modelOptions = endpoint === "embeddings" ? EMBED_MODELS : CHAT_MODELS;

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
      <Card title="Request">
        <Field label="Endpoint">
          <Select
            value={endpoint}
            onChange={(e) => {
              const ep = e.target.value as Endpoint;
              setEndpoint(ep);
              setModel((ep === "embeddings" ? EMBED_MODELS : CHAT_MODELS)[0]);
            }}
          >
            <option value="chat">POST /v1/chat/completions</option>
            <option value="embeddings">POST /v1/embeddings</option>
            <option value="registration-token">POST /v1/registration-tokens</option>
          </Select>
        </Field>

        {endpoint !== "registration-token" && (
          <Field label="X-Relay-User (end-user label)" hint="The end-user must have a connected key in test mode.">
            <TextInput value={endUserLabel} onChange={(e) => setEndUserLabel(e.target.value)} placeholder="e.g. alice" />
          </Field>
        )}

        {(endpoint === "chat" || endpoint === "embeddings") && (
          <Field label="Model">
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
        )}

        {endpoint === "chat" && (
          <Field label="Prompt (user message)">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
          </Field>
        )}

        {endpoint === "embeddings" && (
          <Field label="Input">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} />
          </Field>
        )}

        {endpoint === "registration-token" && (
          <>
            <Field label="endUserLabel">
              <TextInput value={endUserLabel} onChange={(e) => setEndUserLabel(e.target.value)} placeholder="e.g. alice" />
            </Field>
            <Field label="Provider (optional)" hint="Leave blank to let the end-user choose in the widget.">
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p || "(let user choose)"}</option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <Button onClick={send} disabled={busy} style={{ marginTop: 4 }}>
          <Send size={13} />
          {busy ? "Sending…" : "Send"}
        </Button>
      </Card>

      <Card title="Response">
        {!result ? (
          <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>
            Fill in the request and hit Send. Calls run in <b>test</b> mode.
          </p>
        ) : (
          <ResponsePanel result={result} />
        )}
      </Card>
    </div>
  );
}

function ResponsePanel({ result }: { result: PlaygroundResult }) {
  const ok = result.status >= 200 && result.status < 300;
  const errObj =
    !ok && result.json && typeof result.json === "object" && "error" in (result.json as object)
      ? (result.json as { error: { message?: string; code?: string; doc_url?: string; request_id?: string } }).error
      : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
            background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: ok ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)",
          }}
        >
          {result.status}
        </span>
        {result.requestId && (
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
            request_id: <code>{result.requestId}</code>
          </span>
        )}
      </div>

      {errObj && (
        <div
          style={{
            border: "1px solid var(--danger, #dc2626)", borderRadius: 8, padding: 12, marginBottom: 10,
            background: "rgba(239,68,68,0.06)", fontSize: 13,
          }}
        >
          {errObj.code && (
            <div style={{ marginBottom: 4 }}>
              <b>code:</b> <code>{errObj.code}</code>
            </div>
          )}
          {errObj.message && <div style={{ marginBottom: 4 }}>{errObj.message}</div>}
          {errObj.doc_url && (
            <a href={errObj.doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              → See docs for this error
            </a>
          )}
        </div>
      )}

      <CodeBlock>{result.json ? JSON.stringify(result.json, null, 2) : result.raw || ""}</CodeBlock>
    </div>
  );
}
