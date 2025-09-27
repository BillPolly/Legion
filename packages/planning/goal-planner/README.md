# Goal Planner

Converts high-level goals into executable subgoal decompositions using SOP-based planning.

## Overview

The Goal Planner intelligently plans goals by:
1. Searching SOPRegistry for relevant procedures
2. Judging SOP applicability with LLM
3. Adapting SOP steps into subgoals with tool suggestions
4. Tracking provenance (which SOP generated each subgoal)

## Installation

```bash
npm install
```

**Requirements:**
- SOPRegistry with loaded SOPs and perspectives
- MongoDB with SOP data
- Anthropic API key

## Usage

```javascript
import GoalPlanner from '@legion/goal-planner';
import SOPRegistry from '@legion/sop-registry';

const sopRegistry = await SOPRegistry.getInstance();
const goalPlanner = await GoalPlanner.getInstance();

const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');

const goal = {
  gloss: 'Book train to Paris',
  evidence: {
    origin: 'London',
    destination: 'Paris',
    travelDate: '2025-10-01'
  }
};

const plan = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);

console.log(`${plan.subgoals.length} subgoals`);
plan.subgoals.forEach(s => {
  console.log(`- ${s.gloss}`);
  if (s.pred.args.tool) console.log(`  Tool: ${s.pred.args.tool}`);
});
```

## Features

- **SOP Adaptation**: Converts SOP steps to executable subgoals
- **Verb Mapping**: Deterministic action verb → predicate conversion
- **Tool Suggestions**: Preserves suggestedTools from SOPs
- **Parameter Gathering**: Auto-generates gather subgoals for missing inputs
- **Provenance Tracking**: Links subgoals back to source SOP/step
- **Applicability Judgment**: LLM-based SOP suitability assessment

## API

### GoalPlanner

- `getInstance()` - Get singleton
- `sopAdapter.adaptSOPToSubgoals(sop, goal)` - Convert SOP to plan
- `applicabilityJudge.judge(sop, goal, context)` - Assess suitability
- `retrieveSOPCandidates(goal)` - Search for matching SOPs
- `healthCheck()` - System status

## Testing

```bash
npm test
```

All tests use real dependencies (SOPRegistry, LLM).

## Components

- **VerbMapper**: Action verb → predicate mapping
- **SOPAdapter**: SOP → subgoals conversion
- **ApplicabilityJudge**: LLM-based suitability assessment
- **GoalPlanner**: Singleton orchestrator

See `docs/DESIGN.md` for architecture details.