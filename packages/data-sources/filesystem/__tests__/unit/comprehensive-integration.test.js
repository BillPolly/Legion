/**
 * Phase 10: Comprehensive Integration Testing
 * Tests the complete FileSystemDataSource functionality across all phases
 * Verifies end-to-end workflows and real-world usage scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Comprehensive Integration Testing', () => {
  const testRoot = path.join(__dirname, '../tmp/integration-test');
  let dataSource;
  
  beforeAll(() => {
    // Create comprehensive test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    
    // Create nested directory structure
    fs.mkdirSync(path.join(testRoot, 'documents/projects/web'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'documents/projects/mobile'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'documents/templates'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'media/images'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'media/videos'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'config'), { recursive: true });
    
    // Create test files with various content
    fs.writeFileSync(path.join(testRoot, 'README.md'), '# Project Overview\n\nThis is a test project.');
    fs.writeFileSync(path.join(testRoot, 'config.json'), '{"app": "test", "version": "1.0.0"}');
    fs.writeFileSync(path.join(testRoot, 'documents/notes.txt'), 'Meeting notes from today');
    fs.writeFileSync(path.join(testRoot, 'documents/projects/web/index.html'), '<html><body>Hello World</body></html>');
    fs.writeFileSync(path.join(testRoot, 'documents/projects/web/styles.css'), 'body { margin: 0; }');
    fs.writeFileSync(path.join(testRoot, 'documents/projects/mobile/app.js'), 'console.log("Mobile app");');
    fs.writeFileSync(path.join(testRoot, 'documents/templates/letter.docx'), 'Template content');
    fs.writeFileSync(path.join(testRoot, 'media/images/photo.jpg'), 'fake image data');
    fs.writeFileSync(path.join(testRoot, 'config/database.ini'), '[database]\nhost=localhost');
    
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    // Clean up any subscriptions between tests
    if (dataSource._subscriptions) {
      for (const [id, subscription] of dataSource._subscriptions) {
        if (subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      }
      dataSource._subscriptions.clear();
    }
    if (dataSource._watchers) {
      dataSource._watchers.clear();
    }
  });
  
  describe('End-to-End File Operations Workflow', () => {
    it('should perform complete file lifecycle operations', () => {
      // 1. Create file handle
      const fileHandle = dataSource.file('test-lifecycle.txt');
      expect(fileHandle).toBeDefined();
      expect(fileHandle.path).toBe('test-lifecycle.txt');
      
      // 2. Check initial state (file doesn't exist)
      expect(fileHandle.exists()).toBe(false);
      expect(fileHandle.size()).toBe(0);
      
      // 3. Create file with content
      const writeResult = fileHandle.write('Initial content');
      expect(writeResult.success).toBe(true);
      expect(writeResult.operation).toBe('write');
      expect(writeResult.type).toBe('file');
      
      // 4. Verify file now exists and has content
      expect(fileHandle.exists()).toBe(true);
      expect(fileHandle.size()).toBeGreaterThan(0);
      expect(fileHandle.content()).toBe('Initial content');
      
      // 5. Get file metadata
      const metadata = fileHandle.value();
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('isFile');
      expect(metadata).toHaveProperty('isDirectory');
      expect(metadata.name).toBe('test-lifecycle.txt');
      expect(metadata.isFile).toBe(true);
      expect(metadata.isDirectory).toBe(false);
      
      // 6. Append more content
      const appendResult = fileHandle.append('\nAppended content');
      expect(appendResult.success).toBe(true);
      expect(appendResult.operation).toBe('append');
      expect(appendResult.type).toBe('file');
      
      // 7. Verify appended content
      const fullContent = fileHandle.content();
      expect(fullContent).toBe('Initial content\nAppended content');
      
      // 8. Copy file to new location
      const copyResult = fileHandle.copyTo('test-lifecycle-copy.txt');
      expect(copyResult.success).toBe(true);
      expect(copyResult.operation).toBe('copy');
      expect(copyResult.type).toBe('file');
      
      // 9. Verify copy exists
      const copyHandle = dataSource.file('test-lifecycle-copy.txt');
      expect(copyHandle.exists()).toBe(true);
      expect(copyHandle.content()).toBe(fullContent);
      
      // 10. Move original file
      const moveResult = fileHandle.moveTo('test-lifecycle-moved.txt');
      expect(moveResult.success).toBe(true);
      expect(moveResult.operation).toBe('move');
      expect(moveResult.type).toBe('file');
      
      // 11. Verify original is gone and moved file exists
      expect(fileHandle.exists()).toBe(false);
      const movedHandle = dataSource.file('test-lifecycle-moved.txt');
      expect(movedHandle.exists()).toBe(true);
      expect(movedHandle.content()).toBe(fullContent);
      
      // 12. Delete files
      copyHandle.delete();
      movedHandle.delete();
      expect(copyHandle.exists()).toBe(false);
      expect(movedHandle.exists()).toBe(false);
    });
    
    it('should handle file operations with different encodings', () => {
      const fileHandle = dataSource.file('encoding-test.txt');
      
      // Test UTF-8 (default)
      fileHandle.write('Hello 世界', 'utf8');
      expect(fileHandle.content('utf8')).toBe('Hello 世界');
      
      // Test Buffer
      const bufferContent = fileHandle.content('buffer');
      expect(Buffer.isBuffer(bufferContent)).toBe(true);
      
      // Test Base64
      const base64Content = fileHandle.content('base64');
      expect(typeof base64Content).toBe('string');
      expect(base64Content).toMatch(/^[A-Za-z0-9+/=]+$/);
      
      // Clean up
      fileHandle.delete();
    });
  });
  
  describe('End-to-End Directory Operations Workflow', () => {
    it('should perform complete directory lifecycle operations', () => {
      // 1. Create directory handle
      const dirHandle = dataSource.directory('test-dir-lifecycle');
      expect(dirHandle).toBeDefined();
      expect(dirHandle.path).toBe('test-dir-lifecycle');
      
      // 2. Check initial state (doesn't exist)
      expect(dirHandle.exists()).toBe(false);
      expect(dirHandle.children()).toEqual([]);
      
      // 3. Create directory
      const createResult = dirHandle.createDirectory('');
      expect(createResult.success).toBe(true);
      expect(createResult.operation).toBe('create');
      expect(createResult.type).toBe('directory');
      
      // 4. Verify directory exists
      expect(dirHandle.exists()).toBe(true);
      expect(dirHandle.isEmpty()).toBe(true);
      expect(dirHandle.count()).toBe(0);
      
      // 5. Create subdirectories and files
      dirHandle.createDirectory('subdir1');
      dirHandle.createDirectory('subdir2');
      dirHandle.createFile('file1.txt', 'content1');
      dirHandle.createFile('file2.txt', 'content2');
      
      // 6. Verify directory structure
      expect(dirHandle.isEmpty()).toBe(false);
      expect(dirHandle.count()).toBe(4);
      const entries = dirHandle.list();
      expect(entries).toHaveLength(4);
      
      // 7. Test filtering
      const files = dirHandle.list({ filter: { type: 'file' } });
      const dirs = dirHandle.list({ filter: { type: 'directory' } });
      expect(files).toHaveLength(2);
      expect(dirs).toHaveLength(2);
      
      // 8. Test navigation
      const subdir1 = dirHandle.child('subdir1');
      expect(subdir1.exists()).toBe(true);
      expect(subdir1.parent().path).toBe(dirHandle.path);
      
      // 9. Copy directory
      const copyResult = dirHandle.copyTo('test-dir-lifecycle-copy');
      expect(copyResult.success).toBe(true);
      expect(copyResult.operation).toBe('copy');
      expect(copyResult.type).toBe('directory');
      
      // 10. Verify copy
      const copyHandle = dataSource.directory('test-dir-lifecycle-copy');
      expect(copyHandle.exists()).toBe(true);
      expect(copyHandle.count()).toBe(4);
      
      // 11. Delete directories
      dirHandle.delete(true);
      copyHandle.delete(true);
      expect(dirHandle.exists()).toBe(false);
      expect(copyHandle.exists()).toBe(false);
    });
    
    it('should handle complex directory navigation scenarios', () => {
      // Test navigation on existing structure
      const webDir = dataSource.directory('documents/projects/web');
      
      // Test parent navigation
      const projectsDir = webDir.parent();
      expect(projectsDir.path).toBe('documents/projects');
      
      const documentsDir = projectsDir.parent();
      expect(documentsDir.path).toBe('documents');
      
      const rootDir = documentsDir.parent();
      expect(rootDir.path).toBe('');
      
      // Test root reference
      expect(webDir.root().path).toBe('');
      
      // Test ancestors
      const ancestors = webDir.ancestors();
      expect(ancestors).toHaveLength(3); // projects, documents, root
      expect(ancestors[0].path).toBe('documents/projects');
      expect(ancestors[1].path).toBe('documents');
      expect(ancestors[2].path).toBe('');
      
      // Test children
      const children = projectsDir.children();
      expect(children).toHaveLength(2); // web, mobile
      const childPaths = children.map(child => child.name());
      expect(childPaths).toContain('web');
      expect(childPaths).toContain('mobile');
      
      // Test descendant access
      const mobileDir = documentsDir.descendant('projects/mobile');
      expect(mobileDir.exists()).toBe(true);
      expect(mobileDir.path).toBe('documents/projects/mobile');
      
      // Test path resolution
      const templatesFromWeb = webDir.resolve('../../../documents/templates');
      expect(templatesFromWeb.path).toBe('documents/templates');
    });
  });
  
  describe('Advanced Query Operations Integration', () => {
    it('should perform complex search operations', () => {
      // Search for all JavaScript files
      const rootDir = dataSource.directory('');
      const jsFiles = rootDir.search('**/*.js', { recursive: true });
      expect(jsFiles).toHaveLength(1);
      expect(jsFiles[0].name).toBe('app.js');
      expect(jsFiles[0].relativePath).toBe('documents/projects/mobile/app.js');
      
      // Search for files containing specific content
      const htmlFiles = rootDir.findByContent('Hello World');
      expect(htmlFiles).toHaveLength(1);
      expect(htmlFiles[0].relativePath).toBe('documents/projects/web/index.html');
      
      // Test pattern matching
      const configFiles = rootDir.search('**/*.{json,ini}', { recursive: true });
      expect(configFiles).toHaveLength(2);
      const configNames = configFiles.map(f => f.name);
      expect(configNames).toContain('config.json');
      expect(configNames).toContain('database.ini');
    });
    
    it('should handle complex filtering and sorting', () => {
      const documentsDir = dataSource.directory('documents');
      
      // Filter by type and sort by name
      const entries = documentsDir.list({
        filter: { type: 'file' },
        sort: { by: 'name', order: 'asc' }
      });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('notes.txt');
      
      // Get all files recursively
      const allFiles = documentsDir.getAllFiles({ recursive: true });
      expect(allFiles.length).toBeGreaterThan(0);
      
      // Get all directories recursively  
      const allDirs = documentsDir.getAllDirectories({ recursive: true });
      expect(allDirs.length).toBeGreaterThan(0);
    });
  });
  
  describe('Subscription and Event Integration', () => {
    it('should handle complex subscription scenarios', (done) => {
      let eventCount = 0;
      const events = [];
      
      // Subscribe to multiple events
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: '',
        events: ['add', 'change', 'delete'],
        recursive: true
      }, (event) => {
        events.push(event);
        eventCount++;
        
        // After receiving multiple events, verify and cleanup
        if (eventCount >= 2) {
          expect(events).toHaveLength(eventCount);
          
          // Verify event types
          const eventTypes = events.map(e => e.type);
          expect(eventTypes).toContain('add');
          
          subscription.unsubscribe();
          done();
        }
      });
      
      // Trigger multiple events
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'watch-test1.txt'), 'content1');
      }, 50);
      
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'watch-test2.txt'), 'content2');
      }, 100);
    });
    
    it('should handle subscription cleanup properly', () => {
      const subscriptions = [];
      
      // Create multiple subscriptions
      for (let i = 0; i < 5; i++) {
        const subscription = dataSource.subscribe({
          operation: 'watch',
          path: 'README.md',
          events: ['change']
        }, () => {});
        subscriptions.push(subscription);
      }
      
      // Verify subscriptions are tracked
      expect(dataSource._subscriptions.size).toBe(5);
      expect(dataSource._watchers.size).toBe(5);
      
      // Unsubscribe all
      subscriptions.forEach(sub => sub.unsubscribe());
      
      // Verify cleanup
      expect(dataSource._subscriptions.size).toBe(0);
      expect(dataSource._watchers.size).toBe(0);
    });
  });
  
  describe('Handle Pattern Integration', () => {
    it('should work seamlessly with Handle pattern', () => {
      // Test file handle creation through dataSource
      const fileHandle = dataSource.file('README.md');
      expect(fileHandle.constructor.name).toBe('ServerFileHandle');
      expect(fileHandle.dataSource).toBe(dataSource);
      
      // Test directory handle creation through dataSource
      const dirHandle = dataSource.directory('documents');
      expect(dirHandle.constructor.name).toBe('ServerDirectoryHandle');
      expect(dirHandle.dataSource).toBe(dataSource);
      
      // Test handle method chaining
      const webDir = dataSource.directory('documents')
        .directory('projects')
        .directory('web');
      expect(webDir.exists()).toBe(true);
      
      // Test handle cross-references
      const indexFile = webDir.file('index.html');
      const parentFromFile = indexFile.parent();
      expect(parentFromFile.path).toBe(webDir.path);
      
      // Test sibling access
      const stylesFile = indexFile.sibling('styles.css');
      expect(stylesFile.exists()).toBe(true);
    });
    
    it('should handle complex path operations', () => {
      const fileHandle = dataSource.file('documents/projects/web/index.html');
      
      // Test path properties
      expect(fileHandle.name()).toBe('index.html');
      expect(fileHandle.basename()).toBe('index');
      expect(fileHandle.extension()).toBe('.html');
      expect(fileHandle.dirname()).toBe('documents/projects/web');
      
      // Test path analysis
      expect(fileHandle.depth()).toBe(4);
      expect(fileHandle.pathSegments()).toEqual(['documents', 'projects', 'web', 'index.html']);
      
      // Test path relationships
      expect(fileHandle.isDescendantOf('documents/projects')).toBe(true);
      expect(fileHandle.isDescendantOf('documents/projects/web')).toBe(false); // Direct parent, not ancestor
      
      // Test pattern matching
      expect(fileHandle.matches('**/*.html')).toBe(true);
      expect(fileHandle.matches('**/*.js')).toBe(false);
      expect(fileHandle.matches(/\.html$/)).toBe(true);
      
      // Test absolute path
      const absolutePath = fileHandle.absolutePath();
      expect(absolutePath).toContain(testRoot);
      expect(absolutePath.endsWith('documents/projects/web/index.html')).toBe(true);
    });
  });
  
  describe('Error Handling Integration', () => {
    it('should maintain error handling across complex operations', () => {
      // Test error handling in chained operations
      expect(() => {
        dataSource.directory('non-existent')
          .child('also-non-existent')
          .value();
      }).toThrow('Directory not found');
      
      // Test error handling in search operations
      expect(() => {
        dataSource.directory('non-existent')
          .search('**/*');
      }).toThrow('Path does not exist');
      
      // Test error handling in file operations
      const nonExistentFile = dataSource.file('does-not-exist.txt');
      expect(() => {
        nonExistentFile.content();
      }).toThrow('File not found');
      
      // Test security validation in complex paths
      expect(() => {
        dataSource.file('documents/../../../etc/passwd');
      }).toThrow('Path traversal not allowed');
    });
    
    it('should handle edge cases gracefully', () => {
      // Test operations on empty directories
      const emptyDir = dataSource.directory('documents/templates');
      expect(emptyDir.isEmpty()).toBe(false); // Contains letter.docx
      expect(emptyDir.children()).toHaveLength(0); // No subdirectories
      
      // Test operations with special characters
      const specialFile = dataSource.file('test file with spaces & symbols!.txt');
      specialFile.write('content');
      expect(specialFile.exists()).toBe(true);
      expect(specialFile.content()).toBe('content');
      specialFile.delete();
      
      // Test Unicode handling
      const unicodeFile = dataSource.file('测试文件.txt');
      unicodeFile.write('Unicode content 🚀');
      expect(unicodeFile.exists()).toBe(true);
      expect(unicodeFile.content()).toBe('Unicode content 🚀');
      unicodeFile.delete();
    });
  });
  
  describe('Performance and Memory Integration', () => {
    it('should handle high-volume operations efficiently', () => {
      const startTime = Date.now();
      
      // Create many handles
      const handles = [];
      for (let i = 0; i < 100; i++) {
        handles.push(dataSource.file(`test-${i}.txt`));
        handles.push(dataSource.directory(`dir-${i}`));
      }
      
      // Perform operations on all handles
      handles.forEach(handle => {
        if (handle.constructor.name === 'ServerFileHandle') {
          handle.exists();
          handle.size();
        } else {
          handle.exists();
          // Only check isEmpty() if directory exists
          if (handle.exists()) {
            handle.isEmpty();
          }
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Memory should not blow up
      expect(handles).toHaveLength(200);
    });
    
    it('should handle concurrent operations safely', (done) => {
      const promises = [];
      const results = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 20; i++) {
        promises.push(
          new Promise((resolve) => {
            try {
              // Mix of different operations
              if (i % 4 === 0) {
                const result = dataSource.query({
                  type: 'file',
                  path: 'README.md',
                  operation: 'metadata'
                });
                resolve({ type: 'metadata', success: true, result });
              } else if (i % 4 === 1) {
                const result = dataSource.query({
                  type: 'directory',
                  path: 'documents',
                  operation: 'list'
                });
                resolve({ type: 'list', success: true, result });
              } else if (i % 4 === 2) {
                const handle = dataSource.file('README.md');
                const result = handle.content();
                resolve({ type: 'content', success: true, result });
              } else {
                const handle = dataSource.directory('documents');
                const result = handle.count();
                resolve({ type: 'count', success: true, result });
              }
            } catch (error) {
              resolve({ success: false, error: error.message });
            }
          })
        );
      }
      
      Promise.all(promises).then(results => {
        // All operations should succeed
        const successes = results.filter(r => r.success);
        expect(successes).toHaveLength(20);
        
        // Verify different operation types were executed
        const types = results.map(r => r.type);
        expect(types).toContain('metadata');
        expect(types).toContain('list');
        expect(types).toContain('content');
        expect(types).toContain('count');
        
        done();
      });
    });
  });
  
  describe('Real-World Usage Scenarios', () => {
    it('should support file tree exploration workflow', () => {
      // Scenario: Building a file tree UI
      const rootDir = dataSource.directory('');
      
      // Get top-level structure
      const topLevel = rootDir.list();
      expect(topLevel.length).toBeGreaterThan(0);
      
      // Build tree recursively with depth protection
      function buildTree(dir, maxDepth = 5, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
          return {
            path: dir.path,
            name: dir.name(),
            type: 'directory',
            children: [],
            truncated: true
          };
        }
        
        const tree = {
          path: dir.path,
          name: dir.name(),
          type: 'directory',
          children: []
        };
        
        try {
          const entries = dir.list();
          for (const entry of entries) {
            if (entry.isDirectory) {
              // Use the correct path for the entry - entry.name is the direct child name
              const childPath = dir.path ? `${dir.path}/${entry.name}` : entry.name;
              const childDir = dataSource.directory(childPath);
              tree.children.push(buildTree(childDir, maxDepth, currentDepth + 1));
            } else {
              tree.children.push({
                path: entry.relativePath,
                name: entry.name,
                type: 'file',
                size: entry.size
              });
            }
          }
        } catch (error) {
          // Handle directories that can't be listed
          tree.error = error.message;
        }
        
        return tree;
      }
      
      const fileTree = buildTree(rootDir);
      expect(fileTree.children.length).toBeGreaterThan(0);
      expect(fileTree.children.some(child => child.name === 'documents')).toBe(true);
    });
    
    it('should support search and filter workflow', () => {
      // Scenario: Finding files by criteria
      const rootDir = dataSource.directory('');
      
      // Find all text files
      const textFiles = rootDir.search('**/*.{txt,md}', { recursive: true });
      expect(textFiles.length).toBeGreaterThan(0);
      
      // Find files by content
      const projectFiles = rootDir.findByContent('project', { recursive: true });
      expect(projectFiles.length).toBeGreaterThan(0);
      
      // Find large files (> 10 bytes)
      const allFiles = rootDir.search('**/*', { recursive: true });
      const largeFiles = allFiles.filter(file => {
        try {
          const handle = dataSource.file(file.relativePath);
          return handle.size() > 10;
        } catch {
          return false;
        }
      });
      expect(largeFiles.length).toBeGreaterThan(0);
    });
    
    it('should support backup and sync workflow', () => {
      // Scenario: Backing up files
      const backupDir = dataSource.directory('backup');
      backupDir.createDirectory('');
      
      // Copy important files
      const readmeFile = dataSource.file('README.md');
      const configFile = dataSource.file('config.json');
      
      readmeFile.copyTo('backup/README.md');
      configFile.copyTo('backup/config.json');
      
      // Verify backups
      const backupReadme = dataSource.file('backup/README.md');
      const backupConfig = dataSource.file('backup/config.json');
      
      expect(backupReadme.exists()).toBe(true);
      expect(backupConfig.exists()).toBe(true);
      expect(backupReadme.content()).toBe(readmeFile.content());
      expect(backupConfig.content()).toBe(configFile.content());
      
      // Cleanup
      backupDir.delete(true);
    });
    
    it('should support monitoring and automation workflow', (done) => {
      // Scenario: Automated file processing
      const processedFiles = [];
      
      // Set up monitoring
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: '',
        events: ['add'],
        recursive: false
      }, (event) => {
        if (event.filename && event.filename.endsWith('.txt')) {
          // Auto-process text files
          const fileHandle = dataSource.file(event.filename);
          const content = fileHandle.content();
          const processedContent = content.toUpperCase();
          
          const processedFile = `processed-${event.filename}`;
          dataSource.file(processedFile).write(processedContent);
          
          processedFiles.push(processedFile);
          
          if (processedFiles.length >= 2) {
            subscription.unsubscribe();
            
            // Verify processing
            expect(processedFiles).toHaveLength(2);
            processedFiles.forEach(filename => {
              const handle = dataSource.file(filename);
              expect(handle.exists()).toBe(true);
              handle.delete(); // Cleanup
            });
            
            done();
          }
        }
      });
      
      // Create files to trigger processing
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'auto1.txt'), 'hello world');
      }, 50);
      
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'auto2.txt'), 'another file');
      }, 100);
    });
  });
});