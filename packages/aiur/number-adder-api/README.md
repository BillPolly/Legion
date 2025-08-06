# Number Adder API

A simple REST API that adds two numbers.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoint

### POST /api/add

Adds two numbers together.

**Request Body:**
```json
{
  "num1": number,
  "num2": number
}
```

**Success Response:**
```json
{
  "result": number
}
```

**Error Response:**
```json
{
  "error": "error message"
}
```

## Testing

Run the tests:
```bash
npm test
```