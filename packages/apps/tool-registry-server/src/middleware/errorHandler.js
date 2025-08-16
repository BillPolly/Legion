/**
 * Error Handler Middleware
 * Centralized error handling for the server
 */

export function errorHandler(err, req, res, next) {
  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Prepare error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = err.details;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
}