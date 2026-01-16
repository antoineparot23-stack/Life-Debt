import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CommitmentStatus, TaskType } from "@prisma/client";

type Plan = "student" | "builder" | "hardcore" | string;

type CheckInRow = {
  id: string;
  commitmentId: string;
  date: Date;
  success: boolean;
  createdAt: Date;
};

type CommitmentRow = {
  id: string;
  userId: string;
  category: string;
  taskType: TaskType;
  targetValue: number;
  durationDays: number;
  startDate: Date;
  endDate: Date;
  status: CommitmentStatus;
  createdAt: Date;
  stakeCents: number;
  checkIns: CheckInRow[];
};

function planRules(plan: Plan) {
  if (plan === "builder") return { maxActive: 3, maxStakeCents: 3000, allowDailyHard: true };
  if (plan === "hardcore")
    return { maxActive: Number.MAX_SAFE_INTEGER, maxStakeCents: Number.MAX_SAFE_INTEGER, allowDailyHard: true };
  return { maxActive: 1, maxStakeCents: 1000, allowDailyHard: false };
}

function computeStatus(input: {
  status: CommitmentStatus;
  startDate: Date;
  endDate: Date;
  checkIns: { date: Date; success: boolean }[];
}): CommitmentStatus {
  const { status, startDate, endDate, checkIns } = input;

  const created = CommitmentStatus.created;
  const active = CommitmentStatus.active;
  const failed = CommitmentStatus.failed;
  const completed = CommitmentStatus.success;

  if (status === failed || status === completed) return status;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (status === created) return startDate <= now ? active : created;

  if (status === active && endDate < todayUTC) {
    const startDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    const msDay = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / msDay));

    const okDays = new Set<string>();
    for (const ci of checkIns) {
      if (!ci.success) continue;
      const d = new Date(Date.UTC(ci.date.getUTCFullYear(), ci.date.getUTCMonth(), ci.date.getUTCDate()));
      okDays.add(d.toISOString().slice(0, 10));
    }

    let allOk = true;
    for (let i = 0; i < days; i++) {
      const d = new Date(startDay.getTime() + i * msDay);
      const key = d.toISOString().slice(0, 10);
      if (!okDays.has(key)) {
        allOk = false;
        break;
      }
    }

    return allOk ? completed : failed;
  }

  return active;
}

// -------------------- GET --------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const commitments: CommitmentRow[] = await db.commitment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        category: true,
        taskType: true,
        targetValue: true,
        durationDays: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        stakeCents: true,
        checkIns: {
          orderBy: { date: "asc" },
          select: { id: true, commitmentId: true, date: true, success: true, createdAt: true },
        },
      },
    });

    const updates: Promise<any>[] = [];

    const computed = commitments.map((c: CommitmentRow) => {
      const currentStatus = c.status;

      const newStatus = computeStatus({
        status: currentStatus,
        startDate: c.startDate,
        endDate: c.endDate,
        checkIns: c.checkIns.map((x) => ({ date: x.date, success: x.success })),
      });

      if (newStatus !== currentStatus) {
        updates.push(
          db.commitment.update({
            where: { id: c.id },
            data: { status: newStatus },
          })
        );
      }

      return {
        ...c,
        status: newStatus,
        checkIns: c.checkIns.map((x) => ({ date: x.date.toISOString(), success: x.success })),
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        createdAt: c.createdAt.toISOString(),
      };
    });

    if (updates.length) await Promise.all(updates);
    return NextResponse.json({ commitments: computed }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// -------------------- POST --------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body?.email || "").trim();
    const taskType = String(body?.taskType || "").trim();
    const targetValue = Number(body?.targetValue);
    const durationDays = Number(body?.durationDays);
    const stakeCents = Math.max(0, Math.round(Number(body?.stakeCents ?? 0)));

    if (!email || !taskType || !Number.isFinite(targetValue) || !Number.isFinite(durationDays)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, plan: true },
    });

    const rules = planRules(user.plan as Plan);

    const activeCount = await db.commitment.count({
      where: { userId: user.id, status: { in: [CommitmentStatus.created, CommitmentStatus.active] } },
    });

    if (activeCount >= rules.maxActive) {
      return NextResponse.json({ error: "Limite d'engagements atteinte pour ton plan" }, { status: 403 });
    }

    if (stakeCents > rules.maxStakeCents) {
      return NextResponse.json({ error: "Stake trop élevé pour ton plan" }, { status: 403 });
    }

    if (taskType === "daily_hard" && !rules.allowDailyHard) {
      return NextResponse.json({ error: "Cette tâche nécessite un plan supérieur" }, { status: 403 });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const commitment = await db.commitment.create({
      data: {
        userId: user.id,
        category: "sport",
        taskType: taskType as TaskType,
        targetValue,
        durationDays,
        startDate,
        endDate,
        status: CommitmentStatus.created,
        stakeCents,
      },
    });

    return NextResponse.json({ commitment }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// -------------------- DELETE --------------------
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db.commitment.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
