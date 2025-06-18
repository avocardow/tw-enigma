    .action(async (options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());

      // Step 1: Access global options including --length
      const globalOptions = cmd.optsWithGlobals();
      const lengthOption = globalOptions.length;

      // Log length option if provided for user feedback
      if (lengthOption) {
        logger.info(`🎯 Using minimum class name length: ${lengthOption}`);
      }

  // Step 1: Access global options including --length
  const globalOptions = cmd.optsWithGlobals();
  const lengthOption = globalOptions.length;

  // Log length option if provided for user feedback
  if (lengthOption) {
    logger.info(`🎯 Using minimum class name length: ${lengthOption}`);
  }

  try {
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
});
