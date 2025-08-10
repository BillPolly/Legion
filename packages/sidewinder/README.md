# Sidewinder - Node.js Runtime Instrumentation

Sidewinder injects deep monitoring and debugging capabilities into Node.js applications at runtime without requiring any code changes. It works by sideloading instrumentation code using Node's `--require` or `--loader` flags.

## Features

- 🔍 **Deep Visibility** - See inside running Node.js applications
- 🚀 **Zero Code Changes** - Works with any Node.js application
- 📡 **Real-time Data** - WebSocket backchannel for live metrics
- 🎯 **Selective Hooks** - Choose what to monitor with profiles
- 🔧 **Runtime Control** - Change monitoring without restarts
- 📊 **Performance Aware** - Minimal overhead with circuit breakers
- 🔐 **Secure** - Sandboxed execution with authentication

## How It Works

Sidewinder uses Node.js's `--require` flag to inject instrumentation before your application starts:

```bash
# Inject Sidewinder into your app
node --require @legion/sidewinder/inject your-app.js

# Or for ES modules
node --loader @legion/sidewinder/loader your-app.mjs
```

The instrumentation:
1. Establishes a WebSocket connection to the monitoring server
2. Installs configurable hooks (HTTP, console, errors, etc.)
3. Streams telemetry data in real-time
4. Accepts control commands from the monitor

## Installation

```bash
npm install @legion/sidewinder
```

## Usage

### Basic Injection

```javascript
// Start your app with Sidewinder
import { Sidewinder } from '@legion/sidewinder';

const sidewinder = new Sidewinder({
  wsPort: 9999,
  sessionId: 'debug-session-1',
  profile: 'standard'
});

// Generate injection script
const injectPath = await sidewinder.prepare();

// Start process with instrumentation
const child = spawn('node', ['--require', injectPath, 'app.js']);
```

### Configuration via Environment

Sidewinder reads configuration from environment variables:

```bash
export SIDEWINDER_WS_PORT=9999
export SIDEWINDER_SESSION_ID=my-session
export SIDEWINDER_PROFILE=full
export SIDEWINDER_HOOKS=http,console,errors

node --require @legion/sidewinder/inject app.js
```

### Monitoring Profiles

#### Minimal
- Console output capture
- Uncaught errors and rejections
- Basic process metrics

#### Standard (default)
- Everything in Minimal
- HTTP request/response tracking  
- Async context propagation
- Module loading events

#### Full
- Everything in Standard
- Memory snapshots
- CPU profiling
- Event loop monitoring
- Database query tracking

### Custom Hooks

```javascript
// Configure specific hooks
const sidewinder = new Sidewinder({
  hooks: {
    console: { enabled: true, includeStack: false },
    http: { enabled: true, captureBody: true },
    errors: { enabled: true, includeSource: true },
    memory: { enabled: true, interval: 5000 },
    custom: {
      enabled: true,
      path: './my-custom-hook.js'
    }
  }
});
```

## Available Hooks

### Console Hook
Captures all console method calls (log, error, warn, info, debug)

### HTTP Hook  
Intercepts HTTP/HTTPS requests and responses with timing and headers

### Error Hook
Global handlers for uncaught exceptions and unhandled rejections

### Async Hook
Uses AsyncLocalStorage to track request context through async operations

### Memory Hook
Periodic memory usage snapshots and leak detection

### Module Hook
Tracks require() and import() calls to understand dependencies

### Event Loop Hook
Monitors event loop lag and blocking operations

### Database Hook
Intercepts database queries (supports popular ORMs/drivers)

## WebSocket Protocol

Sidewinder communicates over WebSocket with a simple protocol:

### Client → Server Messages

```javascript
{
  type: 'log',
  timestamp: Date.now(),
  data: {
    level: 'info',
    message: 'Server started',
    meta: { port: 3000 }
  }
}
```

### Server → Client Commands

```javascript
{
  type: 'command',
  action: 'updateHooks',
  config: {
    http: { enabled: false }
  }
}
```

## Performance Considerations

- **Sampling**: High-frequency events are sampled
- **Batching**: Data is batched before sending
- **Circuit Breaker**: Disables instrumentation under high load
- **Compression**: Large payloads are compressed
- **Selective Hooks**: Only enable what you need

## Security

- WebSocket authentication via tokens
- Sandboxed hook execution
- No eval() or code generation
- Read-only access by default
- Configurable permissions

## Integration with FullStack Monitor

Sidewinder is designed to work seamlessly with `@legion/fullstack-monitor`:

```javascript
import { FullStackMonitor } from '@legion/fullstack-monitor';

const monitor = new FullStackMonitor({
  instrumentation: {
    enabled: true,
    profile: 'standard'
  }
});

// Start monitoring with deep instrumentation
await monitor.monitorFullStackApp({
  backend: {
    script: 'server.js',
    instrument: true  // ← Enables Sidewinder
  },
  frontend: {
    url: 'http://localhost:3000'
  }
});
```

## Examples

See `/examples` directory for:
- Express app instrumentation
- Debugging async issues
- Memory leak detection
- Performance profiling
- Custom hook creation

## License

MIT