import { jest } from '@jest/globals';

// Mock net module before importing PortManager
const mockServer = {
  listen: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  address: jest.fn()
};

const mockCreateServer = jest.fn(() => mockServer);

jest.unstable_mockModule('net', () => ({
  default: { createServer: mockCreateServer }
}));

// Import PortManager after mocking
const PortManager = (await import('../../../src/utils/PortManager.js')).default;

describe('PortManager', () => {
  let portManager;

  beforeEach(() => {
    portManager = new PortManager();
    jest.clearAllMocks();
    
    // Reset mock
    mockCreateServer.mockReturnValue(mockServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Port Allocation', () => {
    test('should allocate requested port if available', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port = await portManager.allocatePort(3000);
      
      expect(port).toBe(3000);
      expect(portManager.isAllocated(3000)).toBe(true);
    });


    test('should allocate random port when no preference given', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port: 49152 });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port = await portManager.allocatePort();
      
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
    });

    test('should respect port range constraints', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        if (port === 0) {
          mockServer.address.mockReturnValue({ port: 8080 });
        } else {
          mockServer.address.mockReturnValue({ port });
        }
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port = await portManager.allocatePort(null, { min: 8000, max: 9000 });
      
      expect(port).toBeGreaterThanOrEqual(8000);
      expect(port).toBeLessThanOrEqual(9000);
    });


    test('should not allocate same port twice', async () => {
      let listenCallCount = 0;
      mockServer.listen.mockImplementation((port, callback) => {
        listenCallCount++;
        if (listenCallCount === 1 || port === 3000) {
          // First allocation succeeds
          mockServer.address.mockReturnValue({ port: 3000 });
          callback();
        } else {
          // Subsequent allocation on 3000 fails, but 3001 succeeds
          mockServer.address.mockReturnValue({ port: 3001 });
          callback();
        }
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port1 = await portManager.allocatePort(3000);
      expect(port1).toBe(3000);

      const port2 = await portManager.allocatePort(3000);
      expect(port2).toBe(3001);
    });
  });

  describe('Port Release', () => {
    test('should release allocated port', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port: 3000 });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port = await portManager.allocatePort(3000);
      expect(portManager.isAllocated(3000)).toBe(true);

      portManager.releasePort(3000);
      expect(portManager.isAllocated(3000)).toBe(false);
    });

    test('should ignore release of unallocated port', () => {
      expect(() => portManager.releasePort(3000)).not.toThrow();
    });

    test('should allow reallocation after release', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port: 3000 });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      const port1 = await portManager.allocatePort(3000);
      portManager.releasePort(port1);
      
      const port2 = await portManager.allocatePort(3000);
      expect(port2).toBe(3000);
    });
  });

  describe('Port Checking', () => {

    test('should get list of allocated ports', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      await portManager.allocatePort(3000);
      await portManager.allocatePort(3001);
      await portManager.allocatePort(3002);

      const allocated = portManager.getAllocatedPorts();
      expect(allocated).toEqual([3000, 3001, 3002]);
    });
  });

  describe('Cleanup', () => {
    test('should release all ports', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        mockServer.address.mockReturnValue({ port });
        callback();
      });
      mockServer.close.mockImplementation((callback) => callback());

      await portManager.allocatePort(3000);
      await portManager.allocatePort(3001);
      await portManager.allocatePort(3002);

      expect(portManager.getAllocatedPorts()).toHaveLength(3);

      portManager.releaseAll();
      expect(portManager.getAllocatedPorts()).toHaveLength(0);
    });
  });
});