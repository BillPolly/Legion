# Contributing to Umbilical Testing Framework

Thank you for your interest in contributing to the Umbilical Testing Framework! This framework aims to revolutionize component testing by automatically detecting subtle bugs like the [object InputEvent] parameter passing error.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct: be respectful, inclusive, and constructive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

1. **Clear title and description** - What went wrong?
2. **Steps to reproduce** - How can we recreate the issue?
3. **Expected vs actual behavior** - What should have happened?
4. **Component code** - The component that triggered the bug
5. **Test output** - Full test results and error messages
6. **Environment** - Node version, OS, relevant dependencies

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

1. **Use case** - Why is this enhancement needed?
2. **Proposed solution** - How should it work?
3. **Alternatives considered** - What other approaches did you think about?
4. **Examples** - Code examples or mockups if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Write tests** - All new features must have tests
3. **Ensure tests pass** - Run `npm test` before submitting
4. **Update documentation** - Keep README and API docs current
5. **Follow code style** - Run `npm run lint` and `npm run format`
6. **Write clear commit messages** - Describe what and why

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/umbilical-testing.git
cd umbilical-testing

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run example tests
npm run test:examples

# Check code style
npm run lint

# Format code
npm run format
```

## Project Structure

```
packages/testing/umbilical-testing/
├── src/
│   ├── core/           # Core infrastructure
│   ├── generators/     # Test generators
│   ├── validators/     # Bug validators
│   └── utils/         # Utilities
├── __tests__/         # Test files
├── examples/          # Example components
└── docs/             # Documentation
```

## Adding New Test Generators

To add a new test generator:

1. Create a new file in `src/generators/`
2. Extend the base generator pattern
3. Implement the `generateTests()` static method
4. Add tests in `__tests__/unit/generators/`
5. Update `TestOrchestrator` to include your generator
6. Document the generator in README

Example:
```javascript
export class MyTestGenerator {
  static generateTests(description) {
    const tests = [];
    // Generate tests based on description
    return tests;
  }
}
```

## Adding New Bug Detectors

To add a new bug detector:

1. Create a new file in `src/validators/`
2. Implement the `detectBugs()` static method
3. Return bugs in the standard format
4. Add tests in `__tests__/unit/validators/`
5. Integrate with `TestOrchestrator`

## Testing Guidelines

- **Unit tests** - Test individual components in isolation
- **Integration tests** - Test component interactions
- **Example tests** - Ensure examples work correctly
- **Coverage** - Maintain 100% test coverage

## Code Style

- Use ES modules (`import`/`export`)
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Handle errors gracefully
- Always extract event values correctly (avoid [object InputEvent]!)

## Documentation

- Update README for new features
- Add JSDoc comments for new methods
- Include usage examples
- Update CHANGELOG for notable changes

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run tests: `npm test`
4. Build: `npm run build`
5. Tag release: `git tag v1.0.0`
6. Push: `git push --tags`

## Questions?

Feel free to open an issue for questions or join our discussions. We're here to help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.