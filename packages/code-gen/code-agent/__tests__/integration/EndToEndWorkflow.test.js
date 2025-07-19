/**
 * End-to-End Workflow Integration Tests
 * Phase 6.4: Complete development workflow testing
 * 
 * Tests the complete development workflow from project initialization
 * through to deployment, including all Git integration features.
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '../../src/agent/CodeAgent.js';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('End-to-End Workflow Integration Tests', () => {
  let resourceManager;
  let tempDir;
  let agent;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', process.env.GITHUB_USER || 'TestUser');
    resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT || 'test_token');
    resourceManager.register('GITHUB_AGENT_ORG', process.env.GITHUB_AGENT_ORG || 'TestOrg');
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-workflow-test-'));
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
      agent = null;
    }
    
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should complete full frontend project workflow', async () => {
    const config = {
      enableGitIntegration: true,
      projectType: 'frontend',
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        branchStrategy: 'phase',
        autoCommit: true,
        user: {
          name: 'Frontend Test Agent',
          email: 'frontend@codeagent.dev'
        }
      }
    };

    agent = new CodeAgent(config);
    await agent.initialize(tempDir);
    await agent.initializeGitRepository();

    const requirements = {
      title: 'E2E Frontend Test App',
      description: 'A complete frontend application for testing the full workflow',
      type: 'frontend',
      features: ['React components', 'Responsive design', 'API integration'],
      technology: 'react'
    };

    // Phase 1: Planning
    console.log('🏗️ Starting planning phase...');
    await agent.startPhase('planning');
    
    // Create project structure files
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'e2e-frontend-test',
      version: '1.0.0',
      description: requirements.description,
      main: 'src/index.js',
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test'
      },
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0'
      }
    }, null, 2));

    await fs.writeFile(path.join(tempDir, 'README.md'), `# ${requirements.title}\n\n${requirements.description}`);
    
    await agent.trackFile('package.json');
    await agent.trackFile('README.md');
    await agent.completePhase('planning');

    // Phase 2: Generation
    console.log('⚡ Starting generation phase...');
    await agent.startPhase('generation');
    
    // Create source directory
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    
    // Create React components
    await fs.writeFile(path.join(srcDir, 'index.js'), `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
    `);

    await fs.writeFile(path.join(srcDir, 'App.js'), `
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(['Item 1', 'Item 2', 'Item 3']);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>${requirements.title}</h1>
        <p>${requirements.description}</p>
      </header>
      <main>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {data.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default App;
    `);

    await fs.writeFile(path.join(srcDir, 'App.css'), `
.App {
  text-align: center;
  padding: 20px;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  margin-bottom: 20px;
}

.App-header h1 {
  margin: 0 0 10px 0;
}

main ul {
  list-style: none;
  padding: 0;
}

main li {
  padding: 10px;
  margin: 5px 0;
  background-color: #f0f0f0;
  border-radius: 5px;
}

@media (max-width: 768px) {
  .App {
    padding: 10px;
  }
  
  .App-header {
    padding: 15px;
  }
}
    `);

    await agent.trackFile('src/index.js');
    await agent.trackFile('src/App.js');
    await agent.trackFile('src/App.css');
    await agent.completePhase('generation');

    // Phase 3: Testing
    console.log('🧪 Starting testing phase...');
    await agent.startPhase('testing');
    
    // Create test directory
    const testDir = path.join(tempDir, 'src/__tests__');
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(path.join(testDir, 'App.test.js'), `
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

test('renders app title', () => {
  render(<App />);
  const titleElement = screen.getByText('${requirements.title}');
  expect(titleElement).toBeInTheDocument();
});

test('shows loading initially', () => {
  render(<App />);
  const loadingElement = screen.getByText('Loading...');
  expect(loadingElement).toBeInTheDocument();
});

test('displays data after loading', async () => {
  render(<App />);
  
  await waitFor(() => {
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
  
  expect(screen.getByText('Item 2')).toBeInTheDocument();
  expect(screen.getByText('Item 3')).toBeInTheDocument();
});

test('is responsive', () => {
  render(<App />);
  const appElement = document.querySelector('.App');
  expect(appElement).toHaveClass('App');
});
    `);

    await agent.trackFile('src/__tests__/App.test.js');
    await agent.completePhase('testing');

    // Phase 4: Quality
    console.log('✅ Starting quality phase...');
    await agent.startPhase('quality');
    
    // Create quality configuration files
    await fs.writeFile(path.join(tempDir, '.eslintrc.json'), JSON.stringify({
      extends: ['react-app', 'react-app/jest'],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error'
      }
    }, null, 2));

    await fs.writeFile(path.join(tempDir, '.gitignore'), `
node_modules/
build/
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
    `);

    await agent.trackFile('.eslintrc.json');
    await agent.trackFile('.gitignore');
    await agent.completePhase('quality');

    // Phase 5: Documentation
    console.log('📚 Starting documentation phase...');
    await agent.startPhase('documentation');
    
    // Create comprehensive documentation
    await fs.writeFile(path.join(tempDir, 'DEVELOPMENT.md'), `
# Development Guide

## Getting Started

1. Install dependencies: \`npm install\`
2. Start development server: \`npm start\`
3. Run tests: \`npm test\`
4. Build for production: \`npm run build\`

## Project Structure

- \`src/\` - Source code
- \`src/__tests__/\` - Test files
- \`public/\` - Static assets

## Features

${requirements.features.map(f => `- ${f}`).join('\n')}

## Technology Stack

- React 18
- CSS3 with responsive design
- Jest for testing
    `);

    await fs.writeFile(path.join(tempDir, 'DEPLOYMENT.md'), `
# Deployment Guide

## Production Build

Run \`npm run build\` to create an optimized production build.

## Deployment Options

1. **Static Hosting**: Upload \`build/\` folder to any static host
2. **CDN**: Use services like Netlify or Vercel
3. **Container**: Use provided Dockerfile

## Environment Variables

Create \`.env\` file for environment-specific configuration.
    `);

    await agent.trackFile('DEVELOPMENT.md');
    await agent.trackFile('DEPLOYMENT.md');
    await agent.completePhase('documentation');

    // Verify complete workflow
    const finalStatus = await agent.getGitStatus();
    expect(finalStatus.initialized).toBe(true);
    expect(finalStatus.commits).toBeGreaterThan(0);

    const metrics = await agent.getGitMetrics();
    expect(metrics.totalCommits).toBeGreaterThanOrEqual(5); // One per phase
    expect(metrics.commitsByPhase).toHaveProperty('planning');
    expect(metrics.commitsByPhase).toHaveProperty('generation');
    expect(metrics.commitsByPhase).toHaveProperty('testing');
    expect(metrics.commitsByPhase).toHaveProperty('quality');
    expect(metrics.commitsByPhase).toHaveProperty('documentation');

    console.log('✅ Complete frontend project workflow test passed');
    console.log(`📊 Total commits: ${metrics.totalCommits}`);
    console.log(`📊 Files generated: ${finalStatus.trackedFiles.length}`);
  });

  test('should complete enhanced backend project workflow', async () => {
    const config = {
      enableGitIntegration: true,
      projectType: 'backend',
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        branchStrategy: 'feature',
        autoCommit: true,
        includeTestResults: true,
        includePerformanceData: true,
        user: {
          name: 'Enhanced Backend Agent',
          email: 'backend@codeagent.dev'
        }
      },
      enhancedConfig: {
        enableRuntimeTesting: false,
        enableBrowserTesting: false,
        enableLogAnalysis: true,
        enablePerformanceMonitoring: true
      }
    };

    agent = new EnhancedCodeAgent(config);
    await agent.initialize(tempDir);
    await agent.initializeGitRepository();

    const requirements = {
      title: 'E2E Backend Test API',
      description: 'A complete backend API for testing enhanced workflow',
      type: 'backend',
      features: ['REST API', 'Database integration', 'Authentication', 'Logging'],
      technology: 'node'
    };

    // Phase 1: Enhanced Planning with Performance Tracking
    console.log('🏗️ Starting enhanced planning phase...');
    await agent.startPhase('planning');
    
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'e2e-backend-test',
      version: '1.0.0',
      description: requirements.description,
      main: 'src/server.js',
      scripts: {
        start: 'node src/server.js',
        dev: 'nodemon src/server.js',
        test: 'jest',
        'test:coverage': 'jest --coverage'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^6.0.0',
        'express-rate-limit': '^6.7.0'
      },
      devDependencies: {
        jest: '^29.0.0',
        supertest: '^6.3.0',
        nodemon: '^2.0.0'
      }
    }, null, 2));

    const planningMetrics = {
      duration: 1500,
      complexity: 8
    };

    const planningResult = await agent.commitPhase('planning', ['package.json'], 'Complete planning phase', planningMetrics);
    expect(planningResult.success).toBe(true);

    // Phase 2: Enhanced Generation with Performance Data
    console.log('⚡ Starting enhanced generation phase...');
    await agent.startPhase('generation');
    
    const srcDir = path.join(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Create server file
    await fs.writeFile(path.join(srcDir, 'server.js'), `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser = { 
    id: Date.now(), 
    name, 
    email,
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json(newUser);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});

module.exports = app;
    `);

    // Create authentication middleware
    await fs.writeFile(path.join(srcDir, 'middleware', 'auth.js'), `
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
    `);

    await fs.mkdir(path.join(srcDir, 'middleware'), { recursive: true });

    const performanceMetrics = {
      executionTime: 2300,
      memoryUsage: 15.8,
      cpuUsage: 12.4,
      optimizations: ['Express middleware optimization', 'Route caching']
    };

    const generationResult = await agent.commitWithPerformanceData(
      'generation',
      ['src/server.js', 'src/middleware/auth.js'],
      'Complete generation phase with performance optimizations',
      performanceMetrics
    );

    expect(generationResult.success).toBe(true);
    expect(generationResult.metadata.performance.executionTime).toBe(2300);

    // Phase 3: Enhanced Testing with Test Results
    console.log('🧪 Starting enhanced testing phase...');
    await agent.startPhase('testing');
    
    const testDir = path.join(tempDir, '__tests__');
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(path.join(testDir, 'server.test.js'), `
const request = require('supertest');
const app = require('../src/server');

describe('Server Endpoints', () => {
  test('GET /health should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
      
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  test('GET /api/users should return users array', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
      
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('email');
  });

  test('POST /api/users should create new user', async () => {
    const newUser = {
      name: 'Test User',
      email: 'test@example.com'
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(newUser)
      .expect(201);
      
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(newUser.name);
    expect(response.body.email).toBe(newUser.email);
    expect(response.body).toHaveProperty('createdAt');
  });

  test('POST /api/users should validate required fields', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({})
      .expect(400);
      
    expect(response.body).toHaveProperty('error');
  });

  test('should handle 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);
      
    expect(response.body).toHaveProperty('error', 'Route not found');
  });
});
    `);

    const testResults = {
      passed: 5,
      failed: 0,
      coverage: 92,
      testFiles: 1,
      assertions: 12
    };

    const testingResult = await agent.commitWithTestResults(
      'testing',
      ['__tests__/server.test.js'],
      'Complete testing phase with comprehensive test coverage',
      testResults
    );

    expect(testingResult.success).toBe(true);
    expect(testingResult.metadata.testResults.passed).toBe(5);
    expect(testingResult.metadata.testResults.coverage).toBe(92);

    // Phase 4: Enhanced Quality with Log Analysis
    console.log('✅ Starting enhanced quality phase...');
    await agent.startPhase('quality');
    
    await fs.writeFile(path.join(tempDir, '.eslintrc.json'), JSON.stringify({
      env: {
        node: true,
        es2021: true,
        jest: true
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: {
        'no-console': 'off', // Allow console in backend
        'no-unused-vars': 'error',
        'prefer-const': 'error'
      }
    }, null, 2));

    await fs.writeFile(path.join(tempDir, 'jest.config.js'), `
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
    `);

    const logAnalysis = {
      errors: 0,
      warnings: 2,
      info: 8,
      patterns: ['Server lifecycle', 'API requests', 'Error handling'],
      recommendations: ['Add request logging middleware', 'Implement structured logging']
    };

    const qualityResult = await agent.commitWithLogAnalysis(
      'quality',
      ['.eslintrc.json', 'jest.config.js'],
      'Complete quality phase with log analysis',
      logAnalysis
    );

    expect(qualityResult.success).toBe(true);
    expect(qualityResult.metadata.logAnalysis.recommendations).toContain('Add request logging middleware');

    // Get enhanced metrics
    const enhancedMetrics = await agent.getEnhancedGitMetrics();
    expect(enhancedMetrics).toHaveProperty('phaseMetrics');
    expect(enhancedMetrics).toHaveProperty('performanceTrends');
    expect(enhancedMetrics).toHaveProperty('qualityTrends');
    expect(enhancedMetrics).toHaveProperty('recommendations');

    console.log('✅ Enhanced backend project workflow test passed');
    console.log(`📊 Enhanced metrics - Phases: ${Object.keys(enhancedMetrics.phaseMetrics).length}`);
    console.log(`📊 Recommendations: ${enhancedMetrics.recommendations.length}`);
  });

  test('should handle fullstack project workflow', async () => {
    const config = {
      enableGitIntegration: true,
      projectType: 'fullstack',
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        branchStrategy: 'timestamp',
        autoCommit: true,
        user: {
          name: 'Fullstack Test Agent',
          email: 'fullstack@codeagent.dev'
        }
      }
    };

    agent = new CodeAgent(config);
    await agent.initialize(tempDir);
    await agent.initializeGitRepository();

    console.log('🌐 Starting fullstack project workflow...');

    // Create monorepo structure
    const frontendDir = path.join(tempDir, 'frontend');
    const backendDir = path.join(tempDir, 'backend');
    const sharedDir = path.join(tempDir, 'shared');

    await fs.mkdir(frontendDir, { recursive: true });
    await fs.mkdir(backendDir, { recursive: true });
    await fs.mkdir(sharedDir, { recursive: true });

    // Root package.json for monorepo
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'fullstack-e2e-test',
      version: '1.0.0',
      description: 'Fullstack application with frontend and backend',
      private: true,
      workspaces: ['frontend', 'backend', 'shared'],
      scripts: {
        'dev:frontend': 'npm run dev --workspace=frontend',
        'dev:backend': 'npm run dev --workspace=backend',
        'build:all': 'npm run build --workspaces',
        'test:all': 'npm test --workspaces'
      }
    }, null, 2));

    // Frontend package.json
    await fs.writeFile(path.join(frontendDir, 'package.json'), JSON.stringify({
      name: 'frontend',
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'vitest'
      },
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        axios: '^1.0.0'
      },
      devDependencies: {
        vite: '^4.0.0',
        '@vitejs/plugin-react': '^4.0.0'
      }
    }, null, 2));

    // Backend package.json
    await fs.writeFile(path.join(backendDir, 'package.json'), JSON.stringify({
      name: 'backend',
      version: '1.0.0',
      scripts: {
        dev: 'nodemon index.js',
        start: 'node index.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5'
      },
      devDependencies: {
        nodemon: '^2.0.0',
        jest: '^29.0.0'
      }
    }, null, 2));

    // Shared package.json
    await fs.writeFile(path.join(sharedDir, 'package.json'), JSON.stringify({
      name: 'shared',
      version: '1.0.0',
      main: 'index.js',
      scripts: {
        test: 'jest'
      }
    }, null, 2));

    // Shared utilities
    await fs.writeFile(path.join(sharedDir, 'index.js'), `
export const API_ENDPOINTS = {
  USERS: '/api/users',
  HEALTH: '/health'
};

export const validateEmail = (email) => {
  const re = /^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$/;
  return re.test(email);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};
    `);

    await agent.trackFile('package.json');
    await agent.trackFile('frontend/package.json');
    await agent.trackFile('backend/package.json');
    await agent.trackFile('shared/package.json');
    await agent.trackFile('shared/index.js');

    const monorepoResult = await agent.commitPhase('planning', [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
      'shared/package.json',
      'shared/index.js'
    ], 'Setup fullstack monorepo structure');

    expect(monorepoResult.success).toBe(true);

    // Create basic fullstack implementation
    await fs.writeFile(path.join(backendDir, 'index.js'), `
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'backend' });
});

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Frontend User', email: 'frontend@example.com' },
    { id: 2, name: 'Backend User', email: 'backend@example.com' }
  ]);
});

app.listen(PORT, () => {
  console.log(\`Backend server running on port \${PORT}\`);
});
    `);

    await fs.writeFile(path.join(frontendDir, 'src', 'App.jsx'), `
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS, validateEmail } from '../../shared';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(\`http://localhost:5000\${API_ENDPOINTS.USERS}\`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Fullstack E2E Test App</h1>
      <div>
        <h2>Users from Backend API</h2>
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <ul>
            {users.map(user => (
              <li key={user.id}>
                {user.name} - {validateEmail(user.email) ? '✓' : '✗'} {user.email}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
    `);

    await fs.mkdir(path.join(frontendDir, 'src'), { recursive: true });

    await agent.trackFile('backend/index.js');
    await agent.trackFile('frontend/src/App.jsx');

    const fullstackResult = await agent.commitPhase('generation', [
      'backend/index.js',
      'frontend/src/App.jsx'
    ], 'Implement fullstack communication');

    expect(fullstackResult.success).toBe(true);

    // Verify fullstack workflow completion
    const finalStatus = await agent.getGitStatus();
    expect(finalStatus.initialized).toBe(true);
    expect(finalStatus.commits).toBeGreaterThan(0);

    const metrics = await agent.getGitMetrics();
    expect(metrics.totalCommits).toBeGreaterThanOrEqual(2);

    console.log('✅ Fullstack project workflow test passed');
    console.log(`📊 Fullstack files tracked: ${finalStatus.trackedFiles.length}`);
  });
});