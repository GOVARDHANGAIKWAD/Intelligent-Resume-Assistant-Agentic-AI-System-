'use client';
import { useCallback } from 'react';
import { API_BASE } from '@/lib/utils';
import { ResumeData, AgentResponse } from '@/types';

export function useApi() {
  // ── Upload resume ──
  const uploadResume = useCallback(
    async (file: File, sessionId: string): Promise<{
      success: boolean;
      sessionId: string;
      resumeId: string;
      candidateName: string;
      score: number;
      resumeData: ResumeData;
    }> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const res = await fetch(`${API_BASE}/api/upload-resume`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      return res.json();
    },
    []
  );

  // ── REST chat fallback ──
  const sendChat = useCallback(
    async (sessionId: string, message: string): Promise<AgentResponse> => {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Chat failed');
      }

      const data = await res.json();
      return data.response as AgentResponse;
    },
    []
  );

  // ── Get session data ──
  const getSession = useCallback(async (sessionId: string) => {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
    if (!res.ok) throw new Error('Session not found');
    return res.json();
  }, []);

  // ── Match skills ──
  const matchSkills = useCallback(
    async (sessionId: string, requiredSkills: string[]) => {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/match-skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredSkills }),
      });
      if (!res.ok) throw new Error('Skill match failed');
      return res.json();
    },
    []
  );

  // ── Health check ──
  const healthCheck = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return { uploadResume, sendChat, getSession, matchSkills, healthCheck };
}
