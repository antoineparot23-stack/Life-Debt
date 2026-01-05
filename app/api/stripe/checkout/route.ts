import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.json();
  const email = body?.email as string | undefined;
  const plan = body?.plan as "builder" | "hardcore" | undefined;

  if (!email || !plan) {
    return NextResponse.json({ error: "Missing email or plan" }, { status: 400 });
  }

  const priceId =
    plan === "builder"
      ? process.env.STRIPE_PRICE_BUILDER
      : process.env.STRIPE_PRICE_HARDCORE;

  if (!priceId) {
    return NextResponse.json({ error: "Missing Stripe priceId in .env" }, { status: 500 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 1) créer (ou réutiliser) customer Stripe
  let customerId = user.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { email },
    });
    customerId = customer.id;

    await db.user.update({
      where: { email },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 2) Checkout Session abonnement
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/upgrade?canceled=1`,
    metadata: {
      email,
      plan,
    },
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
