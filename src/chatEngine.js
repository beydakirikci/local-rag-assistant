// src/chatEngine.js — RAG pipeline orchestrator (Upgraded: Persistent History)
// Uses Foundry Local's OpenAI-compatible REST API (no SDK needed)
// Foundry server must be running: `foundry server start`

import { execSync } from 'child_process';
import { VectorStore } from './vectorStore.js';
import { buildPromptMessages } from './prompts.js';
import config from './config.js';

/**
 * Get the Foundry Local server URL
 */
function getFoundryServerUrl() {
  try {
    const output = execSync('foundry server status', { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/Web URLs?\s+(http:\/\/[^\s]+)/i);
    if (match) return match[1];
  } catch (e) {
    // fallback
  }
  return 'http://127.0.0.1:61642';
}

export class ChatEngine {
  constructor() {
    this.foundryUrl = null;
    this.vectorStore = new VectorStore();
    this.status = 'initializing';
    this.progress = 0;
    this.statusMessage = 'Starting up...';
    this._statusListeners = [];
  }

  onStatusChange(callback) {
    this._statusListeners.push(callback);
  }

  _setStatus(status, message, progress = 0) {
    this.status = status;
    this.statusMessage = message;
    this.progress = progress;
    for (const listener of this._statusListeners) {
      try {
        listener({ status, message, progress });
      } catch (e) {}
    }
  }

  async initVectorStore() {
    await this.vectorStore.init();
  }

  async initialize() {
    try {
      await this.initVectorStore();
      this._setStatus('initializing', 'Looking for Foundry Local server...');

      this.foundryUrl = getFoundryServerUrl();
      console.log(`📡 Foundry Local server: ${this.foundryUrl}`);

      this._setStatus('loading', `Connecting to Foundry Local at ${this.foundryUrl}...`);

      try {
        const healthRes = await fetch(`${this.foundryUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
        if (!healthRes.ok) throw new Error(`Server responded with ${healthRes.status}`);
      } catch (e) {
        this._setStatus('loading', 'Starting Foundry Local server...');
        try {
          execSync('foundry server start', { timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
          this.foundryUrl = getFoundryServerUrl();
        } catch (startErr) {
          throw new Error(`Cannot connect to Foundry Local server. Make sure it is running: foundry server start`);
        }
      }

      this._setStatus('loading', `Loading model ${config.model}...`, 50);

      try {
        execSync(`foundry model load ${config.model}`, { encoding: 'utf-8', timeout: 120000 });
      } catch (e) {}

      this._setStatus('loading', 'Verifying model...', 80);

      const testRes = await fetch(`${this.foundryUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!testRes.ok) {
        throw new Error(`Model test failed: ${testRes.status}`);
      }

      this._setStatus('ready', 'Model loaded and ready!', 100);
      console.log(`✅ Model "${config.model}" loaded and ready`);

    } catch (error) {
      console.error('❌ Failed to initialize ChatEngine:', error.message);
      this._setStatus('error', `Error: ${error.message}`);
      throw error;
    }
  }

  async answerQuestion(question, onToken = null) {
    if (this.status !== 'ready') {
      throw new Error('Model is not ready. Current status: ' + this.status);
    }

    // Await semantic search
    const chunks = await this.vectorStore.search(question, config.topK);
    const history = this.vectorStore.getHistory(6);
    
    const messages = buildPromptMessages(question, chunks, history);
    let answer = '';

    try {
      if (onToken) {
        const response = await fetch(`${this.foundryUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages,
            stream: true,
            max_tokens: 1024,
            temperature: 0.7
          }),
          signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                answer += token;
                onToken(token);
              }
            } catch (e) {}
          }
        }
      } else {
        const response = await fetch(`${this.foundryUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        const data = await response.json();
        answer = data.choices?.[0]?.message?.content || 'No response generated.';
      }
    } catch (error) {
      console.error('Error generating response:', error);
      answer = 'Yanıt oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.';
    }

    // Save to persistent history
    this.vectorStore.saveMessage('user', question);
    this.vectorStore.saveMessage('assistant', answer);

    return {
      answer,
      sources: chunks.map(c => ({
        source: c.source,
        category: c.category,
        score: c.score,
        preview: c.content.slice(0, 150) + (c.content.length > 150 ? '...' : '')
      }))
    };
  }

  getHistory() {
    return this.vectorStore.getHistory(50); // Get up to 50 previous messages for UI
  }

  clearHistory() {
    this.vectorStore.clearHistory();
  }

  getDocumentInfo() {
    if (!this.vectorStore._initialized) {
      return { totalChunks: 0, sources: [] };
    }
    return {
      totalChunks: this.vectorStore.count,
      sources: this.vectorStore.sources
    };
  }
}
