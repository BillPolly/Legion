/**
 * WebSocket connection handler
 * Manages WebSocket connections and agent instances
 */
import { WebSocketServer } from 'ws';
import { AgentConnection } from './agent-connection.js';

export class WebSocketHandler {
    constructor(server) {
        this.server = server;
        this.wss = null;
        this.connections = new Map(); // connectionId -> { ws, agent }
        this.connectionCounter = 0;
    }
    
    /**
     * Initialize WebSocket server
     */
    initialize() {
        this.wss = new WebSocketServer({ 
            server: this.server,
            path: '/ws'
        });
        
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
        
        console.log('🔌 WebSocket server initialized on /ws');
    }
    
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, request) {
        const connectionId = this.generateConnectionId();
        const clientIP = request.socket.remoteAddress;
        
        console.log(`📡 New WebSocket connection: ${connectionId} from ${clientIP}`);
        
        // Create agent instance for this connection
        const agent = new AgentConnection(connectionId);
        
        // Store connection
        this.connections.set(connectionId, { ws, agent });
        
        // Setup event handlers
        ws.on('message', async (data) => {
            await this.handleMessage(connectionId, data);
        });
        
        ws.on('close', (code, reason) => {
            this.handleDisconnection(connectionId, code, reason);
        });
        
        ws.on('error', (error) => {
            this.handleError(connectionId, error);
        });
        
        // Send welcome message
        this.sendMessage(connectionId, {
            type: 'system',
            message: 'Connected to jsEnvoy Chat',
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Handle incoming message
     */
    async handleMessage(connectionId, data) {
        try {
            const connection = this.connections.get(connectionId);
            if (!connection) {
                console.error(`Connection not found: ${connectionId}`);
                return;
            }
            
            const message = JSON.parse(data.toString());
            console.log(`📨 Message from ${connectionId}:`, message);
            
            // Validate message format
            if (!message.type || !message.content) {
                this.sendError(connectionId, 'Invalid message format', 'Missing type or content');
                return;
            }
            
            if (message.type === 'message') {
                // Process message with agent
                const response = await connection.agent.processMessage(message.content);
                
                // Send response back to client
                this.sendMessage(connectionId, {
                    id: message.id,
                    success: true,
                    response: response,
                    timestamp: new Date().toISOString()
                });
            } else {
                this.sendError(connectionId, 'Unsupported message type', `Type '${message.type}' not supported`);
            }
            
        } catch (error) {
            console.error(`Error handling message from ${connectionId}:`, error);
            this.sendError(connectionId, 'Message processing error', error.message);
        }
    }
    
    /**
     * Handle connection close
     */
    handleDisconnection(connectionId, code, reason) {
        console.log(`❌ WebSocket disconnected: ${connectionId} (code: ${code}, reason: ${reason})`);
        
        const connection = this.connections.get(connectionId);
        if (connection) {
            // Cleanup agent
            connection.agent.destroy();
            this.connections.delete(connectionId);
        }
    }
    
    /**
     * Handle connection error
     */
    handleError(connectionId, error) {
        console.error(`💥 WebSocket error on ${connectionId}:`, error);
        
        const connection = this.connections.get(connectionId);
        if (connection) {
            this.sendError(connectionId, 'Connection error', error.message);
        }
    }
    
    /**
     * Send message to specific connection
     */
    sendMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.ws.readyState !== 1) { // OPEN = 1
            console.warn(`Cannot send message to ${connectionId}: connection not available`);
            return false;
        }
        
        try {
            connection.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`Error sending message to ${connectionId}:`, error);
            return false;
        }
    }
    
    /**
     * Send error message to specific connection
     */
    sendError(connectionId, error, details = null) {
        this.sendMessage(connectionId, {
            success: false,
            error: error,
            details: details,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Generate unique connection ID
     */
    generateConnectionId() {
        return `conn_${Date.now()}_${++this.connectionCounter}`;
    }
    
    /**
     * Get connection statistics
     */
    getStats() {
        const activeConnections = this.connections.size;
        const connectionSummaries = Array.from(this.connections.values())
            .map(conn => conn.agent.getConversationSummary());
        
        return {
            activeConnections,
            totalConnectionsCreated: this.connectionCounter,
            connections: connectionSummaries
        };
    }
    
    /**
     * Broadcast message to all connections
     */
    broadcast(message) {
        let sent = 0;
        for (const [connectionId, connection] of this.connections) {
            if (this.sendMessage(connectionId, message)) {
                sent++;
            }
        }
        console.log(`📢 Broadcast sent to ${sent}/${this.connections.size} connections`);
        return sent;
    }
    
    /**
     * Cleanup all connections
     */
    destroy() {
        console.log('🧹 Cleaning up WebSocket handler...');
        
        // Close all connections
        for (const [connectionId, connection] of this.connections) {
            connection.agent.destroy();
            connection.ws.close(1000, 'Server shutdown');
        }
        
        this.connections.clear();
        
        if (this.wss) {
            this.wss.close();
        }
        
        console.log('✅ WebSocket handler cleanup complete');
    }
}