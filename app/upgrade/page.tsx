"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "student" | "builder" | "hardcore";

function planLabel(p: Plan) {
  if (p === "student") return "STUDENT";
  if (p === "builder") return "BUILDER";
  return "HARDCORE";
}

<div style={{ marginTop: 16, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
  <p style={{ marginTop: 0 }}>
    Tu n’achètes pas des “features”. Tu achètes <strong>une conséquence</strong>.
  </p>
  <p style={{ marginBottom: 0, opacity: 0.85 }}>
    Plus tu peux engager plusieurs objectifs et augmenter le stake, plus ton cerveau prend ça au sérieux.
  </p>
</div>

export default function UpgradePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPlan, setCurrentPlan] = useState<Plan>("student");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadMe(e: string) {
    const r = await fetch(`/api/me?email=${encodeURIComponent(e)}`);
    const d = await r.json();
    if (r.ok) setCurrentPlan((d.user?.plan ?? "student") as Plan);
  }

  async function goCheckout(plan: "builder" | "hardcore") {
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur paiement");

    // 👉 redirection vers Stripe
    window.location.href = data.url;
  } catch (e: any) {
    alert(e.message || "Erreur paiement");
  }
}

  async function setPlan(plan: Plan) {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Upgrade failed");
      setCurrentPlan(d.user.plan);
      setMsg(`✅ Plan activé: ${planLabel(d.user.plan)}`);
    } catch (e: any) {
      setMsg(`❌ ${e.message || "Erreur"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("lifeDebtEmail");
    if (!saved) {
      router.push("/");
      return;
    }
    setEmail(saved);
    loadMe(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Upgrade</h1>
          <p style={{ marginTop: 6, opacity: 0.8 }}>
            Plan actuel : <strong>{planLabel(currentPlan)}</strong>
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Retour dashboard
        </button>
      </header>

      <p style={{ marginTop: 16, opacity: 0.85 }}>
        Ici on vend une chose : <strong>la conséquence</strong>. Le plan n’achète pas “des fonctionnalités”.
        Il achète un cadre plus strict, donc plus transformant.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 16 }}>
        {/* STUDENT */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>🧑‍🎓 STUDENT</h2>
          <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
            <li>1 engagement actif max</li>
            <li>Stake max 10€</li>
            <li>Pas de “daily_hard”</li>
          </ul>
          <p style={{ opacity: 0.8 }}>Mode “je commence” — discipline légère.</p>
          <button
            disabled={loading || currentPlan === "student"}
            onClick={() => setPlan("student")}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid #ccc",
              background: currentPlan === "student" ? "#f3f3f3" : "#fff",
              cursor: "pointer",
            }}
          >
            {currentPlan === "student" ? "Actif" : "Activer"}
          </button>
        </div>

        {/* BUILDER */}
        <div style={{ border: "1px solid #111", borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>🧱 BUILDER</h2>
          <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
            <li>3 engagements actifs max</li>
            <li>Stake max 30€</li>
            <li>Accès à toutes les tâches</li>
          </ul>
          <p style={{ opacity: 0.9 }}>
            Mode “je construis” — plusieurs fronts, vraie constance.
          </p>
          <button
            disabled={loading || currentPlan === "builder"}
            onClick={() => goCheckout("builder")}
              style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {currentPlan === "builder" ? "Actif" : "Activer (dev)"}
          </button>
        </div>

        {/* HARDCORE */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>🔥 HARDCORE</h2>
          <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
            <li>Engagements illimités</li>
            <li>Stake illimité (plus tard)</li>
            <li>Daily hard + règles strictes</li>
          </ul>
          <p style={{ opacity: 0.8 }}>
            Mode “je me transforme” — zéro excuses, identité.
          </p>
          <button
            disabled={loading || currentPlan === "hardcore"}
            onClick={() => goCheckout("hardcore")}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {currentPlan === "hardcore" ? "Actif" : "Activer (dev)"}
          </button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 14 }}>{msg}</p>}

      <p style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
        Note : “Activer (dev)” = simulation. Jour 8/9 on branchera Stripe.
      </p>
    </main>
  );
}

<div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
  <h3 style={{ marginTop: 0 }}>FAQ</h3>
  <p><strong>Est-ce que je perds mon argent si j’échoue ?</strong><br/>Pas aujourd’hui (mode MVP). Ensuite, oui : c’est le principe du stake.</p>
  <p><strong>Pourquoi un abonnement ?</strong><br/>Parce que tu payes pour un cadre plus strict + suivi + fonctionnalités avancées.</p>
  <p style={{ marginBottom: 0 }}><strong>Je peux annuler ?</strong><br/>Oui. Stripe gère l’abonnement et l’annulation.</p>
</div>
