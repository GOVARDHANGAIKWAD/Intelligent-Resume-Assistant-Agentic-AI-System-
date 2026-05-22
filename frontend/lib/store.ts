import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ResumeData, CandidateScore, AgentResponse } from '@/types';

// ─────────────────────────────────────────────
// Chat Tab type
// ─────────────────────────────────────────────
export interface ChatTab {
  id: string;
  label: string;
  sessionId: string;
  resumeData?: ResumeData;
  candidateName?: string;
  score?: number;
  messages: ChatMessage[];
  isUploading: boolean;
  isSending: boolean;
  isStreaming: boolean;
  createdAt: Date;
}

interface AppState {
  // Tabs
  tabs: ChatTab[];
  activeTabId: string | null;

  // Actions
  createTab: () => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getActiveTab: () => ChatTab | undefined;

  // Resume
  setResumeData: (tabId: string, data: ResumeData, sessionId: string, name: string, score: number) => void;

  // Messages
  addMessage: (tabId: string, message: ChatMessage) => void;
  updateStreamingMessage: (tabId: string, messageId: string, token: string) => void;
  finalizeStreamingMessage: (tabId: string, messageId: string, response: AgentResponse) => void;
  addStreamingPlaceholder: (tabId: string) => string;

  // Status flags
  setUploading: (tabId: string, val: boolean) => void;
  setSending: (tabId: string, val: boolean) => void;
  setStreaming: (tabId: string, val: boolean) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;

  // Dashboard
  showDashboard: boolean;
  setShowDashboard: (val: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      sidebarOpen: true,
      showDashboard: false,

      createTab: () => {
        const id = uuidv4();
        const sessionId = uuidv4();
        const newTab: ChatTab = {
          id,
          label: 'New Chat',
          sessionId,
          messages: [],
          isUploading: false,
          isSending: false,
          isStreaming: false,
          createdAt: new Date(),
        };
        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (tabId) => {
        set((s) => {
          const remaining = s.tabs.filter((t) => t.id !== tabId);
          const activeTabId =
            s.activeTabId === tabId
              ? remaining[remaining.length - 1]?.id ?? null
              : s.activeTabId;
          return { tabs: remaining, activeTabId };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
      },

      setResumeData: (tabId, data, sessionId, name, score) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, resumeData: data, sessionId, candidateName: name, score, label: name || 'Resume Chat' }
              : t
          ),
        }));
      },

      addMessage: (tabId, message) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, messages: [...t.messages, message] } : t
          ),
        }));
      },

      addStreamingPlaceholder: (tabId) => {
        const msgId = uuidv4();
        const placeholder: ChatMessage = {
          id: msgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
          streamBuffer: '',
        };
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, messages: [...t.messages, placeholder] } : t
          ),
        }));
        return msgId;
      },

      updateStreamingMessage: (tabId, messageId, token) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId
                      ? { ...m, streamBuffer: (m.streamBuffer || '') + token }
                      : m
                  ),
                }
              : t
          ),
        }));
      },

      finalizeStreamingMessage: (tabId, messageId, response) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId
                      ? {
                          ...m,
                          content: response.answer,
                          structured: response,
                          isStreaming: false,
                          streamBuffer: undefined,
                        }
                      : m
                  ),
                }
              : t
          ),
        }));
      },

      setUploading: (tabId, val) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isUploading: val } : t)),
        })),

      setSending: (tabId, val) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isSending: val } : t)),
        })),

      setStreaming: (tabId, val) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isStreaming: val } : t)),
        })),

      setSidebarOpen: (val) => set({ sidebarOpen: val }),
      setShowDashboard: (val) => set({ showDashboard: val }),
    }),
    {
      name: 'resume-assistant-store',
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({
          ...t,
          isUploading: false,
          isSending: false,
          isStreaming: false,
        })),
        activeTabId: state.activeTabId,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
