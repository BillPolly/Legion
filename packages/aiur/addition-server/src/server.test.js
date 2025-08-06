const request = require('supertest');
const app = require('./server');

describe('Addition Server', () => {
  describe('POST /add', () => {
    it('should correctly add two numbers', async () => {
      const response = await request(app)
        .post('/add')
        .send({ num1: 2, num2: 3 });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ result: 5 });
    });

    it('should handle invalid input', async () => {
      const response = await request(app)
        .post('/add')
        .send({ num1: 'invalid', num2: 3 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});