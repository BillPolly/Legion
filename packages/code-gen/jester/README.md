# Template Package

A ready-to-use template for creating new packages in this monorepo. This template provides a standardized structure and configuration that can be easily copied and customized for new packages.

## Purpose

This package serves as a template to streamline the creation of new packages by providing:
- Standard directory structure
- Pre-configured Jest testing setup
- Common dependencies and dev dependencies
- Consistent package.json configuration
- Documentation structure

## Structure

```
packages/Template/
├── README.md           # This file
├── package.json        # Package configuration
├── jest.config.js      # Jest testing configuration
├── docs/              # Documentation directory
│   └── Design.md      # Design documentation
├── src/               # Source code directory
│   └── index.js       # Main entry point
├── test/              # Test directory
└── scripts/           # Utility scripts
```

## How to Use This Template

1. **Copy the Template Directory**
   ```bash
   cp -r packages/Template packages/YourNewPackage
   ```

2. **Update package.json**
   - Change the `name` field to your package name (lowercase, kebab-case)
   - Update the `description` field
   - Modify dependencies as needed for your specific package
   - Update the `author` field if different

3. **Update Documentation**
   - Replace this README.md with documentation specific to your package
   - Update docs/Design.md with your package's design documentation

4. **Implement Your Package**
   - Replace src/index.js with your package's main implementation
   - Add additional source files as needed
   - Create appropriate test files in the test/ directory

5. **Update Scripts**
   - Add any package-specific scripts to the scripts/ directory
   - Update package.json scripts section as needed

## Included Dependencies

### Runtime Dependencies
- `@example/git-manager` - Git management utilities (workspace dependency)
- `inquirer` - Interactive command line prompts
- `chalk` - Terminal string styling
- `open` - Open files and URLs
- `dotenv` - Environment variable loading

### Development Dependencies
- `cross-env` - Cross-platform environment variables
- `eslint` - JavaScript linting
- `jest` - Testing framework

## Testing

The template includes Jest configuration for testing:

```bash
npm run test
```

## Requirements

- Node.js >= 18.0.0
- This package uses ES modules (`"type": "module"`)

## License

MIT

## Notes

- This is a private package (`"private": true`) intended for internal use as a template
- The package is configured for ES modules
- Jest is configured with experimental VM modules support for ES module compatibility
- Remember to update all placeholder content when creating a new package from this template
