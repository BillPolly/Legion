/**
 * StaticServer - Serves static files for the Aiur Actors UI
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, resolve, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class StaticServer {
  constructor(config = {}) {
    this.port = config.port || 8080;
    this.publicDir = config.publicDir || join(__dirname, '../../public');
    this.server = null;
    this.logger = config.logger || console;
    
    // Configuration options
    this.cors = config.cors || false;
    this.corsOrigin = config.corsOrigin || '*';
    this.securityHeaders = config.securityHeaders || false;
    this.caching = config.caching || false;
    this.compression = config.compression || false;
    this.compressionThreshold = config.compressionThreshold || 1024;
    this.etag = config.etag || false;
    this.spa = config.spa || false;
    this.apiPrefix = config.apiPrefix || '/api';
    
    // MIME types
    this.mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      ...(config.mimeTypes || {})
    };
  }

  /**
   * Start the server
   * @returns {Promise<void>}
   */
  start() {
    return new Promise((resolve, reject) => {
      if (this.server && this.server.listening) {
        resolve();
        return;
      }
      
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });
      
      this.server.listen(this.port, () => {
        this.logger.log(`Static server listening on port ${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        this.logger.error('Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the server
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server && this.server.listening) {
        this.server.close(() => {
          this.logger.log('Static server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming requests
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   */
  handleRequest(req, res) {
    try {
      // Parse URL
      const url = new URL(req.url, `http://localhost:${this.port}`);
      let pathname = url.pathname;
      
      // Handle CORS preflight
      if (req.method === 'OPTIONS' && this.cors) {
        this.handleCorsOptions(res);
        return;
      }
      
      // Check method
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        this.sendError(res, 405, 'Method Not Allowed');
        return;
      }
      
      // Handle API routes in SPA mode
      if (this.spa && pathname.startsWith(this.apiPrefix)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
        return;
      }
      
      // Default to index.html
      if (pathname === '/') {
        pathname = '/index.html';
      }
      
      // Security: Prevent directory traversal
      const safePath = normalize(pathname);
      if (safePath.includes('..')) {
        this.sendError(res, 403, 'Forbidden');
        return;
      }
      
      // Resolve file path
      const filePath = join(this.publicDir, safePath);
      
      // Check if file exists
      if (!existsSync(filePath)) {
        // SPA fallback
        if (this.spa && !extname(pathname)) {
          this.serveFile(res, join(this.publicDir, 'index.html'), '.html', req);
          return;
        }
        this.sendError(res, 404, 'Not Found');
        return;
      }
      
      // Get file stats
      const stats = statSync(filePath);
      if (!stats.isFile()) {
        this.sendError(res, 404, 'Not Found');
        return;
      }
      
      // Serve the file
      const ext = extname(filePath);
      this.serveFile(res, filePath, ext, req, stats);
      
    } catch (error) {
      this.logger.error('Error serving request:', error);
      this.sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Serve a file
   * @param {ServerResponse} res
   * @param {string} filePath
   * @param {string} ext
   * @param {IncomingMessage} req
   * @param {Stats} stats
   */
  serveFile(res, filePath, ext, req, stats = null) {
    try {
      const contentType = this.mimeTypes[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': contentType
      };
      
      // Add security headers
      if (this.securityHeaders) {
        headers['X-Content-Type-Options'] = 'nosniff';
        headers['X-Frame-Options'] = 'SAMEORIGIN';
        headers['X-XSS-Protection'] = '1; mode=block';
      }
      
      // Add CORS headers
      if (this.cors) {
        headers['Access-Control-Allow-Origin'] = this.corsOrigin;
        headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
      }
      
      // Add caching headers
      if (this.caching) {
        const maxAge = ext === '.html' ? '0' : '31536000';
        headers['Cache-Control'] = `public, max-age=${maxAge}`;
      }
      
      // Check If-Modified-Since
      if (stats && req.headers['if-modified-since']) {
        const ifModifiedSince = new Date(req.headers['if-modified-since']);
        if (stats.mtime <= ifModifiedSince) {
          res.writeHead(304, headers);
          res.end();
          return;
        }
      }
      
      // Read file
      let content = this.readFile(filePath);
      
      // Generate ETag
      if (this.etag) {
        const hash = createHash('md5').update(content).digest('hex');
        headers['ETag'] = `"${hash}"`;
        
        // Check If-None-Match
        if (req.headers['if-none-match'] === headers['ETag']) {
          res.writeHead(304, headers);
          res.end();
          return;
        }
      }
      
      // Compress if needed
      if (this.compression && 
          content.length > this.compressionThreshold &&
          req.headers['accept-encoding'] &&
          req.headers['accept-encoding'].includes('gzip')) {
        content = gzipSync(content);
        headers['Content-Encoding'] = 'gzip';
      }
      
      // Send response
      res.writeHead(200, headers);
      
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
      
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Error serving ${filePath}:`, error);
      }
      this.sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Read file with proper error handling
   * @param {string} filePath
   * @returns {Buffer}
   */
  readFile(filePath) {
    return readFileSync(filePath);
  }

  /**
   * Handle CORS OPTIONS request
   * @param {ServerResponse} res
   */
  handleCorsOptions(res) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': this.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Content-Length': '0'
    });
    res.end();
  }

  /**
   * Send error response
   * @param {ServerResponse} res
   * @param {number} code
   * @param {string} message
   */
  sendError(res, code, message) {
    const headers = {
      'Content-Type': 'text/plain'
    };
    
    if (this.cors) {
      headers['Access-Control-Allow-Origin'] = this.corsOrigin;
    }
    
    res.writeHead(code, headers);
    res.end(`${code} ${message}`);
  }
}