// scripts/ingest.js — Document ingestion pipeline
// Reads all markdown files from docs/, chunks them, computes TF-IDF, stores in SQLite

import { chunkAllDocs } from '../src/chunker.js';
import { VectorStore } from '../src/vectorStore.js';
import config from '../src/config.js';

console.log('');
console.log('🔄 Starting document ingestion pipeline...');
console.log(`📂 Documents directory: ${config.docsDir}/`);
console.log(`🗄️  Database: ${config.dbFile}`);
console.log('');

try {
  // Step 1: Read and chunk all documents
  const chunks = chunkAllDocs();

  if (chunks.length === 0) {
    console.log('⚠️  No documents found! Please add .md files to the docs/ directory.');
    process.exit(1);
  }

  // Step 2: Initialize vector store and insert chunks
  const store = new VectorStore();
  await store.init();

  store.clear(); // Fresh ingest
  store.addChunks(chunks);

  console.log('');
  console.log('✅ Ingestion complete!');
  console.log(`   📊 Total chunks: ${store.count}`);
  console.log(`   📄 Documents: ${store.sources.join(', ')}`);
  console.log('');

  // Step 3: Quick verification — test a sample search
  const testQuery = chunks[0]?.content?.split(' ').slice(0, 5).join(' ') || 'test';
  const results = store.search(testQuery, 2);
  console.log(`🔍 Verification search for "${testQuery.slice(0, 40)}...":`);
  for (const result of results) {
    console.log(`   → [${(result.score * 100).toFixed(1)}%] ${result.source}: "${result.content.slice(0, 60)}..."`);
  }
  console.log('');

  store.close();
} catch (error) {
  console.error('❌ Ingestion failed:', error);
  process.exit(1);
}
