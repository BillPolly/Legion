/**
 * LegionLoggerInjector - Express middleware for injecting frontend logging
 * 
 * This middleware automatically injects the Legion frontend logger into HTML responses,
 * enabling any webapp to capture console logs, errors, and performance data without
 * requiring manual integration.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LegionLoggerInjector {
  constructor(config = {}) {
    this.config = {
      // WebSocket URL for Aiur server
      wsUrl: config.wsUrl || 'ws://localhost:8080/ws',
      
      // Injection settings
      injectLocation: config.injectLocation || 'head', // 'head' or 'body'
      enableInProduction: config.enableInProduction !== undefined ? config.enableInProduction : false,
      enableInDevelopment: config.enableInDevelopment !== false,
      
      // Logger configuration
      loggerConfig: {
        batchSize: 25,
        batchInterval: 5000,
        maxBufferSize: 500,
        enableConsoleCapture: true,
        enableErrorCapture: true,
        enablePerformanceCapture: true,
        autoReconnect: true,
        ...config.loggerConfig
      },
      
      // Bundle settings
      bundlePath: config.bundlePath || '/legion-log-capture.js',
      bundleUrl: config.bundleUrl || null, // If served from CDN
      minify: config.minify !== false,
      
      // Session management
      generateSessionId: config.generateSessionId || this.defaultGenerateSessionId.bind(this),
      
      // Filtering
      skipRoutes: config.skipRoutes || ['/api/', '/health', '/status'],
      skipContentTypes: config.skipContentTypes || ['application/json', 'text/plain'],
      skipUserAgents: config.skipUserAgents || ['bot', 'spider', 'crawler'],
      
      ...config
    };
    
    this.loggerBundle = null;
    this.bundleLastModified = null;
  }
  
  /**
   * Create Express middleware function
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Check if injection should be skipped
        if (this.shouldSkipInjection(req)) {
          return next();
        }
        
        // Wrap res.send to inject logger
        const originalSend = res.send.bind(res);
        
        res.send = (body) => {
          // Only process HTML responses
          if (this.isHtmlResponse(res)) {
            body = this.injectLogger(body, req);
          }
          
          return originalSend(body);
        };
        
        next();
        
      } catch (error) {
        console.error('LegionLoggerInjector: Middleware error:', error);
        next();
      }
    };
  }
  
  /**
   * Create route handler for serving the logger bundle
   */
  bundleHandler() {
    return async (req, res) => {
      try {
        const bundle = await this.getLoggerBundle();
        
        res.set({
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600',
          'ETag': `"${this.bundleLastModified}"`,
          'Last-Modified': new Date(this.bundleLastModified).toUTCString()
        });
        
        // Check if client has cached version
        if (req.headers['if-none-match'] === `"${this.bundleLastModified}"`) {
          return res.status(304).end();
        }
        
        res.send(bundle);
        
      } catch (error) {
        console.error('LegionLoggerInjector: Bundle serve error:', error);
        res.status(500).send('// Legion Logger Bundle Error');
      }
    };
  }
  
  /**
   * Check if injection should be skipped
   */
  shouldSkipInjection(req) {
    // Environment check
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !this.config.enableInProduction) {
      return true;
    }
    if (!isProduction && !this.config.enableInDevelopment) {
      return true;
    }
    
    // Route filtering
    if (this.config.skipRoutes.some(route => req.path.startsWith(route))) {
      return true;
    }
    
    // User agent filtering
    const userAgent = req.headers['user-agent'] || '';
    if (this.config.skipUserAgents.some(pattern => userAgent.toLowerCase().includes(pattern))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if response is HTML
   */
  isHtmlResponse(res) {
    const contentType = res.get('Content-Type') || '';
    
    // Skip if already set to non-HTML
    if (this.config.skipContentTypes.some(type => contentType.includes(type))) {
      return false;
    }
    
    // Must be HTML content type
    return contentType.includes('text/html') || !res.get('Content-Type');
  }
  
  /**
   * Inject logger into HTML body
   */
  injectLogger(html, req) {
    if (typeof html !== 'string') {
      return html;
    }
    
    try {
      const sessionId = this.config.generateSessionId(req);
      const injectionScript = this.generateInjectionScript(sessionId, req);
      
      // Choose injection point
      const injectionPoint = this.config.injectLocation === 'head' ? '</head>' : '</body>';
      
      // Inject before the closing tag
      const injectedHtml = html.replace(injectionPoint, `${injectionScript}\n${injectionPoint}`);
      
      // If injection point wasn't found, try fallback
      if (injectedHtml === html) {
        // Try to inject before </html>
        return html.replace('</html>', `${injectionScript}\n</html>`);
      }
      
      return injectedHtml;
      
    } catch (error) {
      console.error('LegionLoggerInjector: Injection error:', error);
      return html; // Return original HTML on error
    }
  }
  
  /**
   * Generate the injection script
   */
  generateInjectionScript(sessionId, req) {
    const bundleUrl = this.config.bundleUrl || this.config.bundlePath;
    const loggerConfig = {
      ...this.config.loggerConfig,
      wsUrl: this.config.wsUrl,
      sessionId: sessionId
    };
    
    return `  <!-- Legion Frontend Logger -->
  <script>
    window.LEGION_CONFIG = ${JSON.stringify(loggerConfig)};
  </script>
  <script src="${bundleUrl}" async></script>`;
  }
  
  /**
   * Get or build the logger bundle
   */
  async getLoggerBundle() {
    try {
      // Check if we need to rebuild the bundle
      const bundlePath = this.getBundlePath();
      const stats = await fs.stat(bundlePath).catch(() => null);
      
      if (!stats || !this.loggerBundle || stats.mtime.getTime() !== this.bundleLastModified) {
        console.log('LegionLoggerInjector: Building logger bundle...');
        
        await this.buildLoggerBundle();
        this.bundleLastModified = stats ? stats.mtime.getTime() : Date.now();
      }
      
      return this.loggerBundle;
      
    } catch (error) {
      console.error('LegionLoggerInjector: Bundle build error:', error);
      
      // Return minimal error logger
      return this.getMinimalErrorLogger();
    }
  }
  
  /**
   * Build the logger bundle from source files
   */
  async buildLoggerBundle() {
    try {
      // For simplicity, we'll concatenate the files
      // In production, you'd use a proper bundler like webpack or rollup
      
      const loggerDir = path.resolve(__dirname, '../../apps/aiur-ui/src/logger');
      
      // Read source files
      const files = [
        'ConsoleHook.js',
        'ErrorCapture.js',
        'LogCaptureActor.js',
        'legion-frontend-logger.js'
      ];
      
      let bundle = '';
      
      // Add a simple module system for the browser
      bundle += `(function() {
        'use strict';
        
        // Simple module system
        const modules = {};
        const exports = {};
        
        function define(name, deps, factory) {
          const module = { exports: {} };
          const depValues = deps.map(dep => {
            if (dep === 'exports') return module.exports;
            if (dep === 'module') return module;
            return modules[dep] || window[dep];
          });
          
          factory.apply(null, depValues);
          modules[name] = module.exports;
        }
        
        // Load source files
      `;
      
      for (const file of files) {
        const filePath = path.join(loggerDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Simple ES6 to CommonJS conversion
        const transformed = this.transformESModules(content, file);
        bundle += `\n// === ${file} ===\n${transformed}\n`;
      }
      
      bundle += `
        // Auto-initialize if configured
        if (window.LEGION_CONFIG && window.LEGION_CONFIG.autoInit !== false) {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              window.LegionLogger.init(window.LEGION_CONFIG).catch(console.error);
            });
          } else {
            window.LegionLogger.init(window.LEGION_CONFIG).catch(console.error);
          }
        }
        
      })();`;
      
      // Minify if requested
      if (this.config.minify) {
        bundle = this.minifyBundle(bundle);
      }
      
      this.loggerBundle = bundle;
      console.log(`LegionLoggerInjector: Bundle built (${bundle.length} bytes)`);
      
    } catch (error) {
      console.error('LegionLoggerInjector: Bundle build failed:', error);
      this.loggerBundle = this.getMinimalErrorLogger();
    }
  }
  
  /**
   * Simple ES6 to browser-compatible transformation
   */
  transformESModules(content, filename) {
    // This is a very basic transformation
    // In production, use a proper transpiler like Babel
    
    // Remove imports (we'll handle dependencies manually)
    content = content.replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?\s*/g, '');
    content = content.replace(/import\s+['"][^'"]+['"];?\s*/g, '');
    
    // Convert export class to window assignment
    content = content.replace(/export\s+class\s+(\w+)/g, 'window.$1 = class $1');
    content = content.replace(/export\s+default\s+(\w+)/g, 'window.$1 = $1');
    content = content.replace(/export\s*\{([^}]+)\}/g, (match, exports) => {
      const exportNames = exports.split(',').map(e => e.trim());
      return exportNames.map(name => `window.${name} = ${name};`).join('\n');
    });
    
    return content;
  }
  
  /**
   * Simple bundle minification
   */
  minifyBundle(bundle) {
    // Very basic minification
    return bundle
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Compress whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .trim();
  }
  
  /**
   * Get minimal error logger for fallback
   */
  getMinimalErrorLogger() {
    return `
      // Minimal Legion Logger Fallback
      (function() {
        window.LegionLogger = {
          init: function(config) {
            console.log('Legion Logger: Minimal fallback mode');
            return Promise.resolve();
          },
          getStatus: function() {
            return { initialized: false, error: 'Bundle build failed' };
          }
        };
      })();
    `;
  }
  
  /**
   * Get bundle file path
   */
  getBundlePath() {
    return path.resolve(__dirname, '../../apps/aiur-ui/src/logger/legion-frontend-logger.js');
  }
  
  /**
   * Default session ID generator
   */
  defaultGenerateSessionId(req) {
    // Try to get from existing session
    if (req.session && req.session.legionSessionId) {
      return req.session.legionSessionId;
    }
    
    // Try to get from cookie
    const sessionCookie = req.cookies && req.cookies['legion-session-id'];
    if (sessionCookie) {
      return sessionCookie;
    }
    
    // Generate new session ID
    const sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    
    // Store in session if available
    if (req.session) {
      req.session.legionSessionId = sessionId;
    }
    
    return sessionId;
  }
  
  /**
   * Static method to create Express app with logger injection
   */
  static createMiddleware(config = {}) {
    const injector = new LegionLoggerInjector(config);
    
    return {
      // Main injection middleware
      middleware: injector.middleware(),
      
      // Bundle serving route
      bundleRoute: {
        path: config.bundlePath || '/legion-log-capture.js',
        handler: injector.bundleHandler()
      },
      
      // Injector instance for additional configuration
      injector
    };
  }
}

/**
 * Express app integration helper
 */
export function addLegionLogging(app, config = {}) {
  const { middleware, bundleRoute, injector } = LegionLoggerInjector.createMiddleware(config);
  
  // Add bundle route
  app.get(bundleRoute.path, bundleRoute.handler);
  
  // Add injection middleware (should be last)
  app.use(middleware);
  
  console.log(`LegionLoggerInjector: Enabled with bundle at ${bundleRoute.path}`);
  
  return injector;
}

export default LegionLoggerInjector;