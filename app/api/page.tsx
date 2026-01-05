"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("lifeDebtEmail");
    if (saved) router.push("/dashboard");
  }, [router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;

    localStorage.setItem("lifeDebtEmail", clean);
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
        Life Debt
      </h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        MVP login simple : entre ton email pour accéder au dashboard.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 20 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex: toi@mail.com"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Continuer
        </button>
      </form>
    </main>
  );
}
