import { jest } from '@jest/globals';

// Import after mocking
const { ResultMapper } = await import('../../src/utils/ResultMapper.js');

describe('ResultMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new ResultMapper();
  });

  describe('mapResult', () => {
    it('should return raw result when no mapping specified', () => {
      const result = { data: 'test', status: 200 };
      const mapped = mapper.mapResult(result, undefined);
      
      expect(mapped).toEqual(result);
    });

    it('should apply simple JSONPath mapping', () => {
      const result = {
        data: {
          items: ['item1', 'item2'],
          total: 2
        },
        meta: {
          status: 200,
          message: 'Success'
        }
      };

      const mapping = {
        success: {
          items: '$.data.items',
          count: '$.data.total',
          status: '$.meta.status'
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        items: ['item1', 'item2'],
        count: 2,
        status: 200
      });
    });

    it('should handle nested path extraction', () => {
      const result = {
        response: {
          body: {
            user: {
              profile: {
                name: 'John Doe',
                age: 30
              }
            }
          }
        }
      };

      const mapping = {
        success: {
          userName: '$.response.body.user.profile.name',
          userAge: '$.response.body.user.profile.age'
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        userName: 'John Doe',
        userAge: 30
      });
    });

    it('should handle array access in paths', () => {
      const result = {
        users: [
          { name: 'Alice', id: 1 },
          { name: 'Bob', id: 2 }
        ]
      };

      const mapping = {
        success: {
          firstUser: '$.users[0].name',
          secondUserId: '$.users[1].id'
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        firstUser: 'Alice',
        secondUserId: 2
      });
    });

    it('should return undefined for invalid paths', () => {
      const result = { data: 'test' };

      const mapping = {
        success: {
          missing: '$.nonexistent.path'
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        missing: undefined
      });
    });

    it('should handle literal values (non-JSONPath)', () => {
      const result = { data: 'test' };

      const mapping = {
        success: {
          type: 'literal-value',
          path: '$.data',
          constant: 42
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        type: 'literal-value',
        path: 'test',
        constant: 42
      });
    });
  });

  describe('mapError', () => {
    it('should map error results', () => {
      const error = {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
        details: {
          reason: 'Invalid token'
        }
      };

      const mapping = {
        failure: {
          errorCode: '$.code',
          errorMessage: '$.message',
          reason: '$.details.reason'
        }
      };

      const mapped = mapper.mapError(error, mapping);

      expect(mapped).toEqual({
        errorCode: 'AUTH_FAILED',
        errorMessage: 'Authentication failed',
        reason: 'Invalid token'
      });
    });
  });

  describe('transform types', () => {
    it('should handle instance transform', () => {
      const result = { id: 123, name: 'Test' };

      const mapping = {
        transform: 'instance'
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        instance: result
      });
    });

    it('should handle raw transform', () => {
      const result = { data: 'test' };

      const mapping = {
        transform: 'raw'
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toBe(result);
    });

    it('should handle stringify transform', () => {
      const result = { data: 'test', num: 123 };

      const mapping = {
        transform: 'stringify'
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toBe(JSON.stringify(result));
    });

    it('should handle array transform', () => {
      const result = { items: ['a', 'b', 'c'] };

      const mapping = {
        transform: 'array',
        path: '$.items'
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual(['a', 'b', 'c']);
    });
  });

  describe('type coercion', () => {
    it('should coerce string to number', () => {
      const result = {
        count: '42',
        price: '19.99'
      };

      const mapping = {
        success: {
          count: { path: '$.count', type: 'number' },
          price: { path: '$.price', type: 'number' }
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        count: 42,
        price: 19.99
      });
    });

    it('should coerce to boolean', () => {
      const result = {
        active: 'true',
        enabled: 1,
        disabled: 0,
        flag: 'yes'
      };

      const mapping = {
        success: {
          active: { path: '$.active', type: 'boolean' },
          enabled: { path: '$.enabled', type: 'boolean' },
          disabled: { path: '$.disabled', type: 'boolean' },
          flag: { path: '$.flag', type: 'boolean' }
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        active: true,
        enabled: true,
        disabled: false,
        flag: true
      });
    });

    it('should coerce to string', () => {
      const result = {
        id: 123,
        value: true,
        data: { nested: 'object' }
      };

      const mapping = {
        success: {
          id: { path: '$.id', type: 'string' },
          value: { path: '$.value', type: 'string' },
          data: { path: '$.data', type: 'string' }
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        id: '123',
        value: 'true',
        data: JSON.stringify({ nested: 'object' })
      });
    });

    it('should handle invalid coercion gracefully', () => {
      const result = {
        notANumber: 'abc'
      };

      const mapping = {
        success: {
          value: { path: '$.notANumber', type: 'number' }
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        value: NaN
      });
    });
  });

  describe('complex mappings', () => {
    it('should handle multiple mapping types together', () => {
      const result = {
        response: {
          status: '200',
          data: {
            users: [
              { id: '1', name: 'Alice', active: 'true' },
              { id: '2', name: 'Bob', active: 'false' }
            ],
            total: '2'
          }
        }
      };

      const mapping = {
        success: {
          statusCode: { path: '$.response.status', type: 'number' },
          users: '$.response.data.users',
          totalUsers: { path: '$.response.data.total', type: 'number' },
          firstUserName: '$.response.data.users[0].name',
          allActive: {
            path: '$.response.data.users',
            transform: 'custom',
            fn: (users) => users.every(u => u.active === 'true')
          }
        }
      };

      const mapped = mapper.mapResult(result, mapping);

      expect(mapped).toEqual({
        statusCode: 200,
        users: result.response.data.users,
        totalUsers: 2,
        firstUserName: 'Alice',
        allActive: false
      });
    });
  });
});