/**
 * Development server for Aiur Actors UI
 * Serves static files and proxies WebSocket connections
 */
import { StaticServer } from './src/server/StaticServer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.PORT || 3002;  // UI server port
const PUBLIC_DIR = join(__dirname, 'public');
const SRC_DIR = join(__dirname, 'src');

// Create and configure the server
const server = new StaticServer({
    port: PORT,
    publicDir: PUBLIC_DIR,
    spa: true,
    cors: true,
    corsOrigin: '*',
    securityHeaders: true,
    caching: false, // Disable caching for development
    compression: true,
    compressionThreshold: 1024,
    etag: true,
    mimeTypes: {
        '.mjs': 'text/javascript',
        '.ts': 'text/typescript'
    },
    logger: console
});

// Custom request handler to serve source files
const originalHandleRequest = server.handleRequest.bind(server);
server.handleRequest = function(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // Map source file requests to the src directory
    if (url.pathname.startsWith('/app/') || 
        url.pathname.startsWith('/components/') || 
        url.pathname.startsWith('/actors/') ||
        url.pathname.startsWith('/services/')) {
        
        // Rewrite the request to point to src directory
        const srcPath = url.pathname;
        const modifiedReq = { ...req, url: srcPath };
        
        // Temporarily change publicDir to src
        const originalPublicDir = this.publicDir;
        this.publicDir = SRC_DIR;
        
        // Handle the request
        originalHandleRequest(modifiedReq, res);
        
        // Restore original publicDir
        this.publicDir = originalPublicDir;
    } else {
        // Handle normal static file requests
        originalHandleRequest(req, res);
    }
};

// Start the server
async function start() {
    try {
        await server.start();
        console.log(`
╔══════════════════════════════════════════╗
║     Aiur Actors UI Development Server    ║
╠══════════════════════════════════════════╣
║                                          ║
║  Server:    http://localhost:${PORT}       ║
║  Public:    ${PUBLIC_DIR}                ║
║  Source:    ${SRC_DIR}                   ║
║                                          ║
║  Press Ctrl+C to stop                    ║
║                                          ║
╚══════════════════════════════════════════╝
        `);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
});

// Start the server
start();