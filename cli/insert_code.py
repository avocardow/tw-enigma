import re

with open('src/commands/css-config.ts', 'r') as f:
    content = f.read()

# Insert code after logger creation
pattern = r'(const logger = createLoggerFromArgv\(cmd\.optsWithGlobals\(\)\);)'
replacement = r'''\1

      // Step 1 & 2: Access global options and integrate with core configuration
      const globalOptions = cmd.optsWithGlobals();
      const lengthOption = globalOptions.length;

      // Create CLI arguments for core configuration integration
      const cliArguments = {
        nameGenerationMinimumLength: lengthOption
      };

      // Log length option if provided for user feedback
      if (lengthOption) {
        logger.info(`🎯 Using minimum class name length: ${lengthOption}`);
      }'''

new_content = re.sub(pattern, replacement, content)

with open('src/commands/css-config.ts', 'w') as f:
    f.write(new_content)

print('✅ Code inserted successfully')
