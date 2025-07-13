/**
 * WebSocket connection manager
 * Handles connection lifecycle and message passing
 */
export class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageId = 0;
        this.pendingMessages = new Map();
        
        // Event callbacks
        this.onOpen = null;
        this.onClose = null;
        this.onError = null;
        this.onMessage = null;
        this.onStatusChange = null;
    }
    
    /**
     * Connect to WebSocket server
     */
    connect() {
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.updateStatus('connected');
                if (this.onOpen) this.onOpen();
            };
            
            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected', event.code, event.reason);
                this.updateStatus('disconnected');
                if (this.onClose) this.onClose(event);
                
                // Auto-reconnect unless explicitly closed
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('error');
                if (this.onError) this.onError(error);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('Received message:', message);
                    
                    // Handle response to pending message
                    if (message.id && this.pendingMessages.has(message.id)) {
                        const callback = this.pendingMessages.get(message.id);
                        this.pendingMessages.delete(message.id);
                        callback(message);
                    }
                    
                    if (this.onMessage) this.onMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.updateStatus('connecting');
            
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.updateStatus('error');
        }
    }
    
    /**
     * Send message and optionally wait for response
     */
    sendMessage(content, waitForResponse = true) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('WebSocket not connected'));
                return;
            }
            
            const messageId = this.generateMessageId();
            const message = {
                id: messageId,
                type: 'message',
                content: content,
                timestamp: new Date().toISOString()
            };
            
            if (waitForResponse) {
                // Set up callback for response
                this.pendingMessages.set(messageId, (response) => {
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Unknown error'));
                    }
                });
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    if (this.pendingMessages.has(messageId)) {
                        this.pendingMessages.delete(messageId);
                        reject(new Error('Message timeout'));
                    }
                }, 30000);
            }
            
            try {
                this.ws.send(JSON.stringify(message));
                if (!waitForResponse) resolve({ success: true });
            } catch (error) {
                if (waitForResponse) {
                    this.pendingMessages.delete(messageId);
                }
                reject(error);
            }
        });
    }
    
    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    /**
     * Close WebSocket connection
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        this.updateStatus('reconnecting');
        
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.connect();
            }
        }, delay);
    }
    
    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${++this.messageId}`;
    }
    
    /**
     * Update connection status
     */
    updateStatus(status) {
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }
}