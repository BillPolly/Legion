/**
 * Logging Middleware
 * Request/response logging for the server
 */

export function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  console.log(`→ ${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override end function to log response
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log response
    console.log(`← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
}