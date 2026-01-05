"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "student" | "builder" | "hardcore" | string;

type Commitment = {
  id: string;
  taskType: "steps_daily" | "km_daily" | "sessions_weekly" | "daily_hard";
  targetValue: number;
  durationDays: number;
  status: "created" | "active" | "failed" | "completed" | string;
  createdAt: string;
  startDate: string;
  endDate: string;
  stakeCents: number;
  checkIns?: { date: string; success: boolean }[];
};

const TASK_LABEL: Record<Commitment["taskType"], string> = {
  steps_daily: "Pas / jour",
  km_daily: "Km / jour",
  sessions_weekly: "Séances / semaine",
  daily_hard: "Tous les jours (hard)",
};

function planLabel(p: Plan) {
  if (p === "student") return "STUDENT";
  if (p === "builder") return "BUILDER";
  if (p === "hardcore") return "HARDCORE";
  return String(p || "STUDENT").toUpperCase();
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function statusBadge(status: string) {
  if (status === "active") return "🟢 ACTIVE";
  if (status === "created") return "🟡 CREATED";
  if (status === "failed") return "🔴 FAILED";
  if (status === "completed") return "🏆 COMPLETED";
  return status;
}

function eurosFromCents(cents: number) {
  const e = Math.round((Number(cents) / 100) * 100) / 100;
  return e.toFixed(0); // on affiche en € entiers pour l’instant
}

function stakeLine(status: string, stakeCents: number) {
  const euros = Number(eurosFromCents(stakeCents));
  if (!stakeCents || euros <= 0) return "Stake : 0€";
  if (status === "failed") return `💀 Perdu : ${euros}€`;
  if (status === "completed") return `✅ Récupéré : ${euros}€`;
  if (status === "active") return `⚠️ À risque : ${euros}€`;
  return `Stake : ${euros}€`;
}

function isInDanger(c: Commitment) {
  if (c.status !== "active") return false;
  const doneToday = c.checkIns?.some((ci) => ci.success && isToday(ci.date));
  return !doneToday;
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [plan, setPlan] = useState<Plan>("student");

  const [taskType, setTaskType] =
    useState<Commitment["taskType"]>("steps_daily");
  const [targetValue, setTargetValue] = useState(9000);
  const [durationDays, setDurationDays] = useState(7);

  // Stake choisi en euros dans l'UI, converti en cents pour l'API
  const stakeOptionsEuros = [0, 5, 10, 15, 20, 25, 30];
  const [stakeEuros, setStakeEuros] = useState<number>(10);

  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email && targetValue > 0 && durationDays > 0;
  }, [email, targetValue, durationDays]);

  async function loadMe(e: string) {
    try {
      const r = await fetch(`/api/me?email=${encodeURIComponent(e)}`);
      const d = await r.json();
      if (r.ok) setPlan(d?.user?.plan ?? "student");
    } catch {
      // pas grave, on reste sur student par défaut
    }
  }

  async function loadCommitments(e: string) {
    const res = await fetch(`/api/commitments?email=${encodeURIComponent(e)}`);
    const data = await res.json();
    setCommitments(data.commitments || []);
  }

  async function createCommitment() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const stakeCents = Math.round(Number(stakeEuros) * 100);

      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          taskType,
          targetValue,
          durationDays,
          stakeCents,
        }),
      });

      // ✅ Jour 7 : afficher la VRAIE erreur du serveur
      if (!res.ok) {
        let errMsg = "Erreur création engagement";
        try {
          const j = await res.json();
          errMsg = j?.error || errMsg;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      await loadCommitments(email);
      await loadMe(email);
    } catch (e: any) {
      setError(e?.message || "Erreur création engagement");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCommitment(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/commitments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
      await loadCommitments(email);
      await loadMe(email);
    } catch (e: any) {
      setError(e?.message || "Erreur suppression");
    } finally {
      setLoading(false);
    }
  }

  async function checkInToday(commitmentId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitmentId }),
      });

      if (!res.ok) {
        let errMsg = "Erreur check-in";
        try {
          const j = await res.json();
          errMsg = j?.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      await loadCommitments(email);
    } catch (e: any) {
      setError(e?.message || "Erreur check-in");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("lifeDebtEmail");
    router.push("/");
  }

  // Jour 8 ready (placeholder) : on renverra vers Stripe plus tard
  function goToUpgrade() {
    router.push("/upgrade");
  }

  useEffect(() => {
    const saved = localStorage.getItem("lifeDebtEmail");
    if (!saved) {
      router.push("/");
      return;
    }
    setEmail(saved);
    loadMe(saved);
    loadCommitments(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: 16 }}>
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Life Debt — Dashboard</h1>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Connecté : <strong>{email}</strong>
          </p>
          <p style={{ marginTop: 4, opacity: 0.85 }}>
            Plan actuel : <strong>{planLabel(plan)}</strong>
          </p>
        </div>

        {/* Boutons haut droite */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* ✅ Jour 7 */}
          <button
            onClick={goToUpgrade}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
            title="Voir les plans"
          >
            Upgrade
          </button>

          {/* Jour 8 ready (placeholder UX) */}
          <button
            onClick={goToUpgrade}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
            title="Bientôt : paiement Stripe"
          >
            Upgrade (paiement bientôt)
          </button>

          <button
            onClick={logout}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* CREATE */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          marginTop: 16,
          marginBottom: 20,
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Créer un engagement</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={taskType}
            onChange={(e) =>
              setTaskType(e.target.value as Commitment["taskType"])
            }
            style={{ padding: 8 }}
          >
            <option value="steps_daily">Pas / jour</option>
            <option value="km_daily">Km / jour</option>
            <option value="sessions_weekly">Séances / semaine</option>
            <option value="daily_hard">Tous les jours (hard)</option>
          </select>

          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(+e.target.value)}
            style={{ padding: 8, width: 140 }}
            placeholder="objectif"
          />

          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(+e.target.value)}
            style={{ padding: 8, width: 140 }}
            placeholder="durée (jours)"
          />

          <select
            value={stakeEuros}
            onChange={(e) => setStakeEuros(+e.target.value)}
            style={{ padding: 8, width: 160 }}
            title="Montant mis en jeu"
          >
            {stakeOptionsEuros.map((e) => (
              <option key={e} value={e}>
                Stake {e}€
              </option>
            ))}
          </select>

          <button
            disabled={!canSubmit || loading}
            onClick={createCommitment}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "Créer"}
          </button>

          <button
            disabled={loading}
            onClick={() => {
              setError(null);
              loadMe(email);
              loadCommitments(email);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Rafraîchir
          </button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Ton plan impose des limites (ex: 1 engagement en STUDENT). Si tu es
          bloqué, clique <strong>Upgrade</strong>.
        </p>
      </section>

      {/* LIST */}
      <section>
        <h2>Mes engagements</h2>

        {commitments.length === 0 && (
          <p style={{ opacity: 0.75 }}>Aucun engagement pour l’instant.</p>
        )}

        {commitments.map((c) => {
          const doneToday = c.checkIns?.some(
            (ci) => ci.success && isToday(ci.date)
          );
          const danger = isInDanger(c);

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid #eee",
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <strong>{TASK_LABEL[c.taskType]}</strong>
                <span>{statusBadge(c.status)}</span>
              </div>

              <div style={{ marginTop: 6 }}>
                Objectif : <strong>{c.targetValue}</strong> — Durée :{" "}
                <strong>{c.durationDays} jours</strong>
              </div>

              <div style={{ marginTop: 6 }}>
                <strong>{stakeLine(c.status, c.stakeCents)}</strong>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Période : {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
              </div>

              <div style={{ marginTop: 8 }}>
                {doneToday ? "✅ Fait aujourd’hui" : "❌ Pas fait aujourd’hui"}
                {danger && (
                  <span style={{ marginLeft: 10, color: "crimson" }}>
                    ⚠️ Aujourd’hui est rattrapable, mais la pression est là.
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => checkInToday(c.id)}
                  disabled={
                    loading ||
                    doneToday ||
                    c.status === "failed" ||
                    c.status === "completed"
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  J’ai fait la tâche aujourd’hui
                </button>

                <button
                  onClick={() => deleteCommitment(c.id)}
                  disabled={loading}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Supprimer
                </button>

                {/* CTA upgrade contextualisé */}
                {(c.status === "active" || c.status === "created") &&
                  plan === "student" && (
                    <button
                      onClick={goToUpgrade}
                      disabled={loading}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title="Débloquer plus d’engagements / stakes"
                    >
                      Débloquer plus (Upgrade)
                    </button>
                  )}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                id: {c.id}
              </div>
            </div>
          );
        })}
      </section>

      {/* ERROR */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #f3b3b3",
            background: "#fff7f7",
            color: "crimson",
          }}
        >
          ❌ {error}
        </div>
      )}
    </main>
  );
}
