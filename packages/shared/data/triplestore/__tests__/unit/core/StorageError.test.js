import { describe, it, expect } from '@jest/globals';
import {
  StorageError,
  ValidationError,
  ConnectionError,
  TransactionError,
  CapacityError,
  AuthenticationError,
  NetworkError,
  isRetryableError
} from '../../../src/core/StorageError.js';

describe('StorageError Classes', () => {
  describe('StorageError base class', () => {
    it('should create a StorageError', () => {
      const error = new StorageError('Test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('StorageError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new StorageError('Test error', 'TEST_CODE', cause);
      expect(error.cause).toBe(cause);
    });

    it('should work without cause', () => {
      const error = new StorageError('Test error', 'TEST_CODE');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new ValidationError('Invalid input', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ConnectionError', () => {
    it('should create a ConnectionError', () => {
      const error = new ConnectionError('Connection failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.name).toBe('ConnectionError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Network issue');
      const error = new ConnectionError('Connection failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('TransactionError', () => {
    it('should create a TransactionError', () => {
      const error = new TransactionError('Transaction failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.message).toBe('Transaction failed');
      expect(error.code).toBe('TRANSACTION_ERROR');
      expect(error.name).toBe('TransactionError');
    });
  });

  describe('CapacityError', () => {
    it('should create a CapacityError', () => {
      const error = new CapacityError('Storage limit reached');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(CapacityError);
      expect(error.message).toBe('Storage limit reached');
      expect(error.code).toBe('CAPACITY_ERROR');
      expect(error.name).toBe('CapacityError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create an AuthenticationError', () => {
      const error = new AuthenticationError('Auth failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Auth failed');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('NetworkError', () => {
    it('should create a NetworkError', () => {
      const error = new NetworkError('Network timeout');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('Network timeout');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
    });
  });

  describe('isRetryableError function', () => {
    it('should return true for NetworkError', () => {
      const error = new NetworkError('Network issue');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ConnectionError', () => {
      const error = new ConnectionError('Connection issue');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ECONNRESET error code', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ETIMEDOUT error code', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 429 status (rate limiting)', () => {
      const error = new Error('Rate limited');
      error.status = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 status (service unavailable)', () => {
      const error = new Error('Service unavailable');
      error.status = 503;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for TransactionError', () => {
      const error = new TransactionError('Transaction failed');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for CapacityError', () => {
      const error = new CapacityError('Storage full');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for AuthenticationError', () => {
      const error = new AuthenticationError('Auth failed');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Generic error');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('Error inheritance chain', () => {
    it('all error types should be instanceof Error', () => {
      const errors = [
        new StorageError('test', 'TEST'),
        new ValidationError('test'),
        new ConnectionError('test'),
        new TransactionError('test'),
        new CapacityError('test'),
        new AuthenticationError('test'),
        new NetworkError('test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('all error types except StorageError should be instanceof StorageError', () => {
      const errors = [
        new ValidationError('test'),
        new ConnectionError('test'),
        new TransactionError('test'),
        new CapacityError('test'),
        new AuthenticationError('test'),
        new NetworkError('test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(StorageError);
      });
    });
  });

  describe('Error message and stack trace', () => {
    it('should have proper stack trace', () => {
      const error = new StorageError('Test error', 'TEST_CODE');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('StorageError');
    });

    it('should preserve original error message', () => {
      const message = 'This is a very specific error message';
      const error = new ValidationError(message);
      expect(error.message).toBe(message);
    });
  });
});