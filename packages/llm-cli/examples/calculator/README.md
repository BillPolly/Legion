# Calculator CLI Example

A natural language calculator built with the LLM-CLI framework. This example demonstrates how to create a conversational calculator that understands natural language queries.

## Features

- **Natural Language Understanding**: Ask questions in plain English
- **Basic Arithmetic**: Addition, subtraction, multiplication, division, powers, square roots
- **Variables**: Store and recall values for later use
- **Unit Conversion**: Convert between common units (length, temperature, weight)
- **Statistics**: Calculate mean, median, and standard deviation
- **History**: Track your calculation history
- **Context Awareness**: Reference previous results with "that" or "it"

## Usage

### Running the Calculator

```bash
# From the llm-cli directory
npm run example:calculator

# Or directly
npx ts-node examples/calculator/index.ts
```

### Example Commands

#### Basic Arithmetic
```
calc> What is 5 plus 3?
5 + 3 = 8

calc> Calculate (10 + 5) * 2
(10 + 5) * 2 = 30

calc> What is the square root of 144?
sqrt(144) = 12

calc> 2 to the power of 10
2^10 = 1024
```

#### Using Variables
```
calc> Store 42 as answer
Stored answer = 42

calc> What is answer times 2?
answer * 2 = 84

calc> Show all variables
Stored variables:
answer = 42
```

#### Unit Conversion
```
calc> Convert 5 kilometers to miles
5 kilometers = 3.11 miles

calc> Convert 100 Celsius to Fahrenheit
100°C = 212.00°F

calc> Convert 10 kg to pounds
10 kg = 22.05 lbs
```

#### Statistics
```
calc> What is the average of 10, 20, 30, 40, 50?
mean of [10, 20, 30, 40, 50] = 30.00

calc> Find the median of 1, 3, 5, 7, 9
median of [1, 3, 5, 7, 9] = 5.00
```

#### Context Awareness
```
calc> 10 plus 5
10 + 5 = 15

calc> Now multiply that by 2
15 * 2 = 30
```

## Architecture

This example showcases several key features of the LLM-CLI framework:

1. **Command Registration**: Multiple commands for different operations
2. **Natural Language Processing**: The LLM interprets various phrasings
3. **State Management**: Persistent calculator state with variables and history
4. **Context Providers**: Custom context provider for calculator state
5. **Error Handling**: Graceful handling of invalid expressions and operations

## Extending the Calculator

You can extend this calculator by:

1. Adding more mathematical functions (sin, cos, log, etc.)
2. Supporting more unit conversions
3. Adding graphing capabilities
4. Implementing matrix operations
5. Adding symbolic math support

## Testing

Run the tests with:
```bash
npm test examples/calculator/__tests__/calculator.test.ts
```

The test suite covers:
- Basic arithmetic operations
- Variable storage and recall
- Unit conversions
- Statistics calculations
- Error handling
- Natural language understanding