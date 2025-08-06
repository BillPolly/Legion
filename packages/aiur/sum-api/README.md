# Sum API

A simple REST API that calculates the sum of two numbers.

## Setup

```bash
npm install
```

## Running the Server

```bash
npm start
```

## API Documentation

### POST /api/sum

Calculates the sum of two numbers.

**Request Body:**

```json
{
  "num1": number,
  "num2": number
}
```

**Response:**

```json
{
  "result": number
}
```

## Running Tests

```bash
npm test
```