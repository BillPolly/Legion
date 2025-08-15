/**
 * Complete integration test for generating a Node.js Express server
 * This demonstrates the full capability of the CodeAgent
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { CodeAgent } from '../../src/index.js';
import { ResourceManager } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Complete Server Generation', () => {
  let agent;
  let testDir;
  let apiKey;
  
  beforeAll(async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    apiKey = resourceManager.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in ResourceManager');
    }
  });

  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    agent = new CodeAgent({
      projectType: 'backend'
    });
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should generate a complete Node.js Express server that adds two numbers', async () => {
    // Initialize the agent
    await agent.initialize(testDir, {
      llmConfig: {
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229'
      }
    });

    // Generate the complete server with all necessary components
    const serverSpec = {
      name: 'number-adder-server',
      description: 'Complete Node.js Express server that adds two numbers',
      imports: [
        { default: 'express', from: 'express' },
        { default: 'cors', from: 'cors' }
      ],
      constants: {
        PORT: 'process.env.PORT || 3000'
      },
      functions: [
        {
          name: 'createApp',
          params: [],
          body: [
            'const app = express();',
            '',
            '// Middleware',
            'app.use(cors());',
            'app.use(express.json());',
            'app.use(express.urlencoded({ extended: true }));',
            '',
            '// Health check endpoint',
            'app.get("/health", (req, res) => {',
            '  res.json({ status: "ok", timestamp: new Date().toISOString() });',
            '});',
            '',
            '// Main endpoint to add two numbers',
            'app.post("/add", (req, res) => {',
            '  const { a, b } = req.body;',
            '  ',
            '  // Input validation',
            '  if (a === undefined || b === undefined) {',
            '    return res.status(400).json({',
            '      error: "Missing required parameters: a and b"',
            '    });',
            '  }',
            '  ',
            '  if (typeof a !== "number" || typeof b !== "number") {',
            '    return res.status(400).json({',
            '      error: "Both a and b must be numbers"',
            '    });',
            '  }',
            '  ',
            '  // Perform calculation',
            '  const result = a + b;',
            '  ',
            '  // Return result',
            '  res.json({',
            '    a: a,',
            '    b: b,',
            '    result: result,',
            '    timestamp: new Date().toISOString()',
            '  });',
            '});',
            '',
            '// 404 handler',
            'app.use((req, res) => {',
            '  res.status(404).json({ error: "Endpoint not found" });',
            '});',
            '',
            '// Error handler',
            'app.use((err, req, res, next) => {',
            '  console.error(err.stack);',
            '  res.status(500).json({ error: "Internal server error" });',
            '});',
            '',
            'return app;'
          ].join('\n'),
          jsdoc: { 
            description: 'Create and configure Express app with all middleware and routes',
            returns: 'Express - Configured Express application'
          }
        },
        {
          name: 'startServer',
          params: [],
          isAsync: true,
          body: [
            'try {',
            '  const app = createApp();',
            '  ',
            '  const server = app.listen(PORT, () => {',
            '    console.log(`🚀 Server is running on port ${PORT}`);',
            '    console.log(`📍 Health check: http://localhost:${PORT}/health`);',
            '    console.log(`➕ Add endpoint: POST http://localhost:${PORT}/add`);',
            '  });',
            '  ',
            '  // Graceful shutdown',
            '  process.on("SIGTERM", () => {',
            '    console.log("SIGTERM signal received: closing HTTP server");',
            '    server.close(() => {',
            '      console.log("HTTP server closed");',
            '    });',
            '  });',
            '} catch (error) {',
            '  console.error("Failed to start server:", error);',
            '  process.exit(1);',
            '}'
          ].join('\n'),
          jsdoc: { 
            description: 'Start the Express server with error handling and graceful shutdown'
          }
        }
      ],
      main: 'startServer();',
      exports: { named: ['createApp'] }
    };

    // Generate the server code
    const serverCode = await agent.jsGenerator.generateModule(serverSpec);
    
    // Write server.js
    await agent.fileOps.writeFile(path.join(testDir, 'server.js'), serverCode);
    
    // Generate package.json
    const packageJson = {
      name: 'number-adder-server',
      version: '1.0.0',
      description: 'Node.js Express server that adds two numbers',
      main: 'server.js',
      type: 'module',
      scripts: {
        start: 'node server.js',
        dev: 'node --watch server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5'
      },
      devDependencies: {
        jest: '^29.0.0',
        supertest: '^6.3.3'
      },
      engines: {
        node: '>=14.0.0'
      }
    };
    
    await agent.fileOps.writeFile(
      path.join(testDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
    
    // Generate README
    const readmeContent = `# Number Adder Server

A simple Node.js Express server that adds two numbers.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

Start the server:

\`\`\`bash
npm start
\`\`\`

The server will start on port 3000 (or the PORT environment variable).

## API Endpoints

### Health Check

\`\`\`
GET /health
\`\`\`

Returns the server status.

### Add Two Numbers

\`\`\`
POST /add
Content-Type: application/json

{
  "a": 5,
  "b": 3
}
\`\`\`

Response:
\`\`\`json
{
  "a": 5,
  "b": 3,
  "result": 8,
  "timestamp": "2025-01-15T12:00:00.000Z"
}
\`\`\`

## Development

Run in development mode with auto-reload:

\`\`\`bash
npm run dev
\`\`\`

## Testing

Run tests:

\`\`\`bash
npm test
\`\`\`
`;
    
    await agent.fileOps.writeFile(path.join(testDir, 'README.md'), readmeContent);
    
    // Generate .gitignore
    const gitignoreContent = `node_modules/
.env
.env.local
dist/
build/
coverage/
.DS_Store
*.log
`;
    
    await agent.fileOps.writeFile(path.join(testDir, '.gitignore'), gitignoreContent);
    
    // Verify all files were created
    const files = await fs.readdir(testDir);
    expect(files).toContain('server.js');
    expect(files).toContain('package.json');
    expect(files).toContain('README.md');
    expect(files).toContain('.gitignore');
    
    // Verify server code content
    const savedServerCode = await fs.readFile(path.join(testDir, 'server.js'), 'utf-8');
    expect(savedServerCode).toContain('express');
    expect(savedServerCode).toContain('cors');
    expect(savedServerCode).toContain('app.post("/add"');
    expect(savedServerCode).toContain('app.get("/health"');
    expect(savedServerCode).toContain('const result = a + b;');
    expect(savedServerCode).toContain('export { createApp }');
    
    // Verify package.json
    const savedPackageJson = await fs.readFile(path.join(testDir, 'package.json'), 'utf-8');
    const packageData = JSON.parse(savedPackageJson);
    expect(packageData.name).toBe('number-adder-server');
    expect(packageData.dependencies).toHaveProperty('express');
    expect(packageData.dependencies).toHaveProperty('cors');
    
    console.log('✅ Complete Node.js Express server generated successfully!');
    console.log('Generated files:', files);
    console.log('Project directory:', testDir);
  });
});