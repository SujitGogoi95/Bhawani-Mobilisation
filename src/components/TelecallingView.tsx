import React, { useState, useMemo } from 'react';
import {
  PhoneCall,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  MessageSquare,
  User,
  Filter,
  Download,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { Candidate, CallLog, User as UserType } from '../types';
import { exportCallLogsCSV } from '../utils/exportUtils';

interface TelecallingViewProps {
  currentUser: UserType;
  onSelectCandidate: (candidateId: string) => void;
  presetCandidateId?: string;
}

export const TelecallingView: React.FC<TelecallingViewProps> = ({
  currentUser,
  onSelectCandidate,
  presetCandidateId,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [loggingForCandidate, setLoggingForCandidate] = useState<Candidate | null>(
    presetCandidateId ? dataStore.getCandidateById(presetCandidateId) || null : null
  );

  // Call Logger Form state
  const [callOutcome, setCallOutcome] = useState<CallLog['outcome']>('Interested');
  const [callNotes, setCallNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpRemarks, setFollowUpRemarks] = useState('');

  const candidates = useMemo(() => {
    return dataStore.getCandidates(currentUser);
  }, [currentUser]);

  const allCallLogs = useMemo(() => {
    return dataStore.getCallLogs(currentUser);
  }, [currentUser]);

  const followUps = useMemo(() => {
    return dataStore.getFollowUps(currentUser);
  }, [currentUser]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Candidates categorized for calling queue
  const callingQueue = useMemo(() => {
    return candidates.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.candidateId.toLowerCase().includes(q);
        if (!match) return false;
      }

      const pendingFup = followUps.find((f) => f.candidateId === c.id && f.status !== 'completed');

      if (activeTab === 'today') {
        // Due today or recently contacted needing follow-up
        return pendingFup && pendingFup.followUpDate === todayStr;
      }
      if (activeTab === 'overdue') {
        return pendingFup && pendingFup.followUpDate < todayStr;
      }
      // All calling candidates
      return true;
    });
  }, [candidates, followUps, activeTab, todayStr, searchQuery]);

  const handleOpenCallLogger = (candidate: Candidate) => {
    setLoggingForCandidate(candidate);
    setCallOutcome('Interested');
    setCallNotes('');
    setFollowUpDate('');
    setFollowUpRemarks('');
  };

  const handleSaveCallLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingForCandidate || !callNotes.trim()) return;

    dataStore.logCall({
      candidateId: loggingForCandidate.id,
      outcome: callOutcome,
      notes: callNotes.trim(),
      followUpDate: followUpDate || undefined,
      followUpRemarks: followUpRemarks.trim() || undefined,
    });

    setLoggingForCandidate(null);
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Tele-calling & Lead Outreach</h2>
          <p className="text-xs text-slate-500">
            Systematic candidate outreach, outcome tracking, and follow-up management
          </p>
        </div>

        <button
          onClick={() => exportCallLogsCSV(allCallLogs)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Call Log CSV</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                activeTab === 'today' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Today's Calls ({candidates.filter((c) => followUps.some((f) => f.candidateId === c.id && f.followUpDate === todayStr && f.status !== 'completed')).length})
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                activeTab === 'overdue' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Overdue ({candidates.filter((c) => followUps.some((f) => f.candidateId === c.id && f.followUpDate < todayStr && f.status !== 'completed')).length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                activeTab === 'all' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, phone..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Calling Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {callingQueue.length === 0 ? (
          <div className="col-span-full bg-white p-10 text-center rounded-xl border border-dashed border-slate-300">
            <PhoneCall className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No candidates in this queue.</p>
            <p className="text-xs text-slate-400 mt-1">Switch to "All Candidates" to make proactive calls.</p>
          </div>
        ) : (
          callingQueue.map((cand) => {
            const lastCall = allCallLogs.find((l) => l.candidateId === cand.id);
            const pendingFup = followUps.find((f) => f.candidateId === cand.id && f.status !== 'completed');

            return (
              <div
                key={cand.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-indigo-300 transition-all space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3
                        onClick={() => onSelectCandidate(cand.id)}
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer"
                      >
                        {cand.name}
                      </h3>
                      <p className="font-mono text-[10px] text-slate-400">
                        {cand.candidateId} • {cand.district} ({cand.block})
                      </p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-medium">
                          {cand.project || cand.projectName || cand.programme || 'Unallocated'}
                        </span>
                        {cand.phase && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">
                            {cand.phase}
                          </span>
                        )}
                        {cand.cycle && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">
                            {cand.cycle}
                          </span>
                        )}
                        {(cand.batch || cand.batchName) && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded text-[9px]">
                            {cand.batch || cand.batchName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cand.currentStatus === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      cand.currentStatus === 'Interested' ? 'bg-sky-100 text-sky-800' :
                      cand.currentStatus === 'New Lead' ? 'bg-slate-100 text-slate-800' :
                      'bg-indigo-50 text-indigo-700'
                    }`}>
                      {cand.currentStatus}
                    </span>
                  </div>

                  {/* Previous call info */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Last Call:</span>
                      <span className="font-semibold text-slate-800">
                        {lastCall ? `${lastCall.callDate} (${lastCall.outcome})` : 'Never contacted'}
                      </span>
                    </div>
                    {pendingFup && (
                      <div className="flex items-center justify-between text-[11px] text-amber-700">
                        <span>Follow-up:</span>
                        <span className="font-bold">{pendingFup.followUpDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                  <a
                    href={`tel:${cand.phone.replace(/\D/g, '')}`}
                    onClick={() => handleOpenCallLogger(cand)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>

                  <a
                    href={`https://wa.me/91${cand.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold cursor-pointer"
                    title="WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => handleOpenCallLogger(cand)}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Log Notes
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Call Logger Modal */}
      {loggingForCandidate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSaveCallLog}
            className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Record Tele-call Outcome</h4>
                <p className="text-xs text-slate-500">
                  {loggingForCandidate.name} ({loggingForCandidate.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoggingForCandidate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Outcome Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Call Outcome *</label>
              <select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value as any)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700"
              >
                <option value="Connected">Connected (General conversation)</option>
                <option value="Interested">Interested (Expressed intent to enroll)</option>
                <option value="Confirmed">Confirmed (Ready to join batch)</option>
                <option value="Call Later">Call Later (Requested callback)</option>
                <option value="Not Interested">Not Interested (Declined program)</option>
                <option value="Number Busy">Number Busy</option>
                <option value="Number Not Reachable">Number Not Reachable / Switched Off</option>
                <option value="Wrong Number">Wrong Number</option>
              </select>
            </div>

            {/* Conversation Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conversation Notes & Summary *
              </label>
              <textarea
                required
                rows={3}
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="e.g., Candidate's brother will drop them off. Interested in morning batch."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            {/* Follow-up Section */}
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-xs space-y-2">
              <label className="block font-semibold text-amber-900">
                Schedule Follow-up Date (Optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full p-2 bg-white border border-amber-300 rounded-lg"
              />
              {followUpDate && (
                <input
                  type="text"
                  value={followUpRemarks}
                  onChange={(e) => setFollowUpRemarks(e.target.value)}
                  placeholder="Action notes for follow-up (e.g. Call back after college exam)"
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLoggingForCandidate(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
              >
                Save Call Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
