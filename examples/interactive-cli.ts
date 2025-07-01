/**
 * Interactive CLI Example
 * 
 * This example demonstrates how to use TW-Enigma's interactive CLI mode
 * for guided dry run operations with real-time feedback and user interaction.
 */

import { 
  getInteractiveCLI, 
  createInteractiveCLI,
  startInteractiveDryRun,
  CLIPreferences 
} from '@tw-enigma/core';

async function interactiveCLIExample() {
  console.log('🎮 Starting Interactive CLI Example');
  console.log('===================================\n');

  // Configure CLI preferences
  const preferences: CLIPreferences = {
    outputFormat: 'html',
    outputDestination: 'file',
    verbose: true,
    useColors: true,
    confirmActions: true,
    autoSave: true,
  };

  console.log('⚙️  CLI Preferences:');
  console.log(`- Output format: ${preferences.outputFormat}`);
  console.log(`- Verbose mode: ${preferences.verbose}`);
  console.log(`- Colors enabled: ${preferences.useColors}`);
  console.log(`- Auto-save: ${preferences.autoSave}\n`);

  try {
    // Start interactive session
    await startInteractiveSession(preferences);
  } catch (error) {
    console.error('❌ Interactive CLI failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Start an interactive CLI session
 */
async function startInteractiveSession(preferences: CLIPreferences): Promise<void> {
  console.log('🚀 Starting interactive session...\n');

  // Get the interactive CLI instance
  const cli = getInteractiveCLI();

  // Start a new session
  const session = await cli.startSession(preferences);
  console.log(`📱 Session started: ${session.id}`);

  // Project context for the dry run
  const projectContext = {
    projectRoot: './src',
    optimizationLevel: 'aggressive',
    targetFramework: 'react',
  };

  console.log('\n📋 Project Context:');
  console.log(`- Root: ${projectContext.projectRoot}`);
  console.log(`- Optimization: ${projectContext.optimizationLevel}`);
  console.log(`- Framework: ${projectContext.targetFramework}\n`);

  // Run the interactive dry run workflow
  await cli.runDryRunWorkflow(projectContext);

  console.log('\n✅ Interactive session completed successfully!');
}

/**
 * Alternative: Use the standalone interactive dry run function
 */
async function standaloneInteractiveExample(): Promise<void> {
  console.log('🎯 Alternative: Standalone Interactive Example');
  console.log('=============================================\n');

  const projectContext = {
    projectRoot: './src',
    optimizationLevel: 'aggressive',
    targetFramework: 'vue',
  };

  const cliOptions = {
    outputFormat: 'markdown' as const,
    verbose: true,
    useColors: true,
    confirmActions: true,
  };

  console.log('🚀 Starting standalone interactive dry run...');

  try {
    await startInteractiveDryRun(projectContext, cliOptions);
    console.log('✅ Standalone interactive dry run completed!');
  } catch (error) {
    console.error('❌ Standalone dry run failed:', error);
  }
}

/**
 * Custom CLI session with specific workflows
 */
async function customWorkflowExample(): Promise<void> {
  console.log('\n🔧 Custom Workflow Example');
  console.log('===========================\n');

  const cli = createInteractiveCLI();

  // Start session with custom preferences
  const session = await cli.startSession({
    outputFormat: 'json',
    verbose: false,
    useColors: false,
    confirmActions: false, // Auto-proceed without confirmation
    autoSave: true,
  });

  console.log('⚡ Running automated workflow...');

  // This would be a custom workflow tailored to specific needs
  // For example: CI/CD pipeline integration, bulk processing, etc.
  const workflows = [
    { name: 'Small Project', files: 50 },
    { name: 'Medium Project', files: 200 },
    { name: 'Large Project', files: 1000 },
  ];

  for (const workflow of workflows) {
    console.log(`\n📊 Testing workflow: ${workflow.name} (${workflow.files} files)`);
    
    await cli.runDryRunWorkflow({
      projectRoot: `./test/${workflow.name.toLowerCase().replace(' ', '-')}`,
      optimizationLevel: workflow.files > 500 ? 'basic' : 'aggressive',
      targetFramework: 'react',
    });

    console.log(`✅ ${workflow.name} workflow completed`);
  }

  console.log('\n🎉 All custom workflows completed!');
}

/**
 * Error handling and recovery example
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n🛡️  Error Handling Example');
  console.log('===========================\n');

  const cli = getInteractiveCLI();

  try {
    const session = await cli.startSession({
      outputFormat: 'html',
      verbose: true,
      useColors: true,
      confirmActions: true,
    });

    // Intentionally cause an error to demonstrate error handling
    const problematicContext = {
      projectRoot: '/nonexistent/path',
      optimizationLevel: 'invalid' as any,
      targetFramework: undefined,
    };

    console.log('🔥 Attempting operation with invalid context...');
    await cli.runDryRunWorkflow(problematicContext);

  } catch (error) {
    console.log('\n⚠️  Expected error caught:');
    console.log(`Error: ${error instanceof Error ? error.message : error}`);
    
    console.log('\n🔧 Demonstrating recovery...');
    
    // Recover with valid context
    const validContext = {
      projectRoot: './src',
      optimizationLevel: 'basic' as const,
      targetFramework: 'react' as const,
    };

    const recoveryCli = getInteractiveCLI();
    const recoverySession = await recoveryCli.startSession({
      outputFormat: 'text',
      verbose: false,
      useColors: true,
      confirmActions: false,
    });

    await recoveryCli.runDryRunWorkflow(validContext);
    console.log('✅ Recovery successful!');
  }
}

/**
 * Run all examples
 */
async function runAllExamples(): Promise<void> {
  console.log('🎪 Running All Interactive CLI Examples');
  console.log('=======================================\n');

  try {
    await interactiveCLIExample();
    await standaloneInteractiveExample();
    await customWorkflowExample();
    await errorHandlingExample();

    console.log('\n🏆 All interactive CLI examples completed successfully!');
    console.log('\n💡 Tips:');
    console.log('- Use interactive mode for exploratory optimization');
    console.log('- Customize CLI preferences for your workflow');
    console.log('- Implement error recovery for robust automation');
    console.log('- Consider different output formats for different use cases');

  } catch (error) {
    console.error('\n💥 Example execution failed:', error);
    process.exit(1);
  }
}

// Run the examples
if (require.main === module) {
  // Comment/uncomment to run specific examples
  runAllExamples().catch(console.error);
  
  // Or run individual examples:
  // interactiveCLIExample().catch(console.error);
  // standaloneInteractiveExample().catch(console.error);
  // customWorkflowExample().catch(console.error);
  // errorHandlingExample().catch(console.error);
}

export { 
  interactiveCLIExample,
  standaloneInteractiveExample, 
  customWorkflowExample,
  errorHandlingExample,
  runAllExamples 
};