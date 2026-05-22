import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { getSessionData, addMessageToSession } from '../memory/sessionManager';
import { runAgent } from '../agents/orchestrator';
import { buildRegexAnswer } from '../services/regexParser';
import { ChatMessage, AgentResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const ChatRequestSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  message: z.string().min(1, 'message is required').max(2000),
});

/**
 * POST /api/chat
 * Body: { sessionId, message }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const validation = ChatRequestSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: validation.error.flatten() });
    return;
  }

  const { sessionId, message } = validation.data;

  const session = await getSessionData(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found. Upload a resume first.' });
    return;
  }
  if (!session.resumeData) {
    res.status(422).json({ error: 'No resume found for this session. Upload a resume first.' });
    return;
  }

  // Save user message
  const userMsg: ChatMessage = {
    role: 'user', content: message, timestamp: new Date(),
  };
  await addMessageToSession(sessionId, userMsg);

  const hasOpenAIKey =
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here' &&
    process.env.OPENAI_API_KEY.startsWith('sk-');

  let response: AgentResponse;

  if (hasOpenAIKey) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      response = await runAgent({
        question: message,
        resumeData: session.resumeData,
        chatHistory: session.chatHistory || [],
        openai,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Agent error — falling back to regex:', errMsg);
      response = buildRegexAnswer(message, session.resumeData);
    }
  } else {
    // No valid OpenAI key — use rule-based answering
    console.log('No valid OpenAI key — using regex parser for chat');
    response = buildRegexAnswer(message, session.resumeData);
  }

  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: response.answer,
    timestamp: new Date(),
    structured: response,
  };
  await addMessageToSession(sessionId, assistantMsg);

  res.status(200).json({ success: true, response });
});

export default router;
