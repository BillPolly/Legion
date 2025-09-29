/**
 * Sample JavaScript code file for testing
 * This is a simple Express.js server implementation
 */

import express from 'express';
import { ResourceManager } from '@legion/resource-manager';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Initialize ResourceManager
let resourceManager;

async function initialize() {
  resourceManager = await ResourceManager.getInstance();
  console.log('ResourceManager initialized');
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/users', async (req, res) => {
  try {
    const db = await resourceManager.createHandleFromURI('legion://local/mongodb/myapp/users');
    const users = await db.find({}).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const db = await resourceManager.createHandleFromURI('legion://local/mongodb/myapp/users');
    const result = await db.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});