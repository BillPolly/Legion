import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 17900;
const HTTP_PORT = 17901;

// WebSocket server for broadcasting card events
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected to overlay server');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client disconnected from overlay server');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// HTTP server to serve the HTML overlay
const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
    res.end(html);
  } else if (req.url === '/styles.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    const css = readFileSync(join(__dirname, 'styles.css'), 'utf8');
    res.end(css);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`Overlay HTTP server listening on http://localhost:${HTTP_PORT}`);
  console.log(`Overlay WebSocket server listening on ws://localhost:${PORT}`);
  console.log(`\nAdd to OBS as Browser Source: http://localhost:${HTTP_PORT}`);
});

// Control API (listen for showCard/hideCard commands)
const controlWss = new WebSocketServer({ port: PORT + 1 });

controlWss.on('connection', (ws) => {
  console.log('Control client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.cmd === 'showCard') {
        console.log('Showing card:', message.args);
        broadcast({
          type: 'showCard',
          title: message.args.title,
          subtitle: message.args.subtitle
        });
      } else if (message.cmd === 'hideCard') {
        console.log('Hiding card');
        broadcast({ type: 'hideCard' });
      }
    } catch (error) {
      console.error('Error parsing control message:', error);
    }
  });
});

console.log('Overlay control server listening on ws://localhost:' + (PORT + 1));
