# Testing Guide for KG-New

This directory contains comprehensive tests for the Unified Capability Ontology with the absolute minimal model.

## Test Structure

### Unit Tests
- **`Capability.test.ts`** - Tests the core 3-field minimal model
- Tests capability creation, validation, and convenience getters
- Verifies the theoretical minimum structure works correctly
- **19/19 tests passing** ✅

### Integration Tests
- **`MongoDBIntegration.test.ts`** - Real MongoDB integration tests
- Tests the complete storage and service layer with actual MongoDB
- Verifies the minimal model works with real database operations
- Tests attribute-based queries, relationships, and performance

## Prerequisites

### For Unit Tests
No additional setup required - these run with mocked dependencies.

### For Integration Tests
You need a local MongoDB instance running:

#### macOS (with Homebrew)
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb
```

#### Ubuntu/Debian
```bash
# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify it's running
sudo systemctl status mongodb
```

#### Docker
```bash
# Run MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps | grep mongodb
```

#### Windows
Download and install from [MongoDB Community Server](https://www.mongodb.com/try/download/community)

## Running Tests

### Run All Tests
```bash
cd packages/kg-new
npm test
```

### Run Only Unit Tests
```bash
npm test -- --selectProjects unit
```

### Run Only Integration Tests
```bash
npm test -- --selectProjects integration
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

## Environment Variables

### MongoDB Configuration
```bash
# Optional: Custom MongoDB URL for tests
export MONGODB_TEST_URL="mongodb://localhost:27017"

# Optional: Suppress console logs during tests
export SUPPRESS_TEST_LOGS="true"
```

## Test Categories

### 1. Minimal Model Storage Tests
- Verifies only 3 fields are stored in MongoDB
- Tests that everything else goes into attributes
- Validates timestamps as attributes
- Confirms relationships as attributes

### 2. Attribute-Based Query Tests
- Cost range queries using attributes
- Category and text search in attributes
- Kind pattern matching
- Creation date queries (now in attributes!)

### 3. Relationship Operation Tests
- Part-of relationships via attributes
- Uses relationships via attributes
- Subtype relationships via attributes
- Complete relationship tree traversal

### 4. Performance Tests
- Bulk operations with minimal model
- Query performance with attribute-based indexes
- Storage efficiency measurements

### 5. Real-World Scenario Tests
- Complete sink installation workflow
- End-to-end capability management
- Complex relationship scenarios

## Test Data

### Test Database
- Database: `kg_new_test`
- Collection: `test_capabilities`
- Automatically cleaned up before each test

### Sample Test Data Structure
```javascript
// MongoDB document with minimal model (only 3 fields!)
{
  _id: ObjectId("..."),
  id: "test_capability",           // ✅ Business identity
  kind: "action.task",             // ✅ Classification  
  attributes: {                    // ✅ EVERYTHING ELSE!
    name: "Test Task",
    description: "A test task",
    cost: 100.00,
    createdAt: ISODate("..."),     // Timestamp as attribute!
    updatedAt: ISODate("..."),     // Timestamp as attribute!
    subtypeOf: "parent_task",      // Relationship as attribute!
    partOf: "parent_package",      // Relationship as attribute!
    requires: ["tool1", "tool2"]   // Collection as attribute!
  }
}
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
brew services list | grep mongodb
# or
sudo systemctl status mongodb
# or  
docker ps | grep mongodb

# Check MongoDB logs
brew services restart mongodb-community
# or
sudo journalctl -u mongodb
# or
docker logs mongodb
```

### Test Failures
1. **Connection timeout**: Ensure MongoDB is running and accessible
2. **Permission errors**: Check MongoDB permissions and user access
3. **Port conflicts**: Ensure port 27017 is available
4. **Memory issues**: Increase Jest timeout for large datasets

### Common Solutions
```bash
# Restart MongoDB
brew services restart mongodb-community

# Clear test database manually
mongo kg_new_test --eval "db.dropDatabase()"

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- MongoDBIntegration.test.ts
```

## Performance Expectations

### Unit Tests
- Should complete in < 5 seconds
- All 19 tests should pass
- No external dependencies

### Integration Tests  
- Should complete in < 30 seconds
- Requires local MongoDB
- Tests real database operations
- Includes performance benchmarks

### Benchmarks
- **Bulk creation**: 10 capabilities in < 100ms
- **Attribute queries**: Multiple queries in < 1000ms
- **Relationship traversal**: Complex trees in < 500ms
- **Storage efficiency**: 73% field reduction (11 → 3)

## Test Output Examples

### Successful Run
```
✅ Connected to local MongoDB for testing
📊 Minimal Model Statistics:
   Total capabilities: 3
   Average attributes per capability: 4.2
   Total attributes: 12
⚡ Bulk creation of 10 capabilities took 45ms
⚡ Multiple attribute queries took 123ms
✅ Complete sink installation workflow tested successfully
✅ Disconnected from MongoDB

Test Suites: 2 passed, 2 total
Tests: 45 passed, 45 total
```

### MongoDB Not Available
```
⚠️  MongoDB not available, skipping integration tests
   Start MongoDB locally: brew services start mongodb-community
   Or set MONGODB_TEST_URL environment variable

Test Suites: 1 passed, 1 skipped, 2 total  
Tests: 19 passed, 26 skipped, 45 total
```

## Contributing

When adding new tests:

1. **Unit tests** for core functionality
2. **Integration tests** for database operations  
3. **Performance tests** for optimization validation
4. **Real-world scenarios** for complete workflows

### Test Naming Convention
- `should [action] [expected result]`
- Group related tests in `describe` blocks
- Use clear, descriptive test names

### Test Data
- Use meaningful IDs and names
- Clean up after each test
- Avoid hardcoded values where possible
- Test edge cases and error conditions

## Architecture Benefits Tested

### ✅ Minimal Model Validation
- Only 3 fields in core interface
- Everything else as attributes
- 73% field reduction achieved
- Perfect backward compatibility

### ✅ Database Efficiency  
- Optimized MongoDB storage
- Attribute-based indexing
- Flexible query patterns
- Better performance metrics

### ✅ Relationship Management
- All relationships as attributes
- Efficient traversal algorithms
- Circular dependency detection
- Statistics and analytics

The test suite validates that our revolutionary minimal model delivers on all its promises while maintaining full functionality and performance.
