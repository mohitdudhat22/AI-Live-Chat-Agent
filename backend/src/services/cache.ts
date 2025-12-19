import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('Redis URL not provided, caching disabled');
    return null;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));

    await redisClient.connect();
    console.log('Redis connected successfully');
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return null;
  }
}

export async function getCachedResponse(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const cached = await client.get(key);
    return cached;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedResponse(
  key: string,
  value: string,
  ttl: number = 3600
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setEx(key, ttl, value);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export function generateCacheKey(sessionId: string, message: string): string {
  return `chat:${sessionId}:${Buffer.from(message).toString('base64').substring(0, 50)}`;
}

