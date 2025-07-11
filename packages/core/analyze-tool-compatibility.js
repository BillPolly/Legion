const fs = require('fs').promises;
const path = require('path');

// Import all tools
const { calculatorTool } = require('./src/tools/calculator');
const { bashExecutorTool } = require('./src/tools/command-executor');
const { crawlerTool } = require('./src/tools/crawler');
const { fileReaderTool } = require('./src/tools/file-reader');
const { fileWriterTool } = require('./src/tools/file-writer');
const { pageScreenshotTool } = require('./src/tools/page-screenshoter');
const { googleSearchTool } = require('./src/tools/serper');
const { serverStarterTool } = require('./src/tools/server-starter');
const { webPageToMarkdownTool } = require('./src/tools/webpage-to-markdown');
const { youtubeTranscriptTool } = require('./src/tools/youtube-transcript');

// All tools for analysis
const tools = [
  { name: 'Calculator', instance: calculatorTool },
  { name: 'Bash Executor', instance: bashExecutorTool },
  { name: 'Crawler', instance: crawlerTool },
  { name: 'File Reader', instance: fileReaderTool },
  { name: 'File Writer', instance: fileWriterTool },
  { name: 'Page Screenshot', instance: pageScreenshotTool },
  { name: 'Google Search (Serper)', instance: googleSearchTool },
  { name: 'Server Starter', instance: serverStarterTool },
  { name: 'Web Page to Markdown', instance: webPageToMarkdownTool },
  { name: 'YouTube Transcript', instance: youtubeTranscriptTool }
];

// Analysis results
const analysis = {
  summary: {
    total: tools.length,
    singleFunction: 0,
    multipleFunction: 0,
    hasComplexTypes: 0,
    hasOptionalArgs: 0,
    requiresInit: 0,
    hasSpecialReturns: 0
  },
  tools: []
};

// Analyze each tool
function analyzeTool(name, tool) {
  const toolAnalysis = {
    name,
    identifier: tool.identifier,
    functionCount: tool.functions.length,
    functions: [],
    issues: [],
    compatibility: 'full'
  };

  // Check multiple functions
  if (tool.functions.length > 1) {
    analysis.summary.multipleFunction++;
    toolAnalysis.issues.push({
      type: 'multiple_functions',
      severity: 'high',
      description: `Tool has ${tool.functions.length} functions but adapter only exposes the first one`,
      functions: tool.functions.map(f => f.name)
    });
    toolAnalysis.compatibility = 'partial';
  } else {
    analysis.summary.singleFunction++;
  }

  // Analyze each function
  tool.functions.forEach((func, index) => {
    const funcAnalysis = {
      name: func.name,
      purpose: func.purpose,
      arguments: [],
      issues: []
    };

    // Analyze arguments
    func.arguments.forEach(arg => {
      const argAnalysis = {
        name: arg.name,
        type: arg.dataType,
        description: arg.description
      };

      // Check for complex types
      if (arg.dataType === 'array' || arg.dataType === 'object') {
        argAnalysis.isComplex = true;
        funcAnalysis.issues.push({
          type: 'complex_argument',
          argName: arg.name,
          argType: arg.dataType,
          note: 'Complex types may need special handling'
        });
      }

      // Check for optional arguments
      if (arg.optional || arg.description.toLowerCase().includes('optional')) {
        argAnalysis.isOptional = true;
        funcAnalysis.issues.push({
          type: 'optional_argument',
          argName: arg.name,
          note: 'Adapter marks all arguments as required'
        });
      }

      funcAnalysis.arguments.push(argAnalysis);
    });

    // Check for no-argument functions
    if (func.arguments.length === 0) {
      funcAnalysis.issues.push({
        type: 'no_arguments',
        note: 'Function has no arguments - adapter should handle empty args object'
      });
    }

    toolAnalysis.functions.push(funcAnalysis);
  });

  // Check for initialization requirement
  if (tool.init && typeof tool.init === 'function') {
    analysis.summary.requiresInit++;
    toolAnalysis.issues.push({
      type: 'requires_init',
      severity: 'medium',
      description: 'Tool has init() method that needs to be called before use'
    });
  }

  // Check for special return types
  if (name === 'Page Screenshot') {
    analysis.summary.hasSpecialReturns++;
    toolAnalysis.issues.push({
      type: 'special_return',
      severity: 'low',
      description: 'Returns object with isImage flag and base64 data instead of simple string'
    });
  }

  // Check identifier mismatches
  if (name === 'File Writer' && tool.identifier === 'file_reader_tool') {
    toolAnalysis.issues.push({
      type: 'identifier_mismatch',
      severity: 'medium',
      description: 'Tool identifier doesn\'t match tool purpose (file_reader_tool for file writer)'
    });
  }

  // Count complex types and optional args
  const hasComplexTypes = toolAnalysis.functions.some(f => 
    f.arguments.some(a => a.isComplex)
  );
  const hasOptionalArgs = toolAnalysis.functions.some(f => 
    f.arguments.some(a => a.isOptional)
  );

  if (hasComplexTypes) analysis.summary.hasComplexTypes++;
  if (hasOptionalArgs) analysis.summary.hasOptionalArgs++;

  // Determine overall compatibility
  if (toolAnalysis.issues.some(i => i.severity === 'high')) {
    toolAnalysis.compatibility = 'partial';
  } else if (toolAnalysis.issues.length > 0) {
    toolAnalysis.compatibility = 'full_with_warnings';
  }

  analysis.tools.push(toolAnalysis);
}

// Generate recommendations
function generateRecommendations() {
  const recommendations = [];

  // Multiple functions issue
  if (analysis.summary.multipleFunction > 0) {
    recommendations.push({
      issue: 'Multiple Functions per Tool',
      affected: analysis.tools
        .filter(t => t.functionCount > 1)
        .map(t => `${t.name} (${t.functionCount} functions)`),
      recommendation: 'Modify ToolAdapter to handle multiple functions by either:\n' +
        '  1. Creating separate tool instances for each function\n' +
        '  2. Returning an array of function descriptions\n' +
        '  3. Creating a multiplexer that routes to the correct function'
    });
  }

  // Optional arguments
  if (analysis.summary.hasOptionalArgs > 0) {
    recommendations.push({
      issue: 'Optional Arguments',
      affected: analysis.tools
        .filter(t => t.functions.some(f => f.arguments.some(a => a.isOptional)))
        .map(t => t.name),
      recommendation: 'Update ToolAdapter to:\n' +
        '  1. Parse argument descriptions for "optional" indicators\n' +
        '  2. Only include truly required arguments in the required array\n' +
        '  3. Handle missing optional arguments gracefully'
    });
  }

  // Initialization requirements
  if (analysis.summary.requiresInit > 0) {
    recommendations.push({
      issue: 'Tools Requiring Initialization',
      affected: analysis.tools
        .filter(t => t.issues.some(i => i.type === 'requires_init'))
        .map(t => t.name),
      recommendation: 'Add initialization support to ToolAdapter:\n' +
        '  1. Check for init() method in constructor\n' +
        '  2. Add setConfig() method to adapter\n' +
        '  3. Pass through initialization before first use'
    });
  }

  return recommendations;
}

// Main analysis
async function runAnalysis() {
  console.log('Tool Adapter Compatibility Analysis');
  console.log('===================================\n');

  // Analyze each tool
  tools.forEach(({ name, instance }) => {
    analyzeTool(name, instance);
  });

  // Print summary
  console.log('SUMMARY');
  console.log('-------');
  console.log(`Total tools analyzed: ${analysis.summary.total}`);
  console.log(`Single function tools: ${analysis.summary.singleFunction}`);
  console.log(`Multiple function tools: ${analysis.summary.multipleFunction}`);
  console.log(`Tools with complex argument types: ${analysis.summary.hasComplexTypes}`);
  console.log(`Tools with optional arguments: ${analysis.summary.hasOptionalArgs}`);
  console.log(`Tools requiring initialization: ${analysis.summary.requiresInit}`);
  console.log(`Tools with special return types: ${analysis.summary.hasSpecialReturns}`);

  // Print detailed analysis
  console.log('\n\nDETAILED ANALYSIS');
  console.log('-----------------');
  
  analysis.tools.forEach(tool => {
    console.log(`\n${tool.name} (${tool.identifier})`);
    console.log(`  Compatibility: ${tool.compatibility}`);
    console.log(`  Functions: ${tool.functionCount}`);
    
    if (tool.issues.length > 0) {
      console.log('  Issues:');
      tool.issues.forEach(issue => {
        console.log(`    - ${issue.type}: ${issue.description || issue.note}`);
        if (issue.severity) console.log(`      Severity: ${issue.severity}`);
      });
    }

    tool.functions.forEach(func => {
      console.log(`  Function: ${func.name}`);
      if (func.arguments.length === 0) {
        console.log('    Arguments: none');
      } else {
        console.log('    Arguments:');
        func.arguments.forEach(arg => {
          let argDesc = `      - ${arg.name} (${arg.type})`;
          if (arg.isOptional) argDesc += ' [optional]';
          if (arg.isComplex) argDesc += ' [complex]';
          console.log(argDesc);
        });
      }
    });
  });

  // Generate and print recommendations
  const recommendations = generateRecommendations();
  console.log('\n\nRECOMMENDATIONS');
  console.log('----------------');
  
  recommendations.forEach((rec, index) => {
    console.log(`\n${index + 1}. ${rec.issue}`);
    console.log(`   Affected tools: ${rec.affected.join(', ')}`);
    console.log(`   ${rec.recommendation}`);
  });

  // Save full report
  const report = {
    timestamp: new Date().toISOString(),
    summary: analysis.summary,
    tools: analysis.tools,
    recommendations
  };

  await fs.writeFile(
    path.join(__dirname, 'tool-compatibility-analysis.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n\nFull report saved to: tool-compatibility-analysis.json');
}

// Run the analysis
runAnalysis().catch(console.error);