/**
 * LogStore - Internal logging component for FullStackMonitor
 * 
 * A purpose-built, silent logging system designed specifically for dual-agent
 * monitoring architecture. Eliminates infinite recursion issues while providing
 * optimized correlation tracking and search capabilities.
 */

export { LogStore } from './LogStore.js';
export { SessionStore } from './SessionStore.js';
export { CorrelationEngine } from './CorrelationEngine.js';
export { LogSearchEngine } from './LogSearchEngine.js';

// Default export for easy importing
import { LogStore } from './LogStore.js';
export default LogStore;