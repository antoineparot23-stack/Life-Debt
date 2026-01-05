import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED = new Set(["student", "builder", "hardcore"]);

export async function POST(req: Request) {
  const body = await req.json();
  const email = body?.email;
  const plan = body?.plan;

  if (!email || !plan) {
    return NextResponse.json({ error: "Missing email or plan" }, { status: 400 });
  }

  if (!ALLOWED.has(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { email },
    data: { plan },
    select: { email: true, plan: true },
  });

  return NextResponse.json({ user }, { status: 200 });
}
