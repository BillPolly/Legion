/**
 * Main chat application
 * Coordinates WebSocket connection and UI interactions
 */
import { WebSocketManager } from './websocket.js';
import { 
    addMessage, 
    removeWelcomeMessage, 
    showTypingIndicator, 
    hideTypingIndicator,
    updateConnectionStatus,
    setInputEnabled,
    autoResizeTextarea,
    showErrorMessage,
    getWebSocketUrl
} from './ui.js';

class ChatApp {
    constructor() {
        this.wsManager = null;
        this.initializeElements();
        this.setupEventListeners();
        this.connect();
    }
    
    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.connectionStatus = document.getElementById('connectionStatus');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            autoResizeTextarea(this.messageInput);
        });
        
        // Focus input when clicking anywhere in chat
        this.messagesContainer.addEventListener('click', () => {
            if (!this.messageInput.disabled) {
                this.messageInput.focus();
            }
        });
    }
    
    /**
     * Connect to WebSocket server
     */
    connect() {
        const wsUrl = getWebSocketUrl();
        console.log('Connecting to:', wsUrl);
        
        this.wsManager = new WebSocketManager(wsUrl);
        
        // Setup WebSocket event handlers
        this.wsManager.onOpen = () => {
            setInputEnabled(this.messageInput, this.sendButton, true);
            this.messageInput.focus();
        };
        
        this.wsManager.onClose = () => {
            setInputEnabled(this.messageInput, this.sendButton, false);
            hideTypingIndicator(this.typingIndicator);
        };
        
        this.wsManager.onError = (error) => {
            console.error('WebSocket error:', error);
            hideTypingIndicator(this.typingIndicator);
            showErrorMessage(this.messagesContainer, 'Connection error occurred');
        };
        
        this.wsManager.onMessage = (message) => {
            this.handleIncomingMessage(message);
        };
        
        this.wsManager.onStatusChange = (status) => {
            updateConnectionStatus(this.connectionStatus, status);
        };
        
        // Start connection
        this.wsManager.connect();
    }
    
    /**
     * Send message to agent
     */
    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || !this.wsManager.isConnected()) {
            return;
        }
        
        // Clear input
        this.messageInput.value = '';
        autoResizeTextarea(this.messageInput);
        
        // Remove welcome message if this is first user message
        removeWelcomeMessage(this.messagesContainer);
        
        // Add user message to UI
        addMessage(this.messagesContainer, content, 'user');
        
        // Show typing indicator
        showTypingIndicator(this.typingIndicator);
        
        // Disable input while processing
        setInputEnabled(this.messageInput, this.sendButton, false);
        
        try {
            // Send message and wait for response
            const response = await this.wsManager.sendMessage(content);
            
            // Hide typing indicator
            hideTypingIndicator(this.typingIndicator);
            
            // Add agent response to UI
            if (response.success && response.response) {
                addMessage(this.messagesContainer, response.response, 'agent', response.timestamp);
            } else {
                showErrorMessage(this.messagesContainer, response.error || 'No response received');
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            hideTypingIndicator(this.typingIndicator);
            showErrorMessage(this.messagesContainer, error.message || 'Failed to send message');
        } finally {
            // Re-enable input
            if (this.wsManager.isConnected()) {
                setInputEnabled(this.messageInput, this.sendButton, true);
                this.messageInput.focus();
            }
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    handleIncomingMessage(message) {
        console.log('Handling message:', message);
        
        // Messages are handled by the sendMessage promise chain
        // This could be extended for real-time notifications, system messages, etc.
    }
}

// Initialize chat app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ChatApp();
    });
} else {
    new ChatApp();
}