/**
 * Legion Chat Room Application
 * Demonstrates declarative-components with ActorSpace integration
 */

import { ComponentLifecycle } from '/legion/declarative-components/lifecycle/ComponentLifecycle.js';
import { ComponentCompiler } from '/legion/declarative-components/compiler/ComponentCompiler.js';
import { DataStore } from '/legion/data-store/src/store.js';

// Simple ActorSpace client
class SimpleActorSpace {
    constructor(spaceId) {
        this.spaceId = spaceId;
        this.ws = null;
        this.messageId = 0;
        this.pendingCalls = new Map();
    }

    async connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = () => {
                console.log('Connected to server');
                resolve();
            };
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.targetGuid && message.targetGuid.startsWith(this.spaceId)) {
                    const pending = this.pendingCalls.get(message.targetGuid);
                    if (pending) {
                        pending.resolve(message.payload);
                        this.pendingCalls.delete(message.targetGuid);
                    }
                }
            };
            this.ws.onclose = () => {
                console.log('Disconnected from server');
            };
        });
    }

    async call(targetGuid, messageType, data) {
        const sourceGuid = `${this.spaceId}-${this.messageId++}`;
        const message = {
            targetGuid: targetGuid,
            sourceGuid: sourceGuid,
            payload: [messageType, data]
        };
        this.ws.send(JSON.stringify(message));
        return new Promise((resolve, reject) => {
            this.pendingCalls.set(sourceGuid, { resolve, reject });
            setTimeout(() => {
                if (this.pendingCalls.has(sourceGuid)) {
                    this.pendingCalls.delete(sourceGuid);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
        });
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Chat Application
export class ChatApp {
    constructor(containerElement) {
        this.container = containerElement;
        this.dataStore = null;
        this.lifecycle = null;
        this.actorSpace = null;
        this.currentView = null;
        this.loginComponent = null;
        this.chatComponent = null;
        this.compiler = new ComponentCompiler();
    }

    async initialize() {
        try {
            // Create DataStore with schema
            this.dataStore = new DataStore({
                ':username': {},
                ':error': {},
                ':users': {},
                ':messages': {},
                ':currentMessage': {}
            });

            // Create ComponentLifecycle
            this.lifecycle = new ComponentLifecycle(this.dataStore);

            // Show login screen
            await this.showLogin();

            console.log('✅ Legion Chat initialized with declarative-components');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.container.innerHTML = `
                <div class="error">
                    <h2>Initialization Error</h2>
                    <p>${error.message}</p>
                </div>
            `;
            throw error;
        }
    }

    async showLogin() {
        this.container.innerHTML = '';

        // Define LoginForm component using DSL
        const loginDSL = `
            LoginForm :: login =>
                div.login-container [
                    h1 { "💬 Legion Chat" }
                    p { "Enter your name to join the chat room" }
                    input#username-input[type=text][placeholder="Your name..."]
                    button#login-button { "Join Chat" }
                    div.error#error { login.error }
                ]
        `;

        const loginComponentDef = this.compiler.compile(loginDSL);

        // Mount login component
        this.loginComponent = await this.lifecycle.mount(
            loginComponentDef,
            this.container,
            { error: '' }
        );

        this.currentView = 'login';

        // Setup event listeners
        const loginButton = this.container.querySelector('#login-button');
        const usernameInput = this.container.querySelector('#username-input');

        usernameInput.focus();

        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin();
            }
        });

        loginButton.addEventListener('click', () => this.handleLogin());
    }

    async handleLogin() {
        const usernameInput = this.container.querySelector('#username-input');
        const errorDiv = this.container.querySelector('#error');
        const username = usernameInput.value.trim();

        if (!username) {
            errorDiv.textContent = 'Please enter a name';
            return;
        }

        try {
            errorDiv.textContent = 'Connecting...';

            // Connect to server
            this.actorSpace = new SimpleActorSpace('browser-client');
            await this.actorSpace.connect('ws://localhost:8080');

            // Join chat room
            const result = await this.actorSpace.call('chat-room', 'join', { username });

            // Show chat screen
            await this.showChat(username, result.messages, result.users);

        } catch (err) {
            errorDiv.textContent = 'Connection failed: ' + err.message;
            console.error(err);
        }
    }

    async showChat(username, messages, users) {
        this.container.innerHTML = '';

        // Unmount login component if it exists
        if (this.loginComponent) {
            await this.loginComponent.unmount();
            this.loginComponent = null;
        }

        // Define ChatRoom component using DSL
        const chatDSL = `
            ChatRoom :: chat =>
                div.chat-container [
                    div.chat-header [
                        h1 { "💬 Legion Chat Room" }
                        div.status { "Connected as " + chat.username }
                    ]
                    div.users-bar [
                        span { "Users: " }
                        span#users-list { chat.users }
                    ]
                    div.messages-container#messages-container
                    div.input-container [
                        input#message-input[type=text][placeholder="Type a message..."]
                        button#send-button { "Send" }
                    ]
                ]
        `;

        const chatComponentDef = this.compiler.compile(chatDSL);

        // Mount chat component
        this.chatComponent = await this.lifecycle.mount(
            chatComponentDef,
            this.container,
            {
                username: username,
                users: users.join(', '),
                currentMessage: ''
            }
        );

        this.currentView = 'chat';
        this.currentUsername = username;

        // Render existing messages
        const messagesContainer = this.container.querySelector('#messages-container');
        messages.forEach(msg => {
            this.renderMessage(messagesContainer, msg);
        });

        // Setup event listeners
        const sendButton = this.container.querySelector('#send-button');
        const messageInput = this.container.querySelector('#message-input');

        messageInput.focus();

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSend();
            }
        });

        sendButton.addEventListener('click', () => this.handleSend());
    }

    async handleSend() {
        const messageInput = this.container.querySelector('#message-input');
        const messagesContainer = this.container.querySelector('#messages-container');
        const text = messageInput.value.trim();

        if (!text) return;

        try {
            // Send message
            await this.actorSpace.call('chat-room', 'send-message', {
                username: this.currentUsername,
                text: text
            });

            // Get updated messages
            const messages = await this.actorSpace.call('chat-room', 'get-messages', {});

            // Display last message
            const lastMsg = messages[messages.length - 1];
            if (lastMsg) {
                this.renderMessage(messagesContainer, lastMsg);
            }

            // Clear input
            messageInput.value = '';

        } catch (err) {
            console.error('Failed to send message:', err);
        }
    }

    renderMessage(container, msg) {
        const div = document.createElement('div');

        if (msg.type === 'system') {
            div.className = 'message system';
            div.textContent = msg.text;
        } else if (msg.type === 'chat') {
            div.className = 'message chat' + (msg.username === this.currentUsername ? ' own' : '');
            div.innerHTML = `
                <div class="username">${msg.username}</div>
                <div class="text">${msg.text}</div>
            `;
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    cleanup() {
        if (this.actorSpace) {
            this.actorSpace.close();
        }
        if (this.lifecycle) {
            this.lifecycle.cleanup();
        }
    }
}
