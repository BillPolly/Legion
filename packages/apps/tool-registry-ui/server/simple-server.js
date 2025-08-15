/**
 * Simple Tool Registry UI Server without external dependencies
 * Uses built-in Node.js modules only for testing
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8090;

// Path to Legion packages for /lib/ serving
const LEGION_ROOT = path.resolve(__dirname, '../../../../');

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Serve Legion modules through /legion/ routes
  if (req.url.startsWith('/legion/')) {
    const modulePath = req.url.replace('/legion/', '');
    const pathParts = modulePath.split('/');
    
    let fullPath;
    if (pathParts[0] === 'shared') {
      if (pathParts.length === 2 && !pathParts[1].endsWith('.js')) {
        // Request for /legion/shared/actors -> serve index.js
        const subPackage = pathParts[1]; // e.g., "actors"
        fullPath = path.join(LEGION_ROOT, 'packages', 'shared', subPackage, 'src', 'index.js');
      } else if (pathParts.length === 3 && pathParts[2].endsWith('.js')) {
        // Request for /legion/shared/actors/Actor.js -> serve individual file from actors directory
        const subPackage = pathParts[1]; // e.g., "actors" 
        const fileName = pathParts[2]; // e.g., "Actor.js"
        fullPath = path.join(LEGION_ROOT, 'packages', 'shared', subPackage, 'src', fileName);
      } else if (pathParts.length === 2 && pathParts[1].endsWith('.js')) {
        // Request for /legion/shared/Actor.js -> this is a relative import from shared/actors/index.js
        // When browser loads /legion/shared/actors and sees './Actor.js', it resolves to /legion/shared/Actor.js
        // We need to redirect this to /legion/shared/actors/Actor.js (actors directory)
        const fileName = pathParts[1]; // e.g., "Actor.js"
        fullPath = path.join(LEGION_ROOT, 'packages', 'shared', 'actors', 'src', fileName);
      } else {
        // Fallback for other shared patterns
        const [, ...fileParts] = pathParts;
        const filePath = fileParts.join('/');
        fullPath = path.join(LEGION_ROOT, 'packages', 'shared', filePath);
      }
    } else {
      // Standard package structure
      const [packageName, ...fileParts] = pathParts;
      const filePath = fileParts.join('/') || 'index.js';
      
      // Handle special package name mappings
      let actualPackagePath;
      if (packageName === 'frontend-components') {
        actualPackagePath = path.join(LEGION_ROOT, 'packages', 'frontend', 'components');
      } else {
        actualPackagePath = path.join(LEGION_ROOT, 'packages', packageName);
      }
      
      const actualFilePath = filePath.includes('.js') ? filePath : `src/${filePath}.js`;
      fullPath = path.join(actualPackagePath, actualFilePath);
    }
    
    console.log(`Serving Legion module: /legion/${modulePath} -> ${fullPath}`);
    
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Module not found: ${fullPath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Module not found: ${fullPath}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
    return;
  }
  
  // Serve index.html for root
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, '../public/index.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  // Serve JavaScript files
  if (req.url.endsWith('.js')) {
    let jsPath;
    if (req.url.startsWith('/components/tool-registry/panels/')) {
      // Panel components are actually in components/panels/ subdirectory
      const panelName = req.url.replace('/components/tool-registry/panels/', '');
      jsPath = path.join(__dirname, '../src/components/tool-registry/components/panels', panelName);
    } else {
      // Remove leading slash to avoid double path issues
      const cleanUrl = req.url.startsWith('/') ? req.url.slice(1) : req.url;
      jsPath = path.join(__dirname, '..', cleanUrl);
    }
    
    console.log(`Serving JS file: ${req.url} -> ${jsPath}`);
    
    fs.readFile(jsPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`JS file not found: ${jsPath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${req.url}`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
    return;
  }
  
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'tool-registry-ui',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server
server.listen(PORT, () => {
  console.log(`Tool Registry UI Server (Simple) running on http://localhost:${PORT}`);
  console.log('This is a simplified server for testing the UI');
  console.log('WebSocket functionality is disabled in this version');
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});