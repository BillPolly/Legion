/**
 * Chat Room Demo - Server
 *
 * Demonstrates the ease of setting up a backend actor with ActorSpace.
 * This shows the CORE VALUE: easy frontend-backend communication with actors.
 */

import { ActorSpace } from '@legion/actors';
import { ResourceManager } from '@legion/resource-manager';

// Chat room actor protocol - declarative definition
const chatRoomProtocol = {
  name: 'ChatRoom',
  state: {
    schema: {
      messages: { type: 'array', default: [] },
      users: { type: 'array', default: [] }
    }
  },
  messages: {
    receives: {
      'join': {
        action: `
          if (!state.users.includes(data.username)) {
            state.users.push(data.username);
            state.messages.push({ type: 'system', text: data.username + ' joined', timestamp: Date.now() });
          }
        `,
        returns: '{ users: state.users, messages: state.messages }'
      },
      'leave': {
        action: `
          const index = state.users.indexOf(data.username);
          if (index > -1) {
            state.users.splice(index, 1);
            state.messages.push({ type: 'system', text: data.username + ' left', timestamp: Date.now() });
          }
        `,
        returns: 'true'
      },
      'send-message': {
        action: `
          state.messages.push({
            type: 'chat',
            username: data.username,
            text: data.text,
            timestamp: Date.now()
          });
        `,
        returns: 'state.messages[state.messages.length - 1]'
      },
      'get-messages': {
        returns: 'state.messages'
      },
      'get-users': {
        returns: 'state.users'
      }
    }
  }
};

async function main() {
  console.log('🚀 Starting Chat Room Server...\n');

  // Get ResourceManager singleton
  const rm = await ResourceManager.getInstance();
  console.log('✅ ResourceManager initialized');

  // Register chat room actor
  rm.actors.register('chat-room', { protocol: chatRoomProtocol });
  console.log('✅ Chat room actor registered');

  // Spawn the chat room instance
  const chatRoom = rm.actors.spawn('chat-room');
  console.log('✅ Chat room instance spawned');

  // Create ActorSpace for backend
  const actorSpace = new ActorSpace('chat-server');
  actorSpace.register(chatRoom, 'chat-room');
  console.log('✅ Chat room registered in ActorSpace');

  // Create a simple space actor to handle connections
  const spaceActor = {
    async receive(messageType, data) {
      if (messageType === 'channel_connected') {
        console.log('📡 New client connected');
        // Send welcome message to client
        data.channel.send('client-actor', { type: 'welcome', message: 'Connected to chat server!' });
      } else if (messageType === 'channel_closed') {
        console.log('📡 Client disconnected');
      }
    }
  };

  // Listen for WebSocket connections
  const PORT = 8080;
  await actorSpace.listen(PORT, () => spaceActor);

  console.log(`\n🎯 Chat server listening on ws://localhost:${PORT}`);
  console.log(`📝 Chat room ready for connections!`);
  console.log(`\n💡 Open another terminal and run:`);
  console.log(`   node client.js YourName\n`);
}

main().catch(console.error);
