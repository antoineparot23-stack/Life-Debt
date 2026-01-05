import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Missing webhook secret/signature" }, { status: 400 });
  }

  // IMPORTANT: body brut (pas req.json())
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
  }

  // On traite ce qui nous intéresse
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const email = (session.metadata?.email || session.customer_details?.email) as string | undefined;
    const plan = session.metadata?.plan as string | undefined;

    if (email && (plan === "builder" || plan === "hardcore")) {
      await db.user.update({
        where: { email },
        data: { plan },
      });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
