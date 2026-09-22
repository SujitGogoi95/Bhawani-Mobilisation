import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { getAllStates } from '../utils/locationData';

interface MobiliserPerformanceViewProps {
  onSelectCandidate: (candidateId: string) => void;
}

export const MobiliserPerformanceView: React.FC<MobiliserPerformanceViewProps> = ({
  onSelectCandidate,
}) => {
  const [selectedMobiliserId, setSelectedMobiliserId] = useState<string | null>(null);
  const [selectedProgramme, setSelectedProgramme] = useState<string>('All');
  const [selectedFilterMobiliser, setSelectedFilterMobiliser] = useState<string>('All');

  const currentUser = dataStore.getCurrentUser();
  const isStateLocked = currentUser.role !== 'admin' && Boolean(currentUser.state) && currentUser.state !== 'All';
  const initialUserState = isStateLocked ? (currentUser.state || 'Nagaland') : 'All';
  const [selectedState, setSelectedState] = useState<string>(initialUserState);

  const [, setTick] = useState(0);
  useEffect(() => {
    return dataStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const projects = dataStore.getProjects();
  const districts = dataStore.getDistricts();
  const allFieldMobilisers = dataStore.getFieldMobilisers(undefined, false);

  const availableStates = useMemo(() => {
    const fromMaster = getAllStates();
    const fromDistricts = districts.map((d) => d.stateName).filter(Boolean);
    const fromMobilisers = allFieldMobilisers.map((m) => m.state).filter(Boolean);
    const combined = Array.from(new Set([...fromMaster, ...fromDistricts, ...fromMobilisers]));
    return combined.filter((st) => st && st !== 'All' && st !== 'All States');
  }, [districts, allFieldMobilisers]);

  const uniqueProgrammes = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.name)));
  }, [projects]);

  // Mobilisers available for the dropdown filter, scoped to selectedState if specified
  const availableFilterMobilisers = useMemo(() => {
    const mobs = dataStore.getFieldMobilisers(
      selectedState !== 'All' ? selectedState : undefined,
      false
    );
    return [...mobs].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedState]);

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedMobiliserId(null);
    if (newState !== 'All') {
      const stateMobs = dataStore.getFieldMobilisers(newState, false);
      const existsInState = stateMobs.some(
        (m) =>
          m.id === selectedFilterMobiliser ||
          m.name.toLowerCase() === selectedFilterMobiliser.toLowerCase()
      );
      if (!existsInState) {
        setSelectedFilterMobiliser('All');
      }
    }
  };

  const mobiliserPerf = useMemo(() => {
    return dataStore.getMobiliserPerformance(
      selectedProgramme !== 'All' ? selectedProgramme : undefined,
      undefined,
      selectedState !== 'All' ? selectedState : undefined
    );
  }, [selectedProgramme, selectedState]);

  // Filter mobiliser performance by selected mobiliser
  const displayPerf = useMemo(() => {
    if (selectedFilterMobiliser === 'All') return mobiliserPerf;
    return mobiliserPerf.filter(
      (m) =>
        m.id === selectedFilterMobiliser ||
        m.name.toLowerCase() === selectedFilterMobiliser.toLowerCase()
    );
  }, [mobiliserPerf, selectedFilterMobiliser]);

  const totalTarget = useMemo(() => displayPerf.reduce((sum, m) => sum + m.target, 0), [displayPerf]);
  const totalLeads = useMemo(() => displayPerf.reduce((sum, m) => sum + m.leads, 0), [displayPerf]);
  const totalEligible = useMemo(() => displayPerf.reduce((sum, m) => sum + m.eligible, 0), [displayPerf]);
  const totalConfirmed = useMemo(() => displayPerf.reduce((sum, m) => sum + m.confirmed, 0), [displayPerf]);
  const totalReported = useMemo(() => displayPerf.reduce((sum, m) => sum + m.reported, 0), [displayPerf]);
  const overallAchievement = totalTarget > 0 ? Math.round((totalConfirmed / totalTarget) * 100) : 0;
  const overallConversionRate = totalLeads > 0 ? Math.round((totalConfirmed / totalLeads) * 100) : 0;

  const users = dataStore.getUsers();
  const candidates = dataStore.getCandidates();
  const activities = dataStore.getActivities();
  const followUps = dataStore.getFollowUps();

  const selectedMobiliser = useMemo(() => {
    if (!selectedMobiliserId) return null;
    const user = users.find((u) => u.id === selectedMobiliserId);
    const fieldMob = dataStore.getFieldMobiliserById(selectedMobiliserId);
    const perf = mobiliserPerf.find((m) => m.id === selectedMobiliserId);
    const userCandidates = candidates.filter((c) => c.assignedMobiliserId === selectedMobiliserId);
    const userActivities = activities.filter((a) => a.mobiliserId === selectedMobiliserId);
    const userFollowUps = followUps.filter((f) => f.mobiliserId === selectedMobiliserId);

    const displayName = user?.name || fieldMob?.name || perf?.name || 'Mobiliser';
    const displayDistrict = user?.district || fieldMob?.district || perf?.district || 'Assigned District';
    const displayBlocks = user?.assignedBlocks || perf?.assignedBlocks || [];

    return {
      user: user || (fieldMob ? { ...fieldMob, role: 'mobiliser' as const, assignedBlocks: [] } : undefined),
      displayName,
      displayDistrict,
      displayBlocks,
      perf,
      candidates: userCandidates,
      activities: userActivities,
      followUps: userFollowUps,
    };
  }, [selectedMobiliserId, users, mobiliserPerf, candidates, activities, followUps]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Field Mobiliser Leaderboard & Tracking</h2>
          <p className="text-xs text-slate-500">
            Individual monthly targets, conversion rates, and grassroots field activity tracking
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* 1. State Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">State:</span>
            <select
              id="mobiliser-leaderboard-state-filter"
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              disabled={isStateLocked}
              className="text-xs p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700 cursor-pointer disabled:opacity-75 disabled:bg-slate-100"
            >
              {!isStateLocked && <option value="All">All States</option>}
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st} {isStateLocked && st === selectedState ? '(Assigned)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Mobiliser Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">Mobiliser:</span>
            <select
              id="mobiliser-leaderboard-mobiliser-filter"
              value={selectedFilterMobiliser}
              onChange={(e) => setSelectedFilterMobiliser(e.target.value)}
              className="text-xs p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700 cursor-pointer"
            >
              <option value="All">All Mobilisers</option>
              {availableFilterMobilisers.map((m, idx) => (
                <option key={`perf-opt-${m.id}-${idx}`} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Programme Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">Programme:</span>
            <select
              id="mobiliser-leaderboard-programme-filter"
              value={selectedProgramme}
              onChange={(e) => setSelectedProgramme(e.target.value)}
              className="text-xs p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700 cursor-pointer"
            >
              <option value="All">All Programmes ({uniqueProgrammes.length})</option>
              {uniqueProgrammes.map((progName) => (
                <option key={progName} value={progName}>
                  {progName}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
            {displayPerf.length} {displayPerf.length === 1 ? 'Active Field Mobiliser' : 'Active Field Mobilisers'}
          </span>
        </div>
      </div>

      {/* Mobiliser Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Mobiliser</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Monthly Target</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Eligible</th>
                <th className="py-3 px-4">Confirmed</th>
                <th className="py-3 px-4">Reported</th>
                <th className="py-3 px-4">Achievement</th>
                <th className="py-3 px-4">Conversion Rate</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayPerf.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No field mobilisers found for {selectedState !== 'All' ? selectedState : 'the selected criteria'}.
                  </td>
                </tr>
              ) : (
                displayPerf.map((m, idx) => (
                  <tr
                    key={`perf-row-${m.id}-${idx}`}
                    onClick={() => setSelectedMobiliserId(m.id)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        Blocks: {m.assignedBlocks.length > 0 ? m.assignedBlocks.join(', ') : 'All Blocks'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{m.district}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{m.target}</td>
                    <td className="py-3.5 px-4">{m.leads}</td>
                    <td className="py-3.5 px-4 text-teal-700 font-semibold">{m.eligible}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">{m.confirmed}</td>
                    <td className="py-3.5 px-4 text-purple-700 font-semibold">{m.reported}</td>
                    <td className="py-3.5 px-4">
                      <div className="w-28 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800">{m.achievement}%</span>
                          <span className="text-slate-400">{m.confirmed}/{m.target}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              m.achievement >= 70 ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(m.achievement, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-slate-100 text-slate-800">
                        {m.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 p-1">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {displayPerf.length > 0 && (
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-[11px] text-slate-700">
                <tr>
                  <td className="py-3 px-4">
                    {selectedFilterMobiliser !== 'All' && displayPerf.length === 1
                      ? `Total (${displayPerf[0].name})`
                      : `Total / State Average (${displayPerf.length} Mobilisers)`}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {selectedFilterMobiliser !== 'All' && displayPerf.length === 1
                      ? displayPerf[0].district
                      : selectedState !== 'All' ? selectedState : 'All States'}
                  </td>
                  <td className="py-3 px-4 text-slate-900">{totalTarget}</td>
                  <td className="py-3 px-4 text-slate-900">{totalLeads}</td>
                  <td className="py-3 px-4 text-teal-700">{totalEligible}</td>
                  <td className="py-3 px-4 text-emerald-700">{totalConfirmed}</td>
                  <td className="py-3 px-4 text-purple-700">{totalReported}</td>
                  <td className="py-3 px-4">
                    <span className="text-indigo-700">{overallAchievement}%</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {overallConversionRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Individual Mobiliser Profile Drawer / Modal */}
      {selectedMobiliser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg">
                  {selectedMobiliser.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedMobiliser.displayName}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedMobiliser.displayDistrict} • Blocks: {selectedMobiliser.displayBlocks.length > 0 ? selectedMobiliser.displayBlocks.join(', ') : 'All Blocks'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMobiliserId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Monthly Target</span>
                <span className="text-lg font-bold text-slate-900">{selectedMobiliser.perf?.target}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Confirmed</span>
                <span className="text-lg font-bold text-emerald-700">{selectedMobiliser.perf?.confirmed}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Target Achievement</span>
                <span className="text-lg font-bold text-indigo-700">{selectedMobiliser.perf?.achievement}%</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Conversion Rate</span>
                <span className="text-lg font-bold text-slate-800">{selectedMobiliser.perf?.conversionRate}%</span>
              </div>
            </div>

            {/* Candidates Added by Mobiliser */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Candidates Mobilised ({selectedMobiliser.candidates.length})
              </h4>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {selectedMobiliser.candidates.map((cand) => (
                  <div
                    key={cand.id}
                    onClick={() => {
                      setSelectedMobiliserId(null);
                      onSelectCandidate(cand.id);
                    }}
                    className="p-2.5 hover:bg-indigo-50/50 flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{cand.name}</span>{' '}
                      <span className="font-mono text-[10px] text-slate-400">({cand.candidateId})</span>
                      <p className="text-[11px] text-slate-500">{cand.village}, {cand.block} • {cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {cand.currentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedMobiliserId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
