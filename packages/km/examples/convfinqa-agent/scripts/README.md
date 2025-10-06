# ConvFinQA Agent Scripts

This directory contains all executable scripts for the ConvFinQA agent evaluation system, organized by purpose.

## Directory Structure

### `ontology/` - Ontology Building (ONE-TIME)

Scripts for building the financial domain ontology from training data.

- **`build-ontology.js`** - Simple ontology builder (legacy)
  - Command: `npm run build-ontology-simple`
  - Builds basic ontology from ConvFinQA training data

- **`build-verified-ontology.js`** - Verified ontology builder (recommended)
  - Command: `npm run build-ontology`
  - Builds ontology with Z3 formal verification
  - **Use this for production**

- **`build-example-kgs.js`** - Build knowledge graphs for examples
  - Command: `npm run build-example-kgs`
  - Creates instance-level KGs from table data

### `evaluation/` - Evaluation Runs

Scripts for running agent evaluations on test data.

- **`run-evaluation.js`** - Main evaluation runner
  - Command: `npm run eval`
  - Runs full evaluation on test dataset
  - Options: `--max-examples N` to limit number of examples

- **`eval-example.js`** - Single example evaluator
  - Command: `npm run eval:example`
  - Evaluates a single example for debugging
  - Useful for testing agent improvements

- **`process-example-simple.js`** - Process single example
  - Command: `npm run process-example`
  - Simple example processing (legacy)

### `testing/` - Manual Testing & Debugging

Scripts for testing individual components and phases.

- **`test-understand.js`** - Test semantic understanding phase
  - Command: `npm run test:understand`
  - Tests Phase 1: Semantic Understanding
  - Useful for debugging question comprehension

- **`test-retrieval.js`** - Test data retrieval phase
  - Command: `npm run test:retrieval`
  - Tests Phase 2: Iterative Data Retrieval
  - Useful for debugging KG queries

- **`test-calculation.js`** - Test calculation phase
  - Command: `npm run test:calculation`
  - Tests Phase 3: Calculation & Formatting
  - Useful for debugging answer generation

### `analysis/` - Result Analysis

Scripts for inspecting and analyzing evaluation results.

- **`inspect-results.js`** - Inspect evaluation results
  - Command: `npm run inspect`
  - View detailed results from MongoDB
  - Options: `--show-failed`, `--example-id`, `--turn-index`, `--show-kg`

## Typical Workflow

### 1. One-Time Setup

Build the ontology from training data (only needs to be done once):

```bash
npm run build-ontology
```

### 2. Run Evaluation

Test on a few examples first:

```bash
npm run eval -- --max-examples 5
```

Run full evaluation:

```bash
npm run eval
```

### 3. Analyze Results

Inspect the latest run:

```bash
npm run inspect
```

Show failed turns:

```bash
npm run inspect -- --show-failed
```

### 4. Debug Issues

If agent is failing, use testing scripts to debug individual phases:

```bash
# Test understanding phase
npm run test:understand

# Test retrieval phase
npm run test:retrieval

# Test calculation phase
npm run test:calculation
```

## Notes

- All scripts use ES6 modules (requires `NODE_OPTIONS='--experimental-vm-modules'`)
- Scripts expect MongoDB to be running
- Requires `ANTHROPIC_API_KEY` in `.env` file
- See main README.md for complete setup instructions
