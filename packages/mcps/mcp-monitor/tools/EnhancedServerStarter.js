/**
 * Enhanced Server Starter - Handles package.json scripts and TypeScript loaders with Sidewinder injection
 * Solves the problem of starting servers that use ts-node, ts-loader, or other TypeScript tooling
 * while still injecting Sidewinder monitoring via the -r (--require) flag.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sidewinder } from '@legion/sidewinder';
import { portManager } from '../utils/PortManager.js';

export class EnhancedServerStarter {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Start a server with enhanced script handling and Sidewinder injection
   */
  async startServer(args) {
    const {
      script,
      packagePath,
      startScript,
      wait_for_port,
      log_level = 'info',
      session_id = 'default',
      env = {}
    } = args;

    // Validate inputs
    if (!script && !startScript && !packagePath) {
      throw new Error('Either script path, startScript name, or packagePath must be provided');
    }

    // Determine the working directory
    const workingDir = packagePath || process.cwd();
    const packageJsonPath = path.join(workingDir, 'package.json');

    // Parse package.json if it exists
    let packageJson = null;
    if (existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      } catch (error) {
        console.warn(`Warning: Could not parse package.json: ${error.message}`);
      }
    }

    // Determine what command to run
    let commandInfo;
    if (startScript && packageJson?.scripts?.[startScript]) {
      // Use specified start script from package.json
      commandInfo = this.parsePackageScript(packageJson.scripts[startScript], workingDir);
    } else if (!script && packageJson?.scripts?.start) {
      // Use default start script from package.json
      commandInfo = this.parsePackageScript(packageJson.scripts.start, workingDir);
    } else if (script) {
      // Use direct script path - if script has a directory, use that as working dir
      const scriptDir = path.dirname(path.resolve(script));
      const actualWorkingDir = existsSync(path.join(scriptDir, 'package.json')) ? scriptDir : workingDir;
      commandInfo = this.parseDirectScript(script, actualWorkingDir);
    } else {
      throw new Error('No valid script or start command found');
    }

    console.log(`[EnhancedServerStarter] Parsed command:`, commandInfo);

    // Set up Sidewinder
    const sidewinderServer = await this.sessionManager.initializeSidewinderServer();
    const sidewinderProfile = this.mapLogLevelToProfile(log_level);

    const sidewinder = new Sidewinder({
      wsPort: sidewinderServer.port,
      wsHost: 'localhost',
      sessionId: session_id,
      profile: sidewinderProfile,
      debug: log_level === 'trace'
    });

    const injectPath = await sidewinder.prepare();

    // Inject Sidewinder into the command
    const enhancedCommand = this.injectSidewinderIntoCommand(commandInfo, injectPath);

    console.log(`[EnhancedServerStarter] Enhanced command:`, enhancedCommand);

    // Reserve port
    const appPort = wait_for_port || await portManager.reservePort(session_id, 'app');

    // Spawn the process
    const appProcess = spawn(enhancedCommand.command, enhancedCommand.args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...env,
        PORT: appPort.toString(),
        NODE_OPTIONS: this.mergeNodeOptions(process.env.NODE_OPTIONS, enhancedCommand.nodeOptions)
      }
    });

    // Register and set up the process
    this.sessionManager.registerProcess(session_id, {
      process: appProcess,
      pid: appProcess.pid,
      port: appPort,
      startTime: new Date(),
      workingDir,
      originalCommand: commandInfo,
      enhancedCommand
    });

    return {
      process: appProcess,
      port: appPort,
      sessionId: session_id,
      workingDir,
      sidewinderPort: sidewinderServer.port
    };
  }

  /**
   * Parse a package.json script into command components
   */
  parsePackageScript(scriptText, workingDir) {
    // Handle common patterns:
    // - "node server.js"
    // - "ts-node src/server.ts"
    // - "nodemon --exec ts-node src/server.ts"
    // - "npm run build && node dist/server.js"

    const parts = this.parseShellCommand(scriptText);
    
    // Look for node-like commands
    const nodeCommands = ['node', 'ts-node', 'tsx', 'nodemon'];
    let mainCommand = parts[0];
    let commandArgs = parts.slice(1);

    // Handle npx prefixes
    if (mainCommand === 'npx' && parts.length > 1) {
      mainCommand = parts[1];
      commandArgs = parts.slice(2);
    }

    // Resolve script paths relative to package directory
    if (commandArgs.length > 0) {
      const lastArg = commandArgs[commandArgs.length - 1];
      if (lastArg.endsWith('.js') || lastArg.endsWith('.ts') || lastArg.endsWith('.mjs')) {
        const scriptPath = path.resolve(workingDir, lastArg);
        if (existsSync(scriptPath)) {
          commandArgs[commandArgs.length - 1] = scriptPath;
        }
      }
    }

    return {
      type: 'package-script',
      original: scriptText,
      command: mainCommand,
      args: commandArgs,
      isNode: nodeCommands.includes(mainCommand) || mainCommand.includes('node'),
      isTypeScript: mainCommand.includes('ts-') || mainCommand === 'tsx' || 
                   scriptText.includes('.ts') || scriptText.includes('typescript'),
      workingDir: workingDir
    };
  }

  /**
   * Parse a direct script path
   */
  parseDirectScript(scriptPath, workingDir) {
    const fullPath = path.isAbsolute(scriptPath) ? scriptPath : path.resolve(workingDir, scriptPath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Script file not found: ${fullPath}`);
    }

    const isTypeScript = fullPath.endsWith('.ts');
    const command = isTypeScript ? 'ts-node' : 'node';

    return {
      type: 'direct-script',
      original: scriptPath,
      command: command,
      args: [fullPath],
      isNode: true,
      isTypeScript: isTypeScript,
      workingDir: workingDir
    };
  }

  /**
   * Resolve command path (check local node_modules first)
   */
  resolveCommand(command, workingDir) {
    // Try local node_modules/.bin first
    const localBin = path.join(workingDir, 'node_modules', '.bin', command);
    if (existsSync(localBin)) {
      return localBin;
    }
    
    // Try npx for local packages
    const nodeModulesCmd = path.join(workingDir, 'node_modules', '.bin', command + '.cmd');
    if (existsSync(nodeModulesCmd)) {
      return nodeModulesCmd;
    }
    
    // Fall back to global command
    return command;
  }

  /**
   * Inject Sidewinder into the parsed command
   */
  injectSidewinderIntoCommand(commandInfo, injectPath) {
    let { command, args, workingDir } = commandInfo;
    let nodeOptions = [];

    // Resolve command path if it's not a built-in
    if (commandInfo.isNode && command !== 'node') {
      const resolvedCommand = this.resolveCommand(command, workingDir);
      if (resolvedCommand !== command) {
        console.log(`[EnhancedServerStarter] Resolved ${command} to ${resolvedCommand}`);
        command = resolvedCommand;
      }
    }

    if (commandInfo.isNode) {
      // For Node.js processes, we can inject Sidewinder
      if (command === 'node') {
        // Direct node command: node script.js -> node --require sidewinder script.js
        const scriptIndex = args.findIndex(arg => !arg.startsWith('-'));
        if (scriptIndex >= 0) {
          args.splice(scriptIndex, 0, '--require', injectPath);
        } else {
          args.unshift('--require', injectPath);
        }
      } else if (command.includes('ts-node') || command === 'tsx') {
        // TypeScript loaders: use NODE_OPTIONS to inject
        nodeOptions.push(`--require ${injectPath}`);
      } else if (command === 'nodemon' || command.includes('nodemon')) {
        // Nodemon: inject into the exec command or use NODE_OPTIONS
        const execIndex = args.findIndex(arg => arg === '--exec');
        if (execIndex >= 0 && execIndex + 1 < args.length) {
          // nodemon --exec "ts-node script.ts" -> nodemon --exec "node --require sidewinder -r ts-node/register script.ts"
          const execCommand = args[execIndex + 1];
          const execParts = this.parseShellCommand(execCommand);
          if (execParts[0].includes('ts-node')) {
            args[execIndex + 1] = `node --require ${injectPath} -r ts-node/register ${execParts.slice(1).join(' ')}`;
          }
        } else {
          // Use NODE_OPTIONS for nodemon
          nodeOptions.push(`--require ${injectPath}`);
        }
      } else {
        // Other Node.js tools: use NODE_OPTIONS
        nodeOptions.push(`--require ${injectPath}`);
      }
    } else {
      console.warn(`[EnhancedServerStarter] Cannot inject Sidewinder into non-Node command: ${command}`);
    }

    return {
      command,
      args,
      nodeOptions: nodeOptions.join(' ')
    };
  }

  /**
   * Parse shell command string into array of arguments
   */
  parseShellCommand(commandStr) {
    // Basic shell parsing - handles quotes and spaces
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Merge NODE_OPTIONS environment variables
   */
  mergeNodeOptions(existing, additional) {
    const parts = [];
    if (existing) parts.push(existing);
    if (additional) parts.push(additional);
    return parts.join(' ');
  }

  /**
   * Map log level to Sidewinder profile
   */
  mapLogLevelToProfile(logLevel) {
    const profiles = {
      'error': 'minimal',
      'warn': 'minimal', 
      'info': 'standard',
      'debug': 'detailed',
      'trace': 'comprehensive'
    };
    return profiles[logLevel] || 'standard';
  }
}