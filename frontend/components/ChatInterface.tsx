'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Wifi, WifiOff, RotateCcw, Download, User, Briefcase, GraduationCap, Code2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';
import { ChatBubble } from './ChatBubble';
import { AgentResponse, ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUGGESTED_QUESTIONS = [
  'What are the candidate\'s top technical skills?',
  'Rate this candidate out of 100.',
  'What is their total years of experience?',
  'Which companies have they worked at?',
  'Do they know React and TypeScript?',
  'What certifications do they have?',
];

interface ChatInterfaceProps {
  tabId: string;
}

export function ChatInterface({ tabId }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamMsgIdRef = useRef<string | null>(null);
  const { sendChat } = useApi();

  const {
    tabs,
    addMessage,
    addStreamingPlaceholder,
    updateStreamingMessage,
    finalizeStreamingMessage,
    setSending,
    setStreaming,
  } = useAppStore();

  const tab = tabs.find((t) => t.id === tabId);
  const sessionId = tab?.sessionId || '';
  const messages = tab?.messages || [];
  const isSending = tab?.isSending || false;
  const isStreaming = tab?.isStreaming || false;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── WebSocket handlers ──
  const handleToken = useCallback(
    (token: string) => {
      if (streamMsgIdRef.current) {
        updateStreamingMessage(tabId, streamMsgIdRef.current, token);
      }
    },
    [tabId, updateStreamingMessage]
  );

  const handleStreamEnd = useCallback(
    (response: AgentResponse) => {
      if (streamMsgIdRef.current) {
        finalizeStreamingMessage(tabId, streamMsgIdRef.current, response);
        streamMsgIdRef.current = null;
      }
      setSending(tabId, false);
      setStreaming(tabId, false);
    },
    [tabId, finalizeStreamingMessage, setSending, setStreaming]
  );

  const handleStreamStart = useCallback(() => {
    const msgId = addStreamingPlaceholder(tabId);
    streamMsgIdRef.current = msgId;
  }, [tabId, addStreamingPlaceholder]);

  const handleWsError = useCallback(
    (msg: string) => {
      toast.error(msg);
      setSending(tabId, false);
      setStreaming(tabId, false);
      streamMsgIdRef.current = null;
    },
    [tabId, setSending, setStreaming]
  );

  const { sendChatMessage, isConnected, reconnect } = useWebSocket({
    onToken: handleToken,
    onStreamEnd: handleStreamEnd,
    onStreamStart: handleStreamStart,
    onError: handleWsError,
    onConnected: () => setWsConnected(true),
  });

  useEffect(() => {
    const interval = setInterval(() => setWsConnected(isConnected()), 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending || !tab?.resumeData) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      addMessage(tabId, userMsg);
      setInput('');
      setSending(tabId, true);
      setStreaming(tabId, true);

      // Try WebSocket first, fall back to REST
      const wsOk = sendChatMessage(sessionId, trimmed, uuidv4());
      if (!wsOk) {
        // REST fallback
        try {
          const response = await sendChat(sessionId, trimmed);
          const assistantMsg: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: response.answer,
            timestamp: new Date(),
            structured: response,
          };
          addMessage(tabId, assistantMsg);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Failed to send');
        } finally {
          setSending(tabId, false);
          setStreaming(tabId, false);
        }
      }
    },
    [tabId, sessionId, tab, isSending, sendChatMessage, sendChat, addMessage, setSending, setStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Export chat
  const exportChat = () => {
    const content = messages
      .map((m) => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${tab?.candidateName || 'resume'}.txt`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-500/10 glass">
        <div className="flex items-center gap-3">
          {tab?.candidateName && (
            <>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                {tab.candidateName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{tab.candidateName}</p>
                <p className="text-[10px] text-slate-500">Resume loaded · Score: {tab.score}/100</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* WS status */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium',
            wsConnected
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-red-500/10 border-red-500/25 text-red-400'
          )}>
            {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {wsConnected ? 'Live' : 'Offline'}
          </div>

          {!wsConnected && (
            <button onClick={reconnect} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
              <RotateCcw size={13} />
            </button>
          )}

          <button onClick={exportChat} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors" title="Export chat">
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Quick resume stats */}
      {tab?.resumeData && messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 px-5 py-3 overflow-x-auto border-b border-indigo-500/10"
        >
          {[
            { icon: Briefcase, label: `${tab.resumeData.experience.length} Jobs`, color: 'indigo' },
            { icon: GraduationCap, label: `${tab.resumeData.education.length} Degrees`, color: 'purple' },
            { icon: Code2, label: `${tab.resumeData.skills.length} Skills`, color: 'blue' },
            { icon: User, label: tab.resumeData.email || 'No email', color: 'violet' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-indigo-500/10 text-xs text-slate-400">
              <Icon size={11} className={`text-${color}-400`} />
              {label}
            </div>
          ))}
        </motion.div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <p className="text-slate-500 text-sm">Ask anything about the candidate…</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-3 py-2.5 rounded-xl glass border border-indigo-500/15 hover:border-indigo-500/30 text-slate-400 hover:text-slate-200 text-xs transition-all duration-150 glass-hover"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <ChatBubble key={msg.id} message={msg} isLatest={i === messages.length - 1} />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-5 py-4 border-t border-indigo-500/10 glass">
        <div className={cn(
          'flex items-end gap-3 p-2 rounded-2xl border transition-all duration-200',
          isSending
            ? 'border-indigo-500/40 bg-indigo-500/5'
            : 'border-indigo-500/20 bg-slate-900/50 focus-within:border-indigo-500/50 focus-within:bg-indigo-500/5'
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tab?.resumeData ? 'Ask about the candidate…' : 'Upload a resume first'}
            disabled={!tab?.resumeData || isSending}
            rows={1}
            className="flex-1 bg-transparent text-slate-200 text-sm placeholder-slate-600 resize-none outline-none px-2 py-1.5 max-h-32 overflow-y-auto disabled:opacity-40"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isSending || !tab?.resumeData}
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
              input.trim() && !isSending && tab?.resumeData
                ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 glow-sm'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            )}
          >
            {isSending ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 text-center mt-2">
          Shift+Enter for new line · AI may take a moment to think
        </p>
      </div>
    </div>
  );
}
