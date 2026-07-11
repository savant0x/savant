"use client";

import { useEffect, useState } from "react";
import { listProfiles, type ProfileSummary } from "@/lib/ipc";
import MasterKeySetup from "@/components/MasterKeySetup";
import InferenceSmokeTest from "@/components/InferenceSmokeTest";

type AppState =
  | { kind: "loading" }
  | { kind: "needs-setup" }
  | { kind: "ready"; profiles: ProfileSummary[] };

export default function Home() {
  const [state, setState] = useState<AppState>({ kind: "loading" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const profiles = await listProfiles();
      const hasOpenrouter = profiles.some((p) => p.provider === "openrouter");
      setState(
        hasOpenrouter ? { kind: "ready", profiles } : { kind: "needs-setup" }
      );
    } catch (err) {
      console.error("[Home] listProfiles failed:", err);
      setState({ kind: "needs-setup" });
    }
  }

  if (state.kind === "loading") {
    return <main style={{ padding: 24 }}>Loading vault…</main>;
  }
  if (state.kind === "needs-setup") {
    return (
      <main style={{ padding: 24 }}>
        <MasterKeySetup onSaved={refresh} />
      </main>
    );
  }
  return (
    <main style={{ padding: 24 }}>
      <InferenceSmokeTest profiles={state.profiles} />
    </main>
  );
}
