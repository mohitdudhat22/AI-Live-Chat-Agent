import request from 'supertest';
import express from 'express';
import { chatRouter } from '../src/routes/chat';
import { getAIResponse } from '../src/services/llm';
import {
  getOrCreateConversation,
  saveMessage,
  getConversationHistory,
} from '../src/db/queries';
import { getCachedResponse, setCachedResponse } from '../src/services/cache';

jest.mock('../src/services/llm');
jest.mock('../src/db/queries');
jest.mock('../src/services/cache');

const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

const mockedGetAIResponse = getAIResponse as jest.MockedFunction<typeof getAIResponse>;
const mockedGetOrCreateConversation = getOrCreateConversation as jest.MockedFunction<
  typeof getOrCreateConversation
>;
const mockedSaveMessage = saveMessage as jest.MockedFunction<typeof saveMessage>;
const mockedGetConversationHistory = getConversationHistory as jest.MockedFunction<
  typeof getConversationHistory
>;
const mockedGetCachedResponse = getCachedResponse as jest.MockedFunction<typeof getCachedResponse>;
const mockedSetCachedResponse = setCachedResponse as jest.MockedFunction<typeof setCachedResponse>;

beforeEach(() => {
  mockedGetOrCreateConversation.mockResolvedValue('conv-1');
  mockedSaveMessage.mockResolvedValue({
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hi',
    created_at: new Date(),
  } as any);
  mockedGetConversationHistory.mockResolvedValue([]);
  mockedGetCachedResponse.mockResolvedValue(null);
  mockedSetCachedResponse.mockResolvedValue();
  mockedGetAIResponse.mockResolvedValue('ok');
  jest.clearAllMocks();
});

describe('POST /api/chat validation and robustness', () => {
  it('rejects empty messages', async () => {
    const res = await request(app).post('/api/chat').send({ message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error?.toLowerCase()).toContain('empty');
  });

  it('rejects non-string messages', async () => {
    const res = await request(app).post('/api/chat').send({ message: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error?.toLowerCase()).toContain('string');
  });

  it('rejects overly long messages (>5000)', async () => {
    const longMessage = 'a'.repeat(5001);
    const res = await request(app).post('/api/chat').send({ message: longMessage });
    expect(res.status).toBe(400);
    expect(res.body.error?.toLowerCase()).toContain('too long');
  });

  it('truncates very long but allowed messages (warn range) and still works', async () => {
    const longMessage = 'a'.repeat(4501); // > warning threshold (4000) but < max (5000)
    mockedGetAIResponse.mockResolvedValue('truncated ok');

    const res = await request(app).post('/api/chat').send({ message: longMessage });
    expect(res.status).toBe(200);
    expect(res.body.response).toBe('truncated ok');

    // processed message should be truncated to 4000 + '...'
    expect(mockedGetAIResponse).toHaveBeenCalledTimes(1);
    expect(mockedGetAIResponse).toHaveBeenCalledWith(
      expect.stringMatching(/^a{4000}\.\.\.$/),
      expect.any(Array)
    );

    // ensure we still saved truncated message
    expect(mockedSaveMessage).toHaveBeenCalledWith('conv-1', 'user', expect.stringMatching(/^a{4000}\.\.\.$/));
  });

  it('returns clean error when LLM fails (rate limit)', async () => {
    mockedGetAIResponse.mockRejectedValue(new Error('rate limit exceeded'));

    const res = await request(app).post('/api/chat').send({ message: 'hello' });
    expect(res.status).toBe(429);
    expect(res.body.error?.toLowerCase()).toContain('rate limit');
  });

  it('falls back gracefully for generic errors without crashing', async () => {
    mockedGetAIResponse.mockRejectedValue(new Error('unexpected failure'));

    const res = await request(app).post('/api/chat').send({ message: 'hello' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeTruthy();
  });
});

