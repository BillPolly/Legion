# Installing MCP FullStack Monitor in Claude Code

## Prerequisites

- Node.js 18+ installed
- Claude Desktop application
- Access to Claude Code (claude.ai/code)

## Installation Steps

### 1. Locate Claude's Configuration Directory

**macOS/Linux:**
```bash
~/.config/claude/
```

**Windows:**
```
%APPDATA%\Claude\
```

### 2. Edit Claude Desktop Configuration

Open or create `claude_desktop_config.json` in the configuration directory:

```bash
# macOS/Linux
nano ~/.config/claude/claude_desktop_config.json

# or with VS Code
code ~/.config/claude/claude_desktop_config.json
```

### 3. Add the MCP Server Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fullstack-monitor": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-server.js"
      ],
      "env": {
        "NODE_OPTIONS": "--experimental-vm-modules"
      }
    }
  }
}
```

**Important:** Replace `/absolute/path/to/mcp-server.js` with the actual path to your MCP server.

For this installation, use:
```json
{
  "mcpServers": {
    "fullstack-monitor": {
      "command": "node",
      "args": [
        "/Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor/mcp-server.js"
      ],
      "env": {
        "NODE_OPTIONS": "--experimental-vm-modules"
      }
    }
  }
}
```

### 4. If You Have Other MCP Servers

If you already have other MCP servers configured, add fullstack-monitor to the existing list:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/Users/username/projects"]
    },
    "fullstack-monitor": {
      "command": "node",
      "args": [
        "/Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor/mcp-server.js"
      ],
      "env": {
        "NODE_OPTIONS": "--experimental-vm-modules"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

After saving the configuration:

1. **Quit Claude Desktop completely** (not just close the window)
   - macOS: Claude → Quit Claude
   - Windows: Right-click system tray icon → Exit

2. **Start Claude Desktop again**

3. **Verify the MCP server is loaded:**
   - Open Claude Code (claude.ai/code)
   - The MCP server icon should appear in the interface
   - You should be able to use the tools

## Testing the Installation

Once installed, you can test the MCP server in Claude Code by asking:

```
"Can you list the available MCP tools?"
```

Claude should respond with the 12 fullstack monitoring tools:
- start_fullstack_monitoring
- stop_monitoring
- get_monitoring_stats
- list_sessions
- execute_debug_scenario
- debug_user_flow
- take_screenshot
- search_logs
- get_correlations
- analyze_error
- get_recent_errors
- trace_request

## Usage Examples

### Start Monitoring a Full-Stack App
```
"Start monitoring my backend at ./server.js on port 3000 and frontend at http://localhost:3001"
```

### Debug a User Flow
```
"Debug the login flow: click the login button, fill in credentials, and submit"
```

### Analyze Errors
```
"Search for any errors in the last 10 minutes and analyze them"
```

### Execute Debug Scenario
```
"Execute a debug scenario: take a screenshot, click the submit button, wait for results, then take another screenshot"
```

## Troubleshooting

### MCP Server Not Appearing

1. **Check the configuration path is correct:**
   ```bash
   ls -la ~/.config/claude/claude_desktop_config.json
   ```

2. **Verify the MCP server path exists:**
   ```bash
   ls -la /Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor/mcp-server.js
   ```

3. **Test the server manually:**
   ```bash
   node /Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor/mcp-server.js
   ```
   You should see: `Starting FullStack Monitor MCP Server...`

4. **Check Claude's logs** (if available in developer console)

### Permission Issues

Make sure the MCP server is executable:
```bash
chmod +x /Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor/mcp-server.js
```

### Node.js Version

Ensure you have Node.js 18 or higher:
```bash
node --version
```

## Alternative: NPM Global Installation

If you want to install it globally for easier access:

```bash
# From the MCP server directory
cd /Users/maxximus/Documents/max/pocs/LegionCopy/packages/mcps/fullstack-monitor

# Link it globally
npm link

# Then in Claude config, you can use:
{
  "mcpServers": {
    "fullstack-monitor": {
      "command": "mcp-fullstack-monitor",
      "env": {
        "NODE_OPTIONS": "--experimental-vm-modules"
      }
    }
  }
}
```

## Security Considerations

The fullstack-monitor MCP server can:
- Start and monitor processes
- Control browser automation
- Read application logs
- Take screenshots

Only install if you trust the source and understand these capabilities.

## Support

For issues or questions:
1. Check the test suite: `npm test`
2. Run the demo: `npm run demo`
3. Review the README.md for detailed documentation

## Next Steps

Once installed, the fullstack-monitor tools will be available in every Claude Code session. You can use them to:

1. **Monitor Development Servers**: Track backend and frontend during development
2. **Debug User Flows**: Automate and analyze user interactions
3. **Analyze Errors**: Get intelligent error analysis with recommendations
4. **Trace Requests**: Follow requests through your entire stack
5. **Correlate Logs**: Track related events across frontend and backend

The MCP server provides Claude with powerful debugging capabilities that make it an expert full-stack debugging assistant!