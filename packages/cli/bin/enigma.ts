#!/usr/bin/env node

// Import from source file, not dist (which doesn't exist during build)
import { cli } from '../src/index.js';

// Start the CLI
cli();
