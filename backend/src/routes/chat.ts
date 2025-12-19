import express, { Request, Response } from 'express';
import { getOrCreateConversation, saveMessage, getConversationHistory } from '../db/queries';
import { getAIResponse } from '../services/llm';
import { getCachedResponse, setCachedResponse, generateCacheKey } from '../services/cache';

export const chatRouter = express.Router();

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatResponse {
  response: string;
  sessionId: string;
  conversationId: string;
}

const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGE_LENGTH_WARNING = 4000;

chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId: providedSessionId }: ChatRequest = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ 
        error: `Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters. Your message is ${trimmedMessage.length} characters.` 
      });
    }

    const processedMessage = trimmedMessage.length > MAX_MESSAGE_LENGTH_WARNING 
      ? trimmedMessage.substring(0, MAX_MESSAGE_LENGTH_WARNING) + '...' 
      : trimmedMessage;

    if (providedSessionId && typeof providedSessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId must be a string' });
    }

    const sessionId = providedSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const cacheKey = generateCacheKey(sessionId, processedMessage);
    const cachedResponse = await getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('Cache hit for message');
      const conversationId = await getOrCreateConversation(sessionId);
      await saveMessage(conversationId, 'user', processedMessage);
      await saveMessage(conversationId, 'assistant', cachedResponse);
      
      return res.json({
        response: cachedResponse,
        sessionId,
        conversationId,
      } as ChatResponse);
    }

    const conversationId = await getOrCreateConversation(sessionId);

    await saveMessage(conversationId, 'user', processedMessage);

    const history = await getConversationHistory(conversationId);

    const aiResponse = await getAIResponse(processedMessage, history);

    await saveMessage(conversationId, 'assistant', aiResponse);

    await setCachedResponse(cacheKey, aiResponse);

    res.json({
      response: aiResponse,
      sessionId,
      conversationId,
    } as ChatResponse);
  } catch (error: any) {
    console.error('Chat error:', error);
    
    const errorMessage = error?.message || 'Failed to process chat message';
    
    let statusCode = 500;
    if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
      statusCode = 503;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      statusCode = 429;
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504;
    } else if (errorMessage.includes('Invalid request')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

chatRouter.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    const conversationId = await getOrCreateConversation(sessionId);
    const history = await getConversationHistory(conversationId);

    res.json({ messages: history || [] });
  } catch (error: any) {
    console.error('Get history error:', error);
    const errorMessage = error?.message || "Failed to get conversation history";
    res.status(500).json({ error: errorMessage });
  }
});
