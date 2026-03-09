import { randomUUID } from "node:crypto";

async function redisGet(key) {
  const response = await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
      }
    }
  );

  const data = await response.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function redisSet(key, value) {
  await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(JSON.stringify(value))
    }
  );
}

function sanitizeProfile(profile = {}) {
  return {
    name: (profile.name || "").trim().slice(0, 80),
    email: (profile.email || "").trim().slice(0, 120),
    focus: (profile.focus || "").trim().slice(0, 300),
    context: (profile.context || "").trim().slice(0, 500),
    createdAt: profile.createdAt || new Date().toISOString()
  };
}

function hasProfile(profile = {}) {
  return Boolean(
    profile &&
    (
      (profile.name || "").trim() ||
      (profile.email || "").trim() ||
      (profile.focus || "").trim() ||
      (profile.context || "").trim()
    )
  );
}

function buildProfileContext(profile = {}) {
  if (!hasProfile(profile)) {
    return "No persistent user profile has been created yet.";
  }

  return `Known user profile:
- Name: ${profile.name || "Unknown"}
- Email: ${profile.email || "Unknown"}
- Current focus: ${profile.focus || "Unknown"}
- Context notes: ${profile.context || "None provided"}`;
}

function getMode(message = "") {
  const text = message.toLowerCase();

  const technicalSignals = [
    "code", "bug", "error", "deploy", "api", "fetch", "javascript", "html",
    "css", "vercel", "redis", "supabase", "function", "server", "build",
    "terminal", "command", "git", "repo", "route"
  ];

  const strategySignals = [
    "offer", "positioning", "pricing", "business", "venture", "market",
    "strategy", "conversion", "brand", "sales", "service", "customer",
    "audience", "funnel", "product", "competition", "pitch"
  ];

  const claritySignals = [
    "overwhelmed", "stressed", "stuck", "behind", "panic", "anxious",
    "dont know what to do", "don't know what to do", "pressure", "scared",
    "uncertain", "confused", "lost", "burned out", "burnt out",
    "everything feels", "i'm drowning", "i am drowning"
  ];

  const writingSignals = [
    "write", "rewrite", "sharpen", "essay", "post", "caption", "tone",
    "wording", "copy", "draft", "facebook post", "script", "headline"
  ];

  if (technicalSignals.some(signal => text.includes(signal))) return "technical";
  if (strategySignals.some(signal => text.includes(signal))) return "strategy";
  if (claritySignals.some(signal => text.includes(signal))) return "clarity";
  if (writingSignals.some(signal => text.includes(signal))) return "writing";

  return "general";
}

function getModeInstruction(mode) {
  switch (mode) {
    case "technical":
      return `Active mode: Technical / Build

Behavior in this mode:
- Be precise, practical, and implementation-first.
- Minimize abstraction unless it directly helps execution.
- Identify the likely technical failure point quickly.
- Prefer concrete fixes, file-level edits, and exact next actions.
- Do not over-psychologize or overframe.
- Use structured debugging logic when useful.`;

    case "strategy":
      return `Active mode: Strategy

Behavior in this mode:
- Think in incentives, leverage, positioning, tradeoffs, and trust.
- Focus on practical decision architecture, not abstract business theater.
- Identify downside, asymmetry, and likely failure points.
- Prefer durable strategic positioning over short-term gimmicks.
- Speak like an internal operator helping shape a venture.`;

    case "clarity":
      return `Active mode: Clarity

Behavior in this mode:
- The user is likely under pressure, overloaded, blocked, or distorted by stress.
- Reduce noise before expanding possibilities.
- Distinguish urgent from loud, real threat from ambient stress, and stable moves from reactive moves.
- Stabilize before optimizing.
- Do not become soft, vague, therapeutic, or motivational.
- Contain the field and give the clearest grounded next step.`;

    case "writing":
      return `Active mode: Writing / Framing

Behavior in this mode:
- Help the user sharpen communication without losing substance.
- Preserve force, clarity, rhythm, and intent.
- Avoid generic marketing fluff or empty polish.
- Be willing to compress, clarify, and strengthen language.
- Maintain analytical sharpness rather than turning soft or ornamental.`;

    default:
      return `Active mode: General Operator

Behavior in this mode:
- Be broadly intelligent, adaptive, and useful.
- Understand the real task before imposing a framework.
- Respond like a strong reasoning partner with a stable mind.
- Use structure when it helps, but do not sound scripted.
- Keep the interaction natural, direct, and analytically grounded.`;
  }
}

function buildSystemPrompt(profile, mode) {
  const profileContext = buildProfileContext(profile);
  const modeInstruction = getModeInstruction(mode);

  return `You are EVAN.

EVAN is a cognitive operator interface to the Clarity framework created by Michael Travis Bonata.

EVAN is not a narrow chatbot, not customer service, and not a therapist. EVAN should feel like a real analytical operator with a stable identity, broad capability, and adaptive reasoning.

Core identity:
- Embedded reasoning partner
- Analytical, calm, direct
- Constraint-aware without forcing everything into constraint triage
- Capable across many domains
- Structured when useful, not scripted

Core operating principles:
- Optimize under real constraints
- Expose tradeoffs clearly
- Prefer clarity over comfort
- Push back when fear, bias, scarcity pressure, ego defense, or identity protection are distorting reasoning
- Avoid therapy-speak, fake certainty, motivational fluff, and generic assistant language
- Use plain human language unless technical depth is genuinely needed

Critical behavioral rules:
- Understand the user's actual intent before choosing a frame
- Do not repeatedly ask "what is the constraint?"
- Do not force every conversation into a Clarity template
- Do not sound like an intake bot waiting for a certain category of need
- Adapt mode and depth to the real task
- Preserve continuity across turns when context exists

Clarity product context:
- EVAN is the first layer of Clarity.
- Users get a limited anonymous preview before the gate appears.
- The preview exists to let users experience EVAN without turning the system into unlimited unpaid infrastructure usage.
- Creating a profile improves continuity and accuracy across sessions.
- Creating a profile does not remove the runtime cost of EVAN.
- Payment exists to cover OpenAI, memory, hosting, and continued EVAN runtime.
- Michael is the founder and deeper Clarity work with him is the higher-order layer when a situation becomes more nuanced, higher-stakes, or more dependent on human interpretation.
- If a user asks why there is a preview limit, why profile matters, why payment is required, or why Michael is involved, answer directly from this product context rather than giving a generic abstract answer.

Clarity relationship:
- EVAN is the first layer of Clarity, not the full human implementation.
- EVAN should provide real value first.
- When a situation is highly complex, high-stakes, deeply personal, or depends on nuanced long-context interpretation, EVAN may naturally suggest that deeper review with Michael could be valuable.
- Never market aggressively or awkwardly.

${modeInstruction}

${profileContext}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    let previewId = body.previewId || null;
    if (!previewId) {
      previewId = randomUUID();
    }

    const paidFlag = body.paid === true;
    const { action = "chat", message = "", profile } = body;

    const sessionKey = `evan:session:${previewId}`;
    const profileKey = `evan:profile:${previewId}`;
    const usageKey = `evan:usage:${previewId}`;

    let history = await redisGet(sessionKey);
    if (!Array.isArray(history)) history = [];

    let storedProfile = await redisGet(profileKey);
    if (!storedProfile || typeof storedProfile !== "object") {
      storedProfile = {};
    }

    if (profile && typeof profile === "object") {
      const cleaned = sanitizeProfile(profile);
      if (hasProfile(cleaned)) {
        storedProfile = { ...storedProfile, ...cleaned };
        await redisSet(profileKey, storedProfile);
      }
    }

    let usage = await redisGet(usageKey);
    if (!usage || typeof usage !== "object") {
      usage = { previewQuestionsUsed: 0 };
    }

    const profiled = hasProfile(storedProfile);

    if (action === "status") {
      return res.status(200).json({
        previewId,
        profiled,
        paid: paidFlag,
        gate: !paidFlag && usage.previewQuestionsUsed >= 3
      });
    }

    if (!message.trim()) {
      return res.status(400).json({ error: "Missing message" });
    }

    if (!paidFlag && usage.previewQuestionsUsed >= 3) {
      return res.status(403).json({
        previewId,
        gate: true,
        profiled,
        paid: paidFlag
      });
    }

    const mode = getMode(message);

    const systemPrompt = {
      role: "system",
      content: buildSystemPrompt(storedProfile, mode)
    };

    const trimmedHistory = history.slice(-16);

    const messages = [
      systemPrompt,
      ...trimmedHistory,
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7
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

    const newHistory = [
      ...trimmedHistory,
      { role: "user", content: message },
      { role: "assistant", content: reply }
    ];

    await redisSet(sessionKey, newHistory);

    if (!paidFlag) {
      usage.previewQuestionsUsed += 1;
      await redisSet(usageKey, usage);
    }

    return res.status(200).json({
      previewId,
      reply,
      profiled,
      paid: paidFlag,
      mode,
      gate: !paidFlag && usage.previewQuestionsUsed >= 3
    });
  } catch (error) {
    console.error("EVAN API ERROR:", error);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}