/**
 * Integration tests for Core Services (ChatRecording, FileDiscovery)
 * NO MOCKS - tests real services with real file system
 */

import ChatRecordingService from '../../src/services/ChatRecordingService.js';
import FileDiscoveryService from '../../src/services/FileDiscoveryService.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Core Services Integration', () => {
  let chatRecordingService;
  let fileDiscoveryService;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Create test project directory
    testDir = path.join(os.tmpdir(), `core-services-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test project structure
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'tests'));
    await fs.mkdir(path.join(testDir, 'node_modules')); // Should be ignored
    
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({name: 'test'}, null, 2));
    await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'console.log("main");');
    await fs.writeFile(path.join(testDir, 'src', 'utils.ts'), 'export function helper() {}');
    await fs.writeFile(path.join(testDir, 'tests', 'test.js'), 'test("works", () => {});');
    await fs.writeFile(path.join(testDir, '.gitignore'), 'node_modules\\n*.log');
    
    chatRecordingService = new ChatRecordingService(resourceManager);
    fileDiscoveryService = new FileDiscoveryService(testDir);
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ChatRecordingService', () => {
    test('should start and stop recording sessions', async () => {
      // Start recording
      const session = await chatRecordingService.startRecording('test-session', {
        projectType: 'Node.js',
        purpose: 'testing'
      });
      
      expect(session.id).toBe('test-session');
      expect(session.startTime).toBeDefined();
      expect(session.metadata.projectType).toBe('Node.js');
      expect(chatRecordingService.isRecording).toBe(true);
      
      // Record some messages
      await chatRecordingService.recordUserMessage('Hello agent');
      await chatRecordingService.recordAssistantMessage('Hi there!', [], { input: 10, output: 15 });
      
      // Stop recording
      const finalSession = await chatRecordingService.stopRecording();
      
      expect(finalSession.endTime).toBeDefined();
      expect(finalSession.messages).toHaveLength(2);
      expect(finalSession.tokenUsage.total).toBe(25);
      expect(chatRecordingService.isRecording).toBe(false);
      
      console.log('✅ Chat recording session management working');
    });

    test('should record tool executions', async () => {
      await chatRecordingService.startRecording();
      
      const toolCalls = [
        {
          id: 'tool1',
          name: 'write_file',
          args: { path: '/test.txt', content: 'test' },
          result: { success: true },
          status: 'completed'
        }
      ];
      
      await chatRecordingService.recordAssistantMessage(
        'I created the file',
        toolCalls,
        { input: 20, output: 30 }
      );
      
      const stats = chatRecordingService.getRecordingStats();
      expect(stats.messageCount).toBe(1);
      expect(stats.tokenUsage.total).toBe(50);
      
      await chatRecordingService.stopRecording();
      
      console.log('✅ Tool execution recording working');
    });

    test('should persist and load sessions', async () => {
      const sessionId = `persist-test-${Date.now()}`;
      
      // Record a session
      await chatRecordingService.startRecording(sessionId);
      await chatRecordingService.recordUserMessage('Test persistence');
      await chatRecordingService.recordAssistantMessage('Response recorded');
      await chatRecordingService.stopRecording();
      
      // Load the session
      const loadedSession = await chatRecordingService.loadSession(sessionId);
      
      expect(loadedSession.id).toBe(sessionId);
      expect(loadedSession.messages).toHaveLength(2);
      expect(loadedSession.endTime).toBeDefined();
      
      console.log('✅ Session persistence working');
    });

    test('should list recorded sessions', async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        await chatRecordingService.startRecording(`list-test-${i}`);
        await chatRecordingService.recordUserMessage(`Message ${i}`);
        await chatRecordingService.stopRecording();
      }
      
      const sessions = await chatRecordingService.listSessions();
      
      expect(sessions.length).toBeGreaterThanOrEqual(3);
      expect(sessions[0]).toHaveProperty('id');
      expect(sessions[0]).toHaveProperty('startTime');
      expect(sessions[0]).toHaveProperty('messageCount');
      
      console.log('Sessions found:', sessions.length);
      console.log('✅ Session listing working');
    });
  });

  describe('FileDiscoveryService', () => {
    test('should discover project files intelligently', async () => {
      const discoveredFiles = await fileDiscoveryService.discoverProjectFiles();
      
      expect(Array.isArray(discoveredFiles)).toBe(true);
      expect(discoveredFiles.length).toBeGreaterThan(0);
      
      // Should include source files
      const hasJsFiles = discoveredFiles.some(f => f.endsWith('.js'));
      const hasTsFiles = discoveredFiles.some(f => f.endsWith('.ts'));
      expect(hasJsFiles || hasTsFiles).toBe(true);
      
      // Should exclude node_modules
      const hasNodeModules = discoveredFiles.some(f => f.includes('node_modules'));
      expect(hasNodeModules).toBe(false);
      
      console.log('Discovered files:', discoveredFiles.length);
      console.log('Sample files:', discoveredFiles.slice(0, 3));
      console.log('✅ Intelligent file discovery working');
    });

    test('should respect gitignore patterns', async () => {
      const allFiles = [
        path.join(testDir, 'src', 'index.js'),
        path.join(testDir, 'node_modules', 'package.js'),
        path.join(testDir, 'app.log')
      ];
      
      const filteredFiles = fileDiscoveryService.filterFiles(allFiles, {
        respectGitIgnore: true,
        respectGeminiIgnore: false
      });
      
      // Should exclude node_modules and .log files
      expect(filteredFiles).toContain(path.join(testDir, 'src', 'index.js'));
      expect(filteredFiles).not.toContain(path.join(testDir, 'node_modules', 'package.js'));
      expect(filteredFiles).not.toContain(path.join(testDir, 'app.log'));
      
      console.log('✅ Gitignore filtering working');
    });

    test('should provide discovery statistics', () => {
      const stats = fileDiscoveryService.getDiscoveryStats();
      
      expect(stats.projectRoot).toBe(testDir);
      expect(typeof stats.isGitRepo).toBe('boolean');
      expect(typeof stats.gitignorePatterns).toBe('number');
      expect(typeof stats.geminiignorePatterns).toBe('number');
      
      console.log('Discovery stats:', stats);
      console.log('✅ Discovery statistics working');
    });

    test('should handle different file extensions', async () => {
      // Test with specific extensions
      const jsFiles = await fileDiscoveryService.discoverProjectFiles({
        fileExtensions: ['.js']
      });
      
      const allFiles = await fileDiscoveryService.discoverProjectFiles({
        fileExtensions: ['*'] // All files
      });
      
      expect(jsFiles.length).toBeLessThanOrEqual(allFiles.length);
      expect(jsFiles.every(f => f.endsWith('.js'))).toBe(true);
      
      console.log('JS files found:', jsFiles.length);
      console.log('All files found:', allFiles.length);
      console.log('✅ File extension filtering working');
    });

    test('should limit directory traversal depth', async () => {
      const shallowFiles = await fileDiscoveryService.discoverProjectFiles({
        maxDepth: 1
      });
      
      const deepFiles = await fileDiscoveryService.discoverProjectFiles({
        maxDepth: 5
      });
      
      expect(shallowFiles.length).toBeLessThanOrEqual(deepFiles.length);
      
      console.log('Shallow scan:', shallowFiles.length, 'Deep scan:', deepFiles.length);
      console.log('✅ Depth limiting working');
    });
  });

  describe('Service Integration', () => {
    test('should integrate chat recording with file discovery', async () => {
      // Start recording
      await chatRecordingService.startRecording('integration-test');
      
      // Use file discovery to find files
      const discoveredFiles = await fileDiscoveryService.discoverProjectFiles();
      
      // Record the discovery
      await chatRecordingService.recordAssistantMessage(
        `Found ${discoveredFiles.length} relevant files in project`,
        [
          {
            name: 'file_discovery',
            args: { projectRoot: testDir },
            result: { files: discoveredFiles },
            status: 'completed'
          }
        ]
      );
      
      const session = await chatRecordingService.stopRecording();
      
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].toolCalls).toHaveLength(1);
      expect(session.messages[0].toolCalls[0].result.files).toHaveLength(discoveredFiles.length);
      
      console.log('✅ Core services integration working');
    });
  });
});