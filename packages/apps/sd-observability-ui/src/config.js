/**
 * Configuration for SD Observability UI
 */

export const config = {
  // Backend WebSocket URL - use window.location for browser compatibility
  backendUrl: typeof window !== 'undefined' 
    ? `ws://${window.location.hostname}:3007` 
    : 'ws://localhost:3007',
  
  // Frontend server port
  frontendPort: 3006,
  
  // Reconnect settings
  reconnectDelay: 3000,
  maxReconnectAttempts: 10,
  
  // UI settings
  enableMockData: false,
  debugMode: true
};