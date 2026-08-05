const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const EventSource = require("eventsource");
globalThis.EventSource = EventSource;

async function listTools() {
  const mcpUrl = "http://127.0.0.1:22346/mcp";
  console.log(`Connecting to ${mcpUrl}...`);
  try {
    const transport = new SSEClientTransport(new URL(mcpUrl));
    const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Connected!");
    const tools = await client.listTools();
    console.log("Tools available:", JSON.stringify(tools, null, 2));
    await client.close();
  } catch (err) {
    console.error("Error:", err);
  }
}

listTools();
