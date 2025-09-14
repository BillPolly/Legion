/**
 * StaticResourceProvider - Simple static resource provider without actor setup
 * Provides basic HTML with Legion import maps, no WebSocket connections
 */

import { ResourceProvider, ResourceResponse } from './ResourceProvider.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StaticResourceProvider extends ResourceProvider {
  constructor(options = {}) {
    super();
    this.options = {
      title: options.title || 'Legion Static App',
      htmlFile: options.htmlFile || null,         // Path to custom HTML file
      htmlContent: options.htmlContent || '',     // Additional HTML content for body
      includeImportMaps: options.includeImportMaps !== false, // Default true
      customImports: options.customImports || {},  // Additional import map entries
      ...options
    };
  }

  async getResource(path, req) {
    switch (path) {
      case '/':
        if (this.options.htmlFile) {
          // Serve custom HTML file
          return new ResourceResponse({
            type: 'text/html',
            file: this.options.htmlFile,
            cache: false
          });
        } else {
          // Generate static HTML with import maps
          return new ResourceResponse({
            type: 'text/html',
            content: this.generateStaticHTML(),
            cache: false
          });
        }

      case '/favicon.ico':
        return new ResourceResponse({
          type: 'image/x-icon',
          file: this.getDefaultFaviconPath(),
          cache: '1 year'
        });

      default:
        return null; // Not found
    }
  }

  generateStaticHTML() {
    const importMapsScript = this.options.includeImportMaps ? 
      this.generateImportMapsScript() : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.options.title}</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  ${importMapsScript}
  <style>
    body { 
      margin: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1a202c;
    }
    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .status-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      background: #4caf50;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="status-indicator">Static Server</div>
  <div class="app-container">
    <div id="app"></div>
    ${this.options.htmlContent}
  </div>
</body>
</html>`;
  }

  generateImportMapsScript() {
    const defaultImports = {
      "@legion/declarative-components": "/legion/declarative-components/index.js",
      "@legion/data-store": "/legion/data-store/index.js",
      "@legion/resource-manager": "/legion/resource-manager/index.js",
      "@legion/handle": "/legion/handle/index.js",
      "@legion/actors": "/legion/actors/index.js"
    };

    const allImports = { ...defaultImports, ...this.options.customImports };

    return `  <script type="importmap">
  {
    "imports": ${JSON.stringify(allImports, null, 6)}
  }
  </script>`;
  }

  getDefaultFaviconPath() {
    // Return path to default favicon in framework assets
    return path.join(__dirname, '../assets/favicon.ico');
  }

  async listResources() {
    const resources = ['/', '/favicon.ico'];
    return resources;
  }
}