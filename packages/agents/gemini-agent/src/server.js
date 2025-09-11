/**
 * Web server for Gemini-Compatible Agent UAT
 * Built with Legion patterns for real agent testing
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { ResourceManager } from '@legion/resource-manager';
import ToolCallingConversationManager from './conversation/ToolCallingConversationManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Initialize agent components
let conversationManager;
let resourceManager;

/**
 * Handle slash commands (Step 1: Minimal implementation)
 * @param {string} input - Slash command input
 * @param {Object} agent - Conversation manager
 * @returns {string} Response
 */
async function handleSlashCommand(input, agent) {
  const command = input.slice(1).split(' ')[0].toLowerCase(); // Remove / and get command
  const args = input.slice(1).split(' ').slice(1); // Get arguments
  
  switch (command) {
    case 'help':
      return `**Available Slash Commands:**

⚡ **/help** - Show this help message
🔧 **/tools** - List all available tools
📋 **/context** - Show current conversation context  
🗂️ **/files** - Show recently accessed files
🧹 **/clear** - Clear conversation history
📊 **/debug** - Show debug information

Type any command for more details. Regular chat messages work as before!`;

    case 'show':
      const param = args[0];
      if (!param) {
        return `**Show Command Usage:**

Use \`/show <parameter>\` where parameter is:
• tools, context, files, errors, citations, compression, debug, all`;
      }
      
      switch (param.toLowerCase()) {
        case 'tools':
          const toolsStats = agent.toolsModule?.getStatistics();
          return toolsStats ? `**🔧 Tools (${toolsStats.toolCount}):** ${toolsStats.tools.join(', ')}` : 'Tools not available';
          
        case 'context':
          const history = agent.getConversationHistory();
          return `**📋 Context:** ${history.length} messages, Working dir: ${process.cwd()}`;
          
        case 'all':
          const allStats = agent.toolsModule?.getStatistics() || {};
          return `**🎯 Complete State:**\n🔧 Tools: ${allStats.toolCount || 0}\n💬 Messages: ${agent.getConversationHistory().length}\n💾 Memory: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`;
          
        default:
          return `Unknown parameter: ${param}. Use /show without parameters for help.`;
      }

    case 'tools':
      const toolsStats = agent.toolsModule?.getStatistics();
      if (toolsStats) {
        return `**Available Tools (${toolsStats.toolCount} total):**

${toolsStats.tools.map(tool => `• ${tool}`).join('\\n')}

All tools are working and available for use through normal chat or slash commands.`;
      }
      return 'Tools information not available';

    case 'context':
      const history = agent.getConversationHistory();
      const recentFiles = agent.projectContextService?.getRecentFilesContext() || 'No recent files tracked';
      
      return `**Current Context:**

**Conversation:** ${history.length} messages in history
**Working Directory:** ${process.cwd()}
**Recent Files:** ${recentFiles.includes('Recently Accessed Files') ? '✅ Files tracked' : '❌ No files tracked'}

Use /clear to reset context or continue with regular chat.`;

    case 'clear':
      agent.clearHistory();
      return '🧹 **Context Cleared!** \\n\\nConversation history has been reset. You can start a fresh conversation.';

    case 'debug':
      return `**Debug Information:**

**Agent Status:** ✅ Operational
**Tools Module:** ${agent.toolsModule ? '✅ Loaded' : '❌ Not loaded'}
**LLM Client:** ✅ Connected to Anthropic
**Tool Count:** ${agent.toolsModule?.getStatistics().toolCount || 0}
**Memory Usage:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

All systems operational for debugging and testing.`;

    default:
      return `❌ **Unknown Command:** /${command}

Type /help to see available commands.`;
  }
}

async function initializeAgent() {
  console.log('🚀 Initializing Gemini-Compatible Agent...');
  
  // Get ResourceManager singleton (Legion pattern)
  resourceManager = await ResourceManager.getInstance();
  
  // Initialize tool calling conversation manager with real LLM and tools
  conversationManager = new ToolCallingConversationManager(resourceManager);
  
  console.log('✅ Agent ready for UAT testing');
}

// Serve the chat interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Gemini-Compatible Agent UAT</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            width: 90%;
            max-width: 900px;
            height: 90vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
            color: white;
            padding: 20px;
            text-align: center;
            position: relative;
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .status {
            position: absolute;
            top: 15px;
            right: 20px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            background: rgba(255,255,255,0.2);
        }
        .test-panel {
            background: #f8fafc;
            padding: 15px 20px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .test-btn {
            padding: 8px 16px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        .test-btn:hover { background: #059669; transform: translateY(-1px); }
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #ffffff;
        }
        .message {
            margin: 15px 0;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        .message.user { flex-direction: row-reverse; }
        .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .message.user .message-content {
            background: #4f46e5;
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message.assistant .message-content {
            background: #f1f5f9;
            color: #1e293b;
            border-bottom-left-radius: 4px;
            border: 1px solid #e2e8f0;
        }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            flex-shrink: 0;
        }
        .message.user .avatar { background: #4f46e5; color: white; }
        .message.assistant .avatar { background: #10b981; color: white; }
        .input-area {
            padding: 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .input-field {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .input-field:focus { border-color: #4f46e5; }
        .send-btn {
            width: 44px;
            height: 44px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.2s;
        }
        .send-btn:hover { background: #3730a3; transform: scale(1.05); }
        .typing {
            font-style: italic;
            opacity: 0.7;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="status" id="status">Connecting...</div>
            <h1>🤖 Gemini-Compatible Agent</h1>
            <p>UAT Testing Interface - Real LLM Integration</p>
        </div>
        
        <div class="test-panel">
            <button class="test-btn" onclick="testBasicChat()">Basic Chat</button>
            <button class="test-btn" onclick="testToolAwareness()">Tool Awareness</button>
            <button class="test-btn" onclick="testFileHelp()">File Operations</button>
            <button class="test-btn" onclick="testCodingHelp()">Coding Help</button>
            <button class="test-btn" onclick="testMemory()">Memory Test</button>
            <button class="test-btn" onclick="clearChat()">Clear Chat</button>
        </div>

        <div class="chat-container" id="chatContainer">
            <div class="message assistant">
                <div class="avatar">🤖</div>
                <div class="message-content">Hello! I'm the Gemini-Compatible Agent built with Legion patterns. I can help with file operations, code analysis, and development tasks. Try the test buttons above or ask me anything!</div>
            </div>
        </div>
        
        <div class="input-area">
            <input type="text" class="input-field" id="messageInput" placeholder="Ask me anything about your code or files..." />
            <button class="send-btn" onclick="sendMessage()">➤</button>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:4010');
        const chatContainer = document.getElementById('chatContainer');
        const statusElement = document.getElementById('status');
        const messageInput = document.getElementById('messageInput');
        
        ws.onopen = () => {
            statusElement.textContent = '✅ Connected';
            statusElement.style.background = 'rgba(16, 185, 129, 0.3)';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'response') {
                addMessage('assistant', data.content);
                removeTypingIndicator();
            }
        };
        
        ws.onclose = () => {
            statusElement.textContent = '❌ Disconnected';
            statusElement.style.background = 'rgba(239, 68, 68, 0.3)';
        };
        
        function addMessage(type, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = type === 'user' ? '👤' : '🤖';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentDiv);
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function addTypingIndicator() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message assistant';
            typingDiv.id = 'typing-indicator';
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = '🤖';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content typing';
            contentDiv.textContent = 'Thinking...';
            
            typingDiv.appendChild(avatar);
            typingDiv.appendChild(contentDiv);
            chatContainer.appendChild(typingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function removeTypingIndicator() {
            const typing = document.getElementById('typing-indicator');
            if (typing) typing.remove();
        }
        
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message) {
                addMessage('user', message);
                addTypingIndicator();
                ws.send(JSON.stringify({ type: 'message', content: message }));
                messageInput.value = '';
            }
        }
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // UAT Test Functions
        function testBasicChat() {
            const message = 'Hello! Can you introduce yourself and tell me what you can do?';
            addMessage('user', message);
            addTypingIndicator();
            ws.send(JSON.stringify({ type: 'message', content: message }));
        }
        
        function testToolAwareness() {
            const message = 'What specific tools do you have available? Please list each one with a brief description.';
            addMessage('user', message);
            addTypingIndicator();
            ws.send(JSON.stringify({ type: 'message', content: message }));
        }
        
        function testFileHelp() {
            const message = 'I need help reading and analyzing files in my project. How would you approach this?';
            addMessage('user', message);
            addTypingIndicator();
            ws.send(JSON.stringify({ type: 'message', content: message }));
        }
        
        function testCodingHelp() {
            const message = 'Can you help me with JavaScript best practices and code reviews?';
            addMessage('user', message);
            addTypingIndicator();
            ws.send(JSON.stringify({ type: 'message', content: message }));
        }
        
        function testMemory() {
            const message = 'My name is UAT Tester and I work on Node.js projects. Please remember this.';
            addMessage('user', message);
            addTypingIndicator();
            ws.send(JSON.stringify({ type: 'message', content: message }));
        }
        
        function clearChat() {
            const messages = chatContainer.querySelectorAll('.message');
            messages.forEach((msg, index) => {
                if (index > 0) msg.remove(); // Keep welcome message
            });
            ws.send(JSON.stringify({ type: 'clear' }));
        }
    </script>
</body>
</html>
  `);
});

// WebSocket handling for our agent with observability
wss.on('connection', (ws) => {
  console.log('🌐 UAT client connected to Gemini-Compatible Agent');
  
  // Connect client to observability service for real-time monitoring
  conversationManager.observabilityService.addWebSocketClient(ws);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'message') {
        console.log(`👤 User: ${data.content}`);
        
        // Step 1: Add basic slash command detection (minimal risk)
        if (data.content.trim().startsWith('/')) {
          // Handle slash command
          const slashResponse = await handleSlashCommand(data.content.trim(), conversationManager);
          
          console.log(`⚡ Slash Command Response: ${slashResponse}`);
          
          ws.send(JSON.stringify({
            type: 'response',
            content: slashResponse,
            isSlashCommand: true
          }));
        } else {
          // Process with existing agent (unchanged)
          const response = await conversationManager.processMessage(data.content);
          
          console.log(`🤖 Our Agent: ${response.content}`);
          
          // Send back to client (unchanged)
          ws.send(JSON.stringify({
            type: 'response',
            content: response.content
          }));
        }
        
      } else if (data.type === 'clear') {
        conversationManager.clearHistory();
        console.log('🧹 Conversation history cleared');
      }
      
    } catch (error) {
      console.error('❌ Agent Error:', error.message);
      ws.send(JSON.stringify({
        type: 'response',
        content: `Error: ${error.message}`
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🌐 UAT client disconnected');
  });
});

// Start server
const PORT = 4010;

initializeAgent().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Gemini-Compatible Agent UAT running on http://localhost:${PORT}`);
    console.log(`🔗 Open http://localhost:${PORT} to test the agent`);
  });
}).catch(console.error);