# @legion/resource-manager

Singleton dependency injection container for the Legion framework. Provides centralized resource management with transparent property access via JavaScript Proxy.

## Installation

```bash
npm install @legion/resource-manager
```

## Usage

### Basic Usage

```javascript
import { ResourceManager } from '@legion/resource-manager';

// Get singleton instance (auto-initializes)
const resourceManager = await ResourceManager.getInstance();

// Access environment variables
const apiKey = resourceManager.get('env.API_KEY');
const mongoUri = resourceManager.get('env.MONGO_URI');

// Set and get resources
resourceManager.set('myService', new MyService());
const service = resourceManager.get('myService');

// Direct property access via Proxy
resourceManager.apiKey = 'sk-123';
console.log(resourceManager.apiKey); // 'sk-123'
```

### Environment Variables

ResourceManager automatically loads the `.env` file from the monorepo root on initialization:

```javascript
// Access environment variables with dot notation
const dbUrl = resourceManager.get('env.DATABASE_URL');
const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
```

### LLM Client Creation

```javascript
// Get or create LLM client
const llmClient = await resourceManager.get('llmClient');

// Or explicitly create with custom config
const customLLM = await resourceManager.createLLMClient({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 2000
});
```

## API

### Static Methods

- `getInstance()` - Returns the singleton instance (auto-initializes)
- `getResourceManager()` - Deprecated, use getInstance()

### Instance Methods

- `get(name)` - Get a resource by name (supports dot notation)
- `set(name, value)` - Set a resource
- `has(name)` - Check if a resource exists
- `remove(name)` - Remove a resource
- `load(resources)` - Load multiple resources from an object
- `clear()` - Clear all resources
- `keys()` - Get all resource keys
- `toObject()` - Export all resources as plain object
- `createLLMClient(config)` - Create LLM client with configuration

### Proxy Features

The ResourceManager uses a Proxy to provide transparent property access:

```javascript
// Set resources like object properties
resourceManager.apiKey = 'sk-123';
resourceManager.baseUrl = 'https://api.example.com';

// Access them directly
console.log(resourceManager.apiKey);

// Check existence
console.log('apiKey' in resourceManager); // true

// Delete resources
delete resourceManager.tempResource;
```

## Important Notes

1. **Singleton Pattern**: Only one instance exists across the entire application
2. **Auto-initialization**: The instance automatically initializes on first access
3. **Environment Loading**: Automatically loads `.env` from monorepo root
4. **Service Management**: Can start required services like Docker, Qdrant, MongoDB
5. **Thread Safety**: Safe to use across multiple modules

## Testing

```bash
npm test
```

## License

MIT