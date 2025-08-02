/**
 * Main entry point for Aiur Actors UI
 */
import { AiurActorsApp } from '/app/AiurActorsApp.js';
import { ComponentFactory } from '/components/ComponentFactory.js';
import { ClientActorSpace } from '/actors/ClientActorSpace.js';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing Aiur Actors UI...');
        
        // Create actor space
        const actorSpace = new ClientActorSpace();
        
        // Create component factory
        const componentFactory = new ComponentFactory();
        
        // Get WebSocket URL from environment or use default
        const wsUrl = window.AIUR_WS_URL || 'ws://localhost:8080/ws';
        
        // Create application instance
        const app = new AiurActorsApp({
            dom: document.getElementById('app'),
            componentFactory,
            actorSpace,
            options: {
                websocketUrl: wsUrl,
                theme: 'dark',
                terminal: {
                    fontSize: '14px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    maxOutputLines: 1000
                }
            }
        });
        
        // Initialize and start the application
        await app.initialize();
        app.start();
        
        // Store app reference globally for debugging
        window.aiurApp = app;
        
        console.log('Aiur Actors UI initialized successfully');
        
        // Handle window unload
        window.addEventListener('beforeunload', () => {
            app.destroy();
        });
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.body.innerHTML = `
            <div class="error-container">
                <h1>Application Error</h1>
                <p>Failed to initialize Aiur Actors UI</p>
                <pre>${error.message}</pre>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
    }
});