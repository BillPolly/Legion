import http from 'http';
import path from 'path';
import fs from 'fs';

console.log('FULLSTACK TEST: Server starting...');

const server = http.createServer((req, res) => {
  console.log('FULLSTACK TEST: Request received for:', req.url);
  
  if (req.url === '/' || req.url === '/index.html') {
    // Serve a simple HTML page with JavaScript that generates console logs
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Fullstack Test Page</title>
</head>
<body>
    <h1>Fullstack Monitoring Test</h1>
    <p>This page generates both backend and frontend logs.</p>
    <button id="logBtn">Generate Browser Logs</button>
    <button id="errorBtn">Generate Browser Error</button>
    
    <script>
        console.log('BROWSER TEST: Page loaded successfully');
        console.warn('BROWSER TEST: This is a browser warning');
        
        document.getElementById('logBtn').addEventListener('click', function() {
            console.log('BROWSER TEST: Button clicked - generating more logs');
            console.info('BROWSER TEST: Info message from button click');
        });
        
        document.getElementById('errorBtn').addEventListener('click', function() {
            console.error('BROWSER TEST: Error button clicked - this is an error');
            console.warn('BROWSER TEST: Warning after error');
        });
        
        // Generate some automatic logs
        setTimeout(() => {
            console.log('BROWSER TEST: Delayed log after 1 second');
        }, 1000);
        
        setTimeout(() => {
            console.warn('BROWSER TEST: Delayed warning after 2 seconds');
        }, 2000);
        
        setTimeout(() => {
            console.error('BROWSER TEST: Delayed error after 3 seconds');
        }, 3000);
    </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    console.warn('FULLSTACK TEST: 404 for path:', req.url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(3099, () => {
  console.log('FULLSTACK TEST: Server listening on port 3099');
  console.info('FULLSTACK TEST: Visit http://localhost:3099 to see the test page');
  
  setTimeout(() => {
    console.log('FULLSTACK TEST: Delayed backend log 1');
  }, 1500);
  
  setTimeout(() => {
    console.warn('FULLSTACK TEST: Delayed backend warning');
  }, 2500);
  
  setTimeout(() => {
    console.error('FULLSTACK TEST: Delayed backend error');
  }, 3500);
});

server.on('error', (error) => {
  console.error('FULLSTACK TEST: Server error:', error.message);
});