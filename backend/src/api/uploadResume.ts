import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
// pdf-parse v1.1.1 exports a direct CJS function
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  dataBuffer: Buffer,
  options?: Record<string, unknown>
) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
import { resumeParserTool, candidateScoreTool } from '../tools';
import { saveSessionResumeData } from '../memory/sessionManager';
import { ResumeModel } from '../models';
import { parseResumeWithRegex } from '../services/regexParser';
import { ResumeData } from '../types';

const router = Router();

// ── Multer: accept PDF + TXT, max 10MB, store in memory ──
const storage = multer.memoryStorage(); // use memory to avoid file path issues
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'application/octet-stream'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ext === '.pdf' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  },
});

/**
 * POST /api/upload-resume
 * Accepts multipart/form-data: file (PDF|TXT) + sessionId (optional)
 */
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send a PDF or TXT file in the "file" field.' });
      return;
    }

    const sessionId: string = (req.body?.sessionId as string) || uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPdf = req.file.mimetype === 'application/pdf' || ext === '.pdf';

    // ── Extract raw text ──
    let rawText = '';
    if (isPdf) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        rawText = pdfData.text;
      } catch (pdfErr) {
        console.error('PDF parse error:', pdfErr);
        res.status(422).json({ error: 'Failed to read PDF. Try uploading a TXT version of the resume.' });
        return;
      }
    } else {
      rawText = req.file.buffer.toString('utf-8');
    }

    if (!rawText || rawText.trim().length < 30) {
      res.status(422).json({ error: 'Could not extract readable text from this file. Make sure it is a text-based PDF.' });
      return;
    }

    // ── Parse resume — AI if key available, regex fallback otherwise ──
    let resumeData: ResumeData;
    const hasOpenAIKey = process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here' &&
      process.env.OPENAI_API_KEY.startsWith('sk-');

    if (hasOpenAIKey) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const parseResult = await resumeParserTool(rawText, openai);
      if (!parseResult.success) {
        console.warn('OpenAI parse failed, falling back to regex:', parseResult.error);
        resumeData = parseResumeWithRegex(rawText);
      } else {
        resumeData = parseResult.result as ResumeData;
      }
    } else {
      console.log('No OpenAI key — using regex parser');
      resumeData = parseResumeWithRegex(rawText);
    }

    // Ensure rawText is on the object
    resumeData.rawText = rawText;

    // ── Score candidate ──
    const scoreResult = candidateScoreTool(resumeData);
    const score = (scoreResult.result as import('../types').CandidateScore).overall;

    // ── Persist to DB (non-fatal if unavailable) ──
    let resumeId = uuidv4();
    try {
      const saved = await ResumeModel.create({
        sessionId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        data: resumeData,
        rawText,
        score,
      });
      resumeId = (saved._id as { toString(): string }).toString();
    } catch {
      // DB unavailable — continue in-memory only
    }

    await saveSessionResumeData(sessionId, resumeData, resumeId);

    console.log(`✅ Resume parsed: ${resumeData.name} | score: ${score} | session: ${sessionId}`);

    res.status(200).json({
      success: true,
      sessionId,
      resumeId,
      candidateName: resumeData.name || 'Unknown',
      score,
      resumeData,
      parsedWith: hasOpenAIKey ? 'openai' : 'regex',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Upload error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
