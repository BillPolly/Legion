import { ResponseFormatter } from '../../../../src/server/protocol/responses.js';
import { MessageProtocol } from '../../../../src/shared/protocol/MessageProtocol.js';
import { WebSocketProtocol } from '../../../../src/shared/protocol/WebSocketProtocol.js';

describe('ResponseFormatter', () => {
  let responseFormatter;

  beforeEach(() => {
    responseFormatter = new ResponseFormatter();
  });

  describe('Success Response Structure', () => {
    test('should format basic success response', () => {
      const result = responseFormatter.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        { element: { tag: 'div', id: 'test' } },
        { execution_time: 150 },
        'test-session-001'
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        type: 'response',
        timestamp: expect.any(String),
        session: 'test-session-001',
        payload: {
          status: 'success',
          command_id: 'cmd-001',
          command: 'inspect_element',
          data: { element: { tag: 'div', id: 'test' } },
          metadata: { execution_time: 150 }
        }
      });
    });

    test('should handle null data in success response', () => {
      const result = responseFormatter.formatSuccessResponse(
        'cmd-002',
        'ping',
        null,
        {},
        'test-session-001'
      );

      expect(result.payload.data).toBeNull();
      expect(result.payload.status).toBe('success');
    });

    test('should include additional metadata fields', () => {
      const metadata = {
        execution_time: 200,
        agent_version: '1.0.0',
        warnings: ['deprecated selector'],
        cache_hit: true
      };

      const result = responseFormatter.formatSuccessResponse(
        'cmd-003',
        'analyze_javascript',
        { analysis: 'complete' },
        metadata,
        'test-session-001'
      );

      expect(result.payload.metadata).toEqual(metadata);
    });

    test('should validate success response structure', () => {
      const result = responseFormatter.formatSuccessResponse(
        'cmd-004',
        'inspect_element',
        { element: {} },
        {},
        'test-session-001'
      );

      const isValid = MessageProtocol.validateMessage(result);
      expect(isValid).toBe(true);
    });
  });

  describe('Error Response Formatting', () => {
    test('should format basic error response', () => {
      const result = responseFormatter.formatErrorResponse(
        'cmd-001',
        'ELEMENT_NOT_FOUND',
        'No element matches selector .missing',
        'test-session-001'
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        type: 'error',
        timestamp: expect.any(String),
        session: 'test-session-001',
        payload: {
          command_id: 'cmd-001',
          error_code: 'ELEMENT_NOT_FOUND',
          error_message: 'No element matches selector .missing'
        }
      });
    });

    test('should include error details when provided', () => {
      const errorDetails = {
        selector: '.missing',
        suggestions: ['.similar-class', '#alternative-id'],
        search_time: 50
      };

      const result = responseFormatter.formatErrorResponse(
        'cmd-002',
        'ELEMENT_NOT_FOUND',
        'Element not found',
        'test-session-001',
        errorDetails
      );

      expect(result.payload.details).toEqual(errorDetails);
    });

    test('should handle error response without command ID', () => {
      const result = responseFormatter.formatErrorResponse(
        null,
        'INVALID_MESSAGE',
        'Message format is invalid',
        'test-session-001'
      );

      expect(result.payload.command_id).toBeNull();
      expect(result.payload.error_code).toBe('INVALID_MESSAGE');
    });

    test('should categorize error types', () => {
      const clientError = responseFormatter.formatErrorResponse(
        'cmd-003',
        'INVALID_SELECTOR',
        'Selector syntax is invalid',
        'test-session-001'
      );

      expect(clientError.payload.error_category).toBe('client_error');

      const serverError = responseFormatter.formatErrorResponse(
        'cmd-004',
        'AGENT_CRASH',
        'Agent process crashed',
        'test-session-001'
      );

      expect(serverError.payload.error_category).toBe('server_error');
    });
  });

  describe('Progress Event Generation', () => {
    test('should format progress event for long-running commands', () => {
      const result = responseFormatter.formatProgressEvent(
        'cmd-001',
        {
          current: 5,
          total: 10,
          percentage: 50,
          message: 'Processing elements...'
        },
        'test-session-001'
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        type: 'event',
        timestamp: expect.any(String),
        session: 'test-session-001',
        payload: {
          event_type: 'progress_update',
          command_id: 'cmd-001',
          progress: {
            current: 5,
            total: 10,
            percentage: 50,
            message: 'Processing elements...'
          }
        }
      });
    });

    test('should calculate percentage if not provided', () => {
      const result = responseFormatter.formatProgressEvent(
        'cmd-002',
        {
          current: 25,
          total: 100
        },
        'test-session-001'
      );

      expect(result.payload.progress.percentage).toBe(25);
    });

    test('should handle indeterminate progress', () => {
      const result = responseFormatter.formatProgressEvent(
        'cmd-003',
        {
          message: 'Analyzing code...',
          indeterminate: true
        },
        'test-session-001'
      );

      expect(result.payload.progress.indeterminate).toBe(true);
      expect(result.payload.progress.percentage).toBeUndefined();
    });
  });

  describe('Metadata Inclusion in Responses', () => {
    test('should extract execution metrics', () => {
      const agentResult = {
        success: true,
        data: { element: {} },
        metrics: {
          dom_query_time: 25,
          style_computation_time: 30,
          total_time: 55
        }
      };

      const metadata = responseFormatter.extractMetadata(agentResult);

      expect(metadata).toEqual({
        execution_time: 55,
        metrics: {
          dom_query_time: 25,
          style_computation_time: 30,
          total_time: 55
        }
      });
    });

    test('should include system metadata', () => {
      const result = responseFormatter.formatSuccessResponse(
        'cmd-004',
        'inspect_element',
        {},
        {},
        'test-session-001',
        { includeSystemMetadata: true }
      );

      expect(result.payload.metadata).toHaveProperty('timestamp');
      expect(result.payload.metadata).toHaveProperty('formatter_version');
      expect(result.payload.metadata).toHaveProperty('node_version');
    });

    test('should merge multiple metadata sources', () => {
      const agentMetadata = { execution_time: 100, agent_id: 'agent-1' };
      const customMetadata = { cache_hit: true, request_id: 'req-123' };

      const result = responseFormatter.formatSuccessResponse(
        'cmd-005',
        'analyze_javascript',
        {},
        responseFormatter.mergeMetadata(agentMetadata, customMetadata),
        'test-session-001'
      );

      expect(result.payload.metadata).toEqual({
        execution_time: 100,
        agent_id: 'agent-1',
        cache_hit: true,
        request_id: 'req-123'
      });
    });
  });

  describe('Event Response Types', () => {
    test('should format agent suggestion events', () => {
      const result = responseFormatter.formatSuggestionEvent(
        'cmd-001',
        {
          type: 'performance',
          suggestion: 'Consider using querySelector instead of querySelectorAll',
          impact: 'high',
          code_example: 'document.querySelector(".single-element")'
        },
        'test-session-001'
      );

      expect(result.type).toBe('event');
      expect(result.payload.event_type).toBe('suggestion');
      expect(result.payload.suggestion.type).toBe('performance');
    });

    test('should format state change events', () => {
      const result = responseFormatter.formatStateChangeEvent(
        {
          previous_state: 'analyzing',
          new_state: 'complete',
          command_id: 'cmd-001'
        },
        'test-session-001'
      );

      expect(result.payload.event_type).toBe('state_change');
      expect(result.payload.state_change.previous_state).toBe('analyzing');
      expect(result.payload.state_change.new_state).toBe('complete');
    });

    test('should format debug information events', () => {
      const result = responseFormatter.formatDebugEvent(
        'cmd-001',
        {
          level: 'info',
          message: 'Found 5 matching elements',
          details: { selectors_tried: 3, time_elapsed: 45 }
        },
        'test-session-001'
      );

      expect(result.payload.event_type).toBe('debug');
      expect(result.payload.debug.level).toBe('info');
      expect(result.payload.debug.details).toBeDefined();
    });
  });

  describe('Response Validation', () => {
    test('should validate all response types against protocol', () => {
      const responses = [
        responseFormatter.formatSuccessResponse('cmd-1', 'test', {}, {}, 'session-1'),
        responseFormatter.formatErrorResponse('cmd-2', 'ERROR', 'Test error', 'session-1'),
        responseFormatter.formatProgressEvent('cmd-3', { current: 1, total: 2 }, 'session-1')
      ];

      responses.forEach(response => {
        const isValid = MessageProtocol.validateMessage(response);
        expect(isValid).toBe(true);
      });
    });

    test('should use WebSocketProtocol for standard formatting', () => {
      const wsResponse = WebSocketProtocol.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        { element: {} },
        { execution_time: 100 },
        'test-session-001'
      );

      const formatterResponse = responseFormatter.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        { element: {} },
        { execution_time: 100 },
        'test-session-001'
      );

      // Core structure should match
      expect(formatterResponse.type).toBe(wsResponse.type);
      expect(formatterResponse.payload.status).toBe(wsResponse.payload.status);
      expect(formatterResponse.payload.command).toBe(wsResponse.payload.command);
    });
  });

  describe('Batch Response Formatting', () => {
    test('should format batch success responses', () => {
      const results = [
        { command_id: 'cmd-1', data: { result: 1 } },
        { command_id: 'cmd-2', data: { result: 2 } },
        { command_id: 'cmd-3', data: { result: 3 } }
      ];

      const batchResponse = responseFormatter.formatBatchResponse(
        results,
        'batch_inspect',
        'test-session-001'
      );

      expect(batchResponse.payload.batch_size).toBe(3);
      expect(batchResponse.payload.results).toHaveLength(3);
      expect(batchResponse.payload.results[0].command_id).toBe('cmd-1');
    });

    test('should handle mixed success and error in batch', () => {
      const results = [
        { command_id: 'cmd-1', success: true, data: { result: 1 } },
        { command_id: 'cmd-2', success: false, error: 'Failed' },
        { command_id: 'cmd-3', success: true, data: { result: 3 } }
      ];

      const batchResponse = responseFormatter.formatBatchResponse(
        results,
        'batch_analyze',
        'test-session-001'
      );

      expect(batchResponse.payload.success_count).toBe(2);
      expect(batchResponse.payload.error_count).toBe(1);
      expect(batchResponse.payload.partial_success).toBe(true);
    });
  });

  describe('Response Compression and Size Management', () => {
    test('should truncate large data payloads', () => {
      const largeData = {
        elements: new Array(1000).fill({ tag: 'div', classes: ['test'] }),
        analysis: 'x'.repeat(1024 * 1024) // 1MB string
      };

      const result = responseFormatter.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        largeData,
        {},
        'test-session-001',
        { maxPayloadSize: 1024 * 100 } // 100KB limit
      );

      expect(result.payload.data_truncated).toBe(true);
      expect(result.payload.original_size).toBeDefined();
      expect(JSON.stringify(result).length).toBeLessThan(1024 * 150); // Some overhead allowed
    });

    test('should provide summary for truncated arrays', () => {
      const data = {
        elements: new Array(1000).fill({ tag: 'div' })
      };

      const result = responseFormatter.formatSuccessResponse(
        'cmd-002',
        'find_all',
        data,
        {},
        'test-session-001',
        { maxArrayLength: 10 }
      );

      expect(result.payload.data.elements).toHaveLength(10);
      expect(result.payload.data.elements_truncated).toBe(true);
      expect(result.payload.data.total_elements).toBe(1000);
    });
  });
});