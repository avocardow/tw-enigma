import { AtomicFileWriter } from './src/atomicOps/AtomicFileWriter.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const TEST_DIR = './test-debug';
const APPEND_FILE = join(TEST_DIR, 'append-file.txt');
const EXISTING_CONTENT = 'This is existing content.\n';
const APPEND_CONTENT = 'This content will be appended.\n';

async function testAppend() {
  // Setup
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(APPEND_FILE, EXISTING_CONTENT);
  
  const writer = new AtomicFileWriter();
  
  console.log('Before append - file exists:', await fs.access(APPEND_FILE).then(() => true).catch(() => false));
  console.log('Before append - content:', await fs.readFile(APPEND_FILE, 'utf8'));
  
  const result = await writer.appendToFile(APPEND_FILE, APPEND_CONTENT);
  
  console.log('Append result:', result);
  
  if (result.success) {
    console.log('After append - content:', await fs.readFile(APPEND_FILE, 'utf8'));
  }
  
  // Cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

testAppend().catch(console.error); 