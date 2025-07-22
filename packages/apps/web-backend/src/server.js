/**
 * Express server with WebSocket support for jsEnvoy chat
 * Serves static frontend files and handles WebSocket connections
 */
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketHandler } from './websocket-handler.js';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ChatServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.resourceManager = null;
        this.moduleFactory = null;
        this.wsHandler = null;
        this.port = process.env.PORT || 3000;
    }
    
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Enable JSON parsing
        this.app.use(express.json());
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
            next();
        });
        
        // Serve static files from frontend package
        const frontendPath = path.join(__dirname, '..', '..', 'web-frontend');
        this.app.use(express.static(frontendPath));
        
        console.log(`📁 Serving static files from: ${frontendPath}`);
    }
    
    /**
     * Setup HTTP routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const stats = this.wsHandler.getStats();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                websocket: stats
            });
        });
        
        // API endpoint for connection stats
        this.app.get('/api/stats', (req, res) => {
            const stats = this.wsHandler.getStats();
            res.json(stats);
        });
        
        // Catch-all route for SPA (serve index.html for any non-API route)
        this.app.get('*', (req, res) => {
            // Don't serve index.html for API routes or WebSocket
            if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            
            const frontendPath = path.join(__dirname, '..', '..', 'web-frontend', 'index.html');
            res.sendFile(frontendPath);
        });
    }
    
    /**
     * Setup WebSocket handling
     */
    setupWebSocket() {
        this.wsHandler.initialize();
    }
    
    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Express error handler
        this.app.use((error, req, res, next) => {
            console.error('Express error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        });
        
        // Process error handlers
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('unhandledRejection');
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\\n📴 Received SIGINT, starting graceful shutdown...');
            this.gracefulShutdown('SIGINT');
        });
        
        process.on('SIGTERM', () => {
            console.log('\\n📴 Received SIGTERM, starting graceful shutdown...');
            this.gracefulShutdown('SIGTERM');
        });
    }
    
    /**
     * Initialize resources and module factory
     */
    async initializeResources() {
        // Initialize ResourceManager
        this.resourceManager = new ResourceManager();
        await this.resourceManager.initialize(); // This loads .env file
        
        // Create module factory
        this.moduleFactory = new ModuleFactory(this.resourceManager);
        
        // Register default resources
        this.resourceManager.register('basePath', process.cwd());
        this.resourceManager.register('encoding', 'utf8');
        this.resourceManager.register('createDirectories', true);
        this.resourceManager.register('permissions', 0o755);
        
        // Register GitHub resources (get from env if available)
        this.resourceManager.register('GITHUB_PAT', this.resourceManager.has('env.GITHUB_PAT') ? this.resourceManager.get('env.GITHUB_PAT') : '');
        this.resourceManager.register('GITHUB_ORG', this.resourceManager.has('env.GITHUB_ORG') ? this.resourceManager.get('env.GITHUB_ORG') : '');
        this.resourceManager.register('GITHUB_USER', this.resourceManager.has('env.GITHUB_USER') ? this.resourceManager.get('env.GITHUB_USER') : '');
        
        // Now create WebSocketHandler with resources
        this.wsHandler = new WebSocketHandler(this.server, this.resourceManager, this.moduleFactory);
        
        // Update port from env if available
        this.port = this.resourceManager.has('env.PORT') ? this.resourceManager.get('env.PORT') : 3000;
    }
    
    /**
     * Start the server
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                console.log('');
                console.log('🚀 jsEnvoy Chat Server Started');
                console.log('================================');
                console.log(`📍 Server URL: http://localhost:${this.port}`);
                console.log(`🔌 WebSocket: ws://localhost:${this.port}/ws`);
                console.log(`📊 Health Check: http://localhost:${this.port}/health`);
                console.log(`📈 Stats API: http://localhost:${this.port}/api/stats`);
                console.log('================================');
                console.log('💬 Ready for chat connections!');
                console.log('');
                
                resolve();
            });
        });
    }
    
    /**
     * Graceful shutdown
     */
    gracefulShutdown(reason) {
        console.log(`\\n🛑 Graceful shutdown initiated (${reason})`);
        
        // Close WebSocket connections
        this.wsHandler.destroy();
        
        // Close HTTP server
        this.server.close((error) => {
            if (error) {
                console.error('Error during server shutdown:', error);
                process.exit(1);
            } else {
                console.log('✅ Server shutdown complete');
                process.exit(0);
            }
        });
        
        // Force exit after 10 seconds
        setTimeout(() => {
            console.error('❌ Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new ChatServer();
    
    (async () => {
        try {
            await server.initializeResources();
            server.setupMiddleware();
            server.setupRoutes();
            server.setupWebSocket();
            server.setupErrorHandling();
            await server.start();
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    })();
}

export { ChatServer };