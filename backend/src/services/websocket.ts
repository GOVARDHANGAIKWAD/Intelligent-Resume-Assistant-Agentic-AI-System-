import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import OpenAI from 'openai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getSessionData, addMessageToSession } from '../memory/sessionManager';
import { runAgentStreaming } from '../agents/orchestrator';
import { buildRegexAnswer } from './regexParser';
import { AgentResponse, ChatMessage, ResumeData } from '../types';

// ── Message schemas ──
const WsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat'),
    sessionId: z.string(),
    message: z.string().min(1).max(2000),
    requestId: z.string().optional(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

type WsClient = {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  isAlive: boolean;
};

const clients = new Map<string, WsClient>();

// ── Validate OpenAI key once at startup ──
function hasValidOpenAIKey(): boolean {
  return !!(
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here' &&
    process.env.OPENAI_API_KEY.startsWith('sk-')
  );
}

// ── Send helper ──
function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ── Save assistant message and notify client ──
async function finalizeResponse(
  ws: WebSocket,
  sessionId: string,
  requestId: string | undefined,
  response: AgentResponse
): Promise<void> {
  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: response.answer,
    timestamp: new Date(),
    structured: response,
  };
  await addMessageToSession(sessionId, assistantMsg);
  send(ws, { type: 'stream_end', requestId, response });
}

// ── Setup WebSocket server ──
export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat — ping all clients every 30s
  const heartbeatInterval = setInterval(() => {
    clients.forEach(({ ws, id, isAlive }) => {
      if (!isAlive) {
        ws.terminate();
        clients.delete(id);
        return;
      }
      clients.get(id)!.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const clientId = uuidv4();
    const client: WsClient = { id: clientId, ws, isAlive: true };
    clients.set(clientId, client);

    console.log(`🔌 WS client connected: ${clientId} (total: ${clients.size})`);

    send(ws, { type: 'connected', clientId });

    ws.on('pong', () => {
      const c = clients.get(clientId);
      if (c) c.isAlive = true;
    });

    ws.on('message', async (raw: Buffer) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      const parsed = WsMessageSchema.safeParse(data);
      if (!parsed.success) {
        send(ws, { type: 'error', message: 'Invalid message format', details: parsed.error.flatten() });
        return;
      }

      const msg = parsed.data;

      // ── Ping/Pong ──
      if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }

      // ── Chat message ──
      if (msg.type === 'chat') {
        const { sessionId, message, requestId } = msg;
        client.sessionId = sessionId;

        // Get session
        const session = await getSessionData(sessionId);
        if (!session) {
          send(ws, { type: 'error', requestId, message: 'Session not found. Upload a resume first.' });
          return;
        }
        if (!session.resumeData) {
          send(ws, { type: 'error', requestId, message: 'No resume data. Upload a resume first.' });
          return;
        }

        // Save user message
        const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
        await addMessageToSession(sessionId, userMsg);

        // Signal stream start
        send(ws, { type: 'stream_start', requestId });

        const resumeData = session.resumeData as ResumeData;

        if (hasValidOpenAIKey()) {
          // ── AI Streaming path ──
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          await runAgentStreaming({
            question: message,
            resumeData,
            chatHistory: session.chatHistory || [],
            openai,
            onToken: (token: string) => {
              send(ws, { type: 'token', requestId, token });
            },
            onComplete: async (response: AgentResponse) => {
              await finalizeResponse(ws, sessionId, requestId, response);
            },
            onError: async (error: string) => {
              // Fallback to regex on any OpenAI error
              console.warn('OpenAI streaming error, falling back to regex:', error);
              try {
                const fallback = buildRegexAnswer(message, resumeData);
                await finalizeResponse(ws, sessionId, requestId, fallback);
              } catch {
                send(ws, { type: 'error', requestId, message: error });
              }
            },
          });
        } else {
          // ── No valid OpenAI key — rule-based answer ──
          console.log('No valid OpenAI key — using regex fallback for WS chat');
          try {
            const response = buildRegexAnswer(message, resumeData);
            await finalizeResponse(ws, sessionId, requestId, response);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            send(ws, { type: 'error', requestId, message: errMsg });
          }
        }
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`🔌 WS client disconnected: ${clientId} (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
      console.error(`WS error [${clientId}]:`, err.message);
      clients.delete(clientId);
    });
  });

  console.log('🚀 WebSocket server ready on /ws');
  return wss;
}
