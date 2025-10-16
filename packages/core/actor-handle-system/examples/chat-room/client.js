/**
 * Chat Room Demo - Client
 *
 * Simple CLI client that connects to the chat room server.
 * Demonstrates how easy it is to use actors from the frontend.
 */

import { ActorSpace } from '@legion/actors';
import * as readline from 'readline';

const username = process.argv[2] || 'Anonymous';
const SERVER_URL = 'ws://localhost:8080';

let chatRoomActor = null;
let actorSpace = null;

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${username}> `
});

// Client actor to handle incoming messages
const clientActor = {
  async receive(messageType, data) {
    if (messageType === 'welcome') {
      console.log(`\n✅ ${data.message}\n`);
      // Join the chat room
      await joinChatRoom();
    } else if (messageType === 'new-message') {
      // Display new message from server
      displayMessage(data);
    }
  }
};

async function joinChatRoom() {
  try {
    const result = await chatRoomActor.receive('join', { username });
    console.log(`👥 Users in room: ${result.users.join(', ')}`);

    // Display message history
    if (result.messages.length > 0) {
      console.log('\n📜 Recent messages:');
      result.messages.slice(-10).forEach(displayMessage);
    }

    console.log('\n💬 Type your message and press Enter (or /quit to exit)\n');
    rl.prompt();
  } catch (error) {
    console.error('Error joining chat room:', error.message);
  }
}

function displayMessage(msg) {
  if (msg.type === 'system') {
    console.log(`\x1b[90m[SYSTEM] ${msg.text}\x1b[0m`);
  } else if (msg.type === 'chat') {
    const isMe = msg.username === username;
    const color = isMe ? '\x1b[36m' : '\x1b[33m';
    console.log(`${color}${msg.username}:\x1b[0m ${msg.text}`);
  }
}

async function sendMessage(text) {
  try {
    await chatRoomActor.receive('send-message', { username, text });

    // Get updated messages to display
    const messages = await chatRoomActor.receive('get-messages');
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      displayMessage(lastMsg);
    }
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}

async function leaveChatRoom() {
  try {
    await chatRoomActor.receive('leave', { username });
    console.log('\n👋 Left chat room. Goodbye!\n');
  } catch (error) {
    console.error('Error leaving chat room:', error.message);
  }
}

// Handle user input
rl.on('line', async (line) => {
  const text = line.trim();

  if (text === '/quit' || text === '/exit') {
    await leaveChatRoom();
    rl.close();
    process.exit(0);
  } else if (text === '/users') {
    const users = await chatRoomActor.receive('get-users');
    console.log(`\n👥 Users: ${users.join(', ')}\n`);
    rl.prompt();
  } else if (text.length > 0) {
    await sendMessage(text);
    rl.prompt();
  } else {
    rl.prompt();
  }
});

// Handle clean exit
rl.on('close', async () => {
  if (chatRoomActor) {
    await leaveChatRoom();
  }
  process.exit(0);
});

async function main() {
  console.log(`\n🔌 Connecting to chat server as "${username}"...\n`);

  try {
    // Create ActorSpace for frontend
    actorSpace = new ActorSpace('chat-client');

    // Connect to server
    await actorSpace.connect(clientActor, SERVER_URL);

    // Get remote chat room actor
    chatRoomActor = actorSpace.guidToObject.get('chat-room') ||
                    await new Promise((resolve) => {
                      setTimeout(() => {
                        // Make remote to chat-room
                        const channel = Array.from(actorSpace.channels.values())[0];
                        resolve(channel.makeRemote('chat-room'));
                      }, 100);
                    });

  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    console.error('   Make sure the server is running: node server.js');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
