export class SimpleToolHandler {
  constructor(sessionManager, logger = null) {
    this.sessionManager = sessionManager;
    this.logger = logger || console;  // Use provided logger or console
    this.pictureAnalysisTool = null;  // Legion Picture Analysis tool
  }
  
  setPictureAnalysisTool(pictureAnalysisTool) {
    this.logger.info('Setting Picture Analysis tool in handler', { hasPictureTool: !!pictureAnalysisTool });
    this.pictureAnalysisTool = pictureAnalysisTool;
  }
  
  getAllTools() {
    const tools = [
      { 
        name: 'start_app', 
        description: 'Start monitoring a backend application. Injects Sidewinder agent to capture console logs, errors, server lifecycle events, and process information. Supports Node.js scripts, npm/yarn commands, and TypeScript files. Session ID isolates monitoring from other sessions.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            script: { type: 'string', description: 'Path to script file or npm package directory to monitor' }, 
            session_id: { type: 'string', description: 'Unique session identifier for isolating this monitoring session' }, 
            wait_for_port: { type: 'number', description: 'Optional port number to wait for server startup (kills existing process on port first)' } 
          },
          required: ['script', 'session_id']
        } 
      },
      { 
        name: 'open_page', 
        description: 'Open and monitor a webpage in a browser session. Injects browser agent to capture console logs, network requests, errors, and user interactions. Each session_id creates an isolated monitoring context. Use data: URLs for custom HTML content.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            url: { type: 'string', description: 'Web URL (http://, https://) or data: URL with HTML content to open' }, 
            session_id: { type: 'string', description: 'Unique session identifier for isolating this browser session' }, 
            headless: { type: 'boolean', description: 'Optional: Run browser headlessly (true) or visibly (false, default)' } 
          },
          required: ['url', 'session_id']
        } 
      },
      { 
        name: 'query_logs', 
        description: 'Retrieve captured logs for a monitoring session. Returns logs from browser agents (console messages, network requests, errors) and backend agents (console output, server events) sorted by timestamp. Logs are session-scoped for isolation.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID to retrieve logs for' }, 
            limit: { type: 'number', description: 'Maximum number of recent logs to return (default: 25)' } 
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'take_screenshot', 
        description: 'Capture a screenshot of the current browser page for a session. Requires an active browser page opened with open_page. Returns base64-encoded image data or saves to file path if specified.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID with an active browser page' },
            fullPage: { type: 'boolean', description: 'Optional: Capture full page (true) or viewport only (false, default)' },
            path: { type: 'string', description: 'Optional: File path to save screenshot (if not provided, returns base64)' }
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'start_video', 
        description: 'Start recording video of the browser session. Records all browser activity including page interactions, animations, and updates. Video is saved in WebM format by default, or MP4 if ffmpeg is available and format is specified.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID with an active browser page' },
            output_path: { type: 'string', description: 'Optional: File path to save video (defaults to videos/recording-{timestamp}.webm)' },
            format: { type: 'string', description: 'Optional: Video format - webm or mp4 (default: webm, mp4 requires ffmpeg)' },
            fps: { type: 'number', description: 'Optional: Frames per second for recording (default: 30)' },
            quality: { type: 'number', description: 'Optional: Video quality 1-100 (default: 80)' },
            width: { type: 'number', description: 'Optional: Video width in pixels (default: 1280)' },
            height: { type: 'number', description: 'Optional: Video height in pixels (default: 720)' }
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'stop_video', 
        description: 'Stop video recording and save the video file. Returns the video file path and recording statistics including duration and frame count. If ffmpeg is not available, saves individual frames as images.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID with an active video recording' }
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'browser_execute', 
        description: 'Execute Puppeteer command formats on an active page. All standard Puppeteer page methods are available. Common examples: "title" (get page title), "url" (get current URL), "click" (click element, args: [selector]), "type" (type text, args: [selector, text]), "evaluate" (run JavaScript, args: [function_string]). Requires active browser page from open_page.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            command: { type: 'string', description: 'Any standard Puppeteer page method (e.g., title, url, click, type, evaluate, waitForSelector, etc.)' }, 
            args: { type: 'array', description: 'Command arguments: [] for title/url, [selector] for click, [selector, text] for type, [js_code] for evaluate' }, 
            session_id: { type: 'string', description: 'Session ID with an active browser page' } 
          },
          required: ['command', 'session_id']
        } 
      },
      { 
        name: 'stop_app', 
        description: 'Stop all monitoring for a session. Terminates backend processes, closes browser pages, but keeps the session logs available for query_logs. Does not stop the monitoring server itself.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Optional: Session ID to stop (stops all sessions if not provided)' } 
          } 
        } 
      },
      { 
        name: 'list_sessions', 
        description: 'List all active monitoring sessions and their status. Shows session IDs, active components (browser/backend), number of pages, and uptime information.', 
        inputSchema: { 
          type: 'object', 
          properties: {},
          additionalProperties: false
        } 
      }
    ];
    
    // Add Picture Analysis tool - availability is checked at execution time
    tools.push({
      name: 'analyse_picture',
      description: `Analyze images using advanced AI vision models to extract detailed descriptions, identify objects, read text, and understand visual content.

This tool provides powerful image analysis capabilities:
• SUPPORTED FORMATS: PNG, JPG, JPEG, GIF, WebP - handles all common image formats
• VISION CAPABILITIES: Object detection, scene understanding, text extraction (OCR), color analysis, spatial relationships, and detailed descriptions
• FLEXIBLE PATHS: Accepts both absolute and relative file paths to images on the local filesystem
• AI PROVIDERS: Uses Claude (Anthropic) or GPT-4 Vision (OpenAI) based on available API keys

The tool processes images by:
1. Reading the image file from disk
2. Validating format and size (max 20MB)
3. Encoding to base64
4. Sending to vision AI model
5. Returning detailed analysis

Perfect for:
- Understanding screenshot contents
- Extracting text from images
- Identifying UI elements in app screenshots
- Analyzing diagrams and charts
- Debugging visual issues
- Documenting visual states

Examples:
- Describe screenshot: file_path="/tmp/screenshot.png", prompt="What errors or warnings do you see in this console output?"
- Extract text: file_path="./diagram.jpg", prompt="What text and labels are visible in this diagram?"
- Analyze UI: file_path="/Users/me/app-screenshot.png", prompt="Describe the layout and components visible in this UI"`,
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the image file to analyze (absolute or relative)'
          },
          prompt: {
            type: 'string',
            description: 'Specific question or analysis request for the image (10-2000 characters)'
          }
        },
        required: ['file_path', 'prompt']
      }
    });
    
    return tools;
  }
  
  async executeTool(toolName, args) {
    try {
      this.logger.info(`Executing tool: ${toolName}`, { tool: toolName, args });
      
      // Get THE single monitor instance (created at startup)
      const monitor = await this.sessionManager.getMonitor();
      
      this.logger.debug(`Got monitor instance`);
      
      switch (toolName) {
        case 'start_app':
          // Just call the simple method on the monitor
          return await monitor.startApp(args.script, args);
          
        case 'open_page':
          // Just call the simple method on the monitor
          return await monitor.openPage(args.url, args.session_id || 'default', args);
          
        case 'query_logs':
          // Just call the simple method on the monitor
          return await monitor.getLogs(args.limit);
          
        case 'take_screenshot':
          return await monitor.screenshot(args.session_id || 'default', args);
          
        case 'start_video':
          // Map the tool args to the FullStackMonitor method parameters
          const videoOptions = {
            output_path: args.output_path,
            format: args.format,
            fps: args.fps || 30,
            videoFrame: {
              width: args.width || 1280,
              height: args.height || 720
            }
          };
          return await monitor.startVideoRecording(args.session_id || 'default', videoOptions);
          
        case 'stop_video':
          return await monitor.stopVideoRecording(args.session_id || 'default');
          
        case 'browser_execute':
          return await monitor.browserCommand(args.session_id || 'default', args.command, args.args);
          
        case 'stop_app':
          return await monitor.stopApp();
          
        case 'list_sessions':
          const sessions = this.sessionManager.listSessions();
          return { content: [{ type: 'text', text: `${sessions.count} sessions` }] };
          
        case 'analyse_picture':
          // Execute Picture Analysis using Legion tool
          if (!this.pictureAnalysisTool) {
            throw new Error('Picture Analysis tool not available - check if ANTHROPIC_API_KEY or OPENAI_API_KEY is set in environment');
          }
          
          const pictureResult = await this.pictureAnalysisTool.execute({
            file_path: args.file_path,
            prompt: args.prompt
          });
          
          // Format result for MCP response
          if (pictureResult.success) {
            const { analysis, file_path, prompt, processing_time_ms } = pictureResult.data;
            
            let responseText = `🖼️ Image Analysis Complete\n\n`;
            responseText += `📁 File: ${file_path}\n`;
            responseText += `❓ Question: ${prompt}\n`;
            responseText += `⏱️ Processing time: ${processing_time_ms}ms\n\n`;
            responseText += `📝 Analysis:\n${analysis}`;
            
            return { content: [{ type: 'text', text: responseText }] };
          } else {
            // Handle errors with specific guidance
            const { errorCode, errorMessage, file_path } = pictureResult.data;
            let responseText = `❌ Image analysis failed\n\n`;
            responseText += `Error: ${errorMessage}\n`;
            responseText += `Code: ${errorCode}\n`;
            if (file_path) {
              responseText += `File: ${file_path}\n`;
            }
            
            // Add helpful suggestions based on error type
            if (errorCode === 'FILE_NOT_FOUND') {
              responseText += '\n💡 Tip: Check if the file path is correct and the file exists.';
            } else if (errorCode === 'UNSUPPORTED_FORMAT') {
              responseText += '\n💡 Tip: Supported formats are: PNG, JPG, JPEG, GIF, WebP';
            } else if (errorCode === 'FILE_TOO_LARGE') {
              responseText += '\n💡 Tip: Maximum file size is 20MB';
            } else if (errorCode === 'VALIDATION_ERROR') {
              responseText += '\n💡 Tip: Prompt must be between 10 and 2000 characters';
            }
            
            return { content: [{ type: 'text', text: responseText }] };
          }
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}`, { 
        tool: toolName,
        error: error.message,
        stack: error.stack 
      });
      return { content: [{ type: 'text', text: `❌ ${error.message}` }] };
    }
  }
}