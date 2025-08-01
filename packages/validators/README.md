# @legion/validators

Input validation utilities for the Legion framework.

## Overview

This package provides comprehensive validation utilities for input validation, data sanitization, and schema validation within the Legion framework ecosystem.

## Features

- **Base Validator**: Core validation functionality with error collection
- **String Validation**: Length constraints, pattern matching, format validation
- **Number Validation**: Range checking, integer validation, numeric constraints
- **Extensible Architecture**: Easy to create custom validators
- **Error Collection**: Comprehensive error reporting and messages

## Installation

```bash
npm install @legion/validators
```

## Usage

### Basic Validation

```javascript
import { Validator, StringValidator, NumberValidator } from '@legion/validators';

// Basic validator
const validator = new Validator();
console.log(validator.validate('some input')); // true
console.log(validator.validate(null)); // false

// String validation
const stringValidator = new StringValidator({
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9]+$/
});

if (stringValidator.validate('hello123')) {
  console.log('Valid string!');
} else {
  console.log('Errors:', stringValidator.getErrors());
}

// Number validation
const numberValidator = new NumberValidator({
  min: 0,
  max: 100,
  integer: true
});

if (numberValidator.validate(42)) {
  console.log('Valid number!');
} else {
  console.log('Errors:', numberValidator.getErrors());
}
```

### Creating Custom Validators

```javascript
import { Validator } from '@legion/validators';

class EmailValidator extends Validator {
  validate(input) {
    super.validate(input);
    
    if (typeof input !== 'string') {
      this.errors.push('Email must be a string');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      this.errors.push('Invalid email format');
    }
    
    return this.isValid();
  }
}

const emailValidator = new EmailValidator();
console.log(emailValidator.validate('user@example.com')); // true
```

## API Reference

### Validator

Base validator class with core functionality.

**Constructor**: `new Validator(rules = {})`
**Methods**:
- `validate(input)`: Validates input, returns boolean
- `getErrors()`: Returns array of error messages
- `isValid()`: Returns true if no errors

### StringValidator

Validates string inputs with various constraints.

**Constructor**: `new StringValidator(options)`
**Options**:
- `minLength`: Minimum string length
- `maxLength`: Maximum string length  
- `pattern`: Regular expression pattern to match

### NumberValidator

Validates numeric inputs with range and type constraints.

**Constructor**: `new NumberValidator(options)`
**Options**:
- `min`: Minimum value
- `max`: Maximum value
- `integer`: Require integer values (boolean)

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Testing

The package includes comprehensive tests covering:
- Base validator functionality
- String validation with various constraints
- Number validation with range checking
- Error collection and reporting
- Edge cases and invalid inputs

## Contributing

This package follows Legion framework conventions:
- ES modules with `type: "module"`
- Jest testing with experimental VM modules
- 80% coverage threshold
- Consistent error handling patterns

## License

MIT