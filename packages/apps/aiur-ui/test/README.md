# Voice Integration Tests

This directory contains integration tests for the voice functionality in the Aiur UI clean application.

## Overview

The voice integration tests demonstrate how the actor system allows us to run real frontend and backend components together in a test environment. Instead of mocking the voice module, we use:

- **Real voice module** - The actual Legion voice module with OpenAI integration
- **Real actors** - Both frontend (ChatActor) and backend (ChatAgent) actors
- **MockWebSocket** - An in-process WebSocket that connects frontend and backend directly
- **JSDOM** - Provides browser APIs for the frontend components

## Architecture

```
┌─────────────────┐     MockWebSocket      ┌─────────────────┐
│   Frontend      │◄──────────────────────►│   Backend       │
│   ActorSpace    │   (in-process pair)    │   ActorSpace    │
│                 │                         │                 │
│  - ChatActor    │                         │  - ChatAgent    │
│  - ChatView     │                         │  - Voice Module │
│  - ViewModel    │                         │  - Real Tools   │
└─────────────────┘                         └─────────────────┘
```

## Running the Tests

### Prerequisites

1. Install dependencies:
```bash
cd packages/apps/aiur-ui-clean
npm install
```

2. Ensure you have OPENAI_API_KEY in your .env file (for the real voice module)

### Run All Tests
```bash
npm test
```

### Run Voice Integration Tests Only
```bash
npm run test:voice
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run with Coverage
```bash
npm run test:coverage
```

## Test Scenarios

### 1. Voice Recording and Transcription
- Simulates user clicking microphone button
- Records audio using MockMediaRecorder
- Sends audio data through actors to backend
- Real voice module processes transcription
- Verifies transcribed text appears in chat

### 2. Text-to-Speech Generation
- User clicks speaker button on a message
- Request flows through actors to backend
- Real voice module generates speech
- Audio data returned to frontend
- Playback initiated in VoiceController

### 3. Auto-Play Mode
- Tests automatic speech generation for responses
- Verifies voice preferences synchronization
- Ensures correct behavior when toggling modes

### 4. Error Handling
- Microphone permission denied
- Transcription failures
- Network disconnection scenarios

## Key Components

### MockWebSocket
Located in `test/mocks/MockWebSocket.js`, this class:
- Creates paired sockets for bidirectional communication
- Allows frontend and backend to communicate in-process
- Tracks all messages for test assertions
- Provides utilities like `waitForMessage()`

### Integration Test
The main test file `voice-integration.test.js`:
- Sets up complete JSDOM environment
- Initializes real frontend and backend actor spaces
- Uses real voice module with mocked API responses
- Tests complete message flow through the system

## Benefits

1. **Real Integration** - Tests actual component interactions, not mocks
2. **Fast Execution** - No network delays, runs in-process
3. **Debugging** - Can set breakpoints in both frontend and backend code
4. **Confidence** - Tests the exact same code that runs in production

## Extending the Tests

To add new test scenarios:

1. Add test cases to `voice-integration.test.js`
2. Use `MockWebSocket.waitForMessage()` to wait for specific messages
3. Mock specific tool executions when needed (e.g., API calls)
4. Verify both frontend state and backend processing

Example:
```javascript
test('My new voice feature', async () => {
  // Setup
  const tool = moduleLoader.getTool('my_tool');
  tool.execute = jest.fn().mockResolvedValue({ success: true });
  
  // Action
  await chatViewModel.myNewFeature();
  
  // Verify frontend
  expect(chatView.someState).toBe(expected);
  
  // Verify backend called
  expect(tool.execute).toHaveBeenCalledWith(expectedParams);
  
  // Verify messages sent
  const messages = clientSocket.getSentMessages();
  expect(messages).toContainEqual(expect.objectContaining({
    type: 'expected_message_type'
  }));
});
```