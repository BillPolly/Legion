# Critical Testing Lessons - Actor Framework with JSDOM

## THE MISTAKE (That Cost Hours of Debugging)

### What I Did Wrong
```javascript
// ❌ DIRECT ACTOR WIRING - BYPASSES WEBSOCKET!
const browserActor = new BrowserCLIClientActor();
cli.sessionActor.remoteActor = browserActor;
browserActor.setRemoteActor(cli.sessionActor);

// Execute command
const result = await cli.sessionActor.receive('execute-command', { command: '/show ...' });
// ✅ Test passes! Graph renders in JSDOM!
```

**Tests passed with 250/250 ✅**

**But real browser FAILS! Why?**

## Why Direct Wiring is Wrong

### What It Tests:
- ✅ CLISessionActor logic
- ✅ DisplayEngine data extraction
- ✅ BrowserCLIClientActor rendering
- ✅ JSDOM updates

### What It DOESN'T Test (THE CRITICAL PARTS):
- ❌ WebSocket connection
- ❌ Message serialization (JSON.stringify)
- ❌ Message deserialization (JSON.parse)
- ❌ ConfigurableActorServer routing
- ❌ WebSocket message handlers
- ❌ Error handling in WebSocket layer

## The Real Flow (What Actually Happens in Browser)

```
Browser                    WebSocket                    Server
--------                   ---------                    ------
User types command
  ↓
BrowserCLIClientActor
  ↓
Send via WebSocket   →   Serialize to JSON    →   ConfigurableActorServer
                                                     ↓
                                                   Parse JSON
                                                     ↓
                                                   Route to CLISessionActor
                                                     ↓
                                                   Execute command
                                                     ↓
                                                   Generate response
                                                     ↓
Send response       ←   Serialize to JSON    ←   remoteActor.receive()
  ↓
Parse JSON
  ↓
BrowserCLIClientActor.receive()
  ↓
Update DOM
```

**EVERY ONE of these steps can break!**

## The Correct Testing Pattern

### Use MockWebSocket
```javascript
// Create mock WebSocket pair
const { serverWs, clientWs } = MockWebSocket.createPair();

// Server setup - ConfigurableActorServer handles serverWs
const server = new CLIServer({ port: 5000 });
// Server creates ActorManager which creates CLISessionActor
// ActorManager wraps WebSocket with actor protocol

// Client setup - BrowserCLIClientActor uses clientWs
const browserActor = new BrowserCLIClientActor();
// Wire clientWs to browserActor's WebSocket handler

// Now messages flow through REAL actor protocol:
// 1. Client sends message via clientWs.send()
// 2. MockWebSocket delivers to serverWs
// 3. Server deserializes and routes
// 4. CLISessionActor processes
// 5. Response serialized back through serverWs
// 6. MockWebSocket delivers to clientWs
// 7. Client deserializes and updates DOM
```

### What This Tests
- ✅ WebSocket message flow
- ✅ JSON serialization/deserialization
- ✅ ConfigurableActorServer routing
- ✅ ActorManager message wrapping
- ✅ Error handling in WebSocket layer
- ✅ CLISessionActor logic
- ✅ BrowserCLIClientActor rendering
- ✅ JSDOM updates

## Common Failures When Using Real Browser

### Issue 1: Message Not Received
**Symptom**: Browser shows "waiting..." but nothing happens

**Cause**: WebSocket message handler not wired correctly

**MockWebSocket would catch**: Handler registration issues

### Issue 2: JSON Parse Error
**Symptom**: Console shows "SyntaxError: Unexpected token"

**Cause**: Message not properly serialized

**MockWebSocket would catch**: Serialization errors

### Issue 3: Wrong Message Type
**Symptom**: Browser receives message but doesn't handle it

**Cause**: Message type mismatch (e.g., 'displayAsset' vs 'display-asset')

**MockWebSocket would catch**: Type mismatch in protocol

### Issue 4: Data Structure Mismatch
**Symptom**: TypeError: Cannot read property 'X' of undefined

**Cause**: Server sends different structure than client expects

**MockWebSocket would catch**: Data structure validation

## Lesson Learned

**Direct actor wiring creates FALSE CONFIDENCE**

Tests pass ✅ → Think everything works → Deploy → Browser fails ❌

**MockWebSocket creates REAL CONFIDENCE**

Tests pass ✅ → Know WebSocket layer works → Deploy → Browser works ✅

## Action Items

1. ❌ Delete all tests with direct actor wiring
2. ✅ Rewrite using MockWebSocket pattern
3. ✅ Test with real browser using chrome-devtools-mcp
4. ✅ Verify graph actually renders

## See Also
- `/packages/cli/__tests__/helpers/MockWebSocket.js` - Mock WebSocket implementation
- `/CLAUDE.md` - Updated with testing pattern
