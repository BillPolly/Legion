export class GoalPlannerError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'GoalPlannerError';
    this.code = code;
    this.details = details;
  }
}

export class SOPAdaptationError extends GoalPlannerError {
  constructor(message, sopId, originalError) {
    super(message, 'SOP_ADAPTATION_ERROR', { sopId, originalError });
    this.name = 'SOPAdaptationError';
    this.sopId = sopId;
    this.originalError = originalError;
  }
}

export class ApplicabilityJudgmentError extends GoalPlannerError {
  constructor(message, goal, originalError) {
    super(message, 'APPLICABILITY_JUDGMENT_ERROR', { goal, originalError });
    this.name = 'ApplicabilityJudgmentError';
    this.goal = goal;
    this.originalError = originalError;
  }
}

export class VanillaPlanningError extends GoalPlannerError {
  constructor(message, goal, originalError) {
    super(message, 'VANILLA_PLANNING_ERROR', { goal, originalError });
    this.name = 'VanillaPlanningError';
    this.goal = goal;
    this.originalError = originalError;
  }
}