import { useState } from "react";
import { Button, Card, TextArea } from "@heroui/react";
import { inferOpenrouter, type ProfileSummary } from "../lib/ipc";

type Props = { profiles: ProfileSummary[] };

export default function InferenceSmokeTest({ profiles }: Props) {
  const [prompt, setPrompt] = useState(
    "In one sentence, what is the historical significance of the year 1969?"
  );
  const [response, setResponse] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(): Promise<void> {
    setRunning(true);
    setError(null);
    setResponse(null);
    try {
      const out = await inferOpenrouter(prompt);
      setResponse(out);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  const hasOpenrouter = profiles.some((p) => p.provider === "openrouter");

  return (
    <section style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <header>
        <h1>Savant — Phase 1 Smoke Test</h1>
        <p style={{ opacity: 0.75 }}>
          Vault holds {profiles.length} profile(s). Pressing Run POSTs to
          OpenRouter&rsquo;s <code>/v1/chat/completions</code> and renders the
          reply below.
        </p>
      </header>

      <TextArea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <Button
        isDisabled={!hasOpenrouter || running}
        onPress={handleRun}
      >
        {running ? "Running…" : "Run Smoke Test"}
      </Button>

      {error ? (
        <Card>
          <p style={{ color: "crimson", padding: 16 }}>Error: {error}</p>
        </Card>
      ) : null}

      {response ? (
        <Card>
          <pre style={{ whiteSpace: "pre-wrap", padding: 16, margin: 0 }}>
            {response}
          </pre>
        </Card>
      ) : null}
    </section>
  );
}
