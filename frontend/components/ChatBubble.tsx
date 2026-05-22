'use client';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Shield, Wrench, AlertTriangle } from 'lucide-react';
import { ChatMessage, AgentResponse } from '@/types';
import { cn, formatDate, formatConfidence, getConfidenceColor, getSourceBadgeStyle } from '@/lib/utils';

interface ChatBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export function ChatBubble({ message, isLatest }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const displayContent = isStreaming ? (message.streamBuffer || '') : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mt-0.5',
        isUser
          ? 'bg-gradient-to-br from-violet-500 to-purple-600'
          : 'bg-gradient-to-br from-indigo-500 to-blue-600'
      )}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1.5 max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-to-br from-indigo-600/80 to-violet-600/80 text-white rounded-tr-sm border border-indigo-500/30'
            : 'glass text-slate-200 rounded-tl-sm'
        )}>
          {isUser ? (
            <p>{displayContent}</p>
          ) : (
            <div className={cn(
              'prose prose-invert prose-sm max-w-none',
              isStreaming && displayContent ? 'typing-cursor' : ''
            )}>
              {isStreaming && !displayContent ? (
                <TypingIndicator />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* Structured response metadata */}
        {!isUser && !isStreaming && message.structured && (
          <StructuredMetadata response={message.structured} />
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-600 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDate(message.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}

function StructuredMetadata({ response }: { response: AgentResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-wrap gap-1.5 px-1"
    >
      {/* Confidence */}
      <span className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium',
        'bg-slate-900/60 border-slate-700/50',
        getConfidenceColor(response.confidence)
      )}>
        <Shield size={9} />
        {formatConfidence(response.confidence)} confidence
      </span>

      {/* Source */}
      <span className={cn(
        'px-2 py-0.5 rounded-full border text-[10px] font-medium',
        getSourceBadgeStyle(response.source)
      )}>
        {response.source === 'resume' ? '📄 From resume' : response.source === 'inference' ? '🔍 Inferred' : '❓ Not found'}
      </span>

      {/* Tool used */}
      {response.tool_used && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border bg-purple-500/10 border-purple-500/30 text-purple-300 text-[10px] font-medium">
          <Wrench size={9} />
          {response.tool_used.replace('_', ' ')}
        </span>
      )}

      {/* Missing data */}
      {response.missing_data && response.missing_data.length > 0 && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-300 text-[10px]">
          <AlertTriangle size={9} />
          Missing: {response.missing_data.join(', ')}
        </span>
      )}
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="dot-pulse flex gap-1.5 py-1">
      <span />
      <span />
      <span />
    </div>
  );
}
