import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createServerActorFactory,
  createClientActorFactory,
  createPDFSignerServerActor,
  createPDFSignerClientActor,
  PDFSignerServerActor,
  PDFSignerClientActor
} from '../../src/index.js';

describe('Actor Factory Functions', () => {
  describe('Server Actor Factory', () => {
    it('should create server actor factory function', () => {
      const factory = createServerActorFactory();
      expect(typeof factory).toBe('function');
    });

    it('should create server actor instance with services', () => {
      const factory = createServerActorFactory();
      const services = new Map();
      services.set('resourceManager', {
        get: (key) => {
          if (key === 'env.MONOREPO_ROOT') return '/test/root';
          return null;
        }
      });
      
      const actor = factory(services);
      expect(actor).toBeInstanceOf(PDFSignerServerActor);
      expect(actor.services).toBe(services);
    });

    it('should create unique instances', () => {
      const factory = createServerActorFactory();
      const services1 = new Map();
      const services2 = new Map();
      
      const actor1 = factory(services1);
      const actor2 = factory(services2);
      
      expect(actor1).not.toBe(actor2);
      expect(actor1.services).toBe(services1);
      expect(actor2.services).toBe(services2);
    });
  });

  describe('Client Actor Factory', () => {
    it('should create client actor factory function', () => {
      const factory = createClientActorFactory();
      expect(typeof factory).toBe('function');
    });

    it('should create client actor instance with container', () => {
      const factory = createClientActorFactory();
      const container = {
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };
      
      const actor = factory(container);
      expect(actor).toBeInstanceOf(PDFSignerClientActor);
      expect(actor.container).toBe(container);
    });

    it('should create unique instances', () => {
      const factory = createClientActorFactory();
      const container1 = { id: 'container1' };
      const container2 = { id: 'container2' };
      
      const actor1 = factory(container1);
      const actor2 = factory(container2);
      
      expect(actor1).not.toBe(actor2);
      expect(actor1.container).toBe(container1);
      expect(actor2.container).toBe(container2);
    });
  });

  describe('Direct Factory Functions', () => {
    it('should create server actor using direct factory', () => {
      const services = new Map();
      const actor = createPDFSignerServerActor(services);
      
      expect(actor).toBeInstanceOf(PDFSignerServerActor);
      expect(actor.services).toBe(services);
    });

    it('should create client actor using direct factory', () => {
      const container = { id: 'test-container' };
      const actor = createPDFSignerClientActor(container);
      
      expect(actor).toBeInstanceOf(PDFSignerClientActor);
      expect(actor.container).toBe(container);
    });
  });

  describe('Actor Protocol Compatibility', () => {
    let serverActor;
    let clientActor;
    let mockContainer;
    
    beforeEach(() => {
      const services = new Map();
      serverActor = createPDFSignerServerActor(services);
      
      mockContainer = {
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };
      clientActor = createPDFSignerClientActor(mockContainer);
    });

    it('should have compatible message handling methods', () => {
      // Server actor should have receive method
      expect(typeof serverActor.receive).toBe('function');
      expect(typeof serverActor.setRemoteActor).toBe('function');
      
      // Client actor should have receive method
      expect(typeof clientActor.receive).toBe('function');
      expect(typeof clientActor.setRemoteActor).toBe('function');
    });

    it('should handle actor references', () => {
      const mockRemoteActor = { receive: jest.fn() };
      
      serverActor.setRemoteActor(mockRemoteActor);
      expect(serverActor.remoteActor).toBe(mockRemoteActor);
      
      clientActor.setRemoteActor(mockRemoteActor);
      expect(clientActor.remoteActor).toBe(mockRemoteActor);
    });

    it('should have cleanup methods', () => {
      expect(typeof serverActor.cleanup).toBe('function');
      expect(typeof clientActor.cleanup).toBe('function');
      
      // Should not throw
      expect(() => serverActor.cleanup()).not.toThrow();
      expect(() => clientActor.cleanup()).not.toThrow();
    });
  });

  describe('Service Injection', () => {
    it('should pass services to server actor', () => {
      const services = new Map();
      services.set('logger', { log: jest.fn() });
      services.set('config', { get: jest.fn() });
      services.set('resourceManager', {
        get: (key) => {
          if (key === 'env.MONOREPO_ROOT') return '/test/root';
          return null;
        }
      });
      
      const actor = createPDFSignerServerActor(services);
      
      expect(actor.services).toBe(services);
      expect(actor.services.has('logger')).toBe(true);
      expect(actor.services.has('config')).toBe(true);
      expect(actor.services.has('resourceManager')).toBe(true);
    });

    it('should work with minimal services', () => {
      const services = new Map();
      const actor = createPDFSignerServerActor(services);
      
      expect(actor).toBeInstanceOf(PDFSignerServerActor);
      expect(actor.processor).toBeDefined();
      expect(actor.signatureManager).toBeDefined();
    });
  });
});