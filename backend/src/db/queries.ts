import { sql } from './init';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

export interface Conversation {
  id: string;
  session_id: string;
  created_at: Date;
  updated_at: Date;
}

export async function getOrCreateConversation(sessionId: string): Promise<string> {
  const existing = await sql`
    SELECT id FROM conversations 
    WHERE session_id = ${sessionId} 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  const conversationId = uuidv4();
  await sql`
    INSERT INTO conversations (id, session_id)
    VALUES (${conversationId}, ${sessionId})
  `;

  return conversationId;
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
  const messageId = uuidv4();
  const result = await sql`
    INSERT INTO messages (id, conversation_id, role, content)
    VALUES (${messageId}, ${conversationId}, ${role}, ${content})
    RETURNING *
  `;

  await sql`
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = ${conversationId}
  `;

  return result[0] as Message;
}

export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  const messages = await sql`
    SELECT * FROM messages 
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;

  return messages as Message[];
}

