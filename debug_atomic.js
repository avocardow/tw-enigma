import { AtomicFileCreator } from './dist/atomicOps/AtomicFileCreator.js';
import fs from 'fs/promises';
import path from 'path';

async function debugTest() {
  const testDir = './test-debug';
  
  // Clean up and create test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {}
  await fs.mkdir(testDir, { recursive: true });
  
  const creator = new AtomicFileCreator();
  
  // Create an existing file that will cause a conflict
  const conflictFile = path.join(testDir, "conflict.txt");
  await fs.writeFile(conflictFile, "existing");
  
  const files = [
    { path: path.join(testDir, "success1.txt"), content: "content 1" },
    { path: conflictFile, content: "new content" }, // This should fail
    { path: path.join(testDir, "not-created.txt"), content: "content 2" },
  ];
  
  console.log('Testing createMultipleFiles with stopOnError: true');
  console.log('Files to create:', files.map(f => ({ path: f.path, exists: false })));
  
  // Check if conflict file exists
  try {
    await fs.access(conflictFile);
    console.log('Conflict file exists:', conflictFile);
  } catch {
    console.log('Conflict file does not exist:', conflictFile);
  }
  
  const results = await creator.createMultipleFiles(files, {
    stopOnError: true,
  });
  
  console.log('Results length:', results.length);
  console.log('Results:', results.map(r => ({ 
    success: r.success, 
    filePath: r.filePath,
    error: r.error?.message 
  })));
  
  await creator.cleanup();
  
  // Clean up
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {}
}

debugTest().catch(console.error); 