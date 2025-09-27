import { VerbMapper } from './VerbMapper.js';
import { SOPAdaptationError } from './errors/index.js';

export class SOPAdapter {
  constructor({ resourceManager }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
  }
  
  extractParameters(sop, goal) {
    const inputs = sop.inputs || {};
    
    const required = Object.entries(inputs)
      .filter(([k, v]) => v.required)
      .map(([k]) => k);
    
    const available = Object.keys(goal.evidence || {});
    
    const missing = required.filter(p => !available.includes(p));
    
    return { required, available, missing };
  }
  
  createGatherSubgoals(missingParams, sop) {
    return missingParams.map(param => ({
      gloss: `Gather ${param}`,
      pred: {
        name: 'gather_info',
        args: {
          key: param,
          prompt: sop.inputs?.[param]?.description || `Please provide ${param}`
        }
      },
      doneWhen: [{ kind: 'hasEvidence', key: param }],
      provenance: {
        sopId: sop._id.toString(),
        sopTitle: sop.title,
        stepIndex: -1,
        reason: 'parameter_gathering'
      }
    }));
  }
  
  mapStepToSubgoal(step, sop, stepIndex) {
    const verb = VerbMapper.extractVerb(step.gloss);
    const pred = VerbMapper.createPredicate(verb, step.suggestedTools, step.gloss);
    const doneWhen = VerbMapper.createDoneWhen(verb, step.gloss, step.doneWhen);
    
    return {
      gloss: step.gloss,
      pred,
      doneWhen,
      provenance: {
        sopId: sop._id.toString(),
        sopTitle: sop.title,
        stepIndex,
        suggestedTool: step.suggestedTools?.[0]
      }
    };
  }
  
  async adaptSOPToSubgoals(sop, goal) {
    try {
      const params = this.extractParameters(sop, goal);
      
      const gatherSubgoals = this.createGatherSubgoals(params.missing, sop);
      
      const stepSubgoals = sop.steps.map((step, i) => 
        this.mapStepToSubgoal(step, sop, i)
      );
      
      const allSubgoals = [...gatherSubgoals, ...stepSubgoals];
      
      const confidence = params.missing.length === 0 ? 0.95 : 0.85;
      
      return {
        subgoals: allSubgoals,
        decomp: 'AND',
        confidence
      };
      
    } catch (error) {
      throw new SOPAdaptationError(
        `Failed to adapt SOP: ${error.message}`,
        sop._id?.toString(),
        error
      );
    }
  }
}