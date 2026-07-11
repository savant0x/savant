"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { saveMasterKey } from "../lib/ipc";

type Props = { onSaved: () => void };

export default function MasterKeySetup({ onSaved }: Props) {
  const [provider, setProvider] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await saveMasterKey(provider, apiKey);
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ maxWidth: 520, display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 8 }}>Savant — Phase 1 Master Key</h1>
        <p style={{ opacity: 0.75 }}>
          One-time setup. Your API key is stored in the OS app-data vault.
          Windows: <code>%APPDATA%/savant/auth.json</code> · Unix:{" "}
          <code>~/.config/savant/auth.json</code>. Unix permissions enforced
          0o600.
        </p>
      </header>

      <Input
        type="text"
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        placeholder="openrouter"
      />
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-or-v1-..."
      />

      {error ? (
        <p style={{ color: "crimson", fontSize: 14 }}>Error: {error}</p>
      ) : null}

      <Button
        isDisabled={!apiKey || saving}
        onPress={handleSave}
      >
        {saving ? "Saving…" : "Save API Key"}
      </Button>
    </section>
  );
}
