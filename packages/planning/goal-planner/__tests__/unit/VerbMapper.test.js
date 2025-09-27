import { VerbMapper } from '../../src/VerbMapper.js';

describe('VerbMapper', () => {
  describe('verb extraction', () => {
    test('extracts first word verb', () => {
      expect(VerbMapper.extractVerb('Search for trains')).toBe('search');
      expect(VerbMapper.extractVerb('Gather user input')).toBe('gather');
      expect(VerbMapper.extractVerb('Confirm selection')).toBe('confirm');
    });
    
    test('extracts second word verb for phrases', () => {
      expect(VerbMapper.extractVerb('Go search for trains')).toBe('search');
      expect(VerbMapper.extractVerb('Please gather input')).toBe('gather');
    });
    
    test('handles case insensitivity', () => {
      expect(VerbMapper.extractVerb('SEARCH for trains')).toBe('search');
      expect(VerbMapper.extractVerb('Search FOR TRAINS')).toBe('search');
    });
    
    test('defaults to execute for unknown verbs', () => {
      expect(VerbMapper.extractVerb('Frobulate the widget')).toBe('execute');
      expect(VerbMapper.extractVerb('Unknown action')).toBe('execute');
    });
    
    test('handles empty or invalid input', () => {
      expect(VerbMapper.extractVerb('')).toBe('execute');
      expect(VerbMapper.extractVerb('   ')).toBe('execute');
    });
  });
  
  describe('predicate creation', () => {
    test('creates gather_info predicate', () => {
      const pred = VerbMapper.createPredicate('gather', [], 'Gather travel date');
      
      expect(pred.name).toBe('gather_info');
      expect(pred.args).toBeDefined();
    });
    
    test('creates use_tool predicate with tool', () => {
      const pred = VerbMapper.createPredicate('search', ['train-api'], 'Search trains');
      
      expect(pred.name).toBe('use_tool');
      expect(pred.args.tool).toBe('train-api');
    });
    
    test('creates use_tool predicate without tool', () => {
      const pred = VerbMapper.createPredicate('search', [], 'Search trains');
      
      expect(pred.name).toBe('use_tool');
      expect(pred.args.tool).toBeUndefined();
    });
    
    test('creates confirm predicate', () => {
      const pred = VerbMapper.createPredicate('confirm', [], 'Confirm choice');
      
      expect(pred.name).toBe('confirm');
    });
    
    test('creates present_info predicate', () => {
      const pred = VerbMapper.createPredicate('present', [], 'Present results');
      
      expect(pred.name).toBe('present_info');
    });
    
    test('extracts parameter key for gather_info', () => {
      const pred = VerbMapper.createPredicate('gather', [], 'Gather travelDate from user');
      
      expect(pred.args.key).toBe('travelDate');
    });
    
    test('handles unknown verb', () => {
      const pred = VerbMapper.createPredicate('unknown', [], 'Unknown action');
      
      expect(pred.name).toBe('execute');
    });
  });
  
  describe('doneWhen creation', () => {
    test('creates hasEvidence condition for gather', () => {
      const conditions = VerbMapper.createDoneWhen('gather', 'Gather date');
      
      expect(conditions).toHaveLength(1);
      expect(conditions[0].kind).toBe('hasEvidence');
      expect(conditions[0].key).toBeDefined();
    });
    
    test('creates hasEvidence condition for search', () => {
      const conditions = VerbMapper.createDoneWhen('search', 'Search trains');
      
      expect(conditions).toHaveLength(1);
      expect(conditions[0].kind).toBe('hasEvidence');
    });
    
    test('creates predicateTrue condition for verify', () => {
      const conditions = VerbMapper.createDoneWhen('verify', 'Verify payment');
      
      expect(conditions).toHaveLength(1);
      expect(conditions[0].kind).toBe('predicateTrue');
    });
    
    test('extracts evidence key from step gloss', () => {
      const conditions = VerbMapper.createDoneWhen('gather', 'Gather travelDate');
      
      expect(conditions[0].key).toBe('travelDate');
    });
    
    test('uses explicit doneWhen if provided', () => {
      const conditions = VerbMapper.createDoneWhen('search', 'Search trains', 'Trains found');
      
      expect(conditions).toHaveLength(1);
      expect(conditions[0].kind).toBe('hasEvidence');
    });
  });
  
  describe('end-to-end verb mapping', () => {
    test('maps complete step gloss to predicate and condition', () => {
      const stepGloss = 'Search for available trains';
      const suggestedTools = ['train-search-api'];
      
      const verb = VerbMapper.extractVerb(stepGloss);
      const pred = VerbMapper.createPredicate(verb, suggestedTools, stepGloss);
      const doneWhen = VerbMapper.createDoneWhen(verb, stepGloss);
      
      expect(verb).toBe('search');
      expect(pred.name).toBe('use_tool');
      expect(pred.args.tool).toBe('train-search-api');
      expect(doneWhen[0].kind).toBe('hasEvidence');
    });
    
    test('maps gather step completely', () => {
      const stepGloss = 'Gather travel date from user';
      
      const verb = VerbMapper.extractVerb(stepGloss);
      const pred = VerbMapper.createPredicate(verb, [], stepGloss);
      const doneWhen = VerbMapper.createDoneWhen(verb, stepGloss);
      
      expect(verb).toBe('gather');
      expect(pred.name).toBe('gather_info');
      expect(pred.args.key).toBe('travel');
      expect(doneWhen[0].key).toBe('travel');
    });
  });
});