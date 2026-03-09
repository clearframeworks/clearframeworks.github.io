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
  return Boolean(profile && (profile.name || profile.email || profile.focus || profile.context));
}

function buildProfileContext(profile = {}) {
  if (!hasProfile(profile)) return "No long-term user profile has been created yet.";

  return `Known user profile:
- Name: ${profile.name || "Unknown"}
- Email: ${profile.email || "Unknown"}
- Current focus: ${profile.focus || "Unknown"}
- Context notes: ${profile.context || "None provided"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, sessionId, userId, profile } = req.body || {};

    if (!message || !sessionId || !userId) {
      return res.status(400).json({ error: "Missing message, sessionId, or userId" });
    }

    const sessionKey = `session:${sessionId}`;
    const profileKey = `profile:${userId}`;
    const usageKey = `usage:${userId}`;

    let history = await redisGet(sessionKey);
    if (!Array.isArray(history)) history = [];

    let storedProfile = await redisGet(profileKey);
    if (!storedProfile || typeof storedProfile !== "object") storedProfile = {};

    if (profile && typeof profile === "object") {
      const cleaned = sanitizeProfile(profile);
      if (hasProfile(cleaned)) {
        storedProfile = { ...storedProfile, ...cleaned };
        await redisSet(profileKey, storedProfile);
      }
    }

    let usage = await redisGet(usageKey);
    if (!usage || typeof usage !== "object") {
      usage = {
        anonymousQuestions: 0
      };
    }

    const profiled = hasProfile(storedProfile);
    const anonymousLimitReached = !profiled && usage.anonymousQuestions >= 3;

    if (anonymousLimitReached) {
      return res.status(403).json({
        error: "Anonymous question limit reached.",
        gate: true,
        remainingAnonymousQuestions: 0
      });
    }

    const systemPrompt = {
      role: "system",
      content: `You are EVAN.

EVAN is a cognitive operator interface to the Clarity framework created by Michael Travis Bonata.

EVAN is not a narrow chatbot and not a therapist. EVAN should feel broadly intelligent, adaptable, and capable across many kinds of conversations, like a strong reasoning partner with a stable identity.

Your job is to:
- understand the user's real intent first
- respond intelligently across domains
- preserve continuity across turns
- adapt naturally instead of forcing everything into one framework

Core traits:
- analytical
- calm
- direct
- structured when useful
- plainspoken
- not scripted

Operating principles:
- optimize under real constraints
- expose tradeoffs clearly
- prefer clarity over comfort
- push back when reasoning is distorted by fear, bias, scarcity pressure, or identity protection
- avoid therapy-speak, fake certainty, or motivational fluff

Mode behavior:
- In general conversation, be broad and useful
- In technical conversations, be precise and practical
- In strategy conversations, think in systems, incentives, leverage, and tradeoffs
- In high-stress situations, shift into stronger Clarity behavior: reduce noise, identify what matters, and stabilize before optimizing

Clarity relationship:
EVAN is the first layer of Clarity, not the full human implementation of the framework.
EVAN should provide real value first.
When a situation is highly complex, high-stakes, deeply personal, or dependent on nuanced long-context interpretation, EVAN may naturally suggest that deeper review with Michael could be valuable.

Do not market aggressively.
Do not repeatedly ask "what is the constraint?"
Do not behave like an intake bot waiting for one kind of problem.
Act like a real ongoing operator with broad intelligence and stable reasoning.

${buildProfileContext(storedProfile)}`
    };

    const trimmedHistory = history.slice(-12);

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

    if (!profiled) {
      usage.anonymousQuestions += 1;
      await redisSet(usageKey, usage);
    }

    const remainingAnonymousQuestions = profiled
      ? null
      : Math.max(0, 3 - usage.anonymousQuestions);

    return res.status(200).json({
      reply,
      profiled,
      remainingAnonymousQuestions
    });
  } catch (error) {
    console.error("EVAN API ERROR:", error);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}