// One Yumi turn: Claude reads the tracker's tools, calls them through /api/agent/run, and answers.
// Not part of the build. Run: npm i @anthropic-ai/sdk && node docs/examples/yumi-loop.mjs "what's due today?"
// Env: ANTHROPIC_API_KEY, TRACKER_URL (e.g. http://localhost:3000), AGENT_API_TOKEN.
import Anthropic from "@anthropic-ai/sdk";

const { TRACKER_URL, AGENT_API_TOKEN } = process.env;
const headers = { authorization: `Bearer ${AGENT_API_TOKEN}`, "content-type": "application/json" };
const tracker = (path, body) =>
  fetch(`${TRACKER_URL}${path}`, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers }).then((r) => r.json());

const client = new Anthropic();
const { tools } = await tracker("/api/agent/tools");
const messages = [{ role: "user", content: process.argv[2] ?? "What is on today?" }];
const system = "You are Yumi, the owner's weekly-tracker assistant. Dates are Asia/Manila. Be brief.";

for (let turn = 0; turn < 8; turn++) {
  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    system,
    tools,
    tool_choice: { type: "auto" },
    messages,
  });
  messages.push({ role: "assistant", content: response.content });
  const calls = response.content.filter((block) => block.type === "tool_use");
  if (calls.length === 0) {
    console.log(response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
    break;
  }
  // Every tool_result goes back in one user message; a failed call is reported, not dropped.
  const results = await Promise.all(
    calls.map(async (call) => {
      const out = await tracker("/api/agent/run", { name: call.name, input: call.input });
      const content = JSON.stringify(out.ok ? out.result : { error: out.error });
      return { type: "tool_result", tool_use_id: call.id, content, is_error: !out.ok };
    }),
  );
  messages.push({ role: "user", content: results });
}
