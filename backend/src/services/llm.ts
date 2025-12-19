import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { Message } from '../db/queries';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-8b';
const SYSTEM_PROMPT = `
You are a live customer support chat agent for "ShopSmart", a small e-commerce store.

Your job is to help customers quickly and clearly in a chat conversation.

STRICT RESPONSE RULES:
- Respond in plain conversational sentences only.
- Do NOT use headings, bullet points, markdown, or formatting of any kind.
- Do NOT include labels like "Shipping Policy", "Timeline", "Overview", or similar.
- Keep responses short and natural (2–4 sentences max).
- Sound friendly, human, and professional — like real chat support.
- Never mention that you are an AI or that this information comes from a prompt.

If the user asks something you are not certain about, say:
"I'm not fully sure on that — let me check with our team and get back to you."

Use the following store information to answer questions accurately:

SHOPSMART STORE INFORMATION:

Shipping:
Standard shipping takes 5–7 business days and costs $5.99. Express shipping takes 2–3 business days and costs $12.99. Orders over $50 qualify for free standard shipping. Orders placed before 2 PM EST ship the same day, and tracking details are sent by email once shipped. We ship across all US states, Canada, and select international locations.

Returns and refunds:
Returns are accepted within 30 days of delivery as long as items are unused and in original packaging with tags attached. Refunds are processed within 5–7 business days after we receive the return. Return shipping is free for defective or incorrect items. For other returns, customers cover return shipping unless the order total was over $100. Refunds are issued to the original payment method.

Support hours:
Support is available Monday to Friday from 9 AM to 6 PM EST, and Saturday from 10 AM to 4 PM EST. We are closed on Sundays. Customers can reach us via email at support@shopsmart.com or by phone at 1-800-746-7762.

General policies:
We accept major credit cards, PayPal, and Apple Pay. Orders usually process within 1–2 business days. Electronics come with a 1-year warranty. Price matching is available within 7 days of purchase, and gift wrapping is available for $4.99.
`;

function buildChatHistory(userMessage: string, conversationHistory: Message[]) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];
}

async function callOpenAI(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
    buildChatHistory(userMessage, conversationHistory);

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return response;
  } catch (error: any) {
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }
    if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    if (error?.status === 503 || error?.code === 'server_error') {
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    if (error?.code === 'timeout' || error?.message?.includes('timeout')) {
      throw new Error('Request timed out. Please try again.');
    }
    if (error?.status === 400) {
      throw new Error('Invalid request to OpenAI. Please check your message.');
    }
    throw error;
  }
}

async function callGemini(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: geminiModelName });

  const historyText = conversationHistory
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${historyText}\n\nUSER: ${userMessage}\nASSISTANT:`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    if (!response) {
      throw new Error('No response from Gemini');
    }

    return response;
  } catch (error: any) {
    if (error?.status === 401 || error?.message?.includes('API key')) {
      throw new Error('Invalid Gemini API key. Please check your configuration.');
    }
    if (error?.status === 429 || error?.message?.includes('quota')) {
      throw new Error('Gemini API quota exceeded. Please try again later.');
    }
    if (error?.status === 503) {
      throw new Error('Gemini service is temporarily unavailable. Please try again later.');
    }
    if (error?.message?.includes('timeout') || error?.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

export async function getAIResponse(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  const MAX_HISTORY_MESSAGES = 20;
  const limitedHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);

  try {
    return await callOpenAI(userMessage, limitedHistory);
  } catch (error: any) {
    console.error('OpenAI API error, attempting Gemini fallback:', error);
  }

  try {
    return await callGemini(userMessage, limitedHistory);
  } catch (geminiError) {
    console.error('Gemini API error:', geminiError);
    throw new Error('Failed to get AI response from both OpenAI and Gemini');
  }
}

