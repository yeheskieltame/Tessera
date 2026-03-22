#!/usr/bin/env node

const http = require("http");
const { execFile, execFileSync } = require("child_process");
const { URL } = require("url");

const VERSION = "1.0.0";
const MODELS = ["claude-opus-4-6", "claude-sonnet-4-6"];
const DEFAULT_PORT = 9877;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePort() {
  const flagIdx = process.argv.indexOf("--port");
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    return Number(process.argv[flagIdx + 1]);
  }
  if (process.env.PORT) {
    return Number(process.env.PORT);
  }
  return DEFAULT_PORT;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function callClaude(prompt, system, model) {
  return new Promise((resolve, reject) => {
    const args = ["--print", "--output-format", "text"];
    if (model) {
      args.push("--model", model);
    }
    if (system) {
      args.push("--append-system-prompt", system);
    }

    const child = execFile("claude", args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function checkClaude() {
  try {
    execFileSync("claude", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handler(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  // GET /api/status
  if (path === "/api/status" && req.method === "GET") {
    console.log(`[${timestamp()}] GET /api/status`);
    return json(res, 200, { ok: true, version: VERSION, models: MODELS });
  }

  // POST /api/prompt
  if (path === "/api/prompt" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }

    const { prompt, system, model } = body || {};
    if (!prompt) {
      return json(res, 400, { error: "Missing required field: prompt" });
    }

    console.log(`[${timestamp()}] POST /api/prompt  model=${model || "default"}  prompt=${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`);

    try {
      const text = await callClaude(prompt, system, model);
      return json(res, 200, { text });
    } catch (e) {
      console.error(`[${timestamp()}] Claude error: ${e.message}`);
      return json(res, 502, { error: e.message });
    }
  }

  // GET /api/prompt (query-param variant for EventSource / simple clients)
  if (path === "/api/prompt" && req.method === "GET") {
    const prompt = parsed.searchParams.get("prompt");
    const system = parsed.searchParams.get("system");
    const model = parsed.searchParams.get("model");

    if (!prompt) {
      return json(res, 400, { error: "Missing required query param: prompt" });
    }

    console.log(`[${timestamp()}] GET  /api/prompt  model=${model || "default"}  prompt=${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`);

    try {
      const text = await callClaude(prompt, system, model);
      return json(res, 200, { text });
    } catch (e) {
      console.error(`[${timestamp()}] Claude error: ${e.message}`);
      return json(res, 502, { error: e.message });
    }
  }

  // 404 fallback
  json(res, 404, { error: "Not found" });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parsePort();

console.log("");
console.log("  tessera-bridge v" + VERSION);
console.log("  ─────────────────────────────");

if (checkClaude()) {
  console.log("  Claude CLI: found");
} else {
  console.log("  Claude CLI: NOT FOUND — install it first (https://docs.anthropic.com/en/docs/claude-cli)");
  process.exit(1);
}

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`  Listening:   http://localhost:${PORT}`);
  console.log("");
  console.log("  Endpoints:");
  console.log("    POST /api/prompt   { prompt, system?, model? }");
  console.log("    GET  /api/prompt   ?prompt=...&system=...&model=...");
  console.log("    GET  /api/status");
  console.log("");
});
