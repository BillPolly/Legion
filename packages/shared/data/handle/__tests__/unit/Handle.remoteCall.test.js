/**
 * Handle.remoteCall.test.js
 *
 * Unit tests for Handle remote-call message handling
 *
 * Phase 6: Server-Side Handle Protocol
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Handle } from '../../src/Handle.js';

// Mock DataSource for testing
class MockDataSource {
  constructor() {
    this.queryResults = [];
    this.subscriptions = new Map();
  }

  query(querySpec) {
    return this.queryResults;
  }

  subscribe(querySpec, callback) {
    const id = Date.now() + Math.random();
    this.subscriptions.set(id, { querySpec, callback });
    return {
      id,
      unsubscribe: () => this.subscriptions.delete(id)
    };
  }

  getSchema() {
    return { attributes: {} };
  }

  queryBuilder(sourceHandle) {
    return {
      where: () => this,
      toArray: () => []
    };
  }
}

// Mock Handle for testing
class TestHandle extends Handle {
  constructor(dataSource) {
    super(dataSource);
  }

  value() {
    return this.dataSource.query({ find: ['?value'] });
  }

  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
}

describe('Handle - Remote Call Protocol', () => {
  let handle;
  let mockDataSource;

  beforeEach(() => {
    mockDataSource = new MockDataSource();
    handle = new TestHandle(mockDataSource);
  });

  describe('Remote-Call Message Handling', () => {
    it('should handle remote-call message with query method', () => {
      const querySpec = { find: ['?value'], where: [] };
      mockDataSource.queryResults = [1, 2, 3];

      const response = handle.receive({
        type: 'remote-call',
        callId: 'call-123',
        method: 'query',
        args: [querySpec]
      });

      expect(response).toMatchObject({
        type: 'remote-response',
        callId: 'call-123',
        result: [1, 2, 3]
      });
    });

    it('should handle remote-call message with subscribe method', () => {
      const response = handle.receive({
        type: 'remote-call',
        callId: 'call-456',
        method: 'subscribe',
        args: [{ find: ['?value'] }, jest.fn()]
      });

      expect(response).toMatchObject({
        type: 'remote-response',
        callId: 'call-456'
      });
      expect(response.result).toBeDefined();
      expect(response.result.id).toBeDefined();
    });

    it('should handle remote-call message with getSchema method', () => {
      const response = handle.receive({
        type: 'remote-call',
        callId: 'call-789',
        method: 'getSchema',
        args: []
      });

      expect(response).toMatchObject({
        type: 'remote-response',
        callId: 'call-789',
        result: { attributes: {} }
      });
    });

    it('should return error response when method throws', () => {
      // Make query throw error
      mockDataSource.query = () => {
        throw new Error('Query execution failed');
      };

      const response = handle.receive({
        type: 'remote-call',
        callId: 'call-error',
        method: 'query',
        args: [{}]
      });

      expect(response).toMatchObject({
        type: 'remote-response',
        callId: 'call-error',
        error: 'Query execution failed'
      });
    });

    it('should return error response when method does not exist', () => {
      const response = handle.receive({
        type: 'remote-call',
        callId: 'call-nomethod',
        method: 'nonExistentMethod',
        args: []
      });

      expect(response).toMatchObject({
        type: 'remote-response',
        callId: 'call-nomethod'
      });
      expect(response.error).toBeDefined();
    });

    it('should pass all arguments to remote method', () => {
      const spy = jest.spyOn(mockDataSource, 'query');
      mockDataSource.queryResults = [];

      const querySpec = { find: ['?a', '?b'] };
      handle.receive({
        type: 'remote-call',
        callId: 'call-args',
        method: 'query',
        args: [querySpec]
      });

      expect(spy).toHaveBeenCalledWith(querySpec);
    });
  });

  describe('Non-Remote-Call Messages', () => {
    it('should handle standard Actor messages', () => {
      // Standard value message
      mockDataSource.queryResults = ['value1'];
      const response = handle.receive({
        type: 'value'
      });

      expect(response).toEqual(['value1']);
    });

    it('should handle standard query message', () => {
      mockDataSource.queryResults = ['result'];
      const response = handle.receive({
        type: 'query',
        querySpec: { find: ['?v'] }
      });

      expect(response).toEqual(['result']);
    });

    it('should pass unknown messages to super.receive()', () => {
      const response = handle.receive({
        type: 'unknown-message-type',
        data: 'test'
      });

      // Actor.receive() returns undefined for unknown messages
      expect(response).toBeUndefined();
    });
  });

  describe('Response Format', () => {
    it('should always include callId in response', () => {
      const response = handle.receive({
        type: 'remote-call',
        callId: 'test-call-id',
        method: 'getSchema',
        args: []
      });

      expect(response.callId).toBe('test-call-id');
    });

    it('should include result field for successful calls', () => {
      mockDataSource.queryResults = ['data'];
      const response = handle.receive({
        type: 'remote-call',
        callId: 'success',
        method: 'query',
        args: [{}]
      });

      expect(response).toHaveProperty('result');
      expect(response.error).toBeUndefined();
    });

    it('should include error field for failed calls', () => {
      mockDataSource.query = () => {
        throw new Error('Failed');
      };

      const response = handle.receive({
        type: 'remote-call',
        callId: 'failure',
        method: 'query',
        args: [{}]
      });

      expect(response).toHaveProperty('error');
      expect(response.result).toBeUndefined();
    });
  });
});