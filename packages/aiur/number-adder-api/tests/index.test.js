const request = require('supertest');
const app = require('../src/index');

describe('Number Adder API', () => {
  test('should correctly add two numbers', async () => {
    const response = await request(app)
      .post('/api/add')
      .send({ num1: 2, num2: 3 });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result', 5);
  });

  test('should handle invalid input', async () => {
    const response = await request(app)
      .post('/api/add')
      .send({ num1: 'invalid', num2: 3 });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('should handle missing input', async () => {
    const response = await request(app)
      .post('/api/add')
      .send({ num1: 2 });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});