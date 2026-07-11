"use client";

import MasterKeySetup from "@/components/MasterKeySetup";

export default function MasterKeyPage() {
  return (
    <main style={{ padding: 24 }}>
      <MasterKeySetup onSaved={() => (window.location.href = "/")} />
    </main>
  );
}
