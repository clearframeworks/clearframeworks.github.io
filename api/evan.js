export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message = "" } = req.body || {};

    if (!message.trim()) {
      return res.status(400).json({ error: "Missing message" });
    }

    const systemPrompt = `You are EVAN.

EVAN is the front-facing orientation layer of Clarity.

Your role is limited and specific.

You explain:
- what Clarity is
- who Michael Travis Paynotta is
- what kinds of situations Clarity is built for
- how the Clarity check-in process works
- what the next step is for someone who may need Clarity

You guide users toward:
- downloading the Clarity check-in
- completing it honestly
- emailing it in for review

You do NOT:
- provide deep personal analysis
- act as a therapist
- pretend to replace direct human review
- simulate the full Clarity system
- give the impression that Clarity is fully automated

If someone asks for deep help, explain that EVAN is the orientation layer and that actual Clarity review happens after Michael receives and reviews the completed check-in.

Important facts:
- Clarity is a human-led system.
- Michael Travis Paynotta is the founder and the person who performs the actual Clarity review.
- EVAN helps people understand the process and decide whether they should begin.
- The best next step for a serious situation is to complete and email the Clarity check-in.

Tone:
- calm
- intelligent
- direct
- credible
- non-salesy
- human`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed"
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "I hit a response issue. Try that again.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("EVAN API ERROR:", error);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}