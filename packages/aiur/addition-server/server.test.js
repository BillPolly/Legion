const request = require('supertest');
const { app, server } = require('./server');

describe('Addition Server', () => {
  afterAll((done) => {
    server.close(done);
  });

  test('should add two numbers correctly', async () => {
    const response = await request(app)
      .post('/add')
      .send({ num1: 2, num2: 3 });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 5 });
  });

  test('should return 400 for invalid input', async () => {
    const response = await request(app)
      .post('/add')
      .send({ num1: 'not a number', num2: 3 });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});