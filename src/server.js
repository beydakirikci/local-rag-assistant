// src/server.js — Express HTTP server
// Serves the web UI and provides API endpoints for chat and status

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { ChatEngine } from './chatEngine.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const app = express();
app.use(express.json());
app.use(express.text());

// Serve static files
app.use(express.static(join(ROOT, 'public')));

// Create the chat engine
const engine = new ChatEngine();

// --- SSE: Status stream ---
const statusClients = new Set();

engine.onStatusChange((statusData) => {
  const data = JSON.stringify(statusData);
  for (const client of statusClients) {
    client.write(`data: ${data}\n\n`);
  }
});

app.get('/api/status', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send current status immediately
  const currentStatus = JSON.stringify({
    status: engine.status,
    message: engine.statusMessage,
    progress: engine.progress
  });
  res.write(`data: ${currentStatus}\n\n`);

  statusClients.add(res);
  req.on('close', () => statusClients.delete(res));
});

// --- API: Chat endpoint (streaming) ---
app.post('/api/chat', async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (engine.status !== 'ready') {
    return res.status(503).json({ error: 'Model is not ready', status: engine.status });
  }

  // Set up SSE for streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const result = await engine.answerQuestion(question.trim(), (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
    });

    // Send sources at the end
    res.write(`data: ${JSON.stringify({ type: 'sources', sources: result.sources })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  }

  res.end();
});

// --- API: Get document info ---
app.get('/api/documents', (req, res) => {
  try {
    const info = engine.getDocumentInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API: Upload document ---
app.post('/api/upload', async (req, res) => {
  try {
    const content = req.body;
    const title = req.headers['x-document-title'] || `uploaded-${Date.now()}`;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    // Save to docs directory
    const docsDir = join(ROOT, config.docsDir);
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = join(docsDir, `${safeTitle}.md`);
    writeFileSync(filePath, content, 'utf-8');

    // Re-ingest: chunk and add to vector store
    const { chunkFile } = await import('./chunker.js');
    const { source, category, chunks } = chunkFile(filePath);

    const chunkObjects = chunks.map((c, i) => ({
      content: c,
      source,
      category,
      chunkIndex: i,
      totalChunks: chunks.length
    }));

    engine.vectorStore.addChunks(chunkObjects);

    res.json({
      success: true,
      message: `Document "${title}" uploaded and indexed`,
      chunks: chunks.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- API: Clear chat history ---
app.post('/api/clear', (req, res) => {
  engine.clearHistory();
  res.json({ success: true });
});

// --- Start server ---
const server = app.listen(config.port, config.host, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       🤖 Local RAG Assistant                    ║');
  console.log('║       Powered by Microsoft Foundry Local        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 URL: http://${config.host}:${config.port}          ║`);
  console.log(`║  📄 Documents: ${engine.getDocumentInfo().totalChunks} chunks loaded          ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Initialize the model in background
  engine.initialize().catch(err => {
    console.error('❌ Model initialization failed:', err.message);
    console.log('💡 Make sure Foundry Local is installed: winget install Microsoft.FoundryLocal');
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close();
  engine.vectorStore?.close();
  process.exit(0);
});
