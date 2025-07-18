# NodeRunner Design Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Design Patterns](#design-patterns)
5. [Integration Architecture](#integration-architecture)
6. [API Design](#api-design)
7. [Error Handling](#error-handling)
8. [Resource Management](#resource-management)
9. [Security Considerations](#security-considerations)
10. [Performance Optimization](#performance-optimization)
11. [Future Enhancements](#future-enhancements)

## Overview

NodeRunner is a comprehensive Node.js process execution and lifecycle management system designed specifically for AI agents. It provides a unified interface for managing Node.js processes, web servers, and package operations with built-in logging, health monitoring, and automatic resource cleanup.

### Design Goals

1. **Simplicity**: Provide a simple, intuitive API for complex process management
2. **Reliability**: Ensure robust process lifecycle management with proper cleanup
3. **Observability**: Integrate comprehensive logging and monitoring
4. **Flexibility**: Support various package managers and server frameworks
5. **AI-Agent Friendly**: Design for programmatic use by AI agents

### Key Features

- **Process Lifecycle Management**: Start, stop, restart, and monitor processes
- **Server Management**: Web server orchestration with health checks
- **Package Operations**: Multi-package-manager support (npm, yarn, pnpm, bun)
- **Port Management**: Automatic port allocation and conflict resolution
- **Log Integration**: Built-in LogManager integration for comprehensive logging
- **Automatic Cleanup**: Resource cleanup on exit with graceful shutdown
- **Event System**: Process lifecycle events via EventEmitter

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                  NodeRunner                      │
│  ┌───────────────────────────────────────────┐  │
│  │         Configuration & Initialization      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │ProcessManager│  │ServerManager │  │Package ││
│  │              │  │              │  │Manager ││
│  └──────┬───────┘  └──────┬───────┘  └────┬───┘│
│         │                  │               │     │
│  ┌──────▼───────────────────▼─────────────▼───┐ │
│  │            LogManager Integration           │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         Cleanup & Resource Management      │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────┴─────────────────┐
        │         External Systems          │
        │  • Child Processes                │
        │  • Web Servers                    │
        │  • Package Managers               │
        │  • File System                    │
        └───────────────────────────────────┘
```

### Component Interaction Diagram

```
NodeRunner
    │
    ├─── ProcessManager
    │    ├─── spawn() child processes
    │    ├─── EventEmitter for lifecycle events
    │    └─── LogManager integration
    │
    ├─── ServerManager
    │    ├─── Uses ProcessManager
    │    ├─── Port management
    │    └─── Health checking
    │
    ├─── PackageManager
    │    ├─── Package manager detection
    │    ├─── Command execution
    │    └─── Environment analysis
    │
    └─── Utils
         ├─── Port utilities
         └─── Cleanup handlers
```

## Core Components

### 1. NodeRunner (Main Class)

The main orchestrator that provides a unified API and manages component lifecycle.

**Responsibilities:**
- Component initialization and configuration
- API method delegation to appropriate managers
- Error handling and response normalization
- LogManager integration setup
- Cleanup coordination

**Key Design Decisions:**
- All methods return consistent `{ success, ...data }` format
- Automatic LogManager creation if not provided
- Configurable auto-cleanup behavior
- Centralized error handling

### 2. ProcessManager

Manages the lifecycle of Node.js processes with comprehensive monitoring.

**Core Features:**
- Process spawn with configurable options
- Graceful and forced shutdown support
- Process tracking with metadata
- Log capture integration
- Event emission for lifecycle changes

**Architecture:**
```javascript
ProcessManager
├── processes: Map<processId, ProcessInfo>
├── logManager: LogManager instance
└── Methods:
    ├── startProcess(command, args, options)
    ├── stopProcess(processId, options)
    ├── restartProcess(processId, options)
    ├── getProcessLogs(processId, options)
    └── killProcessOnPort(port)
```

**Process Lifecycle:**
1. **Start**: Spawn process → Capture logs → Track metadata → Emit 'process-start'
2. **Running**: Monitor status → Buffer logs → Handle events
3. **Stop**: Send SIGTERM → Wait for graceful shutdown → Force kill if needed → Cleanup
4. **Exit**: Update status → Stop log capture → Emit 'process-exit' → Remove from tracking

**Log Integration:**
- Automatic stdout/stderr capture via LogManager
- Configurable buffer sizes per process
- Real-time streaming capability
- Persistent log storage with process correlation

### 3. ServerManager

Specialized manager for web server processes with health monitoring.

**Core Features:**
- Web server lifecycle management
- Port allocation and management
- Health check implementation
- Development server support
- Framework detection

**Server Types:**
1. **Production Servers**: Full health monitoring, port management
2. **Development Servers**: Framework-specific handling, HMR support

**Health Check System:**
```javascript
Health Check Flow:
1. Wait for port to be in use
2. Make HTTP request to health endpoint
3. Validate response status
4. Record health metrics
5. Retry on failure with backoff
```

**Port Management:**
- Automatic port conflict resolution
- Port availability checking
- Fallback port allocation
- Port release on server stop

### 4. PackageManager

Handles NPM ecosystem package operations with multi-manager support.

**Supported Package Managers:**
- npm (default)
- yarn (classic & berry)
- pnpm
- bun

**Core Features:**
- Automatic package manager detection
- Dependency installation with options
- Script execution from package.json
- Environment analysis
- Lock file handling

**Detection Logic:**
```
1. Check for lock files:
   - yarn.lock → yarn
   - pnpm-lock.yaml → pnpm
   - bun.lockb → bun
   - package-lock.json → npm
2. Check for .npmrc/config files
3. Default to npm
```

### 5. Utility Modules

#### Port Utilities (utils/ports.js)
- `findAvailablePort(preferredPort)`: Find next available port
- `waitForPortInUse(port, options)`: Wait for server startup
- `isPortAvailable(port)`: Check port availability

#### Cleanup Utilities (utils/cleanup.js)
- `CleanupContext`: Tracks resources for cleanup
- `registerCleanupHandler`: Process exit handling
- Graceful shutdown coordination

## Design Patterns

### 1. Manager Pattern
Separates concerns into specialized managers (Process, Server, Package) with clear responsibilities.

**Benefits:**
- Single Responsibility Principle
- Easy to extend with new managers
- Clear API boundaries
- Testability

### 2. Facade Pattern
NodeRunner acts as a facade, providing a simplified interface to complex subsystems.

**Implementation:**
```javascript
// Client uses simple API
const result = await nodeRunner.startWebServer('npm start');

// Internally coordinates multiple components
// 1. PackageManager checks environment
// 2. ProcessManager spawns process
// 3. ServerManager manages lifecycle
// 4. LogManager captures output
```

### 3. Event-Driven Architecture
ProcessManager extends EventEmitter for lifecycle notifications.

**Events:**
- `process-start`: Process started successfully
- `process-error`: Process encountered error
- `process-exit`: Process terminated
- `log`: Log entry captured

### 4. Builder Pattern (Configuration)
Flexible configuration with sensible defaults.

```javascript
const runner = new NodeRunner({
  autoCleanup: true,        // Default
  logBufferSize: 1000,      // Default
  logManager: customLogger  // Optional
});
```

### 5. Strategy Pattern (Package Managers)
Different strategies for different package managers.

```javascript
// Internally selects strategy based on detection
const strategy = this.detectPackageManager(cwd);
await strategy.install(options);
```

## Integration Architecture

### LogManager Integration

Deep integration with @jsenvoy/log-manager for comprehensive logging.

**Integration Points:**
1. **Process Output Capture**
   ```javascript
   await this.logManager.captureLogs({
     source: {
       type: 'process',
       id: processId,
       pid: child.pid,
       stdout: child.stdout,
       stderr: child.stderr
     }
   });
   ```

2. **Log Retrieval**
   ```javascript
   const logs = this.logManager.capture.getBufferedLogs(sourceId, {
     limit: 100
   });
   ```

3. **Cleanup Coordination**
   ```javascript
   // On process stop
   await this.logManager.capture.stopCapture(`${processId}-stdout`);
   await this.logManager.capture.stopCapture(`${processId}-stderr`);
   ```

### Event System Integration

ProcessManager emits events for process lifecycle:

```javascript
// In ProcessManager
this.emit('process-start', { processId, command, pid });
this.emit('process-error', { processId, error });
this.emit('process-exit', { processId, code, signal });

// Consumers can listen
processManager.on('process-exit', ({ processId, code }) => {
  console.log(`Process ${processId} exited with code ${code}`);
});
```

## API Design

### Consistent Response Format

All public methods return a consistent structure:

```typescript
interface Response<T = any> {
  success: boolean;
  error?: string;
  // Additional fields based on operation
  ...T
}
```

**Benefits:**
- Predictable error handling
- Easy to check operation status
- Additional data on success
- Error details on failure

### Method Naming Conventions

- **Actions**: `startProcess`, `stopServer`, `installDependencies`
- **Queries**: `listProcesses`, `checkServerHealth`, `getProcessLogs`
- **Utilities**: `findAvailablePort`, `executeCommand`, `cleanup`

### Parameter Design

Methods accept either simple parameters or option objects:

```javascript
// Simple
await runner.stopProcess(processId);

// With options
await runner.stopProcess(processId, {
  force: true,
  timeout: 5000
});
```

## Error Handling

### Error Categories

1. **Process Errors**
   - Spawn failures
   - Exit with non-zero code
   - Signal termination
   - Timeout errors

2. **Server Errors**
   - Port conflicts
   - Health check failures
   - Startup timeouts

3. **Package Errors**
   - Missing package.json
   - Installation failures
   - Script not found

4. **System Errors**
   - Permission denied
   - Resource exhaustion
   - Network errors

### Error Handling Strategy

```javascript
try {
  // Attempt operation
  const result = await operation();
  return { success: true, ...result };
} catch (error) {
  // Log error internally
  this.emit('error', error);
  
  // Return normalized error
  return {
    success: false,
    error: error.message,
    code: error.code // If available
  };
}
```

### Graceful Degradation

- **Port conflicts**: Automatically find next available port
- **Missing health endpoint**: Skip health checks, monitor process
- **Package manager not found**: Fall back to npm

## Resource Management

### Process Cleanup

**Automatic Cleanup Flow:**
1. Register cleanup handlers on startup
2. Track all spawned processes
3. On exit signal (SIGTERM, SIGINT):
   - Stop all servers gracefully
   - Terminate all processes
   - Stop log captures
   - Clean up temporary resources

**Manual Cleanup:**
```javascript
await nodeRunner.cleanup();
```

### Memory Management

- **Log Buffers**: Configurable circular buffers
- **Process Tracking**: Automatic removal on exit
- **Event Listeners**: Proper cleanup to prevent leaks

### File System Resources

- **Temporary files**: Tracked and cleaned
- **Lock files**: Released on exit
- **Port allocations**: Released on cleanup

## Security Considerations

### Process Isolation

- Processes run with inherited permissions
- No privilege escalation
- Environment variable sanitization

### Command Injection Prevention

```javascript
// Safe: Uses array arguments
spawn('node', ['script.js', userInput]);

// Unsafe: Shell injection risk
spawn(`node script.js ${userInput}`, { shell: true });
```

### Resource Limits

- Configurable timeouts
- Buffer size limits
- Process count limits (recommended)

### Safe Defaults

- No shell execution by default
- Restricted environment inheritance
- Health check timeouts

## Performance Optimization

### Process Spawning

- **Reuse**: Process pooling for repeated operations
- **Lazy Loading**: Import heavy dependencies only when needed
- **Shell Avoidance**: Direct spawning when possible

### Log Management

- **Circular Buffers**: Prevent memory growth
- **Streaming**: Real-time processing without buffering
- **Selective Capture**: Only capture needed streams

### Port Management

- **Caching**: Remember allocated ports
- **Quick Checks**: Fail fast on unavailable ports
- **Smart Allocation**: Start from likely available ranges

### Health Monitoring

- **Exponential Backoff**: Reduce check frequency on failures
- **Caching**: Cache health status with TTL
- **Batch Checks**: Check multiple servers in parallel

## Future Enhancements

### Planned Features

1. **Process Pools**
   - Pre-spawn processes for quick allocation
   - Automatic scaling based on load
   - Resource sharing between processes

2. **Advanced Monitoring**
   - CPU and memory metrics
   - Custom health check protocols
   - Performance profiling integration

3. **Cluster Support**
   - Multi-instance process management
   - Load balancing
   - Zero-downtime deployments

4. **Container Integration**
   - Docker process management
   - Container health checks
   - Volume and network management

5. **Enhanced Security**
   - Sandbox execution
   - Resource quotas
   - Security policy enforcement

### Architecture Evolution

1. **Plugin System**
   - Custom managers
   - Health check providers
   - Log processors

2. **Distributed Mode**
   - Multi-machine process management
   - Centralized logging
   - Cross-node communication

3. **AI-Specific Features**
   - Automatic error recovery
   - Performance optimization
   - Predictive resource allocation

## Conclusion

NodeRunner provides a robust, well-architected solution for Node.js process management tailored for AI agents. Its modular design, comprehensive error handling, and deep integration with logging infrastructure make it ideal for complex application orchestration.

The architecture prioritizes:
- **Reliability** through proper resource management
- **Observability** through comprehensive logging
- **Flexibility** through modular design
- **Simplicity** through consistent APIs

This design ensures NodeRunner can handle current requirements while remaining extensible for future needs.