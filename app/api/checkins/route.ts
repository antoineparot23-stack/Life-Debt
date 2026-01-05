import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST(req: Request) {
  try {
    const { commitmentId } = await req.json();

    if (!commitmentId) {
      return NextResponse.json({ error: "Missing commitmentId" }, { status: 400 });
    }

    const today = startOfDay(new Date());

    const checkin = await db.checkIn.upsert({
      where: {
        commitmentId_date: {
          commitmentId,
          date: today,
        },
      },
      update: { success: true },
      create: {
        commitmentId,
        date: today,
        success: true,
      },
    });

    return NextResponse.json({ checkin }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
