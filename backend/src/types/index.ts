// ──────────────────────────────────────────────
// All shared TypeScript types for the backend
// ──────────────────────────────────────────────

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  summary: string;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: string[];
  languages: string[];
  rawText: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface AgentResponse {
  answer: string;
  confidence: number;
  source: 'resume' | 'inference' | 'not_found';
  missing_data: string[];
  tool_used?: string;
  thinking?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  structured?: AgentResponse;
}

export interface Session {
  sessionId: string;
  resumeId?: string;
  resumeData?: ResumeData;
  chatHistory: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  result: unknown;
  error?: string;
}

export interface CandidateScore {
  overall: number;
  experience: number;
  skills: number;
  education: number;
  communication: number;
  breakdown: Record<string, number>;
}

export interface SkillMatch {
  required: string[];
  matched: string[];
  missing: string[];
  percentage: number;
}
