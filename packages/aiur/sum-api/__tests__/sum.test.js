const request = require('supertest');
const app = require('../src/index');

describe('POST /api/sum', () => {
  test('should return sum of two numbers', async () => {
    const response = await request(app)
      .post('/api/sum')
      .send({ num1: 5, num2: 3 });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 8 });
  });

  test('should return 400 for invalid input', async () => {
    const response = await request(app)
      .post('/api/sum')
      .send({ num1: 'invalid', num2: 3 });
    
    expect(response.status).toBe(400);
  });
});