'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';
import { UploadZone } from '@/components/UploadZone';
import { ChatInterface } from '@/components/ChatInterface';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  const { tabs, createTab, getActiveTab, showDashboard } = useAppStore();
  const activeTab = getActiveTab();

  // Prevent hydration mismatch: Zustand persisted store has different state
  // on the server (empty) vs client (restored from localStorage).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Create a default tab on first load
  useEffect(() => {
    if (mounted && tabs.length === 0) {
      createTab();
    }
  }, [mounted]); // eslint-disable-line

  // Show a blank shell while waiting for client hydration
  if (!mounted) {
    return <div className="flex h-screen w-screen bg-[#020817]" />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#020817]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-blue-600/4 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          {showDashboard ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Dashboard />
            </motion.div>
          ) : activeTab ? (
            <motion.div
              key={activeTab.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {!activeTab.resumeData ? (
                <UploadZone
                  tabId={activeTab.id}
                  sessionId={activeTab.sessionId}
                  onUploaded={() => {}}
                />
              ) : (
                <ChatInterface tabId={activeTab.id} />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full text-slate-600"
            >
              <p>Create a new chat to get started.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
