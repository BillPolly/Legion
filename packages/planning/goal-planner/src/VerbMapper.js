const VERB_MAPPINGS = {
  gather: { pred: 'gather_info', doneWhen: 'hasEvidence' },
  collect: { pred: 'gather_info', doneWhen: 'hasEvidence' },
  ask: { pred: 'gather_info', doneWhen: 'hasEvidence' },
  
  search: { pred: 'use_tool', doneWhen: 'hasEvidence' },
  retrieve: { pred: 'use_tool', doneWhen: 'hasEvidence' },
  call: { pred: 'use_tool', doneWhen: 'hasEvidence' },
  execute: { pred: 'use_tool', doneWhen: 'hasEvidence' },
  
  present: { pred: 'present_info', doneWhen: 'hasEvidence' },
  show: { pred: 'present_info', doneWhen: 'hasEvidence' },
  display: { pred: 'present_info', doneWhen: 'hasEvidence' },
  
  confirm: { pred: 'confirm', doneWhen: 'hasEvidence' },
  verify: { pred: 'confirm', doneWhen: 'predicateTrue' },
  validate: { pred: 'confirm', doneWhen: 'predicateTrue' }
};

export class VerbMapper {
  static VERB_MAPPINGS = VERB_MAPPINGS;
  
  static extractVerb(stepGloss) {
    if (!stepGloss || typeof stepGloss !== 'string') {
      return 'execute';
    }
    
    const trimmed = stepGloss.trim();
    if (trimmed === '') {
      return 'execute';
    }
    
    const words = trimmed.toLowerCase().split(/\s+/);
    
    if (words.length === 0) {
      return 'execute';
    }
    
    const firstWord = words[0];
    if (VERB_MAPPINGS[firstWord]) {
      return firstWord;
    }
    
    if (words.length > 1) {
      const secondWord = words[1];
      if (VERB_MAPPINGS[secondWord]) {
        return secondWord;
      }
    }
    
    return 'execute';
  }
  
  static createPredicate(verb, suggestedTools, stepGloss) {
    const mapping = VERB_MAPPINGS[verb] || { pred: 'execute' };
    
    const pred = {
      name: mapping.pred,
      args: {}
    };
    
    if (pred.name === 'use_tool' && suggestedTools?.length > 0) {
      pred.args.tool = suggestedTools[0];
    }
    
    if (pred.name === 'gather_info' && stepGloss) {
      const words = stepGloss.split(/\s+/);
      const gatherIndex = words.findIndex(w => w.toLowerCase() === 'gather');
      
      if (gatherIndex >= 0 && gatherIndex < words.length - 1) {
        const nextWord = words[gatherIndex + 1];
        pred.args.key = nextWord.replace(/[^a-zA-Z0-9]/g, '');
      }
    }
    
    return pred;
  }
  
  static createDoneWhen(verb, stepGloss, explicitDoneWhen) {
    const mapping = VERB_MAPPINGS[verb] || { doneWhen: 'hasEvidence' };
    
    if (mapping.doneWhen === 'hasEvidence') {
      let key = 'result';
      
      if (verb === 'gather' && stepGloss) {
        const words = stepGloss.split(/\s+/);
        const gatherIndex = words.findIndex(w => w.toLowerCase() === 'gather');
        
        if (gatherIndex >= 0 && gatherIndex < words.length - 1) {
          const nextWord = words[gatherIndex + 1];
          key = nextWord.replace(/[^a-zA-Z0-9]/g, '');
        }
      }
      
      return [{ kind: 'hasEvidence', key }];
    }
    
    if (mapping.doneWhen === 'predicateTrue') {
      return [{ 
        kind: 'predicateTrue',
        pred: { name: verb, args: {} }
      }];
    }
    
    return [{ kind: 'hasEvidence', key: 'result' }];
  }
}