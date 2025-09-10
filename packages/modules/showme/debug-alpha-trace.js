import { ForceDirectedLayout } from './src/renderers/diagram/layout/ForceDirectedLayout.js';

console.log('=== Alpha vs Stabilization Trace ===\n');

const layout = new ForceDirectedLayout({
  iterations: 1000,
  stabilization: {
    enabled: true,
    threshold: 0.1,
    minIterations: 20,
    maxIterations: 1000,
    checkInterval: 5  // Check every 5 iterations
  }
});

// Override _runSimulation to add detailed alpha tracing
const originalRunSimulation = layout._runSimulation;
layout._runSimulation = function() {
  const phaseStart = performance.now();
  const maxIterations = this.config.stabilization.enabled 
    ? this.config.stabilization.maxIterations 
    : this.config.iterations;
  
  // Reset stabilization state
  this.stabilization = {
    isStable: false,
    energy: Infinity,
    previousEnergy: Infinity,
    energyHistory: [],
    convergenceHistory: [],
    iterations: 0
  };
  
  // Warmup phase
  const warmupIterations = Math.min(this.config.warmupIterations, maxIterations);
  for (let i = 0; i < warmupIterations; i++) {
    this._simulationTick(true);
    this.stabilization.iterations++;
    
    if (this.alpha < this.alphaMin) break;
  }
  
  console.log(`After warmup: alpha=${this.alpha.toFixed(6)}, alphaMin=${this.alphaMin}, iterations=${this.stabilization.iterations}`);
  
  // Main simulation phase with detailed tracing
  for (let i = warmupIterations; i < maxIterations; i++) {
    const beforeAlpha = this.alpha;
    
    this._simulationTick(false);
    this.stabilization.iterations++;
    
    const afterAlpha = this.alpha;
    const shouldCheck = this.config.stabilization.enabled && 
                       this.stabilization.iterations >= this.config.stabilization.minIterations &&
                       this.stabilization.iterations % this.config.stabilization.checkInterval === 0;
    
    // Log key iterations
    if (shouldCheck || this.stabilization.iterations <= 25 || this.stabilization.iterations % 20 === 0 || afterAlpha < this.alphaMin) {
      console.log(`Iter ${this.stabilization.iterations}: alpha ${beforeAlpha.toFixed(6)} -> ${afterAlpha.toFixed(6)}, energy=${this.stabilization.energy?.toFixed(8) || 'N/A'}, shouldCheck=${shouldCheck}, willBreak=${afterAlpha < this.alphaMin}`);
    }
    
    // Check stabilization if enabled
    if (shouldCheck) {
      console.log(`  >> CHECKING STABILIZATION at iteration ${this.stabilization.iterations}`);
      console.log(`     Energy: ${this.stabilization.energy} vs threshold: ${this.config.stabilization.threshold}`);
      
      if (this._checkStabilization()) {
        this.stabilization.isStable = true;
        console.log(`  >> ✅ STABILIZED! Breaking at iteration ${this.stabilization.iterations}`);
        break;
      } else {
        console.log(`  >> ❌ Not stabilized yet`);
      }
    }
    
    if (this.alpha < this.alphaMin) {
      console.log(`  >> 🛑 ALPHA BREAK at iteration ${this.stabilization.iterations} (alpha=${this.alpha.toFixed(6)} < alphaMin=${this.alphaMin})`);
      break;
    }
  }
  
  console.log(`\nFinal state: iterations=${this.stabilization.iterations}, isStable=${this.stabilization.isStable}, energy=${this.stabilization.energy}`);
  
  this.timing.phases.simulation = performance.now() - phaseStart;
};

const graphData = {
  nodes: [{ id: 'a' }, { id: 'b' }],
  edges: [{ id: 'e1', source: 'a', target: 'b' }]
};

layout.layout(graphData);