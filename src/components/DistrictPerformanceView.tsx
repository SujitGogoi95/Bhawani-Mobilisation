import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Award,
  ChevronRight,
  MapPin,
  Users,
  CheckCircle2,
  X,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { getAllStates } from '../utils/locationData';

export const DistrictPerformanceView: React.FC = () => {
  const [selectedDistrictDetail, setSelectedDistrictDetail] = useState<string | null>(null);
  const [selectedProgramme, setSelectedProgramme] = useState<string>('All');

  const currentUser = dataStore.getCurrentUser();
  const isStateLocked = currentUser.role !== 'admin' && Boolean(currentUser.state) && currentUser.state !== 'All';
  const initialUserState = isStateLocked ? (currentUser.state || 'Nagaland') : 'All';
  const [selectedState, setSelectedState] = useState<string>(initialUserState);

  const [, setTick] = useState(0);
  useEffect(() => {
    return dataStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const districts = dataStore.getDistricts();
  const projects = dataStore.getProjects();
  const candidates = dataStore.getCandidates();
  const mobilisers = dataStore.getMobilisers();

  const availableStates = useMemo(() => {
    const fromMaster = getAllStates();
    const fromDistricts = districts.map((d) => d.stateName).filter(Boolean);
    const fromMobilisers = mobilisers.map((m) => m.state).filter(Boolean);
    const combined = Array.from(new Set([...fromMaster, ...fromDistricts, ...fromMobilisers]));
    return combined.filter((st) => st && st !== 'All' && st !== 'All States');
  }, [districts, mobilisers]);

  const uniqueProgrammes = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.name)));
  }, [projects]);

  const districtPerf = useMemo(() => {
    return dataStore.getDistrictPerformance(
      selectedProgramme !== 'All' ? selectedProgramme : undefined,
      undefined,
      selectedState !== 'All' ? selectedState : undefined
    );
  }, [selectedProgramme, selectedState]);

  // Performance Highlights
  const sorted = [...districtPerf].sort((a, b) => b.achievement - a.achievement);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const belowFifty = districtPerf.filter((d) => d.achievement < 50);
  const zeroMobilisation = districtPerf.filter((d) => d.mobilised === 0);

  const totalTarget = districtPerf.reduce((acc, d) => acc + d.target, 0);
  const totalConfirmed = districtPerf.reduce((acc, d) => acc + d.confirmed, 0);
  const overallAchievement = Math.round((totalConfirmed / (totalTarget || 1)) * 100);

  // Drilldown data for selected district
  const selectedDistrictData = useMemo(() => {
    if (!selectedDistrictDetail) return null;
    const distObj = districts.find((d) => d.name === selectedDistrictDetail);
    const distCandidates = candidates.filter((c) => c.district === selectedDistrictDetail);
    const distMobilisers = mobilisers.filter((m) => m.district === selectedDistrictDetail);

    // Block breakdown
    const blocksData = (distObj?.blocks || []).map((b) => {
      const blockCand = distCandidates.filter((c) => c.block === b);
      const conf = blockCand.filter((c) =>
        ['Confirmed', 'Documents Pending', 'Documents Complete', 'Screening Completed', 'Reported', 'Batch Assigned'].includes(c.currentStatus)
      ).length;
      return {
        block: b,
        total: blockCand.length,
        confirmed: conf,
      };
    });

    return {
      distObj,
      distCandidates,
      distMobilisers,
      blocksData,
    };
  }, [selectedDistrictDetail, districts, candidates, mobilisers]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">District Mobilisation Performance</h2>
          <p className="text-xs text-slate-500">
            Regional targets, confirmed conversions, and geographic drilldown
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* State Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">State:</span>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrictDetail(null);
              }}
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

          {/* Programme Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 whitespace-nowrap">Programme:</span>
            <select
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

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Program Target</span>
            <p className="text-lg font-bold text-slate-900">{totalConfirmed} / {totalTarget}</p>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-sm">
            {overallAchievement}% Achieved
          </div>
        </div>
      </div>

      {/* Highlights & Insights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Highest Performing */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Top Performing District</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-emerald-800">{highest?.district || 'None'}</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {highest ? `${highest.achievement}% Target Met (${highest.confirmed} / ${highest.target})` : 'No data available'}
            </p>
          </div>
        </div>

        {/* Lowest Performing */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Lagging District</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-amber-800">{lowest?.district || 'None'}</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {lowest ? `${lowest.achievement}% Target Met (${lowest.confirmed} / ${lowest.target})` : 'No data available'}
            </p>
          </div>
        </div>

        {/* Below 50% Target */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Districts Below 50%</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-rose-800">{belowFifty.length} Districts</p>
            <p className="text-xs text-rose-600 mt-0.5">
              Require field reinforcement & drive
            </p>
          </div>
        </div>

        {/* Zero Mobilisation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Zero Mobilisation</span>
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-slate-800">{zeroMobilisation.length} Districts</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {zeroMobilisation.length === 0 ? 'All districts active' : 'Unactivated territories'}
            </p>
          </div>
        </div>
      </div>

      {/* District Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">District Mobilisation Scorecard</h3>
          <span className="text-xs text-slate-500">Click any district row to drill down</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Mobilised</th>
                <th className="py-3 px-4">Eligible</th>
                <th className="py-3 px-4">Confirmed</th>
                <th className="py-3 px-4">Reported</th>
                <th className="py-3 px-4">Achievement</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {districtPerf.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No district performance data found for {selectedState !== 'All' ? selectedState : 'the selected filters'}.
                  </td>
                </tr>
              ) : (
                districtPerf.map((d) => (
                  <tr
                    key={d.district}
                    onClick={() => setSelectedDistrictDetail(d.district)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">{d.district}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{d.target}</td>
                    <td className="py-3.5 px-4">{d.mobilised}</td>
                    <td className="py-3.5 px-4 text-teal-700 font-semibold">{d.eligible}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">{d.confirmed}</td>
                    <td className="py-3.5 px-4 text-purple-700 font-semibold">{d.reported}</td>
                    <td className="py-3.5 px-4">
                      <div className="w-36 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800">{d.achievement}%</span>
                          <span className="text-slate-400">{d.confirmed}/{d.target}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              d.achievement >= 75 ? 'bg-emerald-500' : d.achievement >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(d.achievement, 100)}%` }}
                          ></div>
                        </div>
                      </div>
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
          </table>
        </div>
      </div>

      {/* District Drilldown Modal */}
      {selectedDistrictDetail && selectedDistrictData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedDistrictDetail} District Drilldown</h3>
                <p className="text-xs text-slate-500">
                  Block breakdown and deployed field team
                </p>
              </div>
              <button
                onClick={() => setSelectedDistrictDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Blocks Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Block-wise Mobilisation</h4>
              <div className="space-y-2">
                {selectedDistrictData.blocksData.map((blk) => (
                  <div key={blk.block} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{blk.block}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{blk.total} candidates registered</p>
                    </div>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      {blk.confirmed} Confirmed
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deployed Mobilisers */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Assigned Field Mobilisers</h4>
              <div className="space-y-2">
                {selectedDistrictData.distMobilisers.map((mob, idx) => (
                  <div key={`dist-mob-${mob.id}-${idx}`} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{mob.name}</span>
                      <p className="text-[11px] text-slate-500">Phone: {mob.phone} • Target: {mob.monthlyTarget}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      Blocks: {mob.assignedBlocks.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDistrictDetail(null)}
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
