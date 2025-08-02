# Umbilical Testing Framework CLI

The Umbilical Testing Framework includes a powerful command-line interface for running tests on your components directly from the terminal.

## Installation

### Global Installation
```bash
npm install -g @legion/umbilical-testing
```

### Local Installation
```bash
npm install --save-dev @legion/umbilical-testing
```

For local installation, use `npx umbilical` or add to your package.json scripts.

## Basic Usage

```bash
# Test a single component
umbilical src/components/SearchInput.js

# Test all components in a directory
umbilical src/components/

# Test with specific options
umbilical --verbose --min-grade B src/

# Watch for changes
umbilical --watch src/components/
```

## Command-Line Options

### General Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version information |
| `--verbose` | `-V` | Enable verbose logging |
| `--config <file>` | `-c` | Use configuration file |

### Testing Options

| Option | Short | Description |
|--------|-------|-------------|
| `--parallel` | `-p` | Run tests in parallel |
| `--timeout <ms>` | `-t` | Test timeout in milliseconds (default: 30000) |
| `--fail-fast` | | Stop on first failure |
| `--min-grade <grade>` | | Minimum acceptable quality grade (A+, A, B, C, D) |

### Output Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output <format>` | `-o` | Output format: console, json, html, markdown |
| `--output-file <file>` | `-f` | Save output to file |
| `--no-recommendations` | | Hide recommendations |
| `--no-bug-details` | | Hide detailed bug information |

### Bug Detection Options

| Option | Description |
|--------|-------------|
| `--detect <type>` | Detect specific bug type only |

Bug types:
- `parameter-passing` - [object InputEvent] and similar bugs
- `type-errors` - Type mismatches and violations
- `coordination` - State-DOM coordination issues
- `invariants` - Property and constraint violations

### Watch Mode

| Option | Short | Description |
|--------|-------|-------------|
| `--watch` | `-w` | Watch files for changes and re-test |

## Examples

### Basic Testing

```bash
# Test a single component
umbilical MyComponent.js

# Test multiple components
umbilical Component1.js Component2.js Component3.js

# Test entire directory
umbilical src/components/

# Test with current directory
umbilical
```

### Quality Requirements

```bash
# Require minimum B grade
umbilical --min-grade B src/

# Fail on any bugs
umbilical --fail-fast src/

# Only check for [object InputEvent] bugs
umbilical --detect parameter-passing src/
```

### Output Formats

```bash
# Console output (default)
umbilical src/

# JSON output to file
umbilical --output json --output-file report.json src/

# HTML report
umbilical --output html --output-file report.html src/

# Markdown report
umbilical --output markdown --output-file report.md src/

# JSON to stdout
umbilical --output json src/
```

### Watch Mode

```bash
# Watch single file
umbilical --watch MyComponent.js

# Watch directory
umbilical --watch src/components/

# Watch with specific output
umbilical --watch --output json --output-file live-report.json src/
```

### Verbose Mode

```bash
# Show detailed logging
umbilical --verbose src/

# Combine with other options
umbilical -V --min-grade A --detect parameter-passing src/
```

## Configuration File

Create an `umbilical.config.json` file in your project root:

```json
{
  "verboseLogging": false,
  "parallelExecution": true,
  "timeout": 30000,
  "minGrade": "B",
  "outputFormat": "console",
  "showRecommendations": true,
  "showBugDetails": true,
  "detectParameterBugs": true,
  "detectCoordinationBugs": true,
  "includeInvariantTests": true,
  "testPatterns": [
    "**/*.component.js",
    "**/components/*.js"
  ],
  "excludePatterns": [
    "**/*.test.js",
    "**/*.spec.js",
    "**/node_modules/**"
  ]
}
```

Use the config file:
```bash
umbilical --config umbilical.config.json
```

## Exit Codes

- `0` - All tests passed, no bugs found
- `1` - Tests failed or bugs detected
- `2` - Configuration or file errors

## Integration with Package Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test:umbilical": "umbilical src/components/",
    "test:umbilical:watch": "umbilical --watch src/components/",
    "test:umbilical:report": "umbilical --output html --output-file umbilical-report.html src/",
    "test:umbilical:strict": "umbilical --min-grade A --fail-fast src/"
  }
}
```

Then run:
```bash
npm run test:umbilical
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Umbilical Tests
  run: |
    npx umbilical --min-grade B --output json --output-file results.json src/
    
- name: Upload Results
  uses: actions/upload-artifact@v2
  with:
    name: umbilical-results
    path: results.json
```

### GitLab CI

```yaml
umbilical-test:
  script:
    - npx umbilical --min-grade B --fail-fast src/
  artifacts:
    reports:
      junit: umbilical-report.xml
```

### Jenkins

```groovy
stage('Umbilical Testing') {
  steps {
    sh 'npx umbilical --output json --output-file results.json src/'
    publishHTML([
      reportDir: '.',
      reportFiles: 'results.json',
      reportName: 'Umbilical Test Results'
    ])
  }
}
```

## Understanding Output

### Console Output

```
Testing: SearchComponent.js
Path: /src/components/SearchComponent.js

Results:
  Grade: F (Score: 15/100)
  Tests: 18/30 passed (60.0%)
  Coverage: 75.5%
  Duration: 1234ms

Bugs Found: 3
  High: 2
  Medium: 1
  Low: 0
  ⚠️  [object InputEvent] bug detected!

Recommendations:
  1. [CRITICAL] Fix 2 critical bug(s)
  2. [HIGH] Add type validation for event handlers
  3. [MEDIUM] Improve test coverage to at least 80%
```

### JSON Output

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "totalComponents": 5,
  "totalBugs": 3,
  "components": [
    {
      "file": "/src/components/SearchComponent.js",
      "component": "SearchComponent",
      "grade": "F",
      "score": 15,
      "bugs": 3,
      "wouldDetectInputEventBug": true,
      "passRate": 60.0,
      "duration": 1234
    }
  ]
}
```

## Quality Grades

| Grade | Criteria | Meaning |
|-------|----------|---------|
| **A+** | 95%+ pass rate, 0 bugs | Perfect implementation |
| **A** | 95%+ pass rate, ≤1 bug | Excellent quality |
| **B** | 85%+ pass rate, ≤2 bugs | Good quality |
| **C** | 70%+ pass rate, ≤5 bugs | Acceptable quality |
| **D** | 50%+ pass rate, ≤10 bugs | Needs improvement |
| **F** | Critical bugs or <50% pass | Failing quality |

## Troubleshooting

### Component Not Found

If the CLI reports "not an Umbilical component", ensure your component:

1. Exports a component with a `describe` method
2. Uses proper ES module syntax
3. Is not a test file

### Watch Mode Not Working

- Ensure you have Node.js 14.17+ for native fs.watch support
- Check file permissions
- Try using absolute paths

### Performance Issues

- Use `--parallel` for faster execution
- Adjust `--timeout` for slow components
- Consider testing directories separately

## Tips and Best Practices

1. **Start with loose requirements**: Begin with `--min-grade C` and gradually increase
2. **Use configuration files**: Store common options in `umbilical.config.json`
3. **Integrate with CI/CD**: Fail builds on quality degradation
4. **Monitor trends**: Save JSON reports to track quality over time
5. **Focus on critical bugs**: Use `--detect parameter-passing` for targeted testing
6. **Watch during development**: Keep `--watch` running while coding

## See Also

- [API Reference](./API.md) - Programmatic API documentation
- [Examples](../examples/) - Example components and tests
- [Troubleshooting](./Troubleshooting.md) - Common issues and solutions