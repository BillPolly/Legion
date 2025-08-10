/**
 * HTTP Hook - Intercepts HTTP/HTTPS requests and responses
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function install(client, config) {
  const captureBody = config.captureBody !== false;
  const captureHeaders = config.captureHeaders !== false;
  const maxBodySize = config.maxBodySize || 10240; // 10KB default
  
  // Track active requests
  const activeRequests = new Map();
  let requestCounter = 0;
  
  // Helper to capture body data
  function captureBodyData(stream, callback) {
    if (!captureBody) {
      callback(null);
      return;
    }
    
    const chunks = [];
    let size = 0;
    
    const originalWrite = stream.write;
    stream.write = function(chunk, encoding, cb) {
      if (size < maxBodySize) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        size += chunk.length;
      }
      return originalWrite.call(this, chunk, encoding, cb);
    };
    
    stream.on('finish', () => {
      const body = Buffer.concat(chunks).toString('utf8').substring(0, maxBodySize);
      callback(body);
    });
  }
  
  // Wrap http.request
  function wrapRequest(module, protocol) {
    const originalRequest = module.request;
    const originalGet = module.get;
    
    module.request = function(options, callback) {
      const requestId = `${protocol}-${++requestCounter}`;
      const startTime = Date.now();
      
      // Parse URL if string
      let parsedOptions = options;
      if (typeof options === 'string') {
        parsedOptions = new URL(options);
      } else if (options.url) {
        parsedOptions = { ...options, ...new URL(options.url) };
      }
      
      const requestInfo = {
        id: requestId,
        protocol,
        method: parsedOptions.method || 'GET',
        host: parsedOptions.hostname || parsedOptions.host || 'localhost',
        port: parsedOptions.port || (protocol === 'https' ? 443 : 80),
        path: parsedOptions.path || '/',
        headers: captureHeaders ? parsedOptions.headers : undefined,
        startTime
      };
      
      activeRequests.set(requestId, requestInfo);
      
      // Send request start event
      client.send({
        type: 'http',
        subtype: 'requestStart',
        request: requestInfo,
        timestamp: startTime
      });
      
      // Call original request
      const req = originalRequest.call(this, options, function(res) {
        const responseStartTime = Date.now();
        
        // Capture response info
        const responseInfo = {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: captureHeaders ? res.headers : undefined,
          duration: responseStartTime - startTime
        };
        
        // Send response event
        client.send({
          type: 'http',
          subtype: 'response',
          requestId,
          response: responseInfo,
          timestamp: responseStartTime
        });
        
        // Capture response body if needed
        if (captureBody) {
          const chunks = [];
          let size = 0;
          
          const originalPush = res.push;
          res.push = function(chunk) {
            if (chunk && size < maxBodySize) {
              chunks.push(chunk);
              size += chunk.length;
            }
            return originalPush.call(this, chunk);
          };
          
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8').substring(0, maxBodySize);
            client.send({
              type: 'http',
              subtype: 'responseBody',
              requestId,
              body: body.substring(0, 1000), // Limit body size
              truncated: body.length >= 1000,
              timestamp: Date.now()
            });
            
            activeRequests.delete(requestId);
          });
        } else {
          res.on('end', () => {
            activeRequests.delete(requestId);
          });
        }
        
        // Call original callback
        if (callback) {
          callback(res);
        }
      });
      
      // Track request errors
      req.on('error', (err) => {
        client.send({
          type: 'http',
          subtype: 'requestError',
          requestId,
          error: {
            message: err.message,
            code: err.code
          },
          duration: Date.now() - startTime,
          timestamp: Date.now()
        });
        
        activeRequests.delete(requestId);
      });
      
      // Capture request body
      if (captureBody && req.writable) {
        const chunks = [];
        const originalWrite = req.write;
        const originalEnd = req.end;
        
        req.write = function(chunk, encoding, callback) {
          if (chunks.length * 1024 < maxBodySize) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
          }
          return originalWrite.call(this, chunk, encoding, callback);
        };
        
        req.end = function(chunk, encoding, callback) {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
          }
          
          if (chunks.length > 0) {
            const body = Buffer.concat(chunks).toString('utf8').substring(0, maxBodySize);
            client.send({
              type: 'http',
              subtype: 'requestBody',
              requestId,
              body: body.substring(0, 1000),
              truncated: body.length >= 1000,
              timestamp: Date.now()
            });
          }
          
          return originalEnd.call(this, chunk, encoding, callback);
        };
      }
      
      return req;
    };
    
    // Wrap get method (convenience method)
    module.get = function(options, callback) {
      const req = module.request(options, callback);
      req.end();
      return req;
    };
  }
  
  // Wrap server creation to track incoming requests
  function wrapServer(module, protocol) {
    const originalCreateServer = module.createServer;
    
    module.createServer = function(...args) {
      const server = originalCreateServer.apply(this, args);
      
      // Intercept request handler
      server.on('request', (req, res) => {
        const requestId = `${protocol}-server-${++requestCounter}`;
        const startTime = Date.now();
        
        // Send incoming request event
        client.send({
          type: 'http',
          subtype: 'incomingRequest',
          requestId,
          request: {
            method: req.method,
            url: req.url,
            headers: captureHeaders ? req.headers : undefined,
            remoteAddress: req.socket.remoteAddress
          },
          timestamp: startTime
        });
        
        // Track response
        const originalEnd = res.end;
        res.end = function(chunk, encoding, callback) {
          client.send({
            type: 'http',
            subtype: 'incomingResponse',
            requestId,
            response: {
              statusCode: res.statusCode,
              headers: captureHeaders ? res.getHeaders() : undefined,
              duration: Date.now() - startTime
            },
            timestamp: Date.now()
          });
          
          return originalEnd.call(this, chunk, encoding, callback);
        };
      });
      
      return server;
    };
  }
  
  // Install hooks
  wrapRequest(http, 'http');
  wrapRequest(https, 'https');
  wrapServer(http, 'http');
  wrapServer(https, 'https');
  
  // Send periodic stats
  const statsInterval = setInterval(() => {
    if (activeRequests.size > 0) {
      client.send({
        type: 'http',
        subtype: 'stats',
        activeRequests: activeRequests.size,
        requests: Array.from(activeRequests.values()).map(req => ({
          id: req.id,
          method: req.method,
          host: req.host,
          path: req.path,
          duration: Date.now() - req.startTime
        })),
        timestamp: Date.now()
      });
    }
  }, 5000);
  
  // Cleanup on exit
  process.on('exit', () => {
    clearInterval(statsInterval);
  });
}

module.exports = { install };