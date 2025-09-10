/**
 * Unit tests for LayoutPersistenceManager
 * Tests layout state saving, restoration, versioning, and export/import functionality
 */

import { jest } from '@jest/globals';
import { LayoutPersistenceManager } from '../../../../src/renderers/diagram/layout/LayoutPersistenceManager.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock localStorage
const mockStorage = new Map();
global.localStorage = {
  getItem: jest.fn(key => mockStorage.get(key) || null),
  setItem: jest.fn((key, value) => mockStorage.set(key, value)),
  removeItem: jest.fn(key => mockStorage.delete(key))
};

// Mock sessionStorage
const mockSessionStorage = new Map();
global.sessionStorage = {
  getItem: jest.fn(key => mockSessionStorage.get(key) || null),
  setItem: jest.fn((key, value) => mockSessionStorage.set(key, value)),
  removeItem: jest.fn(key => mockSessionStorage.delete(key))
};

const createSampleLayoutData = () => ({
  positions: new Map([
    ['node1', { x: 100, y: 200, width: 80, height: 60 }],
    ['node2', { x: 300, y: 150, width: 80, height: 60 }],
    ['node3', { x: 500, y: 250, width: 80, height: 60 }]
  ]),
  bounds: { x: 50, y: 100, width: 500, height: 200 },
  edges: new Map([
    ['e1', { path: [{ x: 140, y: 230 }, { x: 300, y: 180 }] }],
    ['e2', { path: [{ x: 340, y: 180 }, { x: 500, y: 280 }] }]
  ]),
  metadata: {
    algorithm: 'force-directed',
    nodeCount: 3,
    edgeCount: 2,
    executionTime: 150
  }
});

describe('LayoutPersistenceManager', () => {
  let persistenceManager;
  let sampleLayoutData;
  let mockOnSave, mockOnRestore, mockOnError, mockOnVersionCreated;

  beforeEach(async () => {
    mockStorage.clear();
    mockSessionStorage.clear();
    sampleLayoutData = createSampleLayoutData();
    
    // Mock callbacks
    mockOnSave = jest.fn();
    mockOnRestore = jest.fn();
    mockOnError = jest.fn();
    mockOnVersionCreated = jest.fn();
    
    jest.clearAllMocks();
    performance.now.mockReturnValue(1000);
  });

  afterEach(() => {
    if (persistenceManager) {
      persistenceManager.destroy();
      persistenceManager = null;
    }
  });

  describe('Initialization', () => {
    test('should create persistence manager with default configuration', () => {
      persistenceManager = new LayoutPersistenceManager();

      expect(persistenceManager).toBeDefined();
      expect(persistenceManager.config.storageType).toBe('localStorage');
      expect(persistenceManager.config.storagePrefix).toBe('showme-layout');
      expect(persistenceManager.config.autoSave).toBe(true);
      expect(persistenceManager.config.autoSaveDelay).toBe(1000);
      expect(persistenceManager.config.enableVersioning).toBe(true);
      expect(persistenceManager.config.maxVersions).toBe(10);
      expect(persistenceManager.config.versionNaming).toBe('timestamp');
      expect(persistenceManager.config.includeMetadata).toBe(true);
      expect(persistenceManager.config.includeEdgePaths).toBe(true);
      expect(persistenceManager.config.includeViewState).toBe(true);
      expect(persistenceManager.config.enableAutoRestore).toBe(true);
      expect(persistenceManager.config.gracefulFallback).toBe(true);
      expect(persistenceManager.isInitialized).toBe(false);
    });

    test('should accept custom configuration', () => {
      persistenceManager = new LayoutPersistenceManager({
        storageType: 'sessionStorage',
        storagePrefix: 'custom-prefix',
        autoSave: false,
        autoSaveDelay: 2000,
        enableVersioning: false,
        maxVersions: 5,
        versionNaming: 'sequential',
        includeMetadata: false,
        includeEdgePaths: false,
        includeViewState: false,
        compressData: true,
        enableAutoRestore: false,
        gracefulFallback: false,
        onSave: mockOnSave,
        onRestore: mockOnRestore,
        onError: mockOnError,
        onVersionCreated: mockOnVersionCreated
      });

      expect(persistenceManager.config.storageType).toBe('sessionStorage');
      expect(persistenceManager.config.storagePrefix).toBe('custom-prefix');
      expect(persistenceManager.config.autoSave).toBe(false);
      expect(persistenceManager.config.autoSaveDelay).toBe(2000);
      expect(persistenceManager.config.enableVersioning).toBe(false);
      expect(persistenceManager.config.maxVersions).toBe(5);
      expect(persistenceManager.config.versionNaming).toBe('sequential');
      expect(persistenceManager.config.includeMetadata).toBe(false);
      expect(persistenceManager.config.includeEdgePaths).toBe(false);
      expect(persistenceManager.config.includeViewState).toBe(false);
      expect(persistenceManager.config.compressData).toBe(true);
      expect(persistenceManager.config.enableAutoRestore).toBe(false);
      expect(persistenceManager.config.gracefulFallback).toBe(false);
      expect(persistenceManager.config.onSave).toBe(mockOnSave);
      expect(persistenceManager.config.onRestore).toBe(mockOnRestore);
      expect(persistenceManager.config.onError).toBe(mockOnError);
      expect(persistenceManager.config.onVersionCreated).toBe(mockOnVersionCreated);
    });

    test('should initialize successfully', async () => {
      persistenceManager = new LayoutPersistenceManager();
      
      const result = await persistenceManager.initialize();
      
      expect(result).toBe(persistenceManager);
      expect(persistenceManager.isInitialized).toBe(true);
      expect(persistenceManager.storageInterface).toBeDefined();
    });

    test('should return immediately if already initialized', async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
      
      const result = await persistenceManager.initialize();
      
      expect(result).toBe(persistenceManager);
      expect(persistenceManager.isInitialized).toBe(true);
    });

    test('should handle initialization errors', async () => {
      persistenceManager = new LayoutPersistenceManager({
        onError: mockOnError
      });

      // Mock storage interface to throw error
      persistenceManager._createStorageInterface = () => ({
        initialize: () => { throw new Error('Storage initialization failed'); }
      });

      await expect(persistenceManager.initialize()).rejects.toThrow('Storage initialization failed');
      expect(mockOnError).toHaveBeenCalledWith('initialization', expect.any(Error));
    });
  });

  describe('Storage Interface Creation', () => {
    beforeEach(() => {
      persistenceManager = new LayoutPersistenceManager();
    });

    test('should create localStorage interface by default', () => {
      const storageInterface = persistenceManager._createStorageInterface();
      
      expect(storageInterface.constructor.name).toBe('LocalStorageInterface');
    });

    test('should create sessionStorage interface', () => {
      persistenceManager.config.storageType = 'sessionStorage';
      const storageInterface = persistenceManager._createStorageInterface();
      
      expect(storageInterface.constructor.name).toBe('SessionStorageInterface');
    });

    test('should create memory storage interface', () => {
      persistenceManager.config.storageType = 'memory';
      const storageInterface = persistenceManager._createStorageInterface();
      
      expect(storageInterface.constructor.name).toBe('MemoryStorageInterface');
    });

    test('should create file storage interface', () => {
      persistenceManager.config.storageType = 'file';
      const storageInterface = persistenceManager._createStorageInterface();
      
      expect(storageInterface.constructor.name).toBe('FileStorageInterface');
    });
  });

  describe('Layout Saving', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager({
        onSave: mockOnSave,
        onVersionCreated: mockOnVersionCreated,
        onError: mockOnError
      });
      await persistenceManager.initialize();
    });

    test('should save layout successfully', async () => {
      const layoutId = 'test-layout';
      
      const snapshot = await persistenceManager.saveLayout(layoutId, sampleLayoutData);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBe(layoutId);
      expect(snapshot.version).toBeDefined();
      expect(snapshot.name).toContain(layoutId);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.data).toBeDefined();
      expect(snapshot.data.positions).toBeDefined();
      expect(snapshot.metadata).toBeDefined();
      expect(persistenceManager.stats.totalSaves).toBe(1);
      expect(mockOnSave).toHaveBeenCalledWith(layoutId, snapshot);
      expect(mockOnVersionCreated).toHaveBeenCalledWith(layoutId, snapshot.version, snapshot);
    });

    test('should throw error if not initialized', async () => {
      persistenceManager.isInitialized = false;
      
      await expect(persistenceManager.saveLayout('test', sampleLayoutData))
        .rejects.toThrow('LayoutPersistenceManager not initialized');
    });

    test('should handle save errors', async () => {
      // Mock storage interface to fail
      persistenceManager.storageInterface.save = jest.fn(() => {
        throw new Error('Storage save failed');
      });

      await expect(persistenceManager.saveLayout('test', sampleLayoutData))
        .rejects.toThrow('Storage save failed');
      expect(mockOnError).toHaveBeenCalledWith('save', expect.any(Error), 'test');
    });

    test('should save with custom options', async () => {
      const options = {
        name: 'Custom Layout Name',
        metadata: { customProp: 'value' },
        viewState: { zoom: 1.5, pan: { x: 100, y: 50 } },
        isAutoSave: true
      };

      const snapshot = await persistenceManager.saveLayout('test', sampleLayoutData, options);

      expect(snapshot.name).toBe('Custom Layout Name');
      expect(snapshot.metadata.customProp).toBe('value');
      expect(snapshot.viewState).toEqual({ zoom: 1.5, pan: { x: 100, y: 50 } });
      expect(snapshot.isAutoSave).toBe(true);
    });

    test('should update layout history', async () => {
      await persistenceManager.saveLayout('test', sampleLayoutData);
      
      expect(persistenceManager.layoutHistory.has('test')).toBe(true);
      const versions = persistenceManager.layoutHistory.get('test');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBeDefined();
    });

    test('should clean up old versions when maxVersions exceeded', async () => {
      persistenceManager.config.maxVersions = 2;
      
      // Save 3 versions
      await persistenceManager.saveLayout('test', sampleLayoutData, { name: 'V1' });
      await persistenceManager.saveLayout('test', sampleLayoutData, { name: 'V2' });
      await persistenceManager.saveLayout('test', sampleLayoutData, { name: 'V3' });
      
      const versions = persistenceManager.layoutHistory.get('test');
      expect(versions.length).toBeLessThanOrEqual(2);
    });

    test('should not clean up versions when versioning disabled', async () => {
      persistenceManager.config.enableVersioning = false;
      
      await persistenceManager.saveLayout('test', sampleLayoutData);
      
      // Should not call cleanup
      expect(persistenceManager.layoutHistory.get('test')).toHaveLength(1);
    });
  });

  describe('Layout Restoration', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager({
        onRestore: mockOnRestore,
        onError: mockOnError
      });
      await persistenceManager.initialize();
      
      // Save a layout first
      await persistenceManager.saveLayout('test-layout', sampleLayoutData);
    });

    test('should restore layout successfully', async () => {
      const restoredData = await persistenceManager.restoreLayout('test-layout');
      
      expect(restoredData).toBeDefined();
      expect(restoredData.positions).toBeInstanceOf(Map);
      expect(restoredData.positions.size).toBe(3);
      expect(restoredData.bounds).toEqual(sampleLayoutData.bounds);
      expect(restoredData.metadata.restored).toBe(true);
      expect(persistenceManager.stats.totalRestores).toBe(1);
      expect(mockOnRestore).toHaveBeenCalled();
    });

    test('should throw error if not initialized', async () => {
      persistenceManager.isInitialized = false;
      
      await expect(persistenceManager.restoreLayout('test'))
        .rejects.toThrow('LayoutPersistenceManager not initialized');
    });

    test('should throw error for non-existent layout', async () => {
      await expect(persistenceManager.restoreLayout('non-existent'))
        .rejects.toThrow('No layout found for ID: non-existent');
    });

    test('should restore specific version', async () => {
      // Save multiple versions
      const snapshot1 = await persistenceManager.saveLayout('test', sampleLayoutData, { name: 'V1' });
      const snapshot2 = await persistenceManager.saveLayout('test', sampleLayoutData, { name: 'V2' });
      
      const restoredData = await persistenceManager.restoreLayout('test', { version: snapshot1.version });
      
      expect(restoredData.metadata.restoredFrom).toBe(snapshot1.version);
    });

    test('should handle restore errors gracefully with fallback', async () => {
      persistenceManager.config.gracefulFallback = true;
      
      // Mock storage to fail
      persistenceManager.storageInterface.load = jest.fn(() => {
        throw new Error('Storage load failed');
      });

      const fallbackData = await persistenceManager.restoreLayout('test');
      
      expect(fallbackData.positions).toBeInstanceOf(Map);
      expect(fallbackData.positions.size).toBe(0);
      expect(fallbackData.metadata.restored).toBe(false);
      expect(mockOnError).toHaveBeenCalled();
    });

    test('should throw error without graceful fallback', async () => {
      persistenceManager.config.gracefulFallback = false;
      
      // Mock storage to fail
      persistenceManager.storageInterface.load = jest.fn(() => {
        throw new Error('Storage load failed');
      });

      await expect(persistenceManager.restoreLayout('test'))
        .rejects.toThrow('Storage load failed');
    });

    test('should validate snapshot on restore', async () => {
      // Mock invalid snapshot
      persistenceManager.storageInterface.load = jest.fn(() => ({}));

      await expect(persistenceManager.restoreLayout('test'))
        .rejects.toThrow('Invalid snapshot structure');
    });
  });

  describe('Auto-Save Functionality', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager({
        autoSave: true,
        autoSaveDelay: 100
      });
      await persistenceManager.initialize();
    });

    test('should schedule auto-save with debouncing', async () => {
      persistenceManager.scheduleAutoSave('test', sampleLayoutData);
      
      expect(persistenceManager.autoSaveTimeout).toBeDefined();
    });

    test('should not schedule auto-save when disabled', () => {
      persistenceManager.config.autoSave = false;
      
      persistenceManager.scheduleAutoSave('test', sampleLayoutData);
      
      expect(persistenceManager.autoSaveTimeout).toBeNull();
    });

    test('should clear existing timeout when scheduling new save', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      persistenceManager.scheduleAutoSave('test', sampleLayoutData);
      persistenceManager.scheduleAutoSave('test', sampleLayoutData);
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    test('should execute auto-save after delay', (done) => {
      persistenceManager.scheduleAutoSave('test', sampleLayoutData);
      
      setTimeout(async () => {
        expect(persistenceManager.stats.totalSaves).toBe(1);
        done();
      }, 150);
    });
  });

  describe('Layout Management', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
      
      // Save multiple layouts
      await persistenceManager.saveLayout('layout1', sampleLayoutData, { name: 'First Layout' });
      await persistenceManager.saveLayout('layout2', sampleLayoutData, { name: 'Second Layout' });
      await persistenceManager.saveLayout('layout1', sampleLayoutData, { name: 'Updated First' });
    });

    test('should list all layouts', () => {
      const layouts = persistenceManager.listLayouts();
      
      expect(layouts).toHaveLength(2);
      expect(layouts.find(l => l.id === 'layout1')).toBeDefined();
      expect(layouts.find(l => l.id === 'layout2')).toBeDefined();
      expect(layouts[0].lastModified).toBeGreaterThanOrEqual(layouts[1].lastModified);
    });

    test('should get layout versions', () => {
      const versions = persistenceManager.getLayoutVersions('layout1');
      
      expect(versions).toHaveLength(2);
      expect(versions[0].name).toBe('First Layout');
      expect(versions[1].name).toBe('Updated First');
    });

    test('should delete specific layout version', async () => {
      const versions = persistenceManager.getLayoutVersions('layout1');
      const firstVersion = versions[0].version;
      
      const result = await persistenceManager.deleteLayout('layout1', { version: firstVersion });
      
      expect(result).toBe(true);
      expect(persistenceManager.getLayoutVersions('layout1')).toHaveLength(1);
    });

    test('should delete entire layout', async () => {
      const result = await persistenceManager.deleteLayout('layout2');
      
      expect(result).toBe(true);
      expect(persistenceManager.layoutHistory.has('layout2')).toBe(false);
    });

    test('should handle deletion errors', async () => {
      // Mock storage to fail
      persistenceManager.storageInterface.delete = jest.fn(() => {
        throw new Error('Delete failed');
      });

      const result = await persistenceManager.deleteLayout('layout1');
      
      expect(result).toBe(false);
    });
  });

  describe('Export/Import Functionality', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
      
      await persistenceManager.saveLayout('export-test', sampleLayoutData, { name: 'Export Test' });
    });

    test('should export single layout version', async () => {
      const exported = await persistenceManager.exportLayout('export-test');
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.layoutId).toBe('export-test');
      expect(parsed.format).toBe('single-version');
      expect(parsed.snapshot).toBeDefined();
    });

    test('should export all versions', async () => {
      // Add another version
      await persistenceManager.saveLayout('export-test', sampleLayoutData, { name: 'Second Version' });
      
      const exported = await persistenceManager.exportLayout('export-test', { includeVersions: true });
      const parsed = JSON.parse(exported);
      
      expect(parsed.format).toBe('multi-version');
      expect(parsed.versions).toHaveLength(2);
    });

    test('should export in different formats', async () => {
      const compactExport = await persistenceManager.exportLayout('export-test', { format: 'compact' });
      const objectExport = await persistenceManager.exportLayout('export-test', { format: 'object' });
      
      expect(typeof compactExport).toBe('string');
      expect(JSON.parse(compactExport)).toBeDefined();
      expect(typeof objectExport).toBe('object');
    });

    test('should import layout successfully', async () => {
      const exported = await persistenceManager.exportLayout('export-test');
      
      const importedId = await persistenceManager.importLayout(exported, { layoutId: 'imported-layout' });
      
      expect(importedId).toBe('imported-layout');
      expect(persistenceManager.layoutHistory.has('imported-layout')).toBe(true);
    });

    test('should import multi-version layout', async () => {
      // Add multiple versions
      await persistenceManager.saveLayout('multi-test', sampleLayoutData, { name: 'V1' });
      await persistenceManager.saveLayout('multi-test', sampleLayoutData, { name: 'V2' });
      
      const exported = await persistenceManager.exportLayout('multi-test', { includeVersions: true });
      
      const importedId = await persistenceManager.importLayout(exported, { layoutId: 'multi-imported' });
      
      expect(importedId).toBe('multi-imported');
      expect(persistenceManager.getLayoutVersions('multi-imported')).toHaveLength(2);
    });

    test('should reject import of existing layout without overwrite', async () => {
      const exported = await persistenceManager.exportLayout('export-test');
      
      await expect(persistenceManager.importLayout(exported, { layoutId: 'export-test' }))
        .rejects.toThrow('already exists');
    });

    test('should import with overwrite option', async () => {
      const exported = await persistenceManager.exportLayout('export-test');
      
      const importedId = await persistenceManager.importLayout(exported, { 
        layoutId: 'export-test',
        overwrite: true
      });
      
      expect(importedId).toBe('export-test');
    });

    test('should handle export errors', async () => {
      // Mock restoreLayout to fail
      const originalRestore = persistenceManager.restoreLayout;
      persistenceManager.restoreLayout = () => { throw new Error('Restore failed'); };

      await expect(persistenceManager.exportLayout('export-test'))
        .rejects.toThrow('Restore failed');

      persistenceManager.restoreLayout = originalRestore;
    });

    test('should handle invalid import data', async () => {
      await expect(persistenceManager.importLayout('invalid json'))
        .rejects.toThrow();
    });
  });

  describe('Storage Size and Statistics', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
    });

    test('should track statistics correctly', async () => {
      await persistenceManager.saveLayout('stats-test', sampleLayoutData);
      await persistenceManager.restoreLayout('stats-test');
      
      const stats = persistenceManager.getStats();
      
      expect(stats.totalSaves).toBe(1);
      expect(stats.totalRestores).toBe(1);
      expect(stats.layoutCount).toBe(1);
      expect(stats.totalVersions).toBe(1);
      expect(stats.storageType).toBe('localStorage');
      expect(stats.autoSaveEnabled).toBe(true);
      expect(stats.lastSave).toBeGreaterThan(0);
      expect(stats.lastRestore).toBeGreaterThan(0);
    });

    test('should update storage size estimation', async () => {
      await persistenceManager.saveLayout('size-test', sampleLayoutData);
      
      const stats = persistenceManager.getStats();
      expect(stats.storageSize).toBeGreaterThan(0);
    });
  });

  describe('Clear All Functionality', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
      
      await persistenceManager.saveLayout('clear1', sampleLayoutData);
      await persistenceManager.saveLayout('clear2', sampleLayoutData);
    });

    test('should clear all layouts', async () => {
      const result = await persistenceManager.clearAll();
      
      expect(result).toBe(true);
      expect(persistenceManager.layoutHistory.size).toBe(0);
      expect(persistenceManager.currentSnapshot).toBeNull();
      expect(persistenceManager.stats.totalSaves).toBe(0);
      expect(persistenceManager.stats.totalRestores).toBe(0);
      expect(persistenceManager.stats.totalVersions).toBe(0);
      expect(persistenceManager.stats.storageSize).toBe(0);
    });

    test('should handle clear errors', async () => {
      // Mock storage to fail
      persistenceManager.storageInterface.delete = jest.fn(() => {
        throw new Error('Clear failed');
      });

      const result = await persistenceManager.clearAll();
      
      expect(result).toBe(false);
    });
  });

  describe('Version Generation', () => {
    beforeEach(() => {
      persistenceManager = new LayoutPersistenceManager();
    });

    test('should generate timestamp versions by default', () => {
      const version1 = persistenceManager._generateVersion('test');
      const version2 = persistenceManager._generateVersion('test');
      
      expect(version1).not.toBe(version2);
      expect(parseInt(version1)).toBeGreaterThan(0);
    });

    test('should generate sequential versions', () => {
      persistenceManager.config.versionNaming = 'sequential';
      persistenceManager.layoutHistory.set('test', []);
      
      const version1 = persistenceManager._generateVersion('test');
      persistenceManager.layoutHistory.get('test').push({});
      const version2 = persistenceManager._generateVersion('test');
      
      expect(version1).toBe('v1');
      expect(version2).toBe('v2');
    });

    test('should use custom version when provided', () => {
      const version = persistenceManager._generateVersion('test', { version: 'custom-v1' });
      
      expect(version).toBe('custom-v1');
    });

    test('should generate custom versions with custom naming', () => {
      persistenceManager.config.versionNaming = 'custom';
      
      const version1 = persistenceManager._generateVersion('test');
      const version2 = persistenceManager._generateVersion('test', { customVersion: 'my-custom' });
      
      expect(version1).toContain('custom-');
      expect(version2).toBe('my-custom');
    });
  });

  describe('Snapshot Validation', () => {
    beforeEach(() => {
      persistenceManager = new LayoutPersistenceManager();
    });

    test('should validate valid snapshot', () => {
      const validSnapshot = {
        id: 'test',
        version: 'v1',
        data: { positions: [] }
      };

      expect(() => persistenceManager._validateSnapshot(validSnapshot)).not.toThrow();
    });

    test('should reject null snapshot', () => {
      expect(() => persistenceManager._validateSnapshot(null))
        .toThrow('Snapshot is null or undefined');
    });

    test('should reject snapshot without required fields', () => {
      expect(() => persistenceManager._validateSnapshot({}))
        .toThrow('Invalid snapshot structure');
      
      expect(() => persistenceManager._validateSnapshot({ id: 'test' }))
        .toThrow('Invalid snapshot structure');
      
      expect(() => persistenceManager._validateSnapshot({ id: 'test', version: 'v1' }))
        .toThrow('Invalid snapshot structure');
    });

    test('should reject snapshot without positions data', () => {
      const invalidSnapshot = {
        id: 'test',
        version: 'v1',
        data: {}
      };

      expect(() => persistenceManager._validateSnapshot(invalidSnapshot))
        .toThrow('Snapshot missing positions data');
    });
  });

  describe('Data Serialization', () => {
    beforeEach(() => {
      persistenceManager = new LayoutPersistenceManager();
    });

    test('should serialize layout data correctly', () => {
      const serialized = persistenceManager._serializeLayoutData(sampleLayoutData);
      
      expect(serialized.positions).toEqual([
        ['node1', { x: 100, y: 200, width: 80, height: 60 }],
        ['node2', { x: 300, y: 150, width: 80, height: 60 }],
        ['node3', { x: 500, y: 250, width: 80, height: 60 }]
      ]);
      expect(serialized.bounds).toEqual(sampleLayoutData.bounds);
      expect(serialized.metadata).toEqual(sampleLayoutData.metadata);
    });

    test('should include edges when configured', () => {
      persistenceManager.config.includeEdgePaths = true;
      
      const serialized = persistenceManager._serializeLayoutData(sampleLayoutData);
      
      expect(serialized.edges).toBeDefined();
      expect(serialized.edges).toEqual([
        ['e1', { path: [{ x: 140, y: 230 }, { x: 300, y: 180 }] }],
        ['e2', { path: [{ x: 340, y: 180 }, { x: 500, y: 280 }] }]
      ]);
    });

    test('should extract layout data from snapshot', () => {
      const serialized = persistenceManager._serializeLayoutData(sampleLayoutData);
      const snapshot = { data: serialized, version: 'v1' };
      
      const extracted = persistenceManager._extractLayoutData(snapshot);
      
      expect(extracted.positions).toBeInstanceOf(Map);
      expect(extracted.positions.size).toBe(3);
      expect(extracted.bounds).toEqual(sampleLayoutData.bounds);
      expect(extracted.metadata.restored).toBe(true);
      expect(extracted.metadata.restoredFrom).toBe('v1');
    });
  });

  describe('Storage Interfaces', () => {
    describe('Memory Storage', () => {
      test('should save and load data correctly', async () => {
        persistenceManager = new LayoutPersistenceManager({ storageType: 'memory' });
        await persistenceManager.initialize();
        
        await persistenceManager.saveLayout('memory-test', sampleLayoutData);
        const restored = await persistenceManager.restoreLayout('memory-test');
        
        expect(restored.positions.size).toBe(3);
        expect(restored.metadata.algorithm).toBe('force-directed');
      });

      test('should handle deletion', async () => {
        persistenceManager = new LayoutPersistenceManager({ storageType: 'memory' });
        await persistenceManager.initialize();
        
        await persistenceManager.saveLayout('delete-test', sampleLayoutData);
        const deleteResult = await persistenceManager.deleteLayout('delete-test');
        
        expect(deleteResult).toBe(true);
        await expect(persistenceManager.restoreLayout('delete-test'))
          .rejects.toThrow('No layout found');
      });
    });

    describe('Session Storage', () => {
      test('should use sessionStorage interface', async () => {
        persistenceManager = new LayoutPersistenceManager({ storageType: 'sessionStorage' });
        await persistenceManager.initialize();
        
        await persistenceManager.saveLayout('session-test', sampleLayoutData);
        
        expect(sessionStorage.setItem).toHaveBeenCalled();
      });
    });

    describe('File Storage', () => {
      test('should throw not implemented error', async () => {
        persistenceManager = new LayoutPersistenceManager({ storageType: 'file' });
        
        await expect(persistenceManager.initialize())
          .rejects.toThrow('File storage not implemented yet');
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager({ onError: mockOnError });
      await persistenceManager.initialize();
    });

    test('should handle save errors gracefully', async () => {
      persistenceManager.storageInterface.save = jest.fn(() => {
        throw new Error('Save failed');
      });

      await expect(persistenceManager.saveLayout('error-test', sampleLayoutData))
        .rejects.toThrow('Save failed');
      
      expect(mockOnError).toHaveBeenCalledWith('save', expect.any(Error), 'error-test');
    });

    test('should handle restore errors gracefully', async () => {
      await persistenceManager.saveLayout('error-test', sampleLayoutData);
      
      persistenceManager.storageInterface.load = jest.fn(() => {
        throw new Error('Load failed');
      });

      await expect(persistenceManager.restoreLayout('error-test'))
        .rejects.toThrow('Load failed');
      
      expect(mockOnError).toHaveBeenCalledWith('restore', expect.any(Error), 'error-test');
    });
  });

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager({ autoSave: true });
      await persistenceManager.initialize();
      
      // Schedule an auto-save
      persistenceManager.scheduleAutoSave('cleanup-test', sampleLayoutData);
    });

    test('should clean up resources on destroy', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      persistenceManager.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(persistenceManager.autoSaveTimeout).toBeNull();
      expect(persistenceManager.layoutHistory.size).toBe(0);
      expect(persistenceManager.currentSnapshot).toBeNull();
      expect(persistenceManager.isInitialized).toBe(false);
      
      clearTimeoutSpy.mockRestore();
    });

    test('should call storage interface destroy if available', () => {
      const destroySpy = jest.fn();
      persistenceManager.storageInterface.destroy = destroySpy;
      
      persistenceManager.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      persistenceManager = new LayoutPersistenceManager();
      await persistenceManager.initialize();
    });

    test('should handle empty layout data', async () => {
      const emptyData = {
        positions: new Map(),
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        edges: new Map(),
        metadata: {}
      };

      const snapshot = await persistenceManager.saveLayout('empty', emptyData);
      const restored = await persistenceManager.restoreLayout('empty');

      expect(snapshot).toBeDefined();
      expect(restored.positions.size).toBe(0);
    });

    test('should handle layout with no edges', async () => {
      const noEdgeData = {
        positions: sampleLayoutData.positions,
        bounds: sampleLayoutData.bounds,
        metadata: sampleLayoutData.metadata
      };

      const snapshot = await persistenceManager.saveLayout('no-edges', noEdgeData);
      const restored = await persistenceManager.restoreLayout('no-edges');

      expect(snapshot).toBeDefined();
      expect(restored.positions.size).toBe(3);
      expect(restored.edges.size).toBe(0);
    });

    test('should handle layout history loading failure', async () => {
      const mockInterface = persistenceManager.storageInterface;
      mockInterface.load = jest.fn(key => {
        if (key.includes('history')) {
          throw new Error('History load failed');
        }
        return null;
      });

      // Should not throw, just warn
      await persistenceManager._loadLayoutHistory();
      
      expect(console.warn).toHaveBeenCalledWith('Failed to load layout history:', expect.any(Error));
    });
  });
});