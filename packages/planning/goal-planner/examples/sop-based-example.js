import GoalPlanner from '../src/index.js';
import SOPRegistry from '../../sop-registry/src/index.js';

async function main() {
  console.log('=== SOP-Based Planning Example ===\n');
  
  const sopRegistry = await SOPRegistry.getInstance();
  const goalPlanner = await GoalPlanner.getInstance();
  
  const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
  
  const goal = {
    gloss: 'Book a train to Paris',
    evidence: {
      origin: 'London',
      destination: 'Paris',
      travelDate: '2025-10-01'
    }
  };
  
  console.log('Goal:', goal.gloss);
  console.log('Evidence:', Object.keys(goal.evidence).join(', '), '\n');
  
  const plan = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
  
  console.log(`Plan: ${plan.subgoals.length} subgoals (${plan.decomp})`);
  console.log(`Source: SOP "${trainSOP.title}"`);
  console.log(`Confidence: ${plan.confidence}\n`);
  
  console.log('Subgoals:');
  plan.subgoals.forEach((subgoal, i) => {
    console.log(`${i + 1}. ${subgoal.gloss}`);
    console.log(`   Predicate: ${subgoal.pred.name}`);
    if (subgoal.pred.args.tool) {
      console.log(`   Tool: ${subgoal.pred.args.tool}`);
    }
    console.log(`   Provenance: ${subgoal.provenance.sopTitle} (step ${subgoal.provenance.stepIndex})`);
    console.log('');
  });
  
  await sopRegistry.cleanup();
  
  console.log('=== Example Complete ===');
}

main().catch(console.error);