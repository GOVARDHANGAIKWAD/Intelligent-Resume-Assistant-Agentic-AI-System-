import { ResumeData, ToolResult, CandidateScore, SkillMatch } from '../types';

// ──────────────────────────────────────────────
// Tool: Resume Parser
// Extracts structured data from raw resume text via OpenAI
// ──────────────────────────────────────────────
export async function resumeParserTool(
  rawText: string,
  openai: import('openai').default
): Promise<ToolResult> {
  const prompt = `You are a precise resume parser. Extract ALL information from this resume text.
Return a STRICT JSON object matching this schema exactly (no extra fields, no markdown, raw JSON only):

{
  "name": "string",
  "email": "string",
  "phone": "string",
  "summary": "string",
  "skills": ["array of skills"],
  "education": [{"institution":"","degree":"","field":"","startDate":"","endDate":"","gpa":""}],
  "experience": [{"company":"","title":"","startDate":"","endDate":"","description":"","technologies":[]}],
  "projects": [{"name":"","description":"","technologies":[],"url":""}],
  "certifications": ["array"],
  "languages": ["array"],
  "rawText": ""
}

If any field is not found, use empty string or empty array. Never invent data.

Resume text:
"""
${rawText.slice(0, 8000)}
"""`;

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0].message.content || '{}';
    const parsed: ResumeData = JSON.parse(content);
    parsed.rawText = rawText;

    return { toolName: 'resume_parser', success: true, result: parsed };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { toolName: 'resume_parser', success: false, result: null, error };
  }
}

// ──────────────────────────────────────────────
// Tool: Skill Matcher
// Matches candidate skills against a required skill set
// ──────────────────────────────────────────────
export function skillMatcherTool(
  resumeData: ResumeData,
  requiredSkills: string[]
): ToolResult {
  const candidateSkills = resumeData.skills.map((s) => s.toLowerCase().trim());
  const required = requiredSkills.map((s) => s.toLowerCase().trim());

  const matched = required.filter((skill) =>
    candidateSkills.some(
      (cs) => cs.includes(skill) || skill.includes(cs)
    )
  );
  const missing = required.filter((skill) => !matched.includes(skill));
  const percentage = required.length > 0 ? Math.round((matched.length / required.length) * 100) : 0;

  const result: SkillMatch = {
    required: requiredSkills,
    matched: matched.map((s) => requiredSkills[required.indexOf(s)] || s),
    missing: missing.map((s) => requiredSkills[required.indexOf(s)] || s),
    percentage,
  };

  return { toolName: 'skill_matcher', success: true, result };
}

// ──────────────────────────────────────────────
// Tool: Keyword Extractor
// Extracts top keywords from resume for ATS analysis
// ──────────────────────────────────────────────
export function keywordExtractorTool(resumeData: ResumeData): ToolResult {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been',
    'are', 'was', 'were', 'will', 'can', 'has', 'had', 'not', 'but', 'all',
    'our', 'your', 'their', 'they', 'which', 'who', 'what', 'how', 'when',
    'where', 'also', 'into', 'more', 'its', 'than', 'then', 'them', 'these',
  ]);

  const allText = [
    resumeData.summary,
    ...resumeData.skills,
    ...resumeData.experience.map((e) => `${e.title} ${e.description} ${e.technologies.join(' ')}`),
    ...resumeData.projects.map((p) => `${p.name} ${p.description} ${p.technologies.join(' ')}`),
  ].join(' ');

  const wordFreq: Record<string, number> = {};
  allText
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });

  const keywords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([word, freq]) => ({ word, frequency: freq }));

  return { toolName: 'keyword_extractor', success: true, result: { keywords } };
}

// ──────────────────────────────────────────────
// Tool: Candidate Score
// Scores candidate across multiple dimensions
// ──────────────────────────────────────────────
export function candidateScoreTool(resumeData: ResumeData): ToolResult {
  // Experience score: based on number of jobs & descriptions
  const experienceScore = Math.min(
    100,
    resumeData.experience.length * 20 +
      resumeData.experience.reduce((acc, e) => acc + Math.min(e.description.length / 100, 10), 0)
  );

  // Skills score: based on skill count
  const skillsScore = Math.min(100, resumeData.skills.length * 5);

  // Education score
  const educationScore = Math.min(
    100,
    resumeData.education.length * 30 +
      (resumeData.education.some((e) =>
        ['master', 'phd', 'msc', 'mba'].some((d) => e.degree.toLowerCase().includes(d))
      )
        ? 20
        : 0)
  );

  // Communication: summary quality
  const communicationScore = Math.min(
    100,
    resumeData.summary.length > 50 ? 60 : 30 + resumeData.certifications.length * 10
  );

  const overall = Math.round(
    (experienceScore * 0.35 + skillsScore * 0.3 + educationScore * 0.2 + communicationScore * 0.15)
  );

  const result: CandidateScore = {
    overall,
    experience: Math.round(experienceScore),
    skills: Math.round(skillsScore),
    education: Math.round(educationScore),
    communication: Math.round(communicationScore),
    breakdown: {
      'Experience Weight': 35,
      'Skills Weight': 30,
      'Education Weight': 20,
      'Communication Weight': 15,
    },
  };

  return { toolName: 'candidate_score', success: true, result };
}
