import OpenAI from 'openai';
import { ResumeData, AgentResponse, ChatMessage } from '../types';
import { skillMatcherTool, keywordExtractorTool, candidateScoreTool } from '../tools';

// ──────────────────────────────────────────────
// System prompt — enforces grounded hiring assistant behavior
// ──────────────────────────────────────────────
function buildSystemPrompt(resumeData: ResumeData): string {
  return `You are an intelligent hiring assistant AI. Your ONLY job is to answer questions about the candidate's resume.

STRICT RULES:
1. NEVER hallucinate or fabricate information not in the resume.
2. If information is missing, say "Not mentioned in resume" with confidence ≤ 0.2.
3. Only use data from the provided resume context below.
4. You are NOT a general-purpose assistant. Refuse off-topic questions politely.
5. Always respond with a valid JSON object matching this EXACT schema:

{
  "answer": "Your detailed answer here",
  "confidence": 0.0-1.0,
  "source": "resume | inference | not_found",
  "missing_data": ["list of missing fields if any"],
  "tool_used": "optional tool name used"
}

CONFIDENCE GUIDE:
- 0.9-1.0 = Directly stated in resume
- 0.6-0.9 = Strongly inferred from resume context
- 0.3-0.6 = Weakly inferred
- 0.0-0.3 = Not found / guessing

RESUME DATA:
---
Name: ${resumeData.name || 'Not provided'}
Email: ${resumeData.email || 'Not provided'}
Phone: ${resumeData.phone || 'Not provided'}
Summary: ${resumeData.summary || 'Not provided'}
Skills: ${resumeData.skills.join(', ') || 'None listed'}
Experience: ${JSON.stringify(resumeData.experience, null, 2)}
Education: ${JSON.stringify(resumeData.education, null, 2)}
Projects: ${JSON.stringify(resumeData.projects, null, 2)}
Certifications: ${resumeData.certifications.join(', ') || 'None listed'}
Languages: ${resumeData.languages.join(', ') || 'Not specified'}
---`;
}

// ──────────────────────────────────────────────
// Intent Detection — decides if tools are needed
// ──────────────────────────────────────────────
function detectIntent(question: string): {
  needsSkillMatch: boolean;
  needsScore: boolean;
  needsKeywords: boolean;
  requiredSkills: string[];
} {
  const q = question.toLowerCase();

  const skillKeywords = ['skill', 'know', 'experience with', 'proficient', 'expertise', 'can they', 'does she', 'does he', 'match'];
  const scoreKeywords = ['score', 'rate', 'rating', 'rank', 'evaluate', 'assess', 'grade', 'overall'];
  const keywordKeywords = ['keyword', 'ats', 'top skills', 'key terms', 'buzzword'];

  const needsSkillMatch = skillKeywords.some((k) => q.includes(k));
  const needsScore = scoreKeywords.some((k) => q.includes(k));
  const needsKeywords = keywordKeywords.some((k) => q.includes(k));

  // Extract required skills from question (e.g. "do they know React and Python?")
  const skillPattern = /\b(react|python|java|node|aws|docker|kubernetes|sql|typescript|javascript|go|rust|c\+\+|machine learning|ml|ai|devops|kubernetes|angular|vue|mongodb|postgres|redis|graphql|rest|api)\b/gi;
  const requiredSkills = [...new Set(question.match(skillPattern) || [])];

  return { needsSkillMatch, needsScore, needsKeywords, requiredSkills };
}

// ──────────────────────────────────────────────
// Hallucination Guard — validates response before sending
// ──────────────────────────────────────────────
function validateResponse(response: AgentResponse, resumeData: ResumeData): AgentResponse {
  // If confidence is high but source says not_found — fix it
  if (response.source === 'not_found' && response.confidence > 0.5) {
    response.confidence = 0.2;
  }

  // If answer mentions a company/skill not in resume with high confidence — reduce confidence
  const resumeText = resumeData.rawText.toLowerCase();
  const answer = response.answer.toLowerCase();

  // Check for potential fabricated company names
  const companyPattern = /at (\w+),? (?:he|she|they|the candidate)/gi;
  const mentionedCompanies = [...answer.matchAll(companyPattern)].map((m) => m[1].toLowerCase());
  const hasUnverifiedCompany = mentionedCompanies.some(
    (c) => c.length > 3 && !resumeText.includes(c)
  );

  if (hasUnverifiedCompany && response.confidence > 0.7) {
    response.confidence = Math.min(response.confidence, 0.65);
    response.source = 'inference';
  }

  return response;
}

// ──────────────────────────────────────────────
// Streaming Agent Orchestrator
// ──────────────────────────────────────────────
export async function runAgentStreaming(params: {
  question: string;
  resumeData: ResumeData;
  chatHistory: ChatMessage[];
  openai: OpenAI;
  onToken: (token: string) => void;
  onComplete: (response: AgentResponse) => void;
  onError: (error: string) => void;
}): Promise<void> {
  const { question, resumeData, chatHistory, openai, onToken, onComplete, onError } = params;

  try {
    // Step 1: Detect intent and run tools
    const intent = detectIntent(question);
    let toolContext = '';
    let toolUsed: string | undefined;

    if (intent.needsSkillMatch && intent.requiredSkills.length > 0) {
      const skillResult = skillMatcherTool(resumeData, intent.requiredSkills);
      if (skillResult.success) {
        const sm = skillResult.result as import('../types').SkillMatch;
        toolContext += `\n[SKILL MATCH RESULT]: Matched ${sm.percentage}% — Matched: ${sm.matched.join(', ')} | Missing: ${sm.missing.join(', ')}`;
        toolUsed = 'skill_matcher';
      }
    }

    if (intent.needsScore) {
      const scoreResult = candidateScoreTool(resumeData);
      if (scoreResult.success) {
        const sc = scoreResult.result as import('../types').CandidateScore;
        toolContext += `\n[CANDIDATE SCORE RESULT]: Overall: ${sc.overall}/100 | Experience: ${sc.experience} | Skills: ${sc.skills} | Education: ${sc.education} | Communication: ${sc.communication}`;
        toolUsed = 'candidate_score';
      }
    }

    if (intent.needsKeywords) {
      const kwResult = keywordExtractorTool(resumeData);
      if (kwResult.success) {
        const kw = kwResult.result as { keywords: { word: string; frequency: number }[] };
        const topKw = kw.keywords.slice(0, 15).map((k) => k.word).join(', ');
        toolContext += `\n[KEYWORD EXTRACTION]: Top keywords: ${topKw}`;
        toolUsed = 'keyword_extractor';
      }
    }

    // Step 2: Build messages for LLM
    const systemPrompt = buildSystemPrompt(resumeData);
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add last 6 turns of history for context window optimization
    const recentHistory = chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add tool context + current question
    const userContent = toolContext
      ? `${question}\n\nTool Results:${toolContext}`
      : question;

    messages.push({ role: 'user', content: userContent });

    // Step 3: Stream response
    let fullContent = '';
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages,
      temperature: 0.1,
      max_tokens: 800,
      stream: true,
      response_format: { type: 'json_object' },
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullContent += token;
        onToken(token);
      }
    }

    // Step 4: Parse and validate
    let parsed: AgentResponse;
    try {
      parsed = JSON.parse(fullContent);
    } catch {
      // Fallback if JSON is malformed
      parsed = {
        answer: fullContent || 'Unable to process response.',
        confidence: 0.5,
        source: 'inference',
        missing_data: [],
      };
    }

    if (toolUsed) parsed.tool_used = toolUsed;

    // Step 5: Hallucination guard
    const validated = validateResponse(parsed, resumeData);
    onComplete(validated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    onError(message);
  }
}

// ──────────────────────────────────────────────
// Non-streaming version for REST fallback
// ──────────────────────────────────────────────
export async function runAgent(params: {
  question: string;
  resumeData: ResumeData;
  chatHistory: ChatMessage[];
  openai: OpenAI;
}): Promise<AgentResponse> {
  return new Promise((resolve, reject) => {
    let tokens = '';
    runAgentStreaming({
      ...params,
      onToken: (t) => { tokens += t; },
      onComplete: resolve,
      onError: reject,
    });
  });
}
