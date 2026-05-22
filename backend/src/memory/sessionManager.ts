import { ResumeData } from '../types';
import { SessionModel } from '../models';
import { ChatMessage } from '../types';

// ──────────────────────────────────────────────
// In-memory fallback store (when MongoDB is unavailable)
// ──────────────────────────────────────────────
const memoryStore = new Map<string, {
  sessionId: string;
  resumeData?: ResumeData;
  resumeId?: string;
  chatHistory: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}>();

function isMongoConnected(): boolean {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
}

// ──────────────────────────────────────────────
// Session CRUD
// ──────────────────────────────────────────────
export async function getOrCreateSession(sessionId: string) {
  if (isMongoConnected()) {
    let session = await SessionModel.findOne({ sessionId });
    if (!session) {
      session = await SessionModel.create({ sessionId, chatHistory: [] });
    }
    return session;
  }
  // Memory fallback
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, {
      sessionId,
      chatHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return memoryStore.get(sessionId)!;
}

export async function saveSessionResumeData(
  sessionId: string,
  resumeData: ResumeData,
  resumeId: string
) {
  if (isMongoConnected()) {
    await SessionModel.findOneAndUpdate(
      { sessionId },
      { resumeData, resumeId, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return;
  }
  const session = memoryStore.get(sessionId);
  if (session) {
    session.resumeData = resumeData;
    session.resumeId = resumeId;
    session.updatedAt = new Date();
  }
}

export async function addMessageToSession(sessionId: string, message: ChatMessage) {
  if (isMongoConnected()) {
    await SessionModel.findOneAndUpdate(
      { sessionId },
      { $push: { chatHistory: message }, updatedAt: new Date() },
      { upsert: true }
    );
    return;
  }
  const session = memoryStore.get(sessionId);
  if (session) {
    session.chatHistory.push(message);
    session.updatedAt = new Date();
  }
}

export async function getSessionData(sessionId: string) {
  if (isMongoConnected()) {
    return SessionModel.findOne({ sessionId }).lean();
  }
  return memoryStore.get(sessionId) || null;
}

export async function clearSessionHistory(sessionId: string) {
  if (isMongoConnected()) {
    await SessionModel.findOneAndUpdate(
      { sessionId },
      { chatHistory: [], updatedAt: new Date() }
    );
    return;
  }
  const session = memoryStore.get(sessionId);
  if (session) {
    session.chatHistory = [];
  }
}
