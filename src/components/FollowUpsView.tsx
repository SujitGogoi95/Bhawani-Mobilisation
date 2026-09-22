import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  ChevronRight,
  Plus,
  Calendar,
  X,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { FollowUp, User as UserType } from '../types';

interface FollowUpsViewProps {
  currentUser: UserType;
  onSelectCandidate: (candidateId: string) => void;
  presetCandidateId?: string;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  currentUser,
  onSelectCandidate,
  presetCandidateId,
}) => {
  const [filterTab, setFilterTab] = useState<'due_today' | 'overdue' | 'upcoming' | 'completed'>('due_today');
  const [showScheduleModal, setShowScheduleModal] = useState(!!presetCandidateId);
  const [scheduleCandidateId, setScheduleCandidateId] = useState(presetCandidateId || '');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleRemarks, setScheduleRemarks] = useState('');

  const followUps = useMemo(() => {
    return dataStore.getFollowUps(currentUser);
  }, [currentUser]);

  const candidates = useMemo(() => {
    return dataStore.getCandidates(currentUser);
  }, [currentUser]);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((f) => {
      if (filterTab === 'completed') {
        return f.status === 'completed';
      }
      if (f.status === 'completed') return false;

      if (filterTab === 'due_today') {
        return f.followUpDate === todayStr;
      }
      if (filterTab === 'overdue') {
        return f.followUpDate < todayStr;
      }
      if (filterTab === 'upcoming') {
        return f.followUpDate > todayStr;
      }
      return true;
    });
  }, [followUps, filterTab, todayStr]);

  const handleMarkCompleted = (followUpId: string) => {
    const nextDate = prompt('Marked as completed! Would you like to schedule the NEXT follow-up? Enter date (YYYY-MM-DD) or leave empty:');
    let nextRemarks: string | undefined;
    if (nextDate && nextDate.trim()) {
      nextRemarks = prompt('Enter remarks for next follow-up:') || 'Follow-up interaction scheduled';
    }
    dataStore.markFollowUpCompleted(followUpId, nextDate || undefined, nextRemarks);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCandidateId || !scheduleDate) return;

    dataStore.scheduleFollowUp({
      candidateId: scheduleCandidateId,
      followUpDate: scheduleDate,
      remarks: scheduleRemarks.trim() || 'Follow-up interaction scheduled',
    });

    setShowScheduleModal(false);
    setScheduleRemarks('');
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Follow-up Management Queue</h2>
          <p className="text-xs text-slate-500">
            Never miss a candidate interaction • Daily follow-up checklist
          </p>
        </div>

        <button
          onClick={() => {
            setScheduleCandidateId(candidates[0]?.id || '');
            setShowScheduleModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Follow-up</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600 overflow-x-auto">
        <button
          onClick={() => setFilterTab('due_today')}
          className={`px-4 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
            filterTab === 'due_today' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Due Today ({followUps.filter((f) => f.status !== 'completed' && f.followUpDate === todayStr).length})
        </button>
        <button
          onClick={() => setFilterTab('overdue')}
          className={`px-4 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
            filterTab === 'overdue' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Overdue ({followUps.filter((f) => f.status !== 'completed' && f.followUpDate < todayStr).length})
        </button>
        <button
          onClick={() => setFilterTab('upcoming')}
          className={`px-4 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
            filterTab === 'upcoming' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Upcoming ({followUps.filter((f) => f.status !== 'completed' && f.followUpDate > todayStr).length})
        </button>
        <button
          onClick={() => setFilterTab('completed')}
          className={`px-4 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
            filterTab === 'completed' ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Completed ({followUps.filter((f) => f.status === 'completed').length})
        </button>
      </div>

      {/* Follow-up Items List */}
      <div className="space-y-3">
        {filteredFollowUps.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-300">
            <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No follow-ups in this queue.</p>
            <p className="text-xs text-slate-400 mt-1">All planned candidate touchpoints are up to date.</p>
          </div>
        ) : (
          filteredFollowUps.map((fup) => {
            const cleanPhone = fup.candidatePhone.replace(/\D/g, '');
            return (
              <div
                key={fup.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      onClick={() => onSelectCandidate(fup.candidateId)}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer"
                    >
                      {fup.candidateName}
                    </h3>
                    <span className="text-[11px] font-semibold text-indigo-600">
                      {fup.candidateDistrict}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      fup.candidateStatus === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      fup.candidateStatus === 'Interested' ? 'bg-sky-100 text-sky-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {fup.candidateStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">Action:</span> {fup.remarks}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Clock className="w-3 h-3 text-slate-400" /> Due: {fup.followUpDate}
                    </span>
                    <span>Mobiliser: {fup.mobiliserName}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Call</span>
                  </a>

                  <a
                    href={`https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(fup.candidateName)},%20following%20up%20on%20your%20training%20enrolment.`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    title="WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>

                  {fup.status !== 'completed' && (
                    <button
                      onClick={() => handleMarkCompleted(fup.id)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Schedule Follow-up Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleScheduleSubmit}
            className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">Schedule Candidate Follow-up</h4>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Candidate *</label>
              <select
                value={scheduleCandidateId}
                onChange={(e) => setScheduleCandidateId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.candidateId}) - {c.district}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Date *</label>
              <input
                required
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Action / Remarks *
              </label>
              <textarea
                required
                rows={3}
                value={scheduleRemarks}
                onChange={(e) => setScheduleRemarks(e.target.value)}
                placeholder="e.g., Verify Aadhaar card copy and confirm travel arrangement with parents"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
              >
                Schedule Follow-up
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
