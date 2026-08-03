// scripts/ingest.js — Document ingestion pipeline (Upgraded: Async & Semantic)
// Reads files, chunks them smartly, computes dense embeddings, stores in SQLite

import { chunkAllDocs } from '../src/chunker.js';
import { VectorStore } from '../src/vectorStore.js';
import config from '../src/config.js';

async function main() {
  console.log('');
  console.log('🔄 Starting document ingestion pipeline...');
  console.log(`📂 Documents directory: ${config.docsDir}/`);
  console.log(`🗄️  Database: ${config.dbFile}`);
  console.log('');

  try {
    // Step 1: Read and chunk all documents
    const chunks = await chunkAllDocs();

    if (chunks.length === 0) {
      console.log('⚠️  No documents found! Please add .md or .pdf files to the docs/ directory.');
      process.exit(1);
    }

    // Step 2: Initialize vector store and insert chunks
    const store = new VectorStore();
    await store.init();

    store.clear(); // Fresh ingest
    await store.addChunks(chunks);

    console.log('');
    console.log('✅ Ingestion complete!');
    console.log(`   📊 Total chunks: ${store.count}`);
    console.log(`   📄 Documents: ${store.sources.join(', ')}`);
    console.log('');

    // Step 3: Quick verification
    const testQuery = chunks[0]?.content?.split(' ').slice(0, 5).join(' ') || 'test';
    const results = await store.search(testQuery, 2);
    console.log(`🔍 Verification search for "${testQuery.slice(0, 40)}...":`);
    for (const result of results) {
      console.log(`   → [${(result.score * 100).toFixed(1)}%] ${result.source}: "${result.content.slice(0, 60)}..."`);
    }
    console.log('');

    store.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

main();
