import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const URL = 'http://127.0.0.1:22346/mcp';
const API_KEY = '1oBaWtEsZuqVsfzLoHlALKBtNcTQuFHt5AHGrRS9Zw';
const transport = new StreamableHTTPClientTransport(URL, { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } });
const client = new Client({ name: 'probe', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);
const tools = await client.listTools();
for (const t of tools.tools) {
  if (t.name.includes('trade') || t.name.includes('order')) {
    console.log('\n=== TOOL:', t.name, '===');
    console.log('inputSchema:', JSON.stringify(t.inputSchema, null, 2));
    console.log('outputSchema:', t.outputSchema ? JSON.stringify(t.outputSchema, null, 2) : '(none)');
  }
}
await client.close();