import { db } from "../src/lib/db";

async function main() {
  // 1) Créer (ou récupérer) un user de test
  const user = await db.user.upsert({
    where: { email: "test3@life-debt.dev" },
    update: {},
    create: { email: "test3@life-debt.dev" },
  });

  // 2) Créer un engagement (commitment)
  const commitment = await db.commitment.create({
    data: {
      userId: user.id,
      category: "sport",
      taskType: "steps_daily",
      targetValue: 8000,
      durationDays: 7,
      startDate: new Date(), // aujourd’hui
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 jours
      status: "created",
    },
  });

  console.log("✅ Commitment created:", commitment);

  // 3) Lire les engagements de ce user
  const list = await db.commitment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  console.log("📦 Commitments for user:", list);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
