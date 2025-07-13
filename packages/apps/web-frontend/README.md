# jsEnvoy Web Chat Application

A modern, real-time chat interface for jsEnvoy AI agents built with vanilla JavaScript and Express.js.

## 🚀 Quick Start

```bash
# From the monorepo root
npm run chat

# Visit http://localhost:3000 to start chatting!
```

## 📦 Package Structure

```
packages/apps/
├── web-frontend/          # Vanilla JS/HTML/CSS chat interface
│   ├── index.html         # Main HTML file with ES6 module imports
│   ├── src/
│   │   ├── chat.js        # Main chat application logic
│   │   ├── websocket.js   # WebSocket connection manager
│   │   └── ui.js          # DOM manipulation utilities
│   └── styles/
│       └── main.css       # Modern CSS with animations
│
└── web-backend/           # Express + WebSocket server
    ├── src/
    │   ├── server.js              # Main Express server
    │   ├── websocket-handler.js   # WebSocket connection management
    │   └── agent-connection.js    # Simple agent interaction per connection
    └── package.json
```

## ✨ Features

### Frontend (Vanilla JavaScript)
- **No build steps** - Uses native ES6 modules
- **Modern CSS** with gradients, glass morphism effects, and smooth animations
- **Real-time messaging** via WebSocket
- **Responsive design** that works on desktop and mobile
- **Connection status** indicator with auto-reconnection
- **Typing indicators** while agent processes messages
- **Message history** with timestamps
- **Error handling** with user-friendly messages

### Backend (Express.js + WebSocket)
- **Multi-agent architecture** - Each WebSocket connection gets its own agent instance
- **Static file serving** - Serves the frontend from the same server
- **Health monitoring** - `/health` and `/api/stats` endpoints
- **Graceful shutdown** - Properly handles SIGINT/SIGTERM
- **Error handling** - Comprehensive error management
- **Connection lifecycle** - Automatic cleanup when connections close

## 🎨 Design Highlights

- **Animated gradient background** with floating orbs
- **Glass morphism** message bubbles with backdrop blur
- **Smooth animations** for message appearance and interactions
- **Modern typography** with proper spacing and contrast
- **Dark theme** optimized for comfortable viewing
- **Mobile-responsive** layout with touch-friendly controls

## 🔧 Technical Details

### WebSocket Protocol
```javascript
// Client -> Server
{
  id: "unique-message-id",
  type: "message", 
  content: "user message",
  timestamp: "2025-01-01T00:00:00.000Z"
}

// Server -> Client
{
  id: "unique-message-id",
  success: true,
  response: "agent response", 
  timestamp: "2025-01-01T00:00:00.000Z"
}
```

### Agent Behavior
Each WebSocket connection creates a simple agent that can:
- Handle greetings and casual conversation
- Perform basic math calculations
- Answer questions about time/date
- Tell jokes and provide weather responses
- Maintain conversation context
- Generate contextual responses based on message history

### File Structure Principles
- **No build tools** - Direct ES6 module loading in browsers
- **Separation of concerns** - UI, WebSocket, and chat logic in separate modules
- **Modern CSS** - Using custom properties, grid, flexbox, and animations
- **Express best practices** - Middleware, error handling, graceful shutdown

## 🚀 Development

### Start the Server
```bash
# From monorepo root
npm run chat

# Or directly from backend package
cd packages/apps/web-backend
npm start
```

### Available Endpoints
- **Chat Interface**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Connection Stats**: http://localhost:3000/api/stats
- **WebSocket**: ws://localhost:3000/ws

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## 🛡️ Error Handling

The application includes comprehensive error handling:
- **Connection failures** with automatic reconnection
- **Message timeouts** with user feedback
- **Server errors** with graceful fallbacks
- **Invalid messages** with helpful error responses
- **Network issues** with connection status updates

## 🎯 Architecture Decisions

1. **No Build Steps** - Uses native browser capabilities for ES6 modules
2. **Single Server** - Frontend served from same Express instance as WebSocket
3. **Per-Connection Agents** - Each WebSocket gets its own agent instance for isolation
4. **Vanilla JavaScript** - No frameworks to keep it simple and fast
5. **Modern CSS** - Leverages latest CSS features for beautiful UI without preprocessors

This creates a production-ready chat application that showcases modern web development practices while maintaining simplicity and performance.