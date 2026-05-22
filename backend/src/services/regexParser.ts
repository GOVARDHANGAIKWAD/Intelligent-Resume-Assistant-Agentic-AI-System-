import { ResumeData, AgentResponse } from '../types';

// ──────────────────────────────────────────────────────────
// Regex-based fallback resume parser
// Used when OpenAI API is unavailable or key is invalid.
// Extracts structured data from raw text using heuristics.
// ──────────────────────────────────────────────────────────
export function parseResumeWithRegex(rawText: string): ResumeData {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const text = rawText;

  // ── Name: First non-empty line if it looks like a name ──
  const nameLine = lines.find((l) =>
    /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(l) && l.split(' ').length <= 4
  );
  const name = nameLine || lines[0] || '';

  // ── Email ──
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] || '';

  // ── Phone ──
  const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  const phone = phoneMatch?.[0]?.trim() || '';

  // ── Skills ──
  const skillPatterns = [
    /skills?[:\s]+([^\n]+)/gi,
    /technologies?[:\s]+([^\n]+)/gi,
    /technical skills?[:\s]+([^\n]+)/gi,
  ];
  const skillsSet = new Set<string>();
  for (const pattern of skillPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      m[1].split(/[,|•·]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40)
        .forEach((s) => skillsSet.add(s));
    }
  }
  // Escape special regex characters
  function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Also extract known tech keywords
  const techKeywords = [
    'JavaScript','TypeScript','Python','Java','C#','C++','Go','Rust','Ruby','PHP',
    'React','Angular','Vue','Next.js','Node.js','Express','Django','FastAPI','Spring',
    'AWS','GCP','Azure','Docker','Kubernetes','Terraform','Git','CI/CD',
    'MongoDB','PostgreSQL','MySQL','Redis','GraphQL','REST','SQL','NoSQL',
    'Machine Learning','Deep Learning','TensorFlow','PyTorch','NLP','AI',
    'HTML','CSS','Tailwind','SASS','Redux','Zustand',
  ];
  for (const kw of techKeywords) {
    if (new RegExp(escapeRegex(kw), 'i').test(text)) skillsSet.add(kw);
  }

  // ── Education ──
  const educationSectionMatch = text.match(/education[\s\S]*?(?=experience|skills|project|certif|$)/i);
  const educationText = educationSectionMatch?.[0] || '';
  const degreePattern = /(B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|Ph\.?D\.?|Bachelor|Master|Associate)[^,\n]*/gi;
  const degrees = [...educationText.matchAll(degreePattern)].map((m) => ({
    institution: '',
    degree: m[0].trim(),
    field: '',
    startDate: '',
    endDate: '',
  }));

  // ── Experience ──
  const expSectionMatch = text.match(/experience[\s\S]*?(?=education|skills|project|certif|$)/i);
  const expText = expSectionMatch?.[0] || '';
  const companyPattern = /([A-Z][A-Za-z\s&.,]+)\s*[-–|]\s*([A-Za-z\s]+)\s*\(?(20\d{2})[–\-\s]*(20\d{2}|present|current)?\)?/gi;
  const experiences = [...expText.matchAll(companyPattern)].slice(0, 5).map((m) => ({
    company: m[1]?.trim() || '',
    title: m[2]?.trim() || '',
    startDate: m[3] || '',
    endDate: m[4] || 'Present',
    description: '',
    technologies: [],
  }));

  // ── Projects ──
  const projSectionMatch = text.match(/project[\s\S]*?(?=education|experience|certif|$)/i);
  const projects = projSectionMatch
    ? lines
        .filter((l) => l.length > 10 && l.length < 100 && /^[A-Z]/.test(l))
        .slice(0, 4)
        .map((name) => ({ name, description: '', technologies: [] }))
    : [];

  // ── Certifications ──
  const certPattern = /(AWS|Google|Azure|PMP|CPA|CFA|Cisco|Oracle|Salesforce|PMI)[^\n]+certification[^\n]*/gi;
  const certMatches = [...text.matchAll(certPattern)].map((m) => m[0].trim());
  const certSection = text.match(/certif[^\n]*([\s\S]*?)(?=\n\n|\n[A-Z]{4,}|$)/i);
  const certLines = certSection ? certSection[0].split('\n').slice(1).filter((l) => l.trim().length > 5).slice(0, 5) : [];

  // ── Summary ──
  const summaryMatch = text.match(/(summary|objective|profile|about)[:\s]+([\s\S]*?)(?=\n\n|\nexperience|\neducation)/i);
  const summary = summaryMatch?.[2]?.trim().slice(0, 500) || '';

  return {
    name,
    email,
    phone,
    summary,
    skills: [...skillsSet].slice(0, 30),
    education: degrees.slice(0, 4),
    experience: experiences,
    projects: projects.slice(0, 4),
    certifications: [...certMatches, ...certLines].slice(0, 8),
    languages: [],
    rawText,
  };
}

// ──────────────────────────────────────────────────────────
// Rule-based Q&A engine — used when OpenAI key is absent
// or as a fallback on OpenAI errors. Exported so both
// chat.ts and websocket.ts can share the same logic.
// ──────────────────────────────────────────────────────────
export function buildRegexAnswer(question: string, resumeData: ResumeData): AgentResponse {
  const q = question.toLowerCase();
  const rd = resumeData;

  if (/name/.test(q)) {
    return { answer: rd.name ? `The candidate's name is **${rd.name}**.` : 'Name not found in resume.', confidence: rd.name ? 0.98 : 0.1, source: rd.name ? 'resume' : 'not_found', missing_data: rd.name ? [] : ['name'] };
  }
  if (/email/.test(q)) {
    return { answer: rd.email ? `Email: **${rd.email}**` : 'Email not mentioned in resume.', confidence: rd.email ? 0.98 : 0.1, source: rd.email ? 'resume' : 'not_found', missing_data: [] };
  }
  if (/phone/.test(q)) {
    return { answer: rd.phone ? `Phone: **${rd.phone}**` : 'Phone not mentioned in resume.', confidence: rd.phone ? 0.98 : 0.1, source: rd.phone ? 'resume' : 'not_found', missing_data: [] };
  }
  if (/skill|tech|know|expertise|proficien/.test(q)) {
    return { answer: rd.skills.length ? `**Skills (${rd.skills.length} listed):** ${rd.skills.join(', ')}` : 'No skills listed in resume.', confidence: 0.95, source: 'resume', missing_data: [] };
  }
  if (/experience|work|job|company|employer|role/.test(q)) {
    if (!rd.experience.length) return { answer: 'No work experience listed in resume.', confidence: 0.1, source: 'not_found', missing_data: ['experience'] };
    const exp = rd.experience.map((e) => `• **${e.title}** at ${e.company} (${e.startDate}–${e.endDate})`).join('\n');
    return { answer: `**Work Experience:**\n${exp}`, confidence: 0.95, source: 'resume', missing_data: [] };
  }
  if (/education|degree|university|college|school/.test(q)) {
    if (!rd.education.length) return { answer: 'No education listed in resume.', confidence: 0.1, source: 'not_found', missing_data: ['education'] };
    const edu = rd.education.map((e) => `• **${e.degree}** ${e.field ? `in ${e.field}` : ''} from ${e.institution}`).join('\n');
    return { answer: `**Education:**\n${edu}`, confidence: 0.93, source: 'resume', missing_data: [] };
  }
  if (/certif/.test(q)) {
    return { answer: rd.certifications.length ? `**Certifications:** ${rd.certifications.join(', ')}` : 'No certifications listed in resume.', confidence: 0.9, source: 'resume', missing_data: [] };
  }
  if (/project/.test(q)) {
    if (!rd.projects.length) return { answer: 'No projects listed in resume.', confidence: 0.1, source: 'not_found', missing_data: ['projects'] };
    const proj = rd.projects.map((p) => `• **${p.name}**: ${p.description}`).join('\n');
    return { answer: `**Projects:**\n${proj}`, confidence: 0.9, source: 'resume', missing_data: [] };
  }
  if (/score|rate|rating|evaluat|assess/.test(q)) {
    return { answer: `Based on the resume data, this candidate has **${rd.skills.length} skills**, **${rd.experience.length} work experience entries**, and **${rd.education.length} education entries**. Add your OpenAI API key for an AI-powered score.`, confidence: 0.7, source: 'inference', missing_data: [] };
  }
  if (/summary|about|overview/.test(q)) {
    return { answer: rd.summary ? rd.summary : `**${rd.name || 'Candidate'}** has ${rd.experience.length} work experience entries, ${rd.skills.length} skills, and ${rd.education.length} education entries.`, confidence: 0.85, source: 'resume', missing_data: [] };
  }

  // Default
  return {
    answer: `Based on the resume, here is what I found:\n\n**Name:** ${rd.name || 'Not specified'}\n**Email:** ${rd.email || 'Not specified'}\n**Skills:** ${rd.skills.slice(0, 10).join(', ') || 'None listed'}\n**Experience:** ${rd.experience.length} roles\n**Education:** ${rd.education.length} entries`,
    confidence: 0.5,
    source: 'resume',
    missing_data: [],
  };
}
