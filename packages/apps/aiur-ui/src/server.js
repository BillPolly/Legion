import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = 3003;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css'
};

const server = createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  
  let filePath;
  if (url.startsWith('/Legion/components/')) {
    // Serve components from frontend/components package
    const componentPath = url.replace('/Legion/components/', '');
    filePath = join(__dirname, '../../../frontend/components/src/components/', componentPath);
  } else if (url.startsWith('/Legion/umbilical/')) {
    // Serve umbilical utilities
    const umbilicalPath = url.replace('/Legion/umbilical/', '');
    filePath = join(__dirname, '../../../frontend/components/src/umbilical/', umbilicalPath);
  } else if (url.startsWith('/Legion/shared/')) {
    // Serve shared modules (actors, utils, etc.)
    const sharedPath = url.replace('/Legion/shared/', '');
    filePath = join(__dirname, '../../../packages/shared/', sharedPath);
  } else if (url.startsWith('/src/')) {
    filePath = join(__dirname, '../', url);
  } else {
    filePath = join(__dirname, '../public', url);
  }
  
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`Clean Aiur UI server running at http://localhost:${port}`);
});