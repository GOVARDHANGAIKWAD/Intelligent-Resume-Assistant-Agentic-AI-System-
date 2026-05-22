'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadZoneProps {
  tabId: string;
  sessionId: string;
  onUploaded: () => void;
}

export function UploadZone({ tabId, sessionId, onUploaded }: UploadZoneProps) {
  const { uploadResume } = useApi();
  const { setResumeData, setUploading } = useAppStore();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      setStatus('uploading');
      setProgress(0);
      setUploading(tabId, true);

      // Animate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => (p < 85 ? p + Math.random() * 12 : p));
      }, 300);

      try {
        const result = await uploadResume(file, sessionId);
        clearInterval(progressInterval);
        setProgress(100);

        setResumeData(tabId, result.resumeData, result.sessionId, result.candidateName, result.score);
        setStatus('success');
        toast.success(`Resume parsed! Candidate: ${result.candidateName}`);
        setTimeout(onUploaded, 1200);
      } catch (err: unknown) {
        clearInterval(progressInterval);
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setErrorMsg(msg);
        setStatus('error');
        toast.error(msg);
      } finally {
        setUploading(tabId, false);
      }
    },
    [tabId, sessionId, uploadResume, setResumeData, setUploading, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: status === 'uploading',
  });

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Powered by GPT-4o Agent System
        </div>
        <h1 className="text-4xl font-bold gradient-text mb-3">Resume Intelligence</h1>
        <p className="text-slate-400 text-base max-w-md">
          Upload a resume and ask anything. The AI agent extracts structured data,
          uses tools intelligently, and never hallucinates.
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg"
      >
        <div
          {...getRootProps()}
          className={cn(
            'relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300',
            isDragActive
              ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]'
              : 'border-indigo-500/25 bg-slate-900/40 hover:border-indigo-500/50 hover:bg-indigo-500/5',
            status === 'uploading' && 'pointer-events-none'
          )}
        >
          <input {...getInputProps()} />

          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className={cn(
                  'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300',
                  isDragActive ? 'bg-indigo-500/30' : 'bg-indigo-500/10'
                )}>
                  <Upload size={28} className={isDragActive ? 'text-indigo-300' : 'text-indigo-500'} />
                </div>
                <p className="text-slate-200 font-semibold text-lg mb-1">
                  {isDragActive ? 'Drop it here!' : 'Drop your resume here'}
                </p>
                <p className="text-slate-500 text-sm mb-4">or click to browse files</p>
                <div className="flex items-center justify-center gap-3">
                  {['PDF', 'TXT'].map((ext) => (
                    <span key={ext} className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono">
                      .{ext.toLowerCase()}
                    </span>
                  ))}
                  <span className="text-slate-600 text-xs">Max 10 MB</span>
                </div>
              </motion.div>
            )}

            {status === 'uploading' && (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-indigo-500/10">
                  <Loader2 size={28} className="text-indigo-400 animate-spin" />
                </div>
                <p className="text-slate-200 font-semibold mb-1">
                  {selectedFile?.name && truncate(selectedFile.name, 30)}
                </p>
                <p className="text-slate-500 text-sm mb-4">Parsing with AI agent…</p>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-indigo-400 text-xs mt-2">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
                  <CheckCircle size={28} className="text-emerald-400" />
                </div>
                <p className="text-emerald-300 font-semibold text-lg">Resume Parsed!</p>
                <p className="text-slate-500 text-sm mt-1">Opening chat…</p>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-500/10">
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <p className="text-red-300 font-semibold mb-1">Upload Failed</p>
                <p className="text-slate-500 text-sm mb-4">{errorMsg}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setStatus('idle'); setErrorMsg(''); }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap gap-2 justify-center mt-8"
      >
        {[
          '🧠 Agentic AI',
          '🛡️ Anti-hallucination',
          '📊 Candidate Scoring',
          '🔍 Skill Matching',
          '⚡ Real-time Streaming',
        ].map((f) => (
          <span key={f} className="px-3 py-1.5 rounded-full glass border border-indigo-500/15 text-slate-400 text-xs">
            {f}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
