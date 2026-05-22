import mongoose, { Schema, Document } from 'mongoose';
import { ResumeData, ChatMessage } from '../types';

// ──────────────────────────────────────────────
// Resume Schema
// ──────────────────────────────────────────────
export interface IResume extends Document {
  sessionId: string;
  filename: string;
  mimeType: string;
  data: ResumeData;
  rawText: string;
  score: number;
  uploadedAt: Date;
}

const ResumeSchema = new Schema<IResume>({
  sessionId: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  rawText: { type: String, required: true },
  score: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
});

// ──────────────────────────────────────────────
// Session / Chat History Schema
// ──────────────────────────────────────────────
export interface ISession extends Document {
  sessionId: string;
  resumeId?: string;
  resumeData?: ResumeData;
  chatHistory: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  structured: { type: Schema.Types.Mixed },
});

const SessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    resumeId: { type: String },
    resumeData: { type: Schema.Types.Mixed },
    chatHistory: [ChatMessageSchema],
  },
  { timestamps: true }
);

export const ResumeModel = mongoose.model<IResume>('Resume', ResumeSchema);
export const SessionModel = mongoose.model<ISession>('Session', SessionSchema);
