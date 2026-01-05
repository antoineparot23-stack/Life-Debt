"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // juste UX : on renvoie au dashboard
    const t = setTimeout(() => router.push("/dashboard"), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main style={{ maxWidth: 700, margin: "60px auto", padding: 16 }}>
      <h1>Paiement réussi ✅</h1>
      <p>Ton plan va être activé automatiquement (webhook). Redirection…</p>
    </main>
  );
}
