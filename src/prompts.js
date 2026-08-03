// src/prompts.js — System prompts for the RAG assistant

export const SYSTEM_PROMPT = `You are a local, offline Q&A assistant.
You answer questions based ONLY on the provided context documents.

Behaviour Rules:
- Answer questions accurately using ONLY the provided context.
- If the context does not contain enough information to answer, say:
  "Bu bilgi mevcut dokümanlarımda bulunmuyor." (This information is not available in my documents.)
- Do NOT make up or hallucinate information beyond what is in the context.
- Be concise, clear, and helpful.
- If a question is ambiguous, ask for clarification.
- When possible, mention which document or section the answer comes from.

Response Format:
- Provide a brief summary first (1-2 sentences)
- Then give detailed explanation if needed
- Reference the source document when applicable

Language:
- Respond in the same language as the user's question.
- If the user asks in Turkish, respond in Turkish.
- If the user asks in English, respond in English.`;

/**
 * Build the full prompt messages array for the model
 * @param {string} userQuestion - The user's question
 * @param {Array} contextChunks - Retrieved relevant chunks
 * @param {Array} conversationHistory - Previous messages (optional)
 * @returns {Array} Messages array for chat completion
 */
export function buildPromptMessages(userQuestion, contextChunks, conversationHistory = []) {
  const contextText = contextChunks
    .map((chunk, i) => {
      const source = chunk.source || `Document ${i + 1}`;
      return `--- Source: ${source} (Relevance: ${(chunk.score * 100).toFixed(1)}%) ---\n${chunk.content}`;
    })
    .join('\n\n');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add conversation history (last 6 messages for context window management)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add context + current question
  const userContent = contextChunks.length > 0
    ? `Context Documents:\n${contextText}\n\n---\n\nQuestion: ${userQuestion}`
    : `No relevant documents were found for this question.\n\nQuestion: ${userQuestion}`;

  messages.push({ role: 'user', content: userContent });

  return messages;
}
