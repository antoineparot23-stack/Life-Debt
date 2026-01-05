import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type TaskType = "steps_daily" | "km_daily" | "sessions_weekly" | "daily_hard";
type CommitmentStatus = "created" | "active" | "failed" | "completed";

const STATUS_VALUES: CommitmentStatus[] = ["created", "active", "failed", "completed"];

function planRules(plan: string) {
  if (plan === "builder") {
    return {
      maxActive: 3,
      maxStakeCents: 3000,
      allowDailyHard: true,
    };
  }

  if (plan === "hardcore") {
    return {
      maxActive: Infinity,
      maxStakeCents: Infinity,
      allowDailyHard: true,
    };
  }

  // student (default)
  return {
    maxActive: 1,
    maxStakeCents: 1000,
    allowDailyHard: false,
  };
}

function toStatus(s: unknown): CommitmentStatus {
  if (typeof s !== "string") return "created";
  return (STATUS_VALUES as string[]).includes(s) ? (s as CommitmentStatus) : "created";
}

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function sameDayLocal(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function allowedMisses(taskType: TaskType) {
  if (taskType === "daily_hard") return 0;
  if (taskType === "sessions_weekly") return 2;
  return 1;
}

function computeStatus(commitment: {
  taskType: TaskType;
  startDate: Date;
  endDate: Date;
  status: CommitmentStatus;
  checkIns: { date: Date; success: boolean }[];
}): CommitmentStatus {
  const now = new Date();

  const startDay = startOfDayLocal(commitment.startDate);
  const endDay = startOfDayLocal(commitment.endDate);
  const today = startOfDayLocal(now);

  // Statuts finaux : on ne change pas (MVP)
  if (commitment.status === "failed" || commitment.status === "completed") {
    return commitment.status;
  }

  // Pas encore commencé
  if (today < startDay) return "created";

  // Exigence :
  // - si terminé : jusqu’à endDay inclus
  // - sinon : jusqu’à hier (aujourd’hui est rattrapable)
  let requireUntil = addDays(today, -1);
  const finished = today > endDay;
  if (finished) requireUntil = endDay;

  // Rien à exiger si période trop courte
  if (requireUntil < startDay) {
    return finished ? "completed" : "active";
  }

  const maxMisses = allowedMisses(commitment.taskType);

  const successDays = commitment.checkIns
    .filter((c) => c.success)
    .map((c) => startOfDayLocal(c.date));

  let misses = 0;
  for (let d = new Date(startDay); d <= requireUntil; d = addDays(d, 1)) {
    const has = successDays.some((sd) => sameDayLocal(sd, d));
    if (!has) misses++;
    if (misses > maxMisses) return "failed";
  }

  if (finished) return "completed";
  return "active";
}

// CREATE commitment
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ stakeCents ajouté ici
    const { email, taskType, targetValue, durationDays, stakeCents } = body;

    if (!email || !taskType || !targetValue || !durationDays) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Sécurise stakeCents (0 à 30€ max => 3000 cents)
    const stake = Number(stakeCents ?? 0);
    if (!Number.isFinite(stake) || stake < 0 || stake > 3000) {
      return NextResponse.json({ error: "Invalid stakeCents" }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const rules = planRules(user.plan);

// 1️⃣ limite d'engagements actifs
const activeCount = await db.commitment.count({
  where: {
    userId: user.id,
    status: { in: ["created", "active"] },
  },
});

if (activeCount >= rules.maxActive) {
  return NextResponse.json(
    { error: "Limite d'engagements atteinte pour ton plan" },
    { status: 403 }
  );
}

// 2️⃣ limite de stake
if (stakeCents > rules.maxStakeCents) {
  return NextResponse.json(
    { error: "Stake trop élevé pour ton plan" },
    { status: 403 }
  );
}

// 3️⃣ tâche interdite
if (taskType === "daily_hard" && !rules.allowDailyHard) {
  return NextResponse.json(
    { error: "Cette tâche nécessite un plan supérieur" },
    { status: 403 }
  );
}



// 2️⃣ limite de stake
if (stake > rules.maxStakeCents) {
  return NextResponse.json(
    { error: "Stake trop élevé pour ton plan" },
    { status: 403 }
  );
}

// 3️⃣ tâches interdites
if (taskType === "daily_hard" && !rules.allowDailyHard) {
  return NextResponse.json(
    { error: "Cette tâche nécessite un plan supérieur" },
    { status: 403 }
  );
}


    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000
    );

    const commitment = await db.commitment.create({
      data: {
        userId: user.id,
        category: "sport",
        taskType,
        targetValue: Number(targetValue),
        durationDays: Number(durationDays),
        startDate,
        endDate,
        status: "created",
        // ✅ stake enregistré en cents
        stakeCents: stake as number,
       },
    });

    return NextResponse.json({ commitment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// READ commitments (+ include checkIns)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ commitments: [] }, { status: 200 });

    const commitments = await db.commitment.findMany({
      where: { userId: user.id },
      include: { checkIns: true },
      orderBy: { createdAt: "desc" },
    });

    const updates: Promise<any>[] = [];

    const computed = commitments.map((c) => {
      const currentStatus = toStatus(c.status);

      const newStatus = computeStatus({
        taskType: c.taskType as TaskType,
        startDate: c.startDate,
        endDate: c.endDate,
        status: currentStatus,
        checkIns: c.checkIns.map((x) => ({ date: x.date, success: x.success })),
      });

      if (newStatus !== currentStatus) {
        updates.push(
          db.commitment.update({
            where: { id: c.id },
            // ✅ Pour éviter les soucis TS/Prisma : set
            data: { status: { set: newStatus } as any },
          })
        );
      }

      return { ...c, status: newStatus };
    });

    if (updates.length) await Promise.all(updates);

    return NextResponse.json({ commitments: computed }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE commitment
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await db.commitment.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
