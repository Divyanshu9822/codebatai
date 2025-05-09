import Groq from 'groq-sdk';
import { ensureRateLimit } from '../utils/rateLimiter.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const model = process.env.GROQ_AI_MODEL_NAME || 'llama3-8b-8192';

export const generateChatCompletion = async (messages, maxTokens = 1024) => {
  try {
    await ensureRateLimit();
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      top_p: 0.9,
    });

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating chat completion:', error);
    return '';
  }
};
