# Addition API Server

A simple Node.js server that provides an API endpoint to add two numbers.

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### POST /api/add

Adds two numbers and returns the result.

**Request Body:**
```json
{
  "a": 5,
  "b": 3
}
```

**Response:**
```json
{
  "a": 5,
  "b": 3,
  "result": 8
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{"a":5,"b":3}'
```

### GET /api/add

Returns usage information for the addition API.

### GET /

Returns information about all available endpoints.

## Testing

Run the test script (make sure the server is running first):

```bash
node test-api.js
```

## Error Handling

The API validates that both `a` and `b` are numbers. If invalid input is provided, it returns a 400 error with an explanation.