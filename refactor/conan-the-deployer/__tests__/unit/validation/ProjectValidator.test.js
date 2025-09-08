import { jest } from '@jest/globals';

// Mock fs/promises
jest.unstable_mockModule('fs/promises', () => {
  const mockFunctions = {
    access: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn()
  };
  return {
    ...mockFunctions,
    default: mockFunctions
  };
});

// Mock path
jest.unstable_mockModule('path', () => ({
  default: {
    join: jest.fn((...parts) => parts.join('/'))
  },
  join: jest.fn((...parts) => parts.join('/'))
}));

// Import after mocking
const ProjectValidator = (await import('../../../src/validation/ProjectValidator.js')).default;
const fs = await import('fs/promises');

describe('ProjectValidator', () => {
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ProjectValidator();
  });

  describe('Node.js Project Detection', () => {
    test('should detect valid Node.js project with package.json', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        main: 'index.js',
        scripts: {
          start: 'node index.js'
        },
        dependencies: {
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('nodejs');
      expect(result.projectInfo.name).toBe('test-app');
      expect(result.projectInfo.hasStartScript).toBe(true);
    });

    test('should detect package.json without start script', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('nodejs');
      expect(result.projectInfo.hasStartScript).toBe(false);
      expect(result.warnings).toContain('No start script found in package.json');
    });

    test('should handle missing package.json', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('package.json')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });

      const result = await validator.validateProject('/test/project');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No package.json found');
    });

    test('should handle invalid package.json', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('invalid json');

      const result = await validator.validateProject('/test/project');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid package.json format');
    });

    test('should validate project path exists', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await validator.validateProject('/invalid/path');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Project path does not exist');
    });
  });

  describe('Dependency Checking', () => {
    test('should identify common frameworks', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          express: '^4.18.0',
          next: '^13.0.0',
          react: '^18.0.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.frameworks).toContain('express');
      expect(result.projectInfo.frameworks).toContain('next');
    });

    test('should check for development dependencies', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          express: '^4.18.0'
        },
        devDependencies: {
          nodemon: '^2.0.0',
          jest: '^29.0.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.hasDevDependencies).toBe(true);
      expect(result.projectInfo.testFramework).toBe('jest');
    });

    test('should detect missing dependencies', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        version: '1.0.0'
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.warnings).toContain('No dependencies found');
    });
  });

  describe('Build Command Detection', () => {
    test('should detect build script', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        scripts: {
          start: 'node index.js',
          build: 'npm run compile',
          compile: 'tsc'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.hasBuildScript).toBe(true);
      expect(result.projectInfo.buildCommand).toBe('npm run build');
    });

    test('should detect TypeScript projects', async () => {
      fs.access.mockImplementation((path) => {
        if (path === '/test/project') {
          return Promise.resolve();
        }
        if (path.endsWith('tsconfig.json')) {
          return Promise.resolve();
        }
        if (path.endsWith('package.json')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      fs.readFile.mockImplementation((path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({
            name: 'test-app',
            devDependencies: {
              typescript: '^4.8.0'
            }
          }));
        }
        return Promise.resolve('{}');
      });

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.isTypeScript).toBe(true);
      expect(result.recommendations).toContain('Consider adding a build script for TypeScript compilation');
    });
  });

  describe('Port Configuration', () => {
    test('should detect default port from environment variables', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        scripts: {
          start: 'node index.js'
        }
      }));

      // Mock reading a simple server file
      fs.access.mockImplementation((path) => {
        if (path.endsWith('index.js')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      fs.readFile.mockImplementation((path) => {
        if (path.endsWith('index.js')) {
          return Promise.resolve(`
            const port = process.env.PORT || 3000;
            app.listen(port, () => {
              console.log('Server running on port', port);
            });
          `);
        }
        return Promise.resolve(JSON.stringify({
          name: 'test-app',
          scripts: { start: 'node index.js' }
        }));
      });

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.defaultPort).toBe(3000);
      expect(result.projectInfo.usesEnvPort).toBe(true);
    });

    test('should warn about hardcoded ports', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockImplementation((path) => {
        if (path.endsWith('index.js')) {
          return Promise.resolve(`
            app.listen(8080, () => {
              console.log('Server running on port 8080');
            });
          `);
        }
        return Promise.resolve(JSON.stringify({
          name: 'test-app',
          main: 'index.js',
          scripts: { start: 'node index.js' }
        }));
      });

      const result = await validator.validateProject('/test/project');

      expect(result.warnings).toContain('Hardcoded port detected (8080). Consider using process.env.PORT');
    });
  });

  describe('Security Validation', () => {
    test('should detect package-lock.json for security', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('package-lock.json')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app'
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.hasLockFile).toBe(true);
    });

    test('should warn about missing lock file', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('package-lock.json') || path.endsWith('yarn.lock') || path.endsWith('pnpm-lock.yaml')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });

      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.warnings).toContain('No lock file found. Consider using npm ci or yarn install --frozen-lockfile');
    });

    test('should check for security vulnerabilities in dependencies', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          'old-package': '0.0.1',
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.recommendations).toContain('Run npm audit to check for security vulnerabilities');
    });
  });

  describe('Performance Recommendations', () => {
    test('should recommend production optimizations', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.recommendations).toContain('Add NODE_ENV=production for production deployments');
    });

    test('should recommend health check endpoint', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app',
        dependencies: {
          express: '^4.18.0'
        }
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.recommendations).toContain('Consider adding a health check endpoint (/health)');
    });
  });

  describe('Docker Support Detection', () => {
    test('should detect existing Dockerfile', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('Dockerfile')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      fs.readFile.mockImplementation((path) => {
        if (path.endsWith('Dockerfile')) {
          return Promise.resolve(`
            FROM node:18
            WORKDIR /app
            COPY package*.json ./
            RUN npm ci
            COPY . .
            EXPOSE 3000
            CMD ["npm", "start"]
          `);
        }
        return Promise.resolve(JSON.stringify({ name: 'test-app' }));
      });

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.hasDockerfile).toBe(true);
      expect(result.projectInfo.dockerExpose).toBe(3000);
    });

    test('should detect .dockerignore', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('.dockerignore')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app'
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.projectInfo.hasDockerignore).toBe(true);
    });

    test('should recommend Docker files for production', async () => {
      fs.access.mockImplementation((path) => {
        if (path.endsWith('Dockerfile') || path.endsWith('.dockerignore')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });

      fs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-app'
      }));

      const result = await validator.validateProject('/test/project');

      expect(result.recommendations).toContain('Consider adding Dockerfile for containerized deployments');
    });
  });
});