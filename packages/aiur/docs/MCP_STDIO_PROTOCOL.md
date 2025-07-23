# MCP stdio Tool Protocol: Expected Responses and Examples

When implementing an MCP (Model Context Protocol) tool server over stdio (used in Claude Code and compatible systems), communication happens using **JSON-RPC 2.0** messages via stdin and stdout.

## ⚠️ Important Rules for stdio Tools

* **Only JSON-RPC messages** should be printed to `stdout`.
* **Do not use `console.log` or other stdout logging**—it corrupts the protocol.
* **Use `stderr` for logs and debug output**.

---

## ✅ Example Message Exchange

### 1. Tool Listing Request

**Client (Claude or orchestrator) sends:**

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

**Your server must respond with:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "name": "hello",
      "description": "Return greeting",
      "schema": {
        "type": "object",
        "properties": {
          "name": { "type": "string" }
        },
        "required": ["name"]
      }
    }
  ]
}
```

### 2. Tool Execution Request

**Client sends:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello",
    "arguments": { "name": "Alice" }
  }
}
```

**Your server must respond with:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "message": "Hello, Alice!"
  }
}
```

---

## 🛠 Minimal Node.js Example

```js
#!/usr/bin/env node
const { stdin, stdout, stderr } = require('process');

let buffer = '';
stdin.on('data', chunk => {
  buffer += chunk.toString();
  try {
    const msg = JSON.parse(buffer);
    buffer = ''; // clear buffer after successful parse

    if (msg.method === 'tools/list') {
      stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: [
          {
            name: 'hello',
            description: 'Greet user',
            schema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name']
            }
          }
        ]
      }));
    }
    else if (msg.method === 'tools/call' && msg.params.name === 'hello') {
      const name = msg.params.arguments.name;
      stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { message: `Hello, ${name}!` }
      }));
    }
  } catch (e) {
    // Ignore parse errors for incomplete chunks
  }
});

stderr.write('MCP server started\n');
```

---

## ✅ Tips for Correct Behavior

| Task                       | Rule                                              |
| -------------------------- | ------------------------------------------------- |
| Standard output (stdout)   | Must contain only valid JSON-RPC messages         |
| Logging/debug              | Use `stderr.write()`                              |
| Schema definition          | Include JSON Schema for each tool in `tools/list` |
| Matching call/response IDs | Use the exact same `id` value in your response    |
| Protocol compliance        | Follow JSON-RPC 2.0 format strictly               |

---

## 🔗 References

* [Anthropic Claude Code SDK](https://docs.anthropic.com/en/docs/claude-code/sdk)
* [ModelContextProtocol.org](https://modelcontextprotocol.org/)
* [apidog.com Guide to MCP Servers](https://apidog.com/blog/how-to-quickly-build-a-mcp-server-for-claude-code/)

Use this template to debug and validate your tool's communication under stdio. Avoid printing anything except protocol responses to `stdout`!

---

## Aiur Implementation Notes

### Current Architecture Compliance

The Aiur MCP server follows these stdio protocol rules through several key architectural decisions:

#### 1. LogManager Interception
- **File-based logging**: All debug output goes to log files via `LogManager` instead of console
- **Console interception**: The `LogManager` intercepts `console.log()`, `console.error()`, etc. and redirects them to files
- **No stdout pollution**: Tool execution never writes directly to stdout

#### 2. MCP SDK Usage
- **@modelcontextprotocol/sdk**: Uses the official TypeScript SDK which handles JSON-RPC 2.0 protocol correctly
- **StdioServerTransport**: Properly manages stdin/stdout for MCP communication
- **Structured responses**: All tool results follow the required `CallToolResult` format

#### 3. Tool Response Format
All tools return responses in this format:
```javascript
{
  content: [{
    type: "text",
    text: "JSON string containing tool result"
  }],
  isError: boolean
}
```

#### 4. Error Handling
- **Validation**: Responses are validated before sending to catch format issues
- **Auto-fixing**: Double-encoded JSON is automatically detected and corrected
- **Graceful degradation**: Malformed responses are converted to proper error responses

#### 5. Centralized Formatting
- **Single conversion point**: `ToolDefinitionProvider._formatToolResponse()` handles all Legion → MCP format conversion
- **Consistent JSON**: All responses use compact JSON (`JSON.stringify(result)`) to avoid escaping issues
- **Type safety**: Response validation ensures proper MCP format before transmission

### Recent Fixes Applied

1. **Eliminated console logging** - Replaced all `console.log()`, `console.error()` calls with `logManager` equivalents
2. **Fixed double-encoding** - Ensured JSON is stringified only once in the formatting pipeline  
3. **Stdio protection** - No debug output can interfere with MCP protocol messages
4. **Validation enhancement** - Added detection and auto-correction of malformed responses

These changes ensure the Aiur server maintains strict stdio protocol compliance while providing comprehensive logging and debugging capabilities through file-based outputs.