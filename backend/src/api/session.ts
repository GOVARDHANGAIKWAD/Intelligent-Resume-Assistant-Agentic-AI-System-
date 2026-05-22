import { Router, Request, Response } from 'express';
import { getSessionData, clearSessionHistory } from '../memory/sessionManager';
import { candidateScoreTool, keywordExtractorTool, skillMatcherTool } from '../tools';

const router = Router();

/**
 * GET /api/session/:sessionId
 * Returns full session data including chat history + resume analytics
 */
router.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string;

  const session = await getSessionData(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  let analytics = null;
  if (session.resumeData) {
    const scoreResult = candidateScoreTool(session.resumeData);
    const kwResult = keywordExtractorTool(session.resumeData);
    analytics = {
      score: scoreResult.result,
      keywords: (kwResult.result as { keywords: unknown[] }).keywords?.slice(0, 20),
    };
  }

  res.status(200).json({
    success: true,
    session: {
      sessionId: session.sessionId,
      resumeId: session.resumeId,
      resumeData: session.resumeData,
      chatHistory: session.chatHistory,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    analytics,
  });
});

/**
 * DELETE /api/session/:sessionId/history
 * Clears chat history for a session
 */
router.delete('/:sessionId/history', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string;
  await clearSessionHistory(sessionId);
  res.status(200).json({ success: true, message: 'Chat history cleared' });
});

/**
 * GET /api/session/:sessionId/score
 * Returns candidate scoring details
 */
router.get('/:sessionId/score', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string;
  const session = await getSessionData(sessionId);

  if (!session?.resumeData) {
    res.status(404).json({ error: 'No resume data found for this session' });
    return;
  }

  const scoreResult = candidateScoreTool(session.resumeData);
  res.status(200).json({ success: true, score: scoreResult.result });
});

/**
 * POST /api/session/:sessionId/match-skills
 * Body: { requiredSkills: string[] }
 */
router.post('/:sessionId/match-skills', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string;
  const { requiredSkills } = req.body as { requiredSkills: string[] };

  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    res.status(400).json({ error: 'requiredSkills must be a non-empty array' });
    return;
  }

  const session = await getSessionData(sessionId);
  if (!session?.resumeData) {
    res.status(404).json({ error: 'No resume data found' });
    return;
  }

  const matchResult = skillMatcherTool(session.resumeData, requiredSkills);
  res.status(200).json({ success: true, match: matchResult.result });
});

export default router;
