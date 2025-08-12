/**
 * SimplifiedTools - Streamlined MCP tools focused on app debugging
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import net from 'net';
import { promisify } from 'util';
import { Sidewinder } from '@legion/sidewinder';
import puppeteer from 'puppeteer';
import { portManager } from '../utils/PortManager.js';
import { EnhancedServerStarter } from './EnhancedServerStarter.js';

const execAsync = promisify(exec);

export class SimplifiedTools {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.enhancedStarter = new EnhancedServerStarter(sessionManager);
    // Process management now handled by SessionManager
  }
  
  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      // NEW: Focused server startup tool
      {
        name: 'start_server',
        description: 'Start a Node.js server with automatic monitoring via Sidewinder injection. Works with TypeScript, package.json scripts, and various Node.js loaders.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { 
              type: 'string', 
              description: 'Path to your Node.js server script (e.g., server.js, src/server.ts)' 
            },
            package_path: {
              type: 'string',
              description: 'Path to directory containing package.json. If provided, can use start_script parameter.'
            },
            start_script: {
              type: 'string', 
              description: 'Name of npm script to run from package.json (e.g., "start", "dev", "server"). Defaults to "start" if package_path is provided.'
            },
            wait_for_port: { 
              type: 'number', 
              description: 'Port to wait for before considering server ready' 
            },
            log_level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              default: 'info',
              description: 'Initial logging verbosity'
            },
            session_id: {
              type: 'string',
              description: 'Optional session ID',
              default: 'default'
            },
            env: {
              type: 'object',
              description: 'Additional environment variables to pass to the server process'
            },
            kill_conflicting_ports: {
              type: 'boolean',
              default: true,
              description: 'Kill any process using the target port before starting (default: true)'
            }
          }
        }
      },

      // NEW: Focused browser/page opening tool
      {
        name: 'open_page',
        description: 'Open a browser page for monitoring. Defaults to index.html on the server from the active session.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to open. If not provided, defaults to http://localhost:{server_port}/index.html'
            },
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID to use (must have active server)'
            },
            headless: {
              type: 'boolean',
              default: false,
              description: 'Run browser in headless mode (false = visible browser for better UX)'
            },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', default: 1280 },
                height: { type: 'number', default: 720 }
              },
              description: 'Browser viewport size'
            }
          }
        }
      },
      
      {
        name: 'browser_execute',
        description: 'Execute Puppeteer page commands directly. Supports all Puppeteer page methods like click, type, goto, evaluate, etc. See https://pptr.dev/api/puppeteer.page for full API reference.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Puppeteer page method to execute (e.g., "click", "type", "goto", "evaluate", "screenshot", "title", "url", "content", "waitForSelector")'
            },
            args: {
              type: 'array',
              description: 'Arguments to pass to the command. For example: ["#button"] for click, ["#input", "text"] for type, ["https://example.com"] for goto'
            },
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID with active browser'
            }
          },
          required: ['command']
        }
      },
      
      {
        name: 'query_logs',
        description: 'Search and filter application logs and system events',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Text to search for' 
            },
            request_id: { 
              type: 'string', 
              description: 'Filter by specific request ID' 
            },
            level: { 
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              description: 'Minimum log level to include'
            },
            include_system: {
              type: 'boolean',
              default: true,
              description: 'Include Sidewinder instrumentation events'
            },
            last: { 
              type: 'string', 
              description: 'Time range (e.g., "5m", "1h")' 
            },
            limit: {
              type: 'number',
              default: 100,
              description: 'Maximum number of results'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          }
        }
      },
      
      {
        name: 'set_log_level',
        description: 'Change logging verbosity at runtime',
        inputSchema: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              description: 'New log level'
            },
            session_id: {
              type: 'string',
              default: 'default'
            }
          },
          required: ['level']
        }
      },
      
      {
        name: 'stop_app',
        description: 'Stop the application and monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { 
              type: 'string', 
              default: 'default',
              description: 'Session to stop'
            }
          }
        }
      },
      
      {
        name: 'list_sessions',
        description: 'List all active monitoring sessions',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      
      {
        name: 'take_screenshot',
        description: 'Take a screenshot of the current page under test. If path is provided, saves to file. If path is omitted, returns image as base64 data URI.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpeg', 'webp'],
              default: 'png',
              description: 'Image format: png (lossless), jpeg (lossy with quality setting), webp (lossy with quality setting)'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 90,
              description: 'Quality for JPEG/WebP formats (0-100). Ignored for PNG format as it is lossless.'
            },
            fullPage: {
              type: 'boolean',
              default: true,
              description: 'Capture the full scrollable page'
            },
            path: {
              type: 'string',
              description: 'Optional file path to save screenshot. If omitted, screenshot is returned as base64 data URI in the response.'
            },
            clip: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' }
              },
              description: 'Optional clipping rectangle'
            }
          }
        }
      },
      
      {
        name: 'record_video',
        description: 'Start or stop video recording of browser interactions',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['start', 'stop', 'status'],
              description: 'Recording action to perform'
            },
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID'
            },
            path: {
              type: 'string',
              description: 'Output file path for video (for start action)'
            },
            format: {
              type: 'string',
              enum: ['mp4', 'webm'],
              default: 'mp4',
              description: 'Video format'
            },
            fps: {
              type: 'number',
              minimum: 1,
              maximum: 60,
              default: 30,
              description: 'Frames per second'
            },
            duration: {
              type: 'number',
              minimum: 1,
              description: 'Maximum recording duration in seconds (optional)'
            }
          },
          required: ['action']
        }
      }
    ];
  }
  
  /**
   * Execute a tool
   */
  async execute(toolName, args) {
    switch (toolName) {
      case 'start_server':
        return await this.startServer(args);
      case 'open_page':
        return await this.openPage(args);
      case 'browser_execute':
        return await this.browserExecute(args);
      case 'query_logs':
        return await this.queryLogs(args);
      case 'set_log_level':
        return await this.setLogLevel(args);
      case 'stop_app':
        return await this.stopApp(args);
      case 'list_sessions':
        return await this.listSessions(args);
      case 'take_screenshot':
        return await this.takeScreenshot(args);
      case 'record_video':
        return await this.recordVideo(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Start a server with enhanced script handling and Sidewinder monitoring
   */
  async startServer(args) {
    try {
      const { 
        script, 
        package_path,
        start_script,
        wait_for_port, 
        log_level = 'info', 
        session_id = 'default',
        env = {},
        kill_conflicting_ports = true
      } = args;
      
      // Check if process already exists for this session
      if (this.sessionManager.getProcess(session_id)) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ Server already running for session: ${session_id}`
          }],
          isError: true
        };
      }
      
      // Kill any process using the target port if requested
      if (kill_conflicting_ports && wait_for_port) {
        await this.killProcessOnPort(wait_for_port);
      }
      
      // Get or create monitor for session
      const monitor = await this.sessionManager.getOrCreateMonitor(session_id);
      
      // Use enhanced starter to handle various script types
      const result = await this.enhancedStarter.startServer({
        script,
        packagePath: package_path,
        startScript: start_script,
        wait_for_port,
        log_level,
        session_id,
        env
      });
      
      // Store log level for session
      this.sessionManager.setLogLevel(session_id, log_level);
      
      // Wait for server to be ready using intelligent detection
      const serverReady = await this.waitForServerReady(result.process, result.port, session_id, 30000);
      
      // Capture logs from process stdout/stderr AFTER server is ready
      await this.setupLogCapture(result.process, session_id, monitor);
      
      // Handle process exit - SessionManager will handle cleanup
      result.process.on('exit', (code) => {
        console.log(`Process exited with code ${code} for session ${session_id}`);
      });
      
      if (!serverReady) {
        // Clean up failed process
        result.process.kill('SIGTERM');
        await this.sessionManager.killProcess(session_id);
        throw new Error(`Server failed to start on port ${result.port} within 15 seconds`);
      }
      
      // Construct status message
      let commandDesc = script || 'package.json script';
      if (start_script) {
        commandDesc = `npm run ${start_script}`;
      } else if (package_path && !script) {
        commandDesc = 'npm start';
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Started server: ${commandDesc}\n` +
                `📊 Session: ${session_id}\n` +
                `📝 Log level: ${log_level}\n` +
                `🔌 Port: ${result.port}\n` +
                `🏠 Working directory: ${result.workingDir}\n` +
                `🔍 Sidewinder monitoring enabled (port ${result.sidewinderPort})\n` +
                `🌐 Server URL: http://localhost:${result.port}\n\n` +
                `💡 Tip: Use 'open_page' to open a browser, or access http://localhost:${result.port} directly`
        }]
      };
    } catch (error) {
      // Clean up process if it was started using SessionManager
      await this.sessionManager.killProcess(args.session_id);
      
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to start server: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Kill any process using a specific port
   */
  async killProcessOnPort(port) {
    try {
      // Check if port is in use
      const isInUse = await portManager.isPortListening(port);
      if (!isInUse) {
        return; // Port is free, nothing to kill
      }
      
      console.log(`[SimplifiedTools] Port ${port} is in use, attempting to kill process...`);
      
      const platform = process.platform;
      
      if (platform === 'darwin' || platform === 'linux') {
        // Unix-like systems: use lsof to find the process
        try {
          const { stdout } = await execAsync(`lsof -ti:${port}`);
          const pids = stdout.trim().split('\n').filter(Boolean);
          
          if (pids.length > 0) {
            for (const pid of pids) {
              try {
                await execAsync(`kill -9 ${pid}`);
                console.log(`[SimplifiedTools] Killed process ${pid} on port ${port}`);
              } catch (killError) {
                console.warn(`[SimplifiedTools] Failed to kill process ${pid}: ${killError.message}`);
              }
            }
            
            // Wait a moment for the port to be released
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (lsofError) {
          // lsof might fail if no process is found, which is fine
          console.log(`[SimplifiedTools] No process found on port ${port}`);
        }
      } else if (platform === 'win32') {
        // Windows: use netstat and taskkill
        try {
          const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
          const lines = stdout.trim().split('\n');
          const pids = new Set();
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          }
          
          for (const pid of pids) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`[SimplifiedTools] Killed process ${pid} on port ${port}`);
            } catch (killError) {
              console.warn(`[SimplifiedTools] Failed to kill process ${pid}: ${killError.message}`);
            }
          }
          
          // Wait a moment for the port to be released
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (netstatError) {
          // netstat might fail if no process is found, which is fine
          console.log(`[SimplifiedTools] No process found on port ${port}`);
        }
      }
      
      // Verify the port is now free
      const stillInUse = await portManager.isPortListening(port);
      if (stillInUse) {
        console.warn(`[SimplifiedTools] Port ${port} is still in use after kill attempt`);
      } else {
        console.log(`[SimplifiedTools] Port ${port} is now free`);
      }
    } catch (error) {
      console.error(`[SimplifiedTools] Error killing process on port ${port}: ${error.message}`);
      // Don't throw - we'll try to start the server anyway
    }
  }
  
  /**
   * Open a browser page for monitoring (new focused approach)
   */
  async openPage(args) {
    try {
      const { 
        url,
        session_id = 'default',
        headless = false,  // Default to visible browser for better UX
        viewport = { width: 1280, height: 720 }
      } = args;
      
      // Check if there's an active server for this session
      const sessionInfo = this.sessionManager.getProcess(session_id);
      if (!sessionInfo) {
        return {
          content: [{
            type: 'text',
            text: `❌ No active server found for session: ${session_id}. Start a server first with 'start_server'.`
          }],
          isError: true
        };
      }
      
      // Get or create monitor for session
      const monitor = await this.sessionManager.getOrCreateMonitor(session_id);
      
      // Check if browser already exists
      if (monitor.activeBrowsers && monitor.activeBrowsers.size > 0) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ Browser already open for session: ${session_id}. Close it first or use a different session.`
          }],
          isError: true
        };
      }
      
      // Auto-detect server URL if not provided
      let finalUrl = url;
      if (!finalUrl) {
        const serverPort = sessionInfo.port;
        finalUrl = `http://localhost:${serverPort}/index.html`;
        console.log(`[SimplifiedTools] No URL provided, using default: ${finalUrl}`);
      } else {
        // Replace port in provided URL with actual assigned port if needed
        const serverPort = sessionInfo.port;
        finalUrl = finalUrl.replace(/localhost:\d+/, `localhost:${serverPort}`);
      }
      
      console.log(`[SimplifiedTools] Opening browser for URL: ${finalUrl}`);
      
      try {
        // Launch browser - try to use system Chrome if available on macOS
        const browserOptions = {
          headless,
          defaultViewport: viewport,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials'
          ]
        };
        
        // Try to use system Chrome on macOS if available
        const possibleChromes = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
        ];
        
        for (const chromePath of possibleChromes) {
          if (existsSync(chromePath)) {
            console.log(`[SimplifiedTools] Using system browser at: ${chromePath}`);
            browserOptions.executablePath = chromePath;
            break;
          }
        }
        
        const browser = await puppeteer.launch(browserOptions);
        
        // Create page
        const page = await browser.newPage();
        
        // Set up console logging
        page.on('console', msg => {
          const logManagerActor = this.sessionManager.actorSpaces?.get(session_id)?.actors?.logManager;
          if (logManagerActor) {
            logManagerActor.receive({
              type: 'log',
              data: {
                level: msg.type() === 'error' ? 'error' : msg.type() === 'warning' ? 'warn' : 'info',
                message: `[Browser Console] ${msg.text()}`,
                timestamp: new Date().toISOString(),
                source: 'browser'
              },
              source: 'browser-console'
            }).catch(err => console.error('[SimplifiedTools] Failed to log browser console:', err));
          }
        });
        
        // Set up error logging
        page.on('pageerror', error => {
          const logManagerActor = this.sessionManager.actorSpaces?.get(session_id)?.actors?.logManager;
          if (logManagerActor) {
            logManagerActor.receive({
              type: 'log',
              data: {
                level: 'error',
                message: `[Browser Error] ${error.message}`,
                timestamp: new Date().toISOString(),
                source: 'browser'
              },
              source: 'browser-error'
            }).catch(err => console.error('[SimplifiedTools] Failed to log browser error:', err));
          }
        });
        
        // Navigate to URL
        await page.goto(finalUrl, { waitUntil: 'networkidle2' });
        
        // Store browser and page references
        if (!monitor.activeBrowsers) {
          monitor.activeBrowsers = new Map();
        }
        
        const browserId = `browser-${session_id}`;
        monitor.activeBrowsers.set(browserId, {
          browser,
          page,
          url: finalUrl,
          startTime: new Date()
        });
        
        console.log(`[SimplifiedTools] Browser opened and page loaded for session ${session_id}`);
        
        return {
          content: [{
            type: 'text',
            text: `✅ Browser opened successfully!\n` +
                  `📊 Session: ${session_id}\n` +
                  `🌐 URL: ${finalUrl}\n` +
                  `👁️  Mode: ${headless ? 'Headless' : 'Visible'}\n` +
                  `📐 Viewport: ${viewport.width}x${viewport.height}\n` +
                  `🔍 Console & error monitoring enabled\n\n` +
                  `💡 You can now take screenshots, record videos, or interact with the page.`
          }]
        };
        
      } catch (error) {
        console.error(`[SimplifiedTools] Failed to open browser:`, error);
        return {
          content: [{
            type: 'text',
            text: `❌ Browser launch failed: ${error.message}`
          }],
          isError: true
        };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to open page: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Execute Puppeteer commands directly on the browser page
   */
  async browserExecute(args) {
    try {
      const { 
        command,
        args: commandArgs = [],
        session_id = 'default'
      } = args;
      
      // Validate command is provided
      if (!command) {
        return {
          content: [{
            type: 'text',
            text: `❌ No command provided. Specify a Puppeteer page method like "click", "type", "goto", etc.`
          }],
          isError: true
        };
      }
      
      // Get the monitor for the session
      let monitor;
      try {
        monitor = this.sessionManager.getCurrentMonitor(session_id);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ No active session: ${session_id}. Start a server and open a page first.`
          }],
          isError: true
        };
      }
      
      // Check if browser exists
      if (!monitor.activeBrowsers || monitor.activeBrowsers.size === 0) {
        return {
          content: [{
            type: 'text',
            text: `❌ No browser open for session: ${session_id}. Use 'open_page' to open a browser first.`
          }],
          isError: true
        };
      }
      
      // Get the page object
      const browserEntry = Array.from(monitor.activeBrowsers.values())[0];
      const page = browserEntry.page;
      
      // Check if the command exists on the page object
      if (typeof page[command] !== 'function') {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid command: "${command}" is not a valid Puppeteer page method.\n` +
                  `💡 Common commands: click, type, goto, evaluate, screenshot, title, url, content, waitForSelector\n` +
                  `📚 See https://pptr.dev/api/puppeteer.page for full API reference.`
          }],
          isError: true
        };
      }
      
      console.log(`[browserExecute] Executing: page.${command}(${commandArgs.map(a => JSON.stringify(a)).join(', ')})`);
      
      // Execute the command
      let result;
      const startTime = Date.now();
      
      try {
        // Special handling for certain commands that need specific processing
        if (command === 'evaluate' || command === 'evaluateHandle') {
          // For evaluate, the first arg should be a function string or actual function
          // If it's a string, we need to convert it to a function
          if (commandArgs.length > 0 && typeof commandArgs[0] === 'string') {
            // Create a function from the string
            const funcStr = commandArgs[0];
            const func = new Function('return ' + funcStr)();
            result = await page[command](func, ...commandArgs.slice(1));
          } else {
            result = await page[command](...commandArgs);
          }
        } else {
          // Execute the command normally
          result = await page[command](...commandArgs);
        }
        
        const duration = Date.now() - startTime;
        
        // Format the result based on type
        let resultText = '';
        
        if (result === undefined) {
          resultText = 'Command executed successfully (no return value)';
        } else if (result === null) {
          resultText = 'Command returned: null';
        } else if (typeof result === 'boolean') {
          resultText = `Command returned: ${result}`;
        } else if (typeof result === 'string') {
          resultText = `Command returned: "${result}"`;
        } else if (typeof result === 'number') {
          resultText = `Command returned: ${result}`;
        } else if (Buffer.isBuffer(result)) {
          // For screenshot/pdf commands that return buffers
          resultText = `Command returned: Buffer (${result.length} bytes)`;
        } else if (Array.isArray(result)) {
          resultText = `Command returned array with ${result.length} items:\n${JSON.stringify(result, null, 2)}`;
        } else if (typeof result === 'object') {
          // Try to stringify the object
          try {
            const formatted = JSON.stringify(result, null, 2);
            if (formatted.length > 1000) {
              resultText = `Command returned object:\n${formatted.substring(0, 1000)}...\n(truncated)`;
            } else {
              resultText = `Command returned object:\n${formatted}`;
            }
          } catch (e) {
            resultText = `Command returned: [Complex Object]`;
          }
        } else {
          resultText = `Command returned: ${String(result)}`;
        }
        
        return {
          content: [{
            type: 'text',
            text: `✅ Executed: page.${command}(${commandArgs.map(a => JSON.stringify(a)).join(', ')})\n` +
                  `⏱️  Duration: ${duration}ms\n` +
                  `📊 Session: ${session_id}\n` +
                  `📋 Result: ${resultText}`
          }]
        };
        
      } catch (error) {
        // Provide helpful error messages
        let errorHelp = '';
        
        if (error.message.includes('No element found for selector')) {
          errorHelp = '\n💡 Tip: Make sure the selector exists on the page. Try using page.content() to see the HTML.';
        } else if (error.message.includes('Timeout') || error.message.includes('waiting')) {
          errorHelp = '\n💡 Tip: The element might not be visible yet. Try waitForSelector first or increase timeout.';
        } else if (error.message.includes('Navigation')) {
          errorHelp = '\n💡 Tip: For navigation, use goto with waitUntil options like "networkidle2".';
        } else if (error.message.includes('Evaluation failed')) {
          errorHelp = '\n💡 Tip: Check your evaluate function syntax. It should be a valid JavaScript function.';
        }
        
        return {
          content: [{
            type: 'text',
            text: `❌ Command failed: page.${command}(${commandArgs.map(a => JSON.stringify(a)).join(', ')})\n` +
                  `🔴 Error: ${error.message}${errorHelp}\n` +
                  `📊 Session: ${session_id}`
          }],
          isError: true
        };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Browser execute failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Query logs with Sidewinder events
   */
  async queryLogs(args) {
    try {
      const { 
        query, 
        request_id,
        level = 'info',
        include_system = true,
        last,
        limit = 100,
        session_id = 'default' 
      } = args;
      
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Get both application logs and Sidewinder events
      const results = [];
      
      // Get application logs from LogManagerActor
      const actorSpace = this.sessionManager.actorSpaces?.get(session_id);
      const logManagerActor = actorSpace?.actors?.logManager;
      
      if (logManagerActor) {
        let appLogs;
        
        // Use different methods based on whether we have a query
        if (query && query.trim()) {
          // Search for specific query
          appLogs = await logManagerActor.receive({
            type: 'search-logs',
            data: { query: query.trim(), limit }
          });
          
          if (appLogs && appLogs.success && appLogs.logs) {
            appLogs.logs.forEach(log => {
              if (this.shouldIncludeLogLevel(log.level || 'info', level)) {
                results.push({
                  timestamp: log.timestamp,
                  type: 'app',
                  level: log.level || 'info',
                  message: log.message,
                  source: log.source || 'console'
                });
              }
            });
          }
        } else {
          // Get all session logs
          appLogs = await logManagerActor.receive({
            type: 'get-session-logs',
            data: { limit, level }
          });
          
          if (appLogs && appLogs.success && appLogs.logs) {
            appLogs.logs.forEach(log => {
              if (this.shouldIncludeLogLevel(log.level || 'info', level)) {
                results.push({
                  timestamp: log.timestamp,
                  type: 'app',
                  level: log.level || 'info',
                  message: log.message,
                  source: log.source || 'console'
                });
              }
            });
          }
        }
      }
      
      // Get Sidewinder events if available and requested
      if (include_system) {
        const sidewinderEvents = this.sessionManager.getSidewinderEvents(session_id);
        
        sidewinderEvents.forEach(event => {
          // Filter by request_id if specified
          if (request_id && event.requestId !== request_id) {
            return;
          }
          
          // Filter by query if specified
          if (query && !this.eventMatchesQuery(event, query)) {
            return;
          }
          
          // Format Sidewinder event as log entry
          const logEntry = this.formatSidewinderEvent(event);
          if (this.shouldIncludeLogLevel(logEntry.level, level)) {
            results.push(logEntry);
          }
        });
      }
      
      // Sort by timestamp
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Apply time range filter if specified
      if (last) {
        const cutoff = this.parseTimeRange(last);
        const filtered = results.filter(log => 
          new Date(log.timestamp) > cutoff
        );
        results.length = 0;
        results.push(...filtered);
      }
      
      // Limit results
      if (results.length > limit) {
        results.length = limit;
      }
      
      // Format for display
      const formatted = results.map(log => {
        const prefix = log.type === 'app' ? '' : '[sidewinder] ';
        const level = log.level ? `[${log.level.toUpperCase()}] ` : '';
        return `${log.timestamp} ${level}${prefix}${log.message}`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: formatted || 'No logs found matching criteria'
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error querying logs: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Set log level dynamically
   */
  async setLogLevel(args) {
    try {
      const { level, session_id = 'default' } = args;
      
      // Update session log level
      this.sessionManager.setLogLevel(session_id, level);
      
      // Send command to Sidewinder if connected
      const sidewinderServer = this.sessionManager.getSidewinderServer();
      if (sidewinderServer) {
        sidewinderServer.broadcast({
          type: 'setLogLevel',
          level,
          sessionId: session_id
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Log level set to: ${level}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to set log level: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Stop application
   */
  async stopApp(args) {
    try {
      const { session_id = 'default' } = args;
      
      // Kill the spawned process if it exists using SessionManager
      await this.sessionManager.killProcess(session_id);
      
      // Close browser if it exists
      const monitor = this.sessionManager.monitors.get(session_id);
      if (monitor && monitor.activeBrowsers) {
        for (const [browserId, browserEntry] of monitor.activeBrowsers) {
          try {
            if (browserEntry.browser) {
              await browserEntry.browser.close();
              console.log(`[SimplifiedTools] Closed browser for session ${session_id}`);
            }
          } catch (error) {
            console.error(`[SimplifiedTools] Error closing browser:`, error);
          }
        }
        monitor.activeBrowsers.clear();
      }
      
      // End session (ports are released by killProcess in SessionManager)
      await this.sessionManager.endSession(session_id);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Stopped app and cleaned up session: ${session_id}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to stop app: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * List active sessions
   */
  async listSessions() {
    try {
      const sessions = this.sessionManager.getActiveSessions();
      
      if (sessions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No active sessions'
          }]
        };
      }
      
      const formatted = sessions.map(s => 
        `• ${s.id} (started: ${s.startTime})`
      ).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `Active sessions:\n${formatted}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to list sessions: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Take screenshot of current page
   */
  async takeScreenshot(args) {
    try {
      const { 
        session_id = 'default',
        format = 'png',
        quality = 90,
        fullPage = true,
        path,
        clip
      } = args;
      
      // Try to get the monitor for the session
      let monitor;
      try {
        monitor = this.sessionManager.getCurrentMonitor(session_id);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ No active monitoring session: ${session_id}. Start an app first with start_app.`
          }],
          isError: true
        };
      }
      
      // Get the active browser page
      if (!monitor.activeBrowsers || monitor.activeBrowsers.size === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ No active browser found. Start an app with browser_url parameter to enable screenshots.'
          }],
          isError: true
        };
      }
      
      // Get the first active browser page
      const browserEntry = Array.from(monitor.activeBrowsers.values())[0];
      const page = browserEntry.page;
      
      // Build screenshot options
      const screenshotOptions = {
        type: format,
        fullPage,
        ...(format !== 'png' && { quality }),
        ...(clip && { clip }),
        ...(path && { path })
      };
      
      // Take screenshot
      const screenshot = await page.screenshot(screenshotOptions);
      
      // Generate filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path || `screenshot-${timestamp}.${format}`;
      
      if (path) {
        return {
          content: [{
            type: 'text',
            text: `✅ Screenshot saved to: ${path}\n` +
                  `📐 Format: ${format.toUpperCase()}\n` +
                  `📄 Full page: ${fullPage}\n` +
                  (format !== 'png' ? `🎨 Quality: ${quality}%\n` : '') +
                  (clip ? `✂️  Clipped: ${clip.width}x${clip.height} at (${clip.x}, ${clip.y})\n` : '') +
                  `📊 Session: ${session_id}`
          }]
        };
      } else {
        // Return as base64 - ensure proper Buffer handling
        let base64;
        try {
          // Ensure screenshot is a Buffer and convert to base64
          const buffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
          base64 = buffer.toString('base64');
          
          // Validate base64 string
          if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
            throw new Error('Invalid base64 conversion result');
          }
          
          // Additional validation for base64 format
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            throw new Error('Generated string is not valid base64');
          }
          
        } catch (error) {
          console.error('[ScreenshotTool] Base64 conversion failed:', error);
          return {
            content: [{
              type: 'text',
              text: `❌ Failed to convert screenshot to base64: ${error.message}\n` +
                    `Screenshot buffer type: ${typeof screenshot}\n` +
                    `Screenshot buffer length: ${screenshot?.length || 'unknown'}\n` +
                    `Try using the 'path' parameter to save to file instead.`
            }],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `✅ Screenshot captured\n` +
                    `📐 Format: ${format.toUpperCase()}\n` +
                    `📄 Full page: ${fullPage}\n` +
                    (format !== 'png' ? `🎨 Quality: ${quality}%\n` : '') +
                    (clip ? `✂️  Clipped: ${clip.width}x${clip.height} at (${clip.x}, ${clip.y})\n` : '') +
                    `📊 Session: ${session_id}\n` +
                    `💾 Size: ${Math.round(base64.length / 1024)} KB`
            },
            {
              type: 'image',
              data: base64,
              mimeType: `image/${format}`
            }
          ]
        };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Record video of browser interactions
   */
  async recordVideo(args) {
    try {
      const { 
        action,
        session_id = 'default',
        path,
        format = 'mp4',
        fps = 30,
        duration
      } = args;
      
      // Try to get the monitor for the session
      let monitor;
      try {
        monitor = this.sessionManager.getCurrentMonitor(session_id);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ No active monitoring session: ${session_id}. Start an app first with start_app.`
          }],
          isError: true
        };
      }
      
      // Get the active browser page
      if (!monitor.activeBrowsers || monitor.activeBrowsers.size === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ No active browser found. Start an app with browser_url parameter to enable screenshots.'
          }],
          isError: true
        };
      }
      
      // Get the first active browser page
      const browserEntry = Array.from(monitor.activeBrowsers.values())[0];
      const page = browserEntry.page;
      
      switch (action) {
        case 'start':
          if (page.isRecording && page.isRecording()) {
            return {
              content: [{
                type: 'text',
                text: '⚠️  Recording is already in progress. Stop current recording first.'
              }],
              isError: true
            };
          }
          
          // Generate filename if not provided
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const videoPath = path || `recording-${timestamp}.${format}`;
          
          const result = await page.startRecording({
            path: videoPath,
            format,
            fps
          });
          
          // Set up auto-stop if duration is specified
          if (duration) {
            setTimeout(async () => {
              try {
                if (page.isRecording && page.isRecording()) {
                  await page.stopRecording();
                  console.log(`Auto-stopped recording after ${duration} seconds`);
                }
              } catch (error) {
                console.error('Error auto-stopping recording:', error);
              }
            }, duration * 1000);
          }
          
          return {
            content: [{
              type: 'text',
              text: `🎬 Recording started!\n` +
                    `📹 Output: ${videoPath}\n` +
                    `📐 Format: ${format.toUpperCase()}\n` +
                    `🎭 FPS: ${fps}\n` +
                    (duration ? `⏱️  Auto-stop: ${duration} seconds\n` : '') +
                    `📊 Session: ${session_id}\n\n` +
                    `Use record_video with action='stop' to stop recording.`
            }]
          };
          
        case 'stop':
          if (!page.isRecording || !page.isRecording()) {
            return {
              content: [{
                type: 'text',
                text: '⚠️  No recording in progress.'
              }],
              isError: true
            };
          }
          
          const stopResult = await page.stopRecording();
          const durationMs = stopResult.duration;
          const durationSec = Math.round(durationMs / 1000 * 100) / 100;
          
          return {
            content: [{
              type: 'text',
              text: `🛑 Recording stopped!\n` +
                    `📹 Saved to: ${stopResult.path}\n` +
                    `⏱️  Duration: ${durationSec} seconds\n` +
                    `📊 Session: ${session_id}\n` +
                    `🎬 Started: ${stopResult.startTime.toISOString()}\n` +
                    `🏁 Ended: ${stopResult.endTime.toISOString()}`
            }]
          };
          
        case 'status':
          const isRecording = page.isRecording && page.isRecording();
          
          if (isRecording) {
            return {
              content: [{
                type: 'text',
                text: `🎬 Recording is active\n` +
                      `📊 Session: ${session_id}\n` +
                      `⏱️  Status: Recording in progress...`
              }]
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: `⏹️  No active recording\n` +
                      `📊 Session: ${session_id}\n` +
                      `💡 Use record_video with action='start' to begin recording.`
              }]
            };
          }
          
        default:
          return {
            content: [{
              type: 'text',
              text: `❌ Unknown action: ${action}. Use 'start', 'stop', or 'status'.`
            }],
            isError: true
          };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Video recording failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  // Helper methods
  
  mapLogLevelToProfile(level) {
    switch (level) {
      case 'error':
        return 'minimal';  // Just errors
      case 'warn':
        return 'minimal';  // Errors and warnings
      case 'info':
        return 'standard'; // + HTTP requests
      case 'debug':
        return 'standard'; // + More details
      case 'trace':
        return 'full';     // Everything
      default:
        return 'standard';
    }
  }
  
  shouldIncludeLogLevel(logLevel, minLevel) {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const logIndex = levels.indexOf(logLevel.toLowerCase());
    const minIndex = levels.indexOf(minLevel.toLowerCase());
    return logIndex <= minIndex;
  }
  
  formatSidewinderEvent(event) {
    let message = '';
    let level = 'info';
    
    switch (event.type) {
      case 'http':
        if (event.subtype === 'requestStart') {
          message = `HTTP ${event.request.method} ${event.request.host}${event.request.path} [pending]`;
        } else if (event.subtype === 'response') {
          message = `HTTP ${event.response.statusCode} [${event.response.duration}ms]`;
        }
        break;
        
      case 'console':
        message = `console.${event.method}: ${event.args.join(' ')}`;
        level = event.method === 'error' ? 'error' : 
                event.method === 'warn' ? 'warn' : 'info';
        break;
        
      case 'error':
        message = `${event.subtype}: ${event.error.message}`;
        level = 'error';
        break;
        
      case 'async':
        if (event.subtype === 'contextCreated') {
          message = `Request context: ${event.requestId} - ${event.method} ${event.url}`;
        }
        break;
        
      default:
        message = `${event.type}: ${JSON.stringify(event)}`;
    }
    
    return {
      timestamp: new Date(event.timestamp).toISOString(),
      type: 'system',
      level,
      message,
      requestId: event.requestId
    };
  }
  
  eventMatchesQuery(event, query) {
    const eventStr = JSON.stringify(event).toLowerCase();
    return eventStr.includes(query.toLowerCase());
  }
  
  parseTimeRange(range) {
    const match = range.match(/^(\d+)([mhd])$/);
    if (!match) {
      return new Date(0); // Include all if invalid
    }
    
    const [, num, unit] = match;
    const ms = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    }[unit];
    
    return new Date(Date.now() - (parseInt(num) * ms));
  }
  
  /**
   * Intelligent server startup detection using multiple signals
   * Uses Sidewinder lifecycle events, process monitoring, and port checking
   */
  async waitForServerReady(process, expectedPort, session_id, timeout = 30000) {
    return new Promise((resolve) => {
      let resolved = false;
      const startTime = Date.now();
      let collectedOutput = '';
      let collectedErrors = '';
      
      // Detection state
      const state = {
        processRunning: true,
        sidewinderConnected: false,
        serverCreated: false,
        serverListening: false,
        portVerified: false,
        hasError: false,
        errorMessage: null
      };
      
      // Declare interval variables before cleanup function
      let timeoutId;
      let sidewinderTimeoutId;
      let portCheckInterval;
      
      let cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (sidewinderTimeoutId) clearTimeout(sidewinderTimeoutId);
        if (portCheckInterval) clearInterval(portCheckInterval);
        process.stdout?.removeListener('data', onStdout);
        process.stderr?.removeListener('data', onStderr);
      };
      
      const resolveWith = (success, reason) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        console.log(`[SimplifiedTools] Server startup ${success ? 'succeeded' : 'failed'}: ${reason}`);
        resolve(success);
      };
      
      // Phase 1: Process and Sidewinder connection (0-5s)
      sidewinderTimeoutId = setTimeout(() => {
        if (!state.sidewinderConnected && !resolved) {
          console.warn(`[SimplifiedTools] Sidewinder not connected after 5s, proceeding with basic detection`);
        }
      }, 5000);
      
      // Phase 2: Overall timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          const diagnostic = this.generateStartupDiagnostic(state, collectedOutput, collectedErrors);
          resolveWith(false, `Timeout after ${timeout}ms. ${diagnostic}`);
        }
      }, timeout);
      
      // Monitor process exit
      const onProcessExit = (code, signal) => {
        state.processRunning = false;
        const reason = signal ? `Process killed with signal ${signal}` : `Process exited with code ${code}`;
        resolveWith(false, reason);
      };
      process.once('exit', onProcessExit);
      process.once('error', (err) => {
        state.hasError = true;
        state.errorMessage = err.message;
        resolveWith(false, `Process error: ${err.message}`);
      });
      
      // Monitor stdout for application logs and error patterns
      const onStdout = (data) => {
        const output = data.toString();
        collectedOutput += output;
        
        // Look for common error patterns
        if (this.containsStartupError(output)) {
          state.hasError = true;
          state.errorMessage = output.trim();
          resolveWith(false, `Application error detected: ${output.trim()}`);
          return;
        }
        
        // Look for traditional "listening" patterns as fallback
        const listeningRegex = /(?:listening|started|ready).*(?:port|:)\s*(\d+)/i;
        const match = output.match(listeningRegex);
        if (match && parseInt(match[1]) === expectedPort) {
          state.serverListening = true;
          this.checkFinalReadiness(state, expectedPort, resolveWith);
        }
      };
      
      const onStderr = (data) => {
        const errorOutput = data.toString();
        collectedErrors += errorOutput;
        
        // Check for binding errors specifically
        if (errorOutput.includes('EADDRINUSE') || errorOutput.includes('address already in use')) {
          resolveWith(false, `Port ${expectedPort} already in use`);
        } else if (errorOutput.includes('EACCES') || errorOutput.includes('permission denied')) {
          resolveWith(false, `Permission denied binding to port ${expectedPort}`);
        }
      };
      
      process.stdout?.on('data', onStdout);
      process.stderr?.on('data', onStderr);
      
      // Monitor Sidewinder events if available
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const actorSpace = this.sessionManager.actorSpaces?.get(session_id);
      
      if (actorSpace && actorSpace.actors?.logManager) {
        // Set up Sidewinder event listener
        const logManager = actorSpace.actors.logManager;
        
        const sidewinderEventHandler = (message) => {
          if (message.type === 'sidewinder-event') {
            this.handleSidewinderLifecycleEvent(message.data, state, expectedPort, resolveWith);
          }
        };
        
        // Listen for Sidewinder events
        logManager.on?.('sidewinder-event', sidewinderEventHandler);
        
        // Cleanup function should remove this listener too
        const originalCleanup = cleanup;
        cleanup = () => {
          originalCleanup();
          logManager.off?.('sidewinder-event', sidewinderEventHandler);
        };
      }
      
      // Periodic port checking as final verification
      let portCheckAttempts = 0;
      const maxPortCheckAttempts = 10;
      portCheckInterval = setInterval(async () => {
        portCheckAttempts++;
        
        try {
          const isListening = await portManager.isPortListening(expectedPort);
          if (isListening) {
            state.portVerified = true;
            this.checkFinalReadiness(state, expectedPort, resolveWith);
          } else if (portCheckAttempts >= maxPortCheckAttempts) {
            if (!state.hasError && !resolved) {
              resolveWith(false, `Port ${expectedPort} not listening after ${maxPortCheckAttempts} checks`);
            }
          }
        } catch (err) {
          console.warn(`[SimplifiedTools] Port check failed: ${err.message}`);
        }
      }, 1000);
    });
  }
  
  /**
   * Handle Sidewinder lifecycle events to update detection state
   */
  handleSidewinderLifecycleEvent(event, state, expectedPort, resolveWith) {
    console.log(`[SimplifiedTools] Sidewinder event: ${event.type}/${event.event}`);
    
    switch (event.type) {
      case 'processStart':
        state.sidewinderConnected = true;
        console.log('[SimplifiedTools] ✅ Sidewinder connected - monitoring active');
        break;
        
      case 'server-lifecycle':
        switch (event.event) {
          case 'http-server-created':
          case 'https-server-created':
            state.serverCreated = true;
            console.log('[SimplifiedTools] ✅ Server created');
            break;
            
          case 'server-listening':
            if (event.port === expectedPort) {
              state.serverListening = true;
              console.log(`[SimplifiedTools] ✅ Server listening on port ${expectedPort}`);
              this.checkFinalReadiness(state, expectedPort, resolveWith);
            }
            break;
            
          case 'server-error':
          case 'server-creation-error':
          case 'server-listen-error':
            state.hasError = true;
            state.errorMessage = event.error?.message || 'Unknown server error';
            resolveWith(false, `Server lifecycle error: ${state.errorMessage}`);
            break;
        }
        break;
        
      case 'sidewinder-init-error':
        console.warn('[SimplifiedTools] ⚠️ Sidewinder init error, falling back to basic detection');
        break;
        
      case 'uncaughtException':
      case 'unhandledRejection':
        state.hasError = true;
        state.errorMessage = event.error?.message || event.reason || 'Application error';
        resolveWith(false, `Application error: ${state.errorMessage}`);
        break;
    }
  }
  
  /**
   * Check if all conditions are met for server readiness
   */
  checkFinalReadiness(state, expectedPort, resolveWith) {
    // Require either Sidewinder confirmation OR port verification + logs
    const sidewinderConfirmed = state.sidewinderConnected && state.serverListening;
    const basicConfirmed = state.portVerified;
    
    if (sidewinderConfirmed) {
      resolveWith(true, 'Server confirmed ready via Sidewinder lifecycle events');
    } else if (basicConfirmed) {
      resolveWith(true, `Port ${expectedPort} verified listening`);
    }
    // Otherwise keep waiting for more signals
  }
  
  /**
   * Check if output contains startup error patterns
   */
  containsStartupError(output) {
    const errorPatterns = [
      /Error:/,
      /Cannot find module/,
      /SyntaxError:/,
      /ReferenceError:/,
      /TypeError:.*at startup/,
      /ENOENT.*no such file/,
      /MODULE_NOT_FOUND/,
      /Failed to start/i,
      /Startup failed/i,
      /Unable to start/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(output));
  }
  
  /**
   * Generate diagnostic information for failed startups
   */
  generateStartupDiagnostic(state, stdout, stderr) {
    const diagnostics = [];
    
    if (!state.processRunning) {
      diagnostics.push('Process exited early');
    }
    
    if (!state.sidewinderConnected) {
      diagnostics.push('Sidewinder not connected (monitoring may be disabled)');
    }
    
    if (state.hasError) {
      diagnostics.push(`Error detected: ${state.errorMessage}`);
    }
    
    if (!state.serverCreated && state.sidewinderConnected) {
      diagnostics.push('No server creation detected');
    }
    
    if (stdout.trim()) {
      diagnostics.push(`Stdout: ${stdout.trim().substring(0, 200)}...`);
    }
    
    if (stderr.trim()) {
      diagnostics.push(`Stderr: ${stderr.trim().substring(0, 200)}...`);
    }
    
    return diagnostics.join('; ');
  }

  /**
   * Check if a port is open (legacy method)
   */
  checkPort(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }
  
  /**
   * Cleanup method for ToolHandler integration
   */
  async cleanup() {
    // SimplifiedTools cleanup - all process management is now in SessionManager
    console.log('[SimplifiedTools] Cleanup called');
  }

  /**
   * Set up log capture from process stdout/stderr
   */
  async setupLogCapture(appProcess, sessionId, monitor) {
    const processId = `${sessionId}-process`;
    
    // Get the LogManagerActor from the monitor
    const actorSpace = this.sessionManager.actorSpaces?.get(sessionId);
    const logManagerActor = actorSpace?.actors?.logManager;
    
    if (!logManagerActor) {
      console.warn(`[SimplifiedTools] No LogManagerActor found for session ${sessionId}`);
      return;
    }
    
    // Set up stdout capture
    if (appProcess.stdout) {
      appProcess.stdout.setEncoding('utf8');
      appProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.processLogLine(line, 'info', 'stdout', processId, logManagerActor);
        });
      });
    }
    
    // Set up stderr capture
    if (appProcess.stderr) {
      appProcess.stderr.setEncoding('utf8');
      appProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.processLogLine(line, 'error', 'stderr', processId, logManagerActor);
        });
      });
    }
    
    // Register the process with the LogManagerActor
    await logManagerActor.receive({
      type: 'add-process',
      data: {
        processId,
        name: `App Process (PID: ${appProcess.pid})`,
        type: 'backend',
        script: 'spawned-app'
      }
    });
    
    console.log(`[SimplifiedTools] Log capture set up for process ${appProcess.pid} in session ${sessionId}`);
  }
  
  /**
   * Process and parse a log line from stdout/stderr
   */
  processLogLine(line, defaultLevel, source, processId, logManagerActor) {
    // Extract log level from common patterns
    let level = defaultLevel;
    const levelMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG|TRACE)\]/i);
    if (levelMatch) {
      level = levelMatch[1].toLowerCase();
    }
    
    // Extract timestamp if present
    let timestamp = new Date().toISOString();
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
    if (timestampMatch) {
      timestamp = timestampMatch[1];
    }
    
    // Send log to LogManagerActor
    logManagerActor.receive({
      type: 'log',
      data: {
        level,
        message: line,
        timestamp,
        processId,
        source: source
      },
      source: 'process-capture'
    }).catch(error => {
      console.error('[SimplifiedTools] Failed to send log to LogManagerActor:', error);
    });
  }

  /**
   * Cleanup method to terminate all spawned processes
   */
  async cleanup() {
    // All process management is now handled by SessionManager
    console.log('[SimplifiedTools] Cleanup complete - SessionManager handles all process cleanup');
  }
}