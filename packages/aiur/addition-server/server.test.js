const request = require('supertest');
const { app, server } = require('./server');

describe('Addition API', () => {
  afterAll((done) => {
    server.close(done);
  });

  it('should add two numbers correctly', async () => {
    const response = await request(app)
      .get('/add')
      .query({ num1: '2', num2: '3' });

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(5);
    expect(response.body.numbers).toEqual([2, 3]);
  });

  it('should handle missing parameters', async () => {
    const response = await request(app)
      .get('/add')
      .query({ num1: '2' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing required parameters: num1 and num2');
  });

  it('should handle invalid numbers', async () => {
    const response = await request(app)
      .get('/add')
      .query({ num1: 'abc', num2: '3' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid numbers provided');
  });
});