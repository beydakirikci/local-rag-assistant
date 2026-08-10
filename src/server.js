// src/server.js — Express HTTP server (Upgraded)
// Serves the web UI and provides API endpoints for chat, history, and status

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { ChatEngine } from './chatEngine.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const app = express();
app.use(express.json());
// For parsing raw file uploads (like PDF)
app.use(express.raw({ type: '*/*', limit: '50mb' })); 

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
  let { question } = req.body;
  
  if (!question && req.body instanceof Buffer) {
    try { question = JSON.parse(req.body.toString()).question; } catch (e) {}
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (engine.status !== 'ready') {
    return res.status(503).json({ error: 'Model is not ready', status: engine.status });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const result = await engine.answerQuestion(question.trim(), (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'sources', sources: result.sources })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  }

  res.end();
});

// --- API: Get Chat History ---
app.get('/api/history', (req, res) => {
  try {
    const history = engine.getHistory();
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const contentBuffer = req.body;
    let title = req.headers['x-document-title'] || `uploaded-${Date.now()}`;
    const ext = title.endsWith('.pdf') ? '.pdf' : '.md';

    if (!title.endsWith(ext)) title += ext;

    if (!contentBuffer || contentBuffer.length === 0) {
      return res.status(400).json({ error: 'Document content is empty' });
    }

    const docsDir = join(ROOT, config.docsDir);
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = join(docsDir, safeTitle);
    writeFileSync(filePath, contentBuffer);

    // Re-ingest async
    const { chunkFile } = await import('./chunker.js');
    const { source, category, chunks } = await chunkFile(filePath);

    const chunkObjects = chunks.map((c, i) => ({
      content: c,
      source,
      category,
      chunkIndex: i,
      totalChunks: chunks.length
    }));

    await engine.vectorStore.addChunks(chunkObjects);

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

// --- API: Delete document ---
app.delete('/api/documents/:id', (req, res) => {
  try {
    const source = req.params.id;
    engine.vectorStore.deleteDocument(source);
    res.json({ success: true, message: `Document "${source}" deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API: Upload URL ---
app.post('/api/upload-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const { chunkUrl } = await import('./chunker.js');
    const { source, category, chunks } = await chunkUrl(url);

    const chunkObjects = chunks.map((c, i) => ({
      content: c,
      source,
      category,
      chunkIndex: i,
      totalChunks: chunks.length
    }));

    await engine.vectorStore.addChunks(chunkObjects);

    res.json({
      success: true,
      message: `Website "${source}" processed and indexed`,
      chunks: chunks.length
    });
  } catch (error) {
    console.error('URL processing error:', error);
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
  console.log('║       🤖 Local RAG Assistant V2                 ║');
  console.log('║       (Semantic Search & PDF Ready)             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 URL: http://${config.host}:${config.port}          ║`);
  console.log(`║  📄 Documents: ${engine.getDocumentInfo().totalChunks} chunks loaded          ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  engine.initialize().catch(err => {
    console.error('❌ Model initialization failed:', err.message);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close();
  engine.vectorStore?.close();
  process.exit(0);
});
