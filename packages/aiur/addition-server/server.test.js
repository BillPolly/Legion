const request = require('supertest');
const app = require('./server');

describe('Addition API', () => {
    test('should add two numbers correctly', async () => {
        const response = await request(app)
            .post('/add')
            .send({ num1: 5, num2: 3 });
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ result: 8 });
    });

    test('should handle decimal numbers', async () => {
        const response = await request(app)
            .post('/add')
            .send({ num1: 2.5, num2: 3.7 });
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ result: 6.2 });
    });

    test('should return error for missing numbers', async () => {
        const response = await request(app)
            .post('/add')
            .send({ num1: 5 });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    test('should return error for invalid numbers', async () => {
        const response = await request(app)
            .post('/add')
            .send({ num1: 'abc', num2: 5 });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
});