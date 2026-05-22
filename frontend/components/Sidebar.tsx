'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, X, ChevronLeft, ChevronRight, Trash2, BarChart2, Brain } from 'lucide-react';
import { useAppStore, ChatTab } from '@/lib/store';
import { cn, truncate, formatDate } from '@/lib/utils';

export function Sidebar() {
  const { tabs, activeTabId, sidebarOpen, createTab, closeTab, setActiveTab, setSidebarOpen, setShowDashboard } = useAppStore();

  return (
    <AnimatePresence>
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="relative flex-shrink-0 overflow-hidden h-full"
      >
        <div className="w-[260px] h-full flex flex-col glass border-r border-indigo-500/10">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-indigo-500/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center glow-sm">
                <Brain size={14} className="text-white" />
              </div>
              <span className="font-semibold text-sm gradient-text">Resume AI</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-3 py-3">
            <button
              onClick={() => createTab()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 text-sm font-medium transition-all duration-200 group"
            >
              <Plus size={15} className="group-hover:rotate-90 transition-transform duration-200" />
              New Chat
            </button>
          </div>

          {/* Tabs list */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {tabs.length === 0 && (
              <p className="text-center text-xs text-slate-600 mt-8 px-4">
                Start by creating a new chat and uploading a resume.
              </p>
            )}
            <AnimatePresence>
              {[...tabs].reverse().map((tab: ChatTab) => (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Use div instead of button to avoid invalid <button> inside <button> nesting */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setActiveTab(tab.id); setShowDashboard(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActiveTab(tab.id); setShowDashboard(false); } }}
                    className={cn(
                      'w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left text-xs transition-all duration-150 group relative cursor-pointer',
                      activeTabId === tab.id
                        ? 'bg-indigo-500/15 border border-indigo-500/30 text-slate-200'
                        : 'text-slate-400 hover:bg-white/5 border border-transparent'
                    )}
                  >
                    <MessageSquare size={13} className="flex-shrink-0 mt-0.5 text-indigo-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{tab.label}</div>
                      <div className="text-slate-600 text-[10px] mt-0.5">
                        {tab.messages.length} messages
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all"
                      aria-label="Close tab"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Footer — Analytics link */}
          <div className="px-3 py-3 border-t border-indigo-500/10">
            <button
              onClick={() => setShowDashboard(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs transition-colors"
            >
              <BarChart2 size={13} />
              Recruiter Analytics
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Sidebar toggle when closed */}
      {!sidebarOpen && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-4 z-20 p-2 rounded-lg glass border border-indigo-500/20 text-slate-400 hover:text-slate-200 hover:border-indigo-500/40 transition-all"
        >
          <ChevronRight size={15} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
