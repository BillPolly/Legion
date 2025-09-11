import WebSocketService from '../../src/services/WebSocketService';

describe('WebSocketService', () => {
  let service;

  beforeEach(() => {
    service = new WebSocketService();
  });

  test('should initialize with empty connections', () => {
    expect(service.connections.size).toBe(0);
  });

  test('should broadcast to all connections', () => {
    let ws1SendCalled = false;
    let ws1SendData = null;
    let ws2SendCalled = false;
    let ws2SendData = null;
    
    const mockWs1 = { 
      readyState: 1, 
      send: (data) => {
        ws1SendCalled = true;
        ws1SendData = data;
      }
    };
    const mockWs2 = { 
      readyState: 1, 
      send: (data) => {
        ws2SendCalled = true;
        ws2SendData = data;
      }
    };
    
    service.connections.add(mockWs1);
    service.connections.add(mockWs2);

    const testData = { type: 'test', data: 'message' };
    service.broadcast(testData);

    expect(ws1SendCalled).toBe(true);
    expect(ws1SendData).toBe(JSON.stringify(testData));
    expect(ws2SendCalled).toBe(true);
    expect(ws2SendData).toBe(JSON.stringify(testData));
  });
});