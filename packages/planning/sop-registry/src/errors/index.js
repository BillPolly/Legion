export class SOPRegistryError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'SOPRegistryError';
    this.code = code;
    this.details = details;
  }
}

export class SOPLoadError extends SOPRegistryError {
  constructor(message, filePath, originalError) {
    super(message, 'SOP_LOAD_ERROR', { filePath, originalError });
    this.name = 'SOPLoadError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

export class SOPValidationError extends SOPRegistryError {
  constructor(message, errors, sopData) {
    super(message, 'SOP_VALIDATION_ERROR', { errors, sopData });
    this.name = 'SOPValidationError';
    this.errors = errors;
    this.sopData = sopData;
  }
}

export class SOPSearchError extends SOPRegistryError {
  constructor(message, query, originalError) {
    super(message, 'SOP_SEARCH_ERROR', { query, originalError });
    this.name = 'SOPSearchError';
    this.query = query;
    this.originalError = originalError;
  }
}

export class PerspectiveGenerationError extends SOPRegistryError {
  constructor(message, sopId, originalError) {
    super(message, 'PERSPECTIVE_GENERATION_ERROR', { sopId, originalError });
    this.name = 'PerspectiveGenerationError';
    this.sopId = sopId;
    this.originalError = originalError;
  }
}

export class DatabaseError extends SOPRegistryError {
  constructor(message, operation, collection, originalError) {
    super(message, 'DATABASE_ERROR', { operation, collection, originalError });
    this.name = 'DatabaseError';
    this.operation = operation;
    this.collection = collection;
    this.originalError = originalError;
  }
}