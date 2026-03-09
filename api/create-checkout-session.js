import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: "https://clearframeworks.org/clarity?paid=true",
      cancel_url: "https://clearframeworks.org/clarity"
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("STRIPE CHECKOUT ERROR:", error);
    return res.status(500).json({ error: "Could not create checkout session." });
  }
}