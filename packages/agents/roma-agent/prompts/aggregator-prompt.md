# AggregatorAgent Prompts

This file contains the core prompt templates used by the AggregatorAgent for result synthesis and aggregation.

## Synthesis Prompt Template

```
You are an expert result synthesizer. Combine these task results into a single, coherent, comprehensive output.

Task Results ({count} items):

{results}

{error_note}

Create a synthesized result that:
1. Combines all information coherently
2. Eliminates redundancy and contradictions
3. Maintains important details and insights
4. Presents a clear, well-structured output
5. Flows logically from one point to the next

Operations included: {operations}

Your synthesized result:
```

## Hierarchical Aggregation Prompt Template

```
You are an expert result aggregator. Aggregate these hierarchical task results into a coherent, comprehensive output.

Results to aggregate ({count} items):

{hierarchical_results}

Preserve the hierarchical relationships and create a well-structured, comprehensive result that:
1. Maintains the logical flow from parent to child tasks
2. Integrates all successful results coherently
3. Provides clear organization and structure
4. Eliminates redundancy while preserving important details

Your aggregated result:
```

## Summary Generation Prompt Template

```
Create a concise executive summary of this aggregated result:

{content}

The summary should:
1. Be 2-3 sentences maximum
2. Capture the key findings or outcomes
3. Be suitable for quick decision-making

Executive Summary:
```

## Key Findings Extraction Prompt Template

```
Extract the key findings from this aggregated result as a bullet-point list:

{content}

List the 3-5 most important findings, insights, or conclusions:

Key Findings:
```

## Usage Guidelines

### Synthesis Strategy Selection

1. **Single Result**: Pass-through with minimal processing
2. **Merge Strategy**: Used for similar content types (e.g., multiple WRITE operations)
3. **Hierarchical Strategy**: Used when parent-child relationships exist
4. **Synthesis Strategy**: Default LLM-based combination for mixed content

### Content Type Detection

- **Documentation**: Contains headers, structured content
- **Analysis**: Contains analysis keywords, conclusions
- **Research**: Contains search results, data points
- **General**: Default fallback

### Error Handling

- Failed tasks are excluded from synthesis but noted in metadata
- Malformed results are counted but not processed
- Partial failures are handled gracefully

### Formatting Options

- **JSON**: Structured data format
- **Markdown**: Document format with headers
- **Plain Text**: Default format

## Best Practices

1. Always preserve important metadata from source results
2. Maintain logical flow in aggregated content
3. Eliminate redundancy while preserving key insights
4. Handle mixed operation types intelligently
5. Provide clear attribution when possible
6. Generate summaries for complex aggregations
7. Extract actionable key findings
8. Support multiple output formats

## Example Aggregation Scenarios

### Mixed Operations (THINK + SEARCH + WRITE)
- THINK: Analysis and reasoning
- SEARCH: Supporting data and facts
- WRITE: Structured documentation

Result: Comprehensive report with analysis backed by data

### Hierarchical Decomposition
- Parent: High-level market analysis
- Child 1: Competitor research
- Child 2: Financial analysis
- Child 3: Risk assessment

Result: Integrated market analysis with all components

### Sequential Dependencies
- Task 1: Initial research → Task 2: Analysis → Task 3: Report

Result: Final report incorporating all previous work

### Parallel Independent Tasks
- Multiple searches on different topics
- Multiple analyses of different aspects

Result: Comprehensive synthesis of all parallel work