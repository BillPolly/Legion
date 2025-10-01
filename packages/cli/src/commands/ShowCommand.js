/**
 * ShowCommand - Display a Handle with flexible rendering
 * Usage: /show <uri> [--format <format>] [--width <width>] [--height <height>] [--title <title>]
 */

import { BaseCommand } from './BaseCommand.js';

export class ShowCommand extends BaseCommand {
  constructor(displayEngine, resourceManager) {
    super(
      'show',
      'Display a Handle (browser or terminal)',
      'show <uri> [--format <format>] [--width <width>] [--height <height>] [--title <title>]'
    );

    this.displayEngine = displayEngine;
    this.resourceManager = resourceManager;
  }

  /**
   * Parse command arguments
   * @param {Array} args - Command arguments
   * @returns {Object} Parsed { uri, options }
   */
  parseArgs(args) {
    if (!args || args.length === 0) {
      throw new Error('URI is required. Usage: /show <uri>');
    }

    const uri = args[0];
    const options = {};

    // Parse options
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--format') {
        const format = args[++i];
        const validFormats = ['auto', 'browser', 'table', 'tree', 'json', 'summary'];
        if (!validFormats.includes(format)) {
          throw new Error(`Invalid format: ${format}. Must be one of: ${validFormats.join(', ')}`);
        }
        options.format = format;
      } else if (arg === '--width') {
        const width = parseInt(args[++i]);
        if (isNaN(width)) {
          throw new Error('Invalid width: must be a number');
        }
        options.width = width;
      } else if (arg === '--height') {
        const height = parseInt(args[++i]);
        if (isNaN(height)) {
          throw new Error('Invalid height: must be a number');
        }
        options.height = height;
      } else if (arg === '--title') {
        options.title = args[++i];
      }
    }

    return { uri, options };
  }

  /**
   * Execute the show command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Render result
   */
  async execute(args) {
    // Parse arguments
    const { uri, options } = this.parseArgs(args);

    // Get Handle - supports Legion URIs, HTTP/HTTPS URLs, and file:// URLs
    let handle;
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Create an ImageHandle for HTTP image URLs
      const { ImageHandle } = await import('@legion/showme/src/handles/ImageHandle.js');
      handle = new ImageHandle({
        id: `http-${Date.now()}`,
        title: options.title || uri,
        type: 'image/jpeg', // Default, actual type determined by browser
        data: uri, // Pass URL directly - browser will handle it
        width: 0,
        height: 0
      });

      // Set resourceType so DisplayEngine knows to use browser
      handle.resourceType = 'image';
    } else if (uri.startsWith('file://')) {
      // Handle file:// URLs by reading the file
      const fs = await import('fs/promises');
      const path = await import('path');

      // Extract file path from file:// URL
      const filePath = uri.replace('file://', '');

      // Determine file type from extension
      const ext = path.extname(filePath).toLowerCase();

      // Text file extensions with viewer types
      // viewerType: 'code' = syntax highlighted code, 'markup' = rendered preview, 'style' = CSS preview
      const textFileTypes = {
        // Code files
        '.js': { language: 'javascript', viewerType: 'code' },
        '.mjs': { language: 'javascript', viewerType: 'code' },
        '.cjs': { language: 'javascript', viewerType: 'code' },
        '.jsx': { language: 'javascript', viewerType: 'code' },
        '.ts': { language: 'typescript', viewerType: 'code' },
        '.tsx': { language: 'typescript', viewerType: 'code' },
        '.py': { language: 'python', viewerType: 'code' },
        '.java': { language: 'java', viewerType: 'code' },
        '.c': { language: 'c', viewerType: 'code' },
        '.cpp': { language: 'cpp', viewerType: 'code' },
        '.h': { language: 'c', viewerType: 'code' },
        '.hpp': { language: 'cpp', viewerType: 'code' },
        '.go': { language: 'go', viewerType: 'code' },
        '.rs': { language: 'rust', viewerType: 'code' },
        '.rb': { language: 'ruby', viewerType: 'code' },
        '.php': { language: 'php', viewerType: 'code' },
        '.swift': { language: 'swift', viewerType: 'code' },
        '.kt': { language: 'kotlin', viewerType: 'code' },
        '.scala': { language: 'scala', viewerType: 'code' },
        '.sh': { language: 'shell', viewerType: 'code' },
        '.bash': { language: 'shell', viewerType: 'code' },
        '.zsh': { language: 'shell', viewerType: 'code' },
        '.json': { language: 'json', viewerType: 'data' },
        '.yaml': { language: 'yaml', viewerType: 'code' },
        '.yml': { language: 'yaml', viewerType: 'code' },
        '.md': { language: 'markdown', viewerType: 'code' },
        '.sql': { language: 'sql', viewerType: 'code' },
        '.xml': { language: 'xml', viewerType: 'code' },

        // Markup files (rendered preview + code view)
        '.html': { language: 'html', viewerType: 'markup' },
        '.htm': { language: 'html', viewerType: 'markup' },
        '.svg': { language: 'svg', viewerType: 'markup' },

        // Style files (CSS preview + code view)
        '.css': { language: 'css', viewerType: 'style' }
      };

      // Image extensions
      const imageExtensions = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };

      if (textFileTypes[ext]) {
        // Handle as text file (code, markup, or style)
        const { TextFileHandle } = await import('@legion/showme/src/handles/TextFileHandle.js');
        const fileType = textFileTypes[ext];

        // Read file as text
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lineCount = fileContent.split('\n').length;

        handle = new TextFileHandle({
          id: `file-${Date.now()}`,
          title: options.title || path.basename(filePath),
          language: fileType.language,
          viewerType: fileType.viewerType,
          content: fileContent,
          lineCount: lineCount,
          filePath: filePath // Include file path for saving
        });

        handle.resourceType = fileType.viewerType; // 'code', 'markup', or 'style'
      } else if (imageExtensions[ext]) {
        // Handle as image file
        const { ImageHandle } = await import('@legion/showme/src/handles/ImageHandle.js');

        // Read file as binary
        const fileBuffer = await fs.readFile(filePath);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = imageExtensions[ext];

        // Create data URL
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        handle = new ImageHandle({
          id: `file-${Date.now()}`,
          title: options.title || path.basename(filePath),
          type: mimeType,
          data: dataUrl,
          width: 0,
          height: 0
        });

        handle.resourceType = 'image';
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } else {
      // Get Handle from ResourceManager for legion:// URIs
      handle = await this.resourceManager.createHandleFromURI(uri);
    }

    // Render Handle via DisplayEngine (unified interface)
    const result = await this.displayEngine.render(handle, options);

    // Format success message based on rendering mode
    let message;
    if (result.rendered === 'browser' && result.window) {
      message = `Displaying ${uri} in browser window ${result.window.id}`;
    } else if (result.rendered === 'terminal') {
      message = `Displayed ${uri} as ${result.format} in terminal`;
    } else {
      message = `Displayed ${uri}`;
    }

    return {
      success: result.success,
      message: message,
      window: result.window,
      format: result.format,
      rendered: result.rendered,
      handle: result.handle,
      assetData: result.assetData,
      title: result.title,
      assetType: result.assetType
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/show - Display a Handle (browser or terminal)

Usage:
  /show <uri> [options]

Arguments:
  <uri>          Legion Handle URI (e.g., legion://local/file/path/to/file.txt)

Options:
  --format <fmt> Display format: auto (default), browser, table, tree, json, summary
  --width <px>   Browser window width in pixels (default: 1000)
  --height <px>  Browser window height in pixels (default: 700)
  --title <text> Browser window title (default: Handle URI)

Format Options:
  auto     - Automatically choose browser or terminal (default)
  browser  - Force browser display
  table    - Display as table in terminal
  tree     - Display as tree in terminal
  json     - Display as JSON in terminal
  summary  - Display summary in terminal

Examples:
  /show legion://local/file/README.md
  /show legion://local/file/data.json --format json
  /show legion://local/strategy/MyStrategy.js --format table
  /show legion://local/image/photo.jpg --format browser --title "My Photo"
`;
  }
}

export default ShowCommand;