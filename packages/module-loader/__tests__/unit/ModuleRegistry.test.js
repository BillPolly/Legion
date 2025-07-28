import { ModuleRegistry } from '../../src/module/ModuleRegistry.js';

describe('ModuleRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('register', () => {
    it('should register a module', () => {
      const metadata = { version: '1.0.0' };
      const instance = { name: 'test' };
      
      registry.register('test-module', metadata, instance);
      
      expect(registry.has('test-module')).toBe(true);
      expect(registry.get('test-module')).toMatchObject({
        name: 'test-module',
        metadata: expect.objectContaining({
          version: '1.0.0',
          status: 'loaded',
          registeredAt: expect.any(String)
        }),
        instance
      });
    });

    it('should throw error if module already registered', () => {
      registry.register('test-module', {});
      expect(() => registry.register('test-module', {}))
        .toThrow("Module 'test-module' is already registered");
    });

    it('should track load order', () => {
      registry.register('module1', {});
      registry.register('module2', {});
      registry.register('module3', {});
      
      const stats = registry.getStats();
      expect(stats.loadOrder).toEqual(['module1', 'module2', 'module3']);
    });
  });

  describe('status management', () => {
    it('should update module status', () => {
      registry.register('test-module', {});
      registry.updateStatus('test-module', 'unloading');
      
      const entry = registry.get('test-module');
      expect(entry.metadata.status).toBe('unloading');
      expect(entry.metadata.lastUpdated).toBeDefined();
    });

    it('should throw error for unknown module', () => {
      expect(() => registry.updateStatus('unknown', 'loaded'))
        .toThrow("Module 'unknown' not found in registry");
    });
  });

  describe('instance management', () => {
    it('should set instance after registration', () => {
      registry.register('test-module', {});
      const instance = { name: 'test' };
      
      registry.setInstance('test-module', instance);
      
      expect(registry.getInstance('test-module')).toBe(instance);
      expect(registry.isLoaded('test-module')).toBe(true);
    });

    it('should return null for missing instance', () => {
      expect(registry.getInstance('unknown')).toBeNull();
    });
  });

  describe('unregister', () => {
    it('should unregister a module', () => {
      registry.register('test-module', {}, { name: 'test' });
      
      const result = registry.unregister('test-module');
      
      expect(result).toBe(true);
      expect(registry.has('test-module')).toBe(false);
      expect(registry.getInstance('test-module')).toBeNull();
      expect(registry.getStats().loadOrder).not.toContain('test-module');
    });

    it('should return false for unknown module', () => {
      expect(registry.unregister('unknown')).toBe(false);
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      registry.register('loaded1', {}, { name: 'loaded1' });
      registry.register('loaded2', {}, { name: 'loaded2' });
      registry.register('registered', {});
      registry.updateStatus('registered', 'registered');
    });

    it('should get all modules', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('should get loaded modules only', () => {
      const loaded = registry.getLoaded();
      expect(loaded).toHaveLength(2);
      expect(loaded.every(m => m.metadata.status === 'loaded')).toBe(true);
    });

    it('should get module names', () => {
      const names = registry.getNames();
      expect(names).toEqual(['loaded1', 'loaded2', 'registered']);
    });

    it('should get loaded module names', () => {
      const names = registry.getLoadedNames();
      expect(names).toEqual(['loaded1', 'loaded2']);
    });
  });

  describe('statistics', () => {
    it('should provide statistics', () => {
      registry.register('loaded1', {}, { name: 'loaded1' });
      registry.register('loaded2', {}, { name: 'loaded2' });
      registry.register('registered', {});
      registry.updateStatus('registered', 'registered');
      
      const stats = registry.getStats();
      
      expect(stats).toEqual({
        totalRegistered: 3,
        totalLoaded: 2,
        byStatus: {
          loaded: 2,
          registered: 1
        },
        loadOrder: ['loaded1', 'loaded2', 'registered']
      });
    });
  });

  describe('export', () => {
    it('should export registry data', () => {
      registry.register('test-module', { version: '1.0.0' }, { name: 'test' });
      
      const exported = registry.export();
      
      expect(exported).toMatchObject({
        modules: [{
          name: 'test-module',
          metadata: expect.objectContaining({
            version: '1.0.0',
            status: 'loaded'
          }),
          hasInstance: true
        }],
        loadOrder: ['test-module'],
        stats: expect.any(Object)
      });
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      registry.register('test1', {}, { name: 'test1' });
      registry.register('test2', {}, { name: 'test2' });
      
      registry.clear();
      
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getStats().totalRegistered).toBe(0);
      expect(registry.getStats().loadOrder).toHaveLength(0);
    });
  });
});