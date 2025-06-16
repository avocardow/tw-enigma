# Changelog - @tw-enigma/cli

All notable changes to the @tw-enigma/cli package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Command-line interface migrated to dedicated @tw-enigma/cli package
- Commander.js-based command structure for better CLI experience
- Comprehensive utilities for file operations and validation
- Integration with @tw-enigma/core package for optimization functionality
- Enhanced error handling and user-friendly messages
- Configuration management commands
- Progress reporting and verbose output options

### Changed
- Migrated from yargs to commander.js for improved CLI structure
- Restructured command organization for better usability
- Enhanced output formatting and user experience
- Improved error messages with actionable suggestions

### Fixed
- Command option parsing edge cases
- Error handling in file operations
- Path resolution issues across platforms
- Configuration validation feedback

## [1.0.0] - 2024-12-XX

### Added
- **Core CLI Infrastructure**
  - Commander.js-based command framework
  - Modular command structure for extensibility
  - Consistent command-line interface patterns
  - Help system with detailed command documentation

- **Configuration Commands**
  - `init-config`: Initialize Enigma configuration for projects
  - `css-config`: Configure CSS generation settings
  - Configuration template support
  - Validation and error reporting for configurations

- **Optimization Commands**
  - Integration with @tw-enigma/core optimization engine
  - Project-wide CSS optimization
  - Watch mode for development workflows
  - Progress reporting and metrics display

- **Utility Features**
  - File discovery and validation utilities
  - Path manipulation and normalization
  - Cross-platform compatibility
  - Comprehensive error handling

- **Developer Experience**
  - Verbose output modes for debugging
  - Progress indicators for long operations
  - Colored output for better readability
  - Command completion support

### Command Reference

#### Configuration Commands

##### `init-config`
Initialize Enigma configuration for a project.

```bash
npx @tw-enigma/cli init-config [options]

Options:
  --force              Overwrite existing configuration
  --template <name>    Use a specific template
  --output <path>      Specify output directory
  -h, --help           Display help for command
```

##### `css-config`
Configure CSS generation settings.

```bash
npx @tw-enigma/cli css-config [options]

Options:
  --strategy <strategy>    Set optimization strategy (atomic|utility|component|mixed)
  --apply-directives       Enable @apply directive generation
  --comments <level>       Set comment verbosity level (none|minimal|detailed|verbose)
  -h, --help              Display help for command
```

#### Utility Commands

##### `version`
Display version information.

```bash
npx @tw-enigma/cli --version
npx @tw-enigma/cli -V
```

##### `help`
Display help information for commands.

```bash
npx @tw-enigma/cli --help
npx @tw-enigma/cli <command> --help
```

### CLI Utilities

#### Version Information
```typescript
import { version, cliVersion, name } from '@tw-enigma/cli';

console.log(`${name} v${version}`);
```

#### Command Registration
```typescript
import { registerCommands } from '@tw-enigma/cli';
import { Command } from 'commander';

const program = new Command();
registerCommands(program);
```

### Breaking Changes from Legacy Version

1. **Command Structure**: New commander.js-based command organization
2. **Option Names**: Standardized option naming conventions
3. **Output Format**: Enhanced output formatting and progress reporting
4. **Error Handling**: Improved error messages with better context
5. **Configuration**: New configuration command structure

### Migration Guide

#### From Legacy tw-enigma CLI

```bash
# Before (legacy CLI)
npx tw-enigma optimize --input src --output dist

# After (@tw-enigma/cli)
npx @tw-enigma/cli init-config
npx @tw-enigma/cli css-config --strategy mixed
```

#### Command Mapping

| Legacy Command | New Command | Notes |
|---|---|---|
| `tw-enigma init` | `@tw-enigma/cli init-config` | Enhanced configuration options |
| `tw-enigma optimize` | Integration with @tw-enigma/core | Use programmatic API |
| `tw-enigma config` | `@tw-enigma/cli css-config` | Separated configuration commands |

### Installation

#### Package Manager Installation

```bash
# npm
npm install @tw-enigma/cli

# pnpm (recommended)
pnpm add @tw-enigma/cli

# yarn
yarn add @tw-enigma/cli
```

#### Global Installation

```bash
# npm
npm install -g @tw-enigma/cli

# pnpm
pnpm add -g @tw-enigma/cli

# yarn
yarn global add @tw-enigma/cli
```

### Usage Examples

#### Basic Configuration Setup

```bash
# Initialize configuration
npx @tw-enigma/cli init-config --template react

# Configure CSS generation
npx @tw-enigma/cli css-config \
  --strategy mixed \
  --apply-directives \
  --comments detailed
```

#### Integration with Build Tools

```bash
# Package.json scripts
{
  "scripts": {
    "prepare": "tw-enigma init-config",
    "css:config": "tw-enigma css-config --strategy mixed"
  }
}
```

### Performance

- **Command Startup**: < 100ms for most commands
- **Configuration Operations**: Near-instantaneous validation and setup
- **File Operations**: Efficient handling of large project structures
- **Memory Usage**: Minimal memory footprint for CLI operations

### Compatibility

- **Node.js**: Requires v18.0.0 or higher
- **Package Managers**: Compatible with npm, pnpm, yarn
- **Operating Systems**: Windows, macOS, Linux
- **Terminals**: Supports colors and progress indicators where available

### Dependencies

#### Runtime Dependencies
- `commander`: Command-line interface framework
- `@tw-enigma/core`: Core optimization engine integration
- Other utilities for file operations and validation

#### Development Dependencies
- `typescript`: TypeScript compiler
- `vitest`: Testing framework
- `@types/node`: Node.js type definitions
- Build and development tooling

### Error Handling

The CLI provides comprehensive error handling with:

- **User-Friendly Messages**: Clear, actionable error descriptions
- **Context Information**: Relevant details about what went wrong
- **Suggestions**: Helpful suggestions for resolving issues
- **Exit Codes**: Proper exit codes for script integration

#### Common Error Scenarios

```bash
# Configuration file not found
Error: Configuration file not found
Suggestion: Run 'tw-enigma init-config' to create a configuration

# Invalid strategy option
Error: Invalid strategy 'invalid'
Valid options: atomic, utility, component, mixed

# File permission issues
Error: Cannot write to output directory
Suggestion: Check file permissions or run with appropriate privileges
```

### Security

- **Input Validation**: All command inputs are validated
- **Path Sanitization**: Safe handling of file paths and outputs
- **Configuration Validation**: Schema validation for configuration files
- **Error Information**: Careful handling of sensitive information in errors

### Testing

The CLI package includes comprehensive tests for:

- **Command Parsing**: Validation of all command options and arguments
- **Configuration Handling**: Testing of configuration file operations
- **Error Scenarios**: Coverage of various error conditions
- **Integration**: Testing with @tw-enigma/core package

### Contributing to CLI

When contributing to the CLI package:

1. **Command Structure**: Follow commander.js patterns
2. **Error Handling**: Provide helpful error messages
3. **Documentation**: Update help text and examples
4. **Testing**: Add tests for new commands and options
5. **Compatibility**: Ensure cross-platform functionality

---

For more information about @tw-enigma/cli, see the [API Reference](../../docs/API_REFERENCE.md) and [CLI Usage Examples](../../examples/cli/README.md). 