/**
 * jsEnvoy Chat Server using ResourceManager StaticServer pattern
 * Simplified server setup using centralized static server service
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketHandler } from './websocket-handler.js';
import { ResourceManager, ModuleFactory } from '@legion/tool-system';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ChatServer {
    constructor() {
        this.staticServer = null;
        this.resourceManager = null;
        this.moduleFactory = null;
        this.wsHandler = null;
        this.port = process.env.PORT || 3000;
    }
    
    /**
     * Setup StaticServer with ResourceManager
     */
    async setupStaticServer() {
        // Path to frontend files
        const frontendPath = path.join(__dirname, '..', '..', 'web-frontend');
        
        // Create StaticServer using ResourceManager
        this.staticServer = await this.resourceManager.getOrCreate('StaticServer', {
            server: {
                port: this.port,
                host: 'localhost'
            },
            static: {
                publicDir: frontendPath,
                caching: process.env.NODE_ENV === 'production'
            },
            security: {
                cors: {
                    enabled: true,
                    origin: '*',
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
                }
            },
            api: {
                endpoints: {
                    '/health': (req, res) => {
                        const stats = this.wsHandler.getStats();
                        res.json({
                            status: 'healthy',
                            timestamp: new Date().toISOString(),
                            uptime: process.uptime(),
                            websocket: stats
                        });
                    },
                    '/api/stats': (req, res) => {
                        const stats = this.wsHandler.getStats();
                        res.json(stats);
                    }
                }
            },
            logging: {
                level: 'info',
                requests: true
            }
        });
        
        console.log(`📁 Serving static files from: ${frontendPath}`);
    }
    
    /**
     * Setup WebSocket handling
     */
    setupWebSocket() {
        // Create WebSocketHandler with StaticServer's HTTP server
        this.wsHandler = new WebSocketHandler(
            this.staticServer.getHttpServer(), 
            this.resourceManager, 
            this.moduleFactory
        );
        this.wsHandler.initialize();
    }
    
    /**
     * Setup error handling
     */
    setupErrorHandling() {
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
        this.resourceManager.register('GITHUB_PAT', this.resourceManager.has('env.GITHUB_PAT') ? this.resourceManager.env.GITHUB_PAT : '');
        this.resourceManager.register('GITHUB_ORG', this.resourceManager.has('env.GITHUB_ORG') ? this.resourceManager.env.GITHUB_ORG : '');
        this.resourceManager.register('GITHUB_USER', this.resourceManager.has('env.GITHUB_USER') ? this.resourceManager.env.GITHUB_USER : '');
        
        // Update port from env if available
        this.port = this.resourceManager.has('env.PORT') ? this.resourceManager.env.PORT : 3000;
    }
    
    /**
     * Start the server
     */
    async start() {
        // Start the StaticServer
        await this.staticServer.start();
        
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
    }
    
    /**
     * Graceful shutdown
     */
    async gracefulShutdown(reason) {
        console.log(`\\n🛑 Graceful shutdown initiated (${reason})`);
        
        try {
            // Close WebSocket connections
            if (this.wsHandler) {
                this.wsHandler.destroy();
            }
            
            // Close StaticServer
            if (this.staticServer) {
                await this.staticServer.stop();
            }
            
            console.log('✅ Server shutdown complete');
            process.exit(0);
        } catch (error) {
            console.error('Error during server shutdown:', error);
            process.exit(1);
        }
        
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
            await server.setupStaticServer();
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