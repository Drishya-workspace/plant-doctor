import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = cleanSecret(process.env.OPENAI_API_KEY);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_API_KEY = cleanSecret(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      provider: OPENAI_API_KEY ? "openai" : GEMINI_API_KEY ? "gemini" : "none",
      model: OPENAI_API_KEY ? OPENAI_MODEL : GEMINI_API_KEY ? GEMINI_MODEL : null
    });
    return;
  }
  if (req.method !== "POST" || req.url !== "/api/plant-assistant") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJson(req);
    validatePayload(body);
    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
      sendJson(res, 503, { error: "No online model configured" });
      return;
    }
    const answer = OPENAI_API_KEY ? await askOpenAI(body) : await askGemini(body);
    sendJson(res, 200, { answer });
  } catch (error) {
    console.error("Assistant request failed:", error);
    sendJson(res, error.statusCode || 502, {
      error: error.publicMessage || error.message || "Assistant failed"
    });
  }
});

server.listen(PORT, () => {
  console.log(`Plant Doctor assistant server listening on http://0.0.0.0:${PORT}`);
});

function cleanSecret(value) {
  const secret = (value || "").trim();
  if (!secret || secret.includes("your_") || secret === "your_key_here") return "";
  return secret;
}

function providerError(provider, status, bodyText) {
  const detail = bodyText ? bodyText.slice(0, 500) : "";
  const error = new Error(`${provider} request failed: ${status}${detail ? ` - ${detail}` : ""}`);
  error.statusCode = 502;
  if (status === 401 || status === 403) {
    error.publicMessage = `${provider} rejected the API key. Check the Render environment variable.`;
  } else if (status === 429) {
    error.publicMessage = `${provider} quota or rate limit reached. Check billing/usage for the API key.`;
  } else if (status >= 500) {
    error.publicMessage = `${provider} is temporarily unavailable. Try again shortly.`;
  } else {
    error.publicMessage = `${provider} returned ${status}${detail ? `: ${detail}` : ""}`;
  }
  return error;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 120000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function validatePayload(body) {
  if (!body || typeof body.question !== "string" || !body.question.trim()) throw new Error("Missing question");
  if (!body.diagnosis || typeof body.diagnosis !== "object") throw new Error("Missing diagnosis context");
}

function systemPrompt() {
  return [
    "You are Plant Doctor AI, a follow-up assistant for an existing plant disease classifier.",
    "Use the supplied diagnosis, class probabilities, symptoms, cause, and treatment recommendations as context.",
    "Do not silently change the ML prediction. You may discuss uncertainty and alternatives shown in probabilities.",
    "Distinguish confirmed diagnosis-card facts from user-reported conditions.",
    "Do not invent pesticide dosages, spray intervals, restricted chemicals, or unsupported diagnoses.",
    "For chemical treatment, tell the user to follow local agricultural guidance and the product label.",
    "If confidence is low or the question is outside the provided context, say so and recommend local expert guidance.",
    "Keep answers concise, practical, and mobile-friendly."
  ].join("\n");
}

function buildMessages(body) {
  const diagnosis = JSON.stringify(body.diagnosis, null, 2);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  return [
    { role: "system", content: systemPrompt() },
    { role: "user", content: `Current diagnosis context:\n${diagnosis}` },
    ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"),
    { role: "user", content: body.question }
  ];
}

async function askOpenAI(body) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: buildMessages(body),
      temperature: 0.3,
      max_tokens: 500
    })
  });
  if (!response.ok) throw providerError("OpenAI", response.status, await response.text());
  const data = await response.json();
  const answer = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  if (!answer) throw new Error("OpenAI returned an empty answer");
  return answer;
}

async function askGemini(body) {
  const messages = buildMessages(body).map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: messages }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
    })
  });
  if (!response.ok) throw providerError("Gemini", response.status, await response.text());
  const data = await response.json();
  const answer = data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts.map((part) => part.text || "").join("")
    : "";
  if (!answer) throw new Error("Gemini returned an empty answer");
  return answer;
}
