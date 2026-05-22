'use client';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { getScoreColor } from '@/lib/utils';
import { BarChart2, Award, Briefcase, GraduationCap, Code2, MessageCircle, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { tabs, setShowDashboard } = useAppStore();
  const activeTabs = tabs.filter((t) => t.resumeData);

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold gradient-text">Recruiter Analytics</h2>
            <p className="text-slate-500 text-sm mt-1">{activeTabs.length} candidate{activeTabs.length !== 1 ? 's' : ''} analyzed</p>
          </div>
          <button
            onClick={() => setShowDashboard(false)}
            className="px-4 py-2 rounded-xl glass border border-indigo-500/20 text-slate-400 hover:text-slate-200 text-sm transition-all"
          >
            ← Back to Chat
          </button>
        </div>
      </motion.div>

      {activeTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <BarChart2 size={40} className="mb-3 opacity-30" />
          <p>No candidates analyzed yet.</p>
          <p className="text-sm mt-1">Upload resumes to see analytics here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Candidate cards */}
          {activeTabs.map((tab, i) => {
            const rd = tab.resumeData!;
            const score = tab.score || 0;
            const scoreColor = getScoreColor(score);
            const circumference = 2 * Math.PI * 28;
            const dashOffset = circumference - (score / 100) * circumference;

            return (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-2xl border border-indigo-500/15 p-6"
              >
                {/* Candidate header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    {/* Score ring */}
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg width="64" height="64" className="score-ring">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="5" />
                        <circle
                          cx="32" cy="32" r="28"
                          fill="none"
                          stroke={scoreColor}
                          strokeWidth="5"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold" style={{ color: scoreColor }}>{score}</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{rd.name || 'Unknown'}</h3>
                      <p className="text-sm text-slate-500">{rd.email}</p>
                      {rd.phone && <p className="text-xs text-slate-600">{rd.phone}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 items-end">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border"
                      style={{ color: scoreColor, borderColor: `${scoreColor}40`, background: `${scoreColor}15` }}>
                      Score: {score}/100
                    </span>
                    <span className="text-[10px] text-slate-600">{tab.messages.length} questions asked</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { icon: Briefcase, label: `${rd.experience.length} Jobs`, iconClass: 'text-indigo-400' },
                    { icon: GraduationCap, label: `${rd.education.length} Degrees`, iconClass: 'text-purple-400' },
                    { icon: Code2, label: `${rd.skills.length} Skills`, iconClass: 'text-blue-400' },
                    { icon: User, label: rd.email || 'No email', iconClass: 'text-violet-400' },
                  ].map(({ icon: Icon, label, iconClass }) => (
                    <div key={label} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-indigo-500/10 text-xs text-slate-400">
                      <Icon size={11} className={iconClass} />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Skills cloud */}
                {rd.skills.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                      <Code2 size={11} />Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rd.skills.slice(0, 20).map((skill) => (
                        <span key={skill} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]">
                          {skill}
                        </span>
                      ))}
                      {rd.skills.length > 20 && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-500 text-[11px]">
                          +{rd.skills.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Experience timeline */}
                {rd.experience.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1.5">
                      <Briefcase size={11} />Experience
                    </p>
                    <div className="space-y-2">
                      {rd.experience.slice(0, 3).map((exp, j) => (
                        <div key={j} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-slate-200 text-xs font-medium truncate">{exp.title} @ {exp.company}</p>
                            <p className="text-slate-600 text-[10px]">{exp.startDate} – {exp.endDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Comparison table (if multiple candidates) */}
          {activeTabs.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: activeTabs.length * 0.08 }}
              className="glass rounded-2xl border border-indigo-500/15 p-6"
            >
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-400" />
                Candidate Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-2 text-slate-500 font-medium">Candidate</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Score</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Skills</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Experience</th>
                      <th className="text-center py-2 text-slate-500 font-medium">Education</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTabs.map((tab) => (
                      <tr key={tab.id} className="border-b border-slate-800/50 hover:bg-white/2">
                        <td className="py-2.5 text-slate-300 font-medium">{tab.resumeData?.name || 'Unknown'}</td>
                        <td className="py-2.5 text-center">
                          <span className="font-bold" style={{ color: getScoreColor(tab.score || 0) }}>
                            {tab.score || 0}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-slate-400">{tab.resumeData?.skills.length}</td>
                        <td className="py-2.5 text-center text-slate-400">{tab.resumeData?.experience.length} roles</td>
                        <td className="py-2.5 text-center text-slate-400">{tab.resumeData?.education.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
