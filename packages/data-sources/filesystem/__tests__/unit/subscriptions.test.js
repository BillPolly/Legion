/**
 * Unit tests for FileSystemDataSource subscription operations
 * Tests file watching, event handling, and subscriptions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemDataSource - subscriptions', () => {
  const testRoot = path.join(__dirname, '../tmp/subscription-test');
  let dataSource;
  
  beforeAll(() => {
    // Create test directory
    fs.mkdirSync(testRoot, { recursive: true });
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    // Clean directory contents
    const files = fs.readdirSync(testRoot);
    for (const file of files) {
      const filePath = path.join(testRoot, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  });
  
  describe('basic subscription operations', () => {
    it('should subscribe to file changes', (done) => {
      // Create test file
      const testFile = path.join(testRoot, 'watch.txt');
      fs.writeFileSync(testFile, 'initial content');
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'watch.txt',
        events: ['change']
      }, (event) => {
        expect(event).toBeDefined();
        expect(event.type).toBe('change');
        expect(event.path).toContain('watch.txt');
        subscription.unsubscribe();
        done();
      });
      
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.unsubscribe).toBeInstanceOf(Function);
      
      // Trigger change event
      setTimeout(() => {
        fs.writeFileSync(testFile, 'changed content');
      }, 50);
    });
    
    it('should subscribe to directory changes', (done) => {
      fs.mkdirSync(path.join(testRoot, 'watchdir'));
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'watchdir',
        events: ['add']
      }, (event) => {
        expect(event).toBeDefined();
        expect(event.type).toBe('add');
        expect(event.filename).toBe('newfile.txt');
        subscription.unsubscribe();
        done();
      });
      
      // Add file to directory
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'watchdir/newfile.txt'), 'content');
      }, 50);
    });
    
    it('should return subscription object with id and unsubscribe', () => {
      fs.writeFileSync(path.join(testRoot, 'test.txt'), 'content');
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'test.txt',
        events: ['change']
      }, () => {});
      
      expect(subscription).toHaveProperty('id');
      expect(typeof subscription.id).toBe('number');
      expect(subscription).toHaveProperty('unsubscribe');
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Clean up
      subscription.unsubscribe();
    });
    
    it('should unsubscribe from changes', (done) => {
      const testFile = path.join(testRoot, 'unsub.txt');
      fs.writeFileSync(testFile, 'initial');
      
      let callCount = 0;
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'unsub.txt',
        events: ['change']
      }, () => {
        callCount++;
      });
      
      // First change should trigger callback
      setTimeout(() => {
        fs.writeFileSync(testFile, 'change1');
      }, 50);
      
      // Unsubscribe after first change
      setTimeout(() => {
        expect(callCount).toBe(1);
        subscription.unsubscribe();
        
        // Second change should NOT trigger callback
        fs.writeFileSync(testFile, 'change2');
      }, 100);
      
      // Verify callback wasn't called again
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 150);
    });
    
    it('should handle multiple subscriptions', () => {
      fs.writeFileSync(path.join(testRoot, 'multi.txt'), 'content');
      
      const subscription1 = dataSource.subscribe({
        operation: 'watch',
        path: 'multi.txt',
        events: ['change']
      }, () => {});
      
      const subscription2 = dataSource.subscribe({
        operation: 'watch',
        path: 'multi.txt',
        events: ['change']
      }, () => {});
      
      expect(subscription1.id).not.toBe(subscription2.id);
      
      // Clean up
      subscription1.unsubscribe();
      subscription2.unsubscribe();
    });
  });
  
  describe('event types', () => {
    it('should detect file additions', (done) => {
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: '',
        events: ['add'],
        recursive: false
      }, (event) => {
        expect(event.type).toBe('add');
        expect(event.filename).toBe('added.txt');
        subscription.unsubscribe();
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'added.txt'), 'new file');
      }, 50);
    });
    
    it('should detect file deletions', (done) => {
      const testFile = path.join(testRoot, 'delete.txt');
      fs.writeFileSync(testFile, 'will be deleted');
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: '',
        events: ['delete'],
        recursive: false
      }, (event) => {
        expect(event.type).toBe('delete');
        expect(event.filename).toBe('delete.txt');
        subscription.unsubscribe();
        done();
      });
      
      setTimeout(() => {
        fs.unlinkSync(testFile);
      }, 50);
    });
    
    it('should detect file renames', (done) => {
      const oldPath = path.join(testRoot, 'old.txt');
      fs.writeFileSync(oldPath, 'content');
      
      // Wait for filesystem to settle after file creation
      setTimeout(() => {
        let eventsReceived = [];
        const subscription = dataSource.subscribe({
          operation: 'watch',
          path: '',
          events: ['add', 'delete'], // Renames generate delete + add events
          recursive: false
        }, (event) => {
          eventsReceived.push(event);
          
          // A rename produces two events: delete (old name) and add (new name)
          if (eventsReceived.length >= 2) {
            // Check that we got both delete and add
            const types = eventsReceived.map(e => e.type).sort();
            expect(types).toEqual(['add', 'delete']);
            
            // Check filenames
            const filenames = eventsReceived.map(e => e.filename).sort();
            expect(filenames).toEqual(['new.txt', 'old.txt']);
            
            subscription.unsubscribe();
            done();
          }
        });
        
        // Perform the rename after subscription is set up
        setTimeout(() => {
          try {
            fs.renameSync(oldPath, path.join(testRoot, 'new.txt'));
          } catch (error) {
            subscription.unsubscribe();
            done(error);
          }
        }, 50);
      }, 100); // Wait 100ms for filesystem to settle
    });
  });
  
  describe('recursive watching', () => {
    it('should watch subdirectories recursively', (done) => {
      fs.mkdirSync(path.join(testRoot, 'parent'));
      fs.mkdirSync(path.join(testRoot, 'parent/child'));
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'parent',
        events: ['add'],
        recursive: true
      }, (event) => {
        expect(event.type).toBe('add');
        expect(event.path).toContain('child');
        subscription.unsubscribe();
        done();
      });
      
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'parent/child/nested.txt'), 'nested');
      }, 50);
    });
    
    it('should not watch subdirectories when recursive is false', (done) => {
      fs.mkdirSync(path.join(testRoot, 'parent2'));
      fs.mkdirSync(path.join(testRoot, 'parent2/child'));
      
      let callCount = 0;
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'parent2',
        events: ['add'],
        recursive: false
      }, () => {
        callCount++;
      });
      
      // Add file in subdirectory - should not trigger
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'parent2/child/nested.txt'), 'nested');
      }, 50);
      
      // Add file in parent directory - should trigger
      setTimeout(() => {
        fs.writeFileSync(path.join(testRoot, 'parent2/direct.txt'), 'direct');
      }, 100);
      
      setTimeout(() => {
        expect(callCount).toBe(1);
        subscription.unsubscribe();
        done();
      }, 150);
    });
  });
  
  describe('error handling', () => {
    it('should throw error if callback is not provided', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: '',
          events: ['change']
        });
      }).toThrow('Subscribe requires a callback function');
    });
    
    it('should throw error if callback is not a function', () => {
      expect(() => {
        dataSource.subscribe({
          operation: 'watch',
          path: '',
          events: ['change']
        }, 'not a function');
      }).toThrow('Subscribe requires a callback function');
    });
    
    it('should handle watching non-existent path gracefully', () => {
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'non-existent',
        events: ['change']
      }, (event) => {
        // Should handle error event
        if (event.type === 'error') {
          expect(event.error).toBeDefined();
        }
      });
      
      expect(subscription).toBeDefined();
      subscription.unsubscribe();
    });
  });
  
  describe('subscription cleanup', () => {
    it('should clean up watchers on unsubscribe', () => {
      fs.writeFileSync(path.join(testRoot, 'cleanup.txt'), 'content');
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'cleanup.txt',
        events: ['change']
      }, () => {});
      
      const watcherId = subscription.id;
      expect(dataSource._subscriptions.has(watcherId)).toBe(true);
      expect(dataSource._watchers.has(watcherId)).toBe(true);
      
      subscription.unsubscribe();
      
      expect(dataSource._subscriptions.has(watcherId)).toBe(false);
      expect(dataSource._watchers.has(watcherId)).toBe(false);
    });
    
    it('should handle multiple unsubscribe calls gracefully', () => {
      fs.writeFileSync(path.join(testRoot, 'multi-unsub.txt'), 'content');
      
      const subscription = dataSource.subscribe({
        operation: 'watch',
        path: 'multi-unsub.txt',
        events: ['change']
      }, () => {});
      
      // Should not throw on multiple unsubscribes
      expect(() => {
        subscription.unsubscribe();
        subscription.unsubscribe();
        subscription.unsubscribe();
      }).not.toThrow();
    });
  });
});