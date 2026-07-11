"use client";

import { useEffect, useState } from "react";
import { listProfiles, type ProfileSummary } from "@/lib/ipc";
import InferenceSmokeTest from "@/components/InferenceSmokeTest";

export default function InferencePage() {
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await listProfiles();
        setProfiles(p);
      } catch (err) {
        console.error("[InferencePage] listProfiles failed:", err);
        setProfiles([]);
      }
    })();
  }, []);

  if (profiles === null) {
    return <main style={{ padding: 24 }}>Loading vault…</main>;
  }
  return (
    <main style={{ padding: 24 }}>
      <InferenceSmokeTest profiles={profiles} />
    </main>
  );
}
