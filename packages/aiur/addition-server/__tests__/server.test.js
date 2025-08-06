const request = require('supertest');
const app = require('../src/server');

describe('Addition Server', () => {
  describe('GET /add/:num1/:num2', () => {
    it('should correctly add two numbers', async () => {
      const response = await request(app)
        .get('/add/2/3')
        .expect(200);
      
      expect(response.body).toEqual({
        result: 5,
        inputs: { num1: 2, num2: 3 }
      });
    });

    it('should handle invalid numbers', async () => {
      const response = await request(app)
        .get('/add/abc/3')
        .expect(400);
      
      expect(response.body).toEqual({
        error: 'Both parameters must be valid numbers'
      });
    });
  });
});