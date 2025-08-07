# @legion/schema

JSON Schema to Zod validator conversion for the Legion framework. This package provides a comprehensive solution for converting JSON Schema definitions to Zod validators dynamically at runtime.

## Features

- ✅ Full JSON Schema draft-07 support
- ✅ Complex schema support (oneOf, anyOf, allOf, not)
- ✅ $ref resolution for schema references
- ✅ Type coercion for lenient validation
- ✅ Custom format handlers
- ✅ Both object and function interfaces
- ✅ Async validation support
- ✅ Detailed error messages

## Installation

```bash
npm install @legion/schema
```

## Quick Start

```javascript
import { jsonSchemaToZod, createValidator } from '@legion/schema';

// Simple conversion
const jsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name']
};

// Convert to Zod schema directly
const zodSchema = jsonSchemaToZod(jsonSchema);
const result = zodSchema.parse({ name: 'John', age: 30 });

// Or use the validator wrapper
const validator = createValidator(jsonSchema);
const validation = validator.validate({ name: 'John', age: 30 });
if (validation.valid) {
  console.log('Valid data:', validation.data);
} else {
  console.log('Errors:', validation.errors);
}
```

## API Reference

### SchemaConverter

The main class for converting JSON Schema to Zod schemas.

```javascript
import { SchemaConverter } from '@legion/schema';

const converter = new SchemaConverter({
  strictMode: true,        // Strict type checking (default: true)
  coerceTypes: false,      // Enable type coercion (default: false)
  customFormats: {}        // Custom format handlers
});

const zodSchema = converter.convert(jsonSchema);
```

### ZodValidator

A wrapper class that provides convenient validation methods.

```javascript
import { ZodValidator } from '@legion/schema';

const validator = new ZodValidator(jsonSchema, {
  coerceTypes: false,      // Enable type coercion
  strictMode: true,        // Strict validation
  abortEarly: false,       // Stop on first error
  includeStack: false      // Include error stack traces
});

// Validate synchronously
const result = validator.validate(data);

// Validate asynchronously
const asyncResult = await validator.validateAsync(data);

// Safe parse (doesn't throw)
const safeResult = validator.safeParse(data);

// Check validity
const isValid = validator.isValid(data);

// Update schema dynamically
validator.updateSchema(newJsonSchema);
```

### Factory Functions

Convenient factory functions for common use cases:

```javascript
import { 
  createValidator,
  createValidatorFunction,
  createAsyncValidatorFunction,
  createPredicate 
} from '@legion/schema';

// Create a validator instance
const validator = createValidator(jsonSchema);

// Create a validation function
const validate = createValidatorFunction(jsonSchema);
const result = validate(data);

// Create an async validation function
const validateAsync = createAsyncValidatorFunction(jsonSchema);
const result = await validateAsync(data);

// Create a predicate function
const isValid = createPredicate(jsonSchema);
if (isValid(data)) {
  // Data is valid
}
```

## Supported JSON Schema Features

### Basic Types
- `null`
- `boolean`
- `integer`
- `number`
- `string`
- `array`
- `object`

### String Formats
- `email`
- `uri` / `url`
- `uuid`
- `date-time`
- `date`
- `time`
- `ipv4`
- `ipv6`
- `hostname`
- `regex`

### Constraints
- String: `minLength`, `maxLength`, `pattern`
- Number: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`
- Array: `minItems`, `maxItems`, `uniqueItems`, `items`, `additionalItems`
- Object: `properties`, `required`, `additionalProperties`, `minProperties`, `maxProperties`, `dependencies`, `patternProperties`

### Advanced Features
- `enum` and `const`
- `oneOf`, `anyOf`, `allOf`, `not`
- `$ref` references
- Default values
- Tuple validation

## Examples

### Complex Object Validation

```javascript
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    username: { 
      type: 'string', 
      minLength: 3, 
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$'
    },
    email: { 
      type: 'string', 
      format: 'email' 
    },
    age: { 
      type: 'number', 
      minimum: 13, 
      maximum: 120 
    },
    roles: {
      type: 'array',
      items: { 
        type: 'string',
        enum: ['user', 'admin', 'moderator']
      },
      minItems: 1,
      uniqueItems: true
    },
    profile: {
      type: 'object',
      properties: {
        bio: { type: 'string', maxLength: 500 },
        website: { type: 'string', format: 'uri' }
      }
    }
  },
  required: ['id', 'username', 'email']
};

const validator = createValidator(userSchema);
const result = validator.validate({
  id: 1,
  username: 'john_doe',
  email: 'john@example.com',
  age: 25,
  roles: ['user'],
  profile: {
    bio: 'Software developer',
    website: 'https://example.com'
  }
});
```

### Using References

```javascript
const schemaWithRefs = {
  definitions: {
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' }
      },
      required: ['city', 'country']
    }
  },
  type: 'object',
  properties: {
    name: { type: 'string' },
    homeAddress: { $ref: '#/definitions/address' },
    workAddress: { $ref: '#/definitions/address' }
  }
};

const validator = createValidator(schemaWithRefs);
```

### Type Coercion

```javascript
const schema = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    active: { type: 'boolean' },
    tags: { 
      type: 'array',
      items: { type: 'string' }
    }
  }
};

// Enable type coercion
const validator = createValidator(schema, { coerceTypes: true });

// These string values will be coerced to correct types
const result = validator.validate({
  count: '42',        // Coerced to 42
  active: 'true',     // Coerced to true
  tags: ['tag1', 'tag2']
});
```

### Custom Format Handlers

```javascript
const customFormats = {
  'phone': (schema) => schema.regex(/^\+?[1-9]\d{1,14}$/),
  'color': (schema) => schema.regex(/^#[0-9A-F]{6}$/i)
};

const schema = {
  type: 'object',
  properties: {
    phone: { type: 'string', format: 'phone' },
    favoriteColor: { type: 'string', format: 'color' }
  }
};

const validator = createValidator(schema, { customFormats });
```

### Discriminated Unions (oneOf)

```javascript
const schema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        type: { const: 'rectangle' },
        width: { type: 'number' },
        height: { type: 'number' }
      },
      required: ['type', 'width', 'height']
    },
    {
      type: 'object',
      properties: {
        type: { const: 'circle' },
        radius: { type: 'number' }
      },
      required: ['type', 'radius']
    }
  ]
};

const validator = createValidator(schema);

// Valid rectangle
validator.isValid({ type: 'rectangle', width: 10, height: 20 }); // true

// Valid circle
validator.isValid({ type: 'circle', radius: 5 }); // true

// Invalid - mixed properties
validator.isValid({ type: 'rectangle', radius: 5 }); // false
```

## Migration Guide

If you're migrating from manual Zod schema creation or other validation libraries:

### From Manual Zod

```javascript
// Before - Manual Zod schema
const zodSchema = z.object({
  name: z.string(),
  age: z.number().min(0).optional()
});

// After - JSON Schema with conversion
const jsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name']
};
const zodSchema = jsonSchemaToZod(jsonSchema);
```

### From Other Validators

```javascript
// Before - Using another validator
const schema = Joi.object({
  username: Joi.string().min(3).max(30).required()
});

// After - JSON Schema
const jsonSchema = {
  type: 'object',
  properties: {
    username: { 
      type: 'string', 
      minLength: 3, 
      maxLength: 30 
    }
  },
  required: ['username']
};
const validator = createValidator(jsonSchema);
```

## Performance Considerations

- Schema conversion is done once at initialization
- Validation is performed using the compiled Zod schema
- Reference resolution is cached for better performance
- Consider reusing validator instances for the same schema

## TypeScript Support

While this package is written in JavaScript, it works seamlessly with TypeScript projects. The Zod schemas generated can be used with TypeScript's type inference:

```typescript
import { jsonSchemaToZod } from '@legion/schema';
import { z } from 'zod';

const schema = jsonSchemaToZod({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
});

// TypeScript will infer the type
type User = z.infer<typeof schema>;
// { name: string; age?: number }
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## See Also

- [Zod Documentation](https://github.com/colinhacks/zod)
- [JSON Schema Specification](https://json-schema.org/)
- [Legion Framework](https://github.com/maxximus-dev/Legion)