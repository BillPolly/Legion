import { ForceDirectedLayout } from './src/renderers/diagram/layout/ForceDirectedLayout.js';

// Create a layout with debugging
const layout = new ForceDirectedLayout({
  stabilization: {
    enabled: true,
    threshold: 0.1,
    minIterations: 20,
    maxIterations: 1000,
    checkInterval: 5
  }
});

// Override _extractResults to see what state we have
const originalExtractResults = layout._extractResults;
layout._extractResults = function() {
  console.log('=== DEBUG: _extractResults called ===');
  console.log('this.stabilization:', JSON.stringify(this.stabilization, null, 2));
  
  const result = originalExtractResults.call(this);
  
  console.log('result.metadata.stabilization:', JSON.stringify(result.metadata.stabilization, null, 2));
  console.log('===============================');
  
  return result;
};

// Test with simple graph
const graphData = {
  nodes: [
    { id: 'a' },
    { id: 'b' }
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b' }
  ]
};

console.log('Running layout...');
const result = layout.layout(graphData);

console.log('\nFinal result metadata:');
console.log('isStable:', result.metadata.stabilization.isStable);
console.log('convergenceIterations:', result.metadata.stabilization.convergenceIterations);
console.log('finalEnergy:', result.metadata.stabilization.finalEnergy);