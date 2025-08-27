/**
 * PlanningMode Value Object
 * Immutable enumeration of planning modes
 */

export const PlanningMode = Object.freeze({
  IDLE: 'IDLE',
  INFORMAL: 'INFORMAL',
  INFORMAL_COMPLETE: 'INFORMAL_COMPLETE',
  DISCOVERING_TOOLS: 'DISCOVERING_TOOLS',
  TOOLS_DISCOVERED: 'TOOLS_DISCOVERED',
  FORMAL: 'FORMAL',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED'
});

export function isPlanningActive(mode) {
  return mode === PlanningMode.INFORMAL ||
         mode === PlanningMode.DISCOVERING_TOOLS ||
         mode === PlanningMode.FORMAL;
}

export function canTransitionTo(currentMode, targetMode) {
  const transitions = {
    [PlanningMode.IDLE]: [PlanningMode.INFORMAL],
    [PlanningMode.INFORMAL]: [PlanningMode.INFORMAL_COMPLETE, PlanningMode.ERROR, PlanningMode.CANCELLED],
    [PlanningMode.INFORMAL_COMPLETE]: [PlanningMode.DISCOVERING_TOOLS, PlanningMode.FORMAL],
    [PlanningMode.DISCOVERING_TOOLS]: [PlanningMode.TOOLS_DISCOVERED, PlanningMode.ERROR, PlanningMode.CANCELLED],
    [PlanningMode.TOOLS_DISCOVERED]: [PlanningMode.FORMAL],
    [PlanningMode.FORMAL]: [PlanningMode.COMPLETE, PlanningMode.ERROR, PlanningMode.CANCELLED],
    [PlanningMode.COMPLETE]: [PlanningMode.IDLE],
    [PlanningMode.ERROR]: [PlanningMode.IDLE],
    [PlanningMode.CANCELLED]: [PlanningMode.IDLE]
  };
  
  return transitions[currentMode]?.includes(targetMode) || false;
}