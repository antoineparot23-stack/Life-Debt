"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("lifeDebtEmail");
    if (saved) router.push("/dashboard");
  }, [router]);

  function login() {
    if (!email) return;
    localStorage.setItem("lifeDebtEmail", email);
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 920, margin: "60px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Life Debt</h1>
      <p style={{ marginTop: 10, fontSize: 18, opacity: 0.85 }}>
        Tu choisis une tâche. Tu mets un stake. Chaque jour, tu prouves que tu l’as fait.
      </p>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <p style={{ marginTop: 0 }}>
          La motivation est une illusion. <strong>La conséquence</strong> est réelle.
        </p>
        <ul style={{ lineHeight: 1.8, marginBottom: 0 }}>
          <li>Engagements simples (sport, discipline, révisions)</li>
          <li>Check-in quotidien</li>
          <li>Plans (Student / Builder / Hardcore)</li>
        </ul>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton email"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: 280 }}
        />
        <button
          onClick={login}
          style={{
            height: 42,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Entrer
        </button>
        <button
          onClick={() => router.push("/upgrade")}
          style={{
            height: 42,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Voir les plans
        </button>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
        MVP en cours. Tout le texte/design est modifiable.
      </p>
    </main>
  );
}
