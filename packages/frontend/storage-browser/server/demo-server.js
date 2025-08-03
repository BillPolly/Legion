/**
 * Demo Server for StorageBrowser
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3600;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

// Serve example
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/examples/index.html'));
});

app.listen(port, () => {
  console.log(`StorageBrowser demo server running at http://localhost:${port}`);
  console.log('Make sure the Storage Actor Server is running on port 3700');
});