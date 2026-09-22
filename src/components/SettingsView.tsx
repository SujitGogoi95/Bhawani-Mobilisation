import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  MapPin,
  Briefcase,
  Users,
  Shield,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Calendar,
  Link2,
  Send,
  Terminal,
  AlertCircle,
  ExternalLink,
  UserCheck,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { User as UserType } from '../types';
import { appsScriptApi, APPS_SCRIPT_URL, apiRequest } from '../services/api';
import { BhawaniLogo } from './BhawaniLogo';
import { MobiliserManagementView } from './MobiliserManagementView';

interface SettingsViewProps {
  currentUser: UserType;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'backend' | 'districts' | 'projects' | 'mobilisers' | 'users' | 'audit'>('general');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    return dataStore.subscribe(() => setVersion((v) => v + 1));
  }, []);

  // Apps Script Backend Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testAction, setTestAction] = useState('test');
  const [customPayload, setCustomPayload] = useState('{}');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  const districts = dataStore.getDistricts();
  const projects = dataStore.getProjects();
  const batches = dataStore.getBatches();
  const users = dataStore.getUsers();
  const auditLogs = dataStore.getAuditLogs();
  const isOnline = dataStore.getOnlineStatus();
  const offlineQueue = dataStore.getOfflineQueue();

  const handleTestConnection = async (actionToRun = testAction) => {
    setIsTesting(true);
    setTestError(null);
    setTestResponse(null);
    const startTime = performance.now();
    try {
      let payloadData = {};
      if (actionToRun !== 'test' && customPayload) {
        try {
          payloadData = JSON.parse(customPayload);
        } catch {
          // ignore parsing error
        }
      }
      const result = await apiRequest(actionToRun, payloadData);
      const elapsed = Math.round(performance.now() - startTime);
      setResponseTime(elapsed);
      setTestResponse(result);
      setLastTestedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setResponseTime(elapsed);
      setTestError(err.message || 'Connection request failed');
      setLastTestedAt(new Date().toLocaleTimeString());
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all data back to original seed data? Any offline unsynced records will be restored.')) {
      dataStore.resetToDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">System Settings & Master Data</h2>
          <p className="text-xs text-slate-500">
            Configure master tables, geographic blocks, target batches, and backend API integration
          </p>
        </div>

        {resetSuccess && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            Data reset to initial state ✓
          </span>
        )}
      </div>

      {/* Subtabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-500 space-x-4 overflow-x-auto">
        {[
          { id: 'general', label: 'System Overview & Sync', icon: Database },
          { id: 'backend', label: 'Apps Script & Sheets Backend', icon: Link2 },
          { id: 'mobilisers', label: 'Mobiliser Master (Admin)', icon: UserCheck },
          { id: 'districts', label: 'Districts & Blocks', icon: MapPin },
          { id: 'projects', label: 'Projects & Batches', icon: Briefcase },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'audit', label: 'System Audit Trail', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`pb-3 px-1 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                activeSubTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 font-bold'
                  : 'border-transparent hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* GENERAL & OFFLINE SYNC */}
      {(activeSubTab === 'general' || activeSubTab === 'backend') && (
        <div className="space-y-4">
          {/* Organization & Company Branding Card */}
          {activeSubTab === 'general' && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-2xl shrink-0">
                  <BhawaniLogo variant="mark" size="md" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Bhawani Marketing Pvt Ltd</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Official Licensee
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Mobilisation Management System
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Standardized Training Schemes: <strong className="text-slate-700">DDU-GKY 2.0</strong> • <strong className="text-slate-700">CSR</strong> • <strong className="text-slate-700">RTD</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right">
                <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-left sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Environment</div>
                  <div className="text-xs font-bold text-slate-800">Production Ops</div>
                </div>
              </div>
            </div>
          )}

          {/* Apps Script Web App Integration Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Google Apps Script Web App Backend</h3>
                  <p className="text-xs text-slate-500">
                    Live endpoint connection to Google Sheets backend via POST requests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isTesting ? (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Connecting...
                  </span>
                ) : testResponse ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Response Received {responseTime ? `(${responseTime}ms)` : ''}
                  </span>
                ) : testError ? (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Failed
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    Ready to Test
                  </span>
                )}
              </div>
            </div>

            {/* Endpoint URL display */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Configured Web App Endpoint URL
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 select-all overflow-x-auto break-all">
                  {APPS_SCRIPT_URL}
                </div>
                <a
                  href={APPS_SCRIPT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Test Trigger Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Connection Test</h4>
                  <p className="text-[11px] text-slate-500">
                    Sends a POST request with payload <code className="text-indigo-600 font-semibold">{`{ "action": "test" }`}</code> to verify backend responsiveness.
                  </p>
                </div>

                <button
                  id="apps-script-test-btn"
                  onClick={() => handleTestConnection('test')}
                  disabled={isTesting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Test Response Display */}
              {(testResponse || testError) && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-500" />
                      Endpoint Response
                    </span>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                      {responseTime && <span>Duration: {responseTime}ms</span>}
                      {lastTestedAt && <span>• Tested at {lastTestedAt}</span>}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                    {testError ? (
                      <div className="text-rose-400">Error: {testError}</div>
                    ) : (
                      <pre className="whitespace-pre-wrap">
                        {typeof testResponse === 'object'
                          ? JSON.stringify(testResponse, null, 2)
                          : String(testResponse)}
                      </pre>
                    )}
                  </div>

                  {/* Informational Guidance for Apps Script doPost */}
                  {testResponse && (testResponse.raw?.includes('doPost') || testResponse.message?.includes('doPost')) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Apps Script Configuration Note:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Your Apps Script Web App responded! However, it reported that the <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">doPost</code> function is not found in the currently deployed version.
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        In your Apps Script project, ensure you have declared <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">function doPost(e) &#123; ... &#125;</code> and published a new version via:
                        <br />
                        <span className="font-semibold">Deploy &gt; Manage deployments &gt; Edit (pencil icon) &gt; Version: New version &gt; Deploy</span>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Supported API Actions Reference */}
            <div className="border border-slate-100 rounded-lg p-3.5 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Supported API Service Actions</span>
                <span className="text-[10px] text-slate-400 font-medium">14 Actions Configured</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                {[
                  'login',
                  'getCandidates',
                  'addCandidate',
                  'updateCandidate',
                  'getDashboard',
                  'addActivity',
                  'addCallLog',
                  'addFollowUp',
                  'getFollowUps',
                  'getActivities',
                  'getCallLogs',
                  'getDocuments',
                  'updateDocument',
                  'getTargets',
                ].map((act, idx) => (
                  <div
                    key={act}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-mono text-[10px] truncate"
                    title={act}
                  >
                    <span className="text-slate-400 mr-1">{idx + 1}.</span>
                    {act}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Local Storage Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Offline Resilience & Local Storage</h3>
            <p className="text-xs text-slate-500">
              The application utilizes an offline-first storage queue that saves every action locally.
              When network re-establishes, queued activities and new candidates sync automatically.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Network Status</span>
                <span className={`text-sm font-bold ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isOnline ? '● Online (Connected)' : '○ Offline Mode'}
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Pending Offline Queue</span>
                <span className="text-sm font-bold text-slate-900">
                  {offlineQueue.length} items queued
                </span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Storage Engine</span>
                <span className="text-sm font-bold text-indigo-700">
                  HTML5 LocalStorage
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Reset Local State</h4>
                <p className="text-[11px] text-slate-400">Restore default demo candidates, activities, and follow-ups.</p>
              </div>
              <button
                onClick={handleResetData}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISTRICTS & BLOCKS */}
      {activeSubTab === 'districts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Configured Districts & Blocks (Nagaland)</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {districts.map((d) => (
              <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{d.name}</span>
                  <span className="text-[11px] text-slate-400 ml-2">Target: {d.target} candidates</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.blocks.map((b) => (
                      <span key={b} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOBILISER MASTER (ADMIN) */}
      {activeSubTab === 'mobilisers' && (
        <MobiliserManagementView currentUser={currentUser} />
      )}

      {/* PROJECTS & BATCHES */}
      {activeSubTab === 'projects' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Training Schemes & Projects</h3>
            <div className="space-y-2 text-xs">
              {projects.map((p) => (
                <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{p.name}</span>
                      {p.state && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                          {p.state}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">Target: {p.target} candidates</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Batches & Intake Capacities</h3>
            <div className="space-y-2 text-xs">
              {batches.map((b) => (
                <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <p className="text-[11px] text-slate-500">
                      Starts: {b.startDate} • Capacity: {b.capacity} seats ({b.district})
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[10px]">
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* USERS & ROLES */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Registered System Users & Mobilisers</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{u.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {u.email} • {u.phone} • {u.district}
                  </p>
                  {u.role === 'mobiliser' && (
                    <p className="text-[11px] text-indigo-600 mt-0.5">
                      Target: {u.monthlyTarget} | Blocks: {u.assignedBlocks.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">System Audit Trail</h3>
            <p className="text-xs text-slate-500">Real-time log of candidate creation, status transitions & verification</p>
          </div>
          <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-slate-50">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-indigo-600">{log.action}</span>
                  <span>{log.createdAt.replace('T', ' ').substring(0, 19)}</span>
                </div>
                <p className="text-slate-800 font-semibold mt-0.5">{log.newValue || log.action}</p>
                <p className="text-[11px] text-slate-500">Performed by: {log.userName}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
