import {
  User,
  FieldMobiliser,
  Candidate,
  CandidateStatus,
  CandidateStage,
  PreMobilisationStatus,
  PostMobilisationStatus,
  PRE_MOBILISATION_STATUSES,
  POST_MOBILISATION_STATUSES,
  getStageForStatus,
  MobilisationActivity,
  MobilisationPlan,
  MobilisationPlanStatus,
  PlanBudget,
  CallLog,
  FollowUp,
  CandidateDocument,
  StatusHistory,
  District,
  Project,
  Batch,
  AuditLog,
  SystemNotification,
  OfflineSyncItem,
  DocumentType,
  DocumentVerificationStatus,
  PROJECT_OPTIONS,
  CSR_BATCH_MAPPING,
  AllocationHistoryEntry,
  getApplicableDocumentsForProject,
  normalizeDocumentName,
  evaluateDocumentTransition,
  DocumentTransitionCheckResult,
  MIN_REQUIRED_DOCUMENTS_FOR_TRANSITION,
  DDU_GKY_APPLICABLE_DOCUMENTS,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_DISTRICTS,
  PROGRAMMES,
  INITIAL_PROJECTS,
  INITIAL_BATCHES,
  INITIAL_CANDIDATES,
  INITIAL_ACTIVITIES,
  INITIAL_MOBILISATION_PLANS,
  INITIAL_CALL_LOGS,
  INITIAL_FOLLOW_UPS,
  INITIAL_DOCUMENTS,
  INITIAL_STATUS_HISTORY,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_FIELD_MOBILISERS,
} from '../data/seedData';
import { mergeDistrictsWithMaster, getStateForDistrict } from '../utils/locationData';
import { getUserAssignedState } from '../utils/userState';
import { appsScriptApi } from './api';
import {
  DUPLICATE_PROGRAMME_CONFIG_ERROR,
  normalizeProgrammeName,
  normalizeProgrammeState,
  normalizeProgrammeYear,
  normalizeProgrammePhase,
  normalizeProgrammeCycle,
  makeProgrammeConfigKey,
  getProjectConfigurationKeys,
} from '../utils/programmeUtils';

const STORAGE_KEYS = {
  USERS: 'mms_users',
  FIELD_MOBILISERS: 'mms_field_mobilisers',
  CURRENT_USER_ID: 'mms_current_user_id',
  DISTRICTS: 'mms_districts',
  PROJECTS: 'mms_projects',
  BATCHES: 'mms_batches',
  CANDIDATES: 'mms_candidates',
  ACTIVITIES: 'mms_activities',
  MOBILISATION_PLANS: 'mms_mobilisation_plans',
  CALL_LOGS: 'mms_call_logs',
  FOLLOW_UPS: 'mms_follow_ups',
  DOCUMENTS: 'mms_documents',
  STATUS_HISTORY: 'mms_status_history',
  AUDIT_LOGS: 'mms_audit_logs',
  NOTIFICATIONS: 'mms_notifications',
  OFFLINE_QUEUE: 'mms_offline_queue',
  IS_ONLINE: 'mms_is_online',
};

// Safe JSON parse from localStorage
function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch (e) {
    console.warn(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

export class DataStore {
  private users: User[] = [];
  private fieldMobilisers: FieldMobiliser[] = [];
  private currentUserId: string = 'u-admin-1';
  private districts: District[] = [];
  private projects: Project[] = [];
  private batches: Batch[] = [];
  private candidates: Candidate[] = [];
  private activities: MobilisationActivity[] = [];
  private mobilisationPlans: MobilisationPlan[] = [];
  private callLogs: CallLog[] = [];
  private followUps: FollowUp[] = [];
  private documents: CandidateDocument[] = [];
  private statusHistory: StatusHistory[] = [];
  private auditLogs: AuditLog[] = [];
  private notifications: SystemNotification[] = [];
  private offlineQueue: OfflineSyncItem[] = [];
  private isOnline: boolean = true;
  private isSyncingRemoteCandidates: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  public init() {
    // 1. Enforce the 5 authorized login accounts & purge obsolete names
    const storedUsers = getStored<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const validInitialIds = new Set(INITIAL_USERS.map((u) => u.id));
    const hasLegacyOrCorruptedUsers =
      !Array.isArray(storedUsers) ||
      storedUsers.length === 0 ||
      storedUsers.some((u) => !validInitialIds.has(u.id) && !u.id.startsWith('u-custom-')) ||
      !storedUsers.some((u) => u.id === 'u-admin-1');

    if (hasLegacyOrCorruptedUsers) {
      this.users = [...INITIAL_USERS];
      this.persist(STORAGE_KEYS.USERS, this.users);
    } else {
      // Ensure all authorized accounts are always present with state-based profiles
      const userMap = new Map<string, User>();
      INITIAL_USERS.forEach((u) => userMap.set(u.id, { ...u }));
      storedUsers.forEach((u) => {
        if (!userMap.has(u.id)) {
          userMap.set(u.id, u);
        } else {
          // Sync stored user with updated profile name and state
          const initialUser = userMap.get(u.id)!;
          if (initialUser.role === 'mobiliser') {
            userMap.set(u.id, { ...u, name: initialUser.name, state: initialUser.state });
          }
        }
      });
      this.users = Array.from(userMap.values()).map((u) => {
        if (u.role === 'mobiliser' && u.state && u.state !== 'All') {
          return { ...u, name: `Mobiliser (${u.state})` };
        }
        return u;
      });
      this.persist(STORAGE_KEYS.USERS, this.users);
    }

    this.currentUserId = getStored(STORAGE_KEYS.CURRENT_USER_ID, 'u-admin-1');
    if (!this.users.some((u) => u.id === this.currentUserId)) {
      this.currentUserId = 'u-admin-1';
      this.persist(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
    }

    // 2. Field Mobilisers Master List (Separate from Login Accounts)
    const storedFieldMobs = getStored<FieldMobiliser[]>(STORAGE_KEYS.FIELD_MOBILISERS, INITIAL_FIELD_MOBILISERS);
    const mobMap = new Map<string, FieldMobiliser>();
    INITIAL_FIELD_MOBILISERS.forEach((m) => {
      if (m && m.id) mobMap.set(m.id, { ...m });
    });
    if (Array.isArray(storedFieldMobs)) {
      storedFieldMobs.forEach((m) => {
        if (m && m.id) {
          // Stored field mobiliser contains admin's updates/additions - give it authority over seed defaults
          mobMap.set(m.id, { ...(mobMap.get(m.id) || {}), ...m });
        }
      });
    }
    this.fieldMobilisers = Array.from(mobMap.values());
    this.persist(STORAGE_KEYS.FIELD_MOBILISERS, this.fieldMobilisers);

    const rawDistricts = getStored(STORAGE_KEYS.DISTRICTS, INITIAL_DISTRICTS);
    this.districts = mergeDistrictsWithMaster(rawDistricts);
    this.persist(STORAGE_KEYS.DISTRICTS, this.districts);

    // Sync projects to ensure ONLY the 3 programmes exist: DDU-GKY 2.0, CSR, RTD
    const rawProjects = getStored(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    this.projects = this.syncProjects(rawProjects);
    this.persist(STORAGE_KEYS.PROJECTS, this.projects);

    // Sync batches to match the 3 programmes
    const rawBatches = getStored(STORAGE_KEYS.BATCHES, INITIAL_BATCHES);
    this.batches = this.syncBatches(rawBatches);
    this.persist(STORAGE_KEYS.BATCHES, this.batches);

    // Sync candidates so programme strictly matches DDU-GKY 2.0, CSR, RTD
    const rawCandidates = getStored(STORAGE_KEYS.CANDIDATES, INITIAL_CANDIDATES);
    const hasLatestNagalandSeed = Array.isArray(rawCandidates) && rawCandidates.some((c) => c.id === 'c-ng-001');
    const candidatesToSync = (!Array.isArray(rawCandidates) || rawCandidates.length < 60 || !hasLatestNagalandSeed)
      ? INITIAL_CANDIDATES
      : rawCandidates;
    this.candidates = this.syncCandidates(candidatesToSync);
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);

    const storedActivities = getStored<MobilisationActivity[]>(STORAGE_KEYS.ACTIVITIES, INITIAL_ACTIVITIES);
    if (!Array.isArray(storedActivities) || storedActivities.length === 0) {
      this.activities = [...INITIAL_ACTIVITIES];
      this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);
    } else {
      const existingActIds = new Set(storedActivities.map((a) => a.id));
      const missingActs = INITIAL_ACTIVITIES.filter((a) => !existingActIds.has(a.id));
      // Ensure seed activities act-1 and act-2 have plan details even if cached previously
      const enrichedActivities = storedActivities.map((act) => {
        if (act.id === 'act-1' && !act.planId) {
          return {
            ...act,
            programme: 'DDU-GKY 2.0',
            isPlanned: true,
            planId: 'MOB-2026-001',
            approvedBudget: { travelling: 500, lodging: 0, fooding: 1000, total: 1500 },
            actualExpenditureBreakdown: { travelling: 400, lodging: 0, fooding: 800, total: 1200 },
          };
        }
        if (act.id === 'act-2' && !act.planId) {
          return {
            ...act,
            programme: 'CSR - Raddison',
            isPlanned: true,
            planId: 'MOB-2026-002',
            approvedBudget: { travelling: 500, lodging: 0, fooding: 400, total: 900 },
            actualExpenditureBreakdown: { travelling: 450, lodging: 0, fooding: 350, total: 800 },
          };
        }
        return act;
      });
      this.activities = missingActs.length > 0 ? [...enrichedActivities, ...missingActs] : enrichedActivities;
      this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);
    }

    const storedPlans = getStored<MobilisationPlan[]>(STORAGE_KEYS.MOBILISATION_PLANS, INITIAL_MOBILISATION_PLANS);
    if (!Array.isArray(storedPlans) || storedPlans.length === 0) {
      this.mobilisationPlans = [...INITIAL_MOBILISATION_PLANS];
      this.persist(STORAGE_KEYS.MOBILISATION_PLANS, this.mobilisationPlans);
    } else {
      const existingPlanIds = new Set(storedPlans.map((p) => p.id || p.planId));
      const missingPlans = INITIAL_MOBILISATION_PLANS.filter((p) => !existingPlanIds.has(p.id) && !existingPlanIds.has(p.planId));
      this.mobilisationPlans = missingPlans.length > 0 ? [...storedPlans, ...missingPlans] : storedPlans;
      if (missingPlans.length > 0) {
        this.persist(STORAGE_KEYS.MOBILISATION_PLANS, this.mobilisationPlans);
      }
    }
    this.callLogs = getStored(STORAGE_KEYS.CALL_LOGS, INITIAL_CALL_LOGS);
    this.followUps = getStored(STORAGE_KEYS.FOLLOW_UPS, INITIAL_FOLLOW_UPS);
    this.documents = getStored(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    this.statusHistory = getStored(STORAGE_KEYS.STATUS_HISTORY, INITIAL_STATUS_HISTORY);
    this.auditLogs = getStored(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    this.notifications = getStored(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    this.offlineQueue = getStored(STORAGE_KEYS.OFFLINE_QUEUE, []);
    this.isOnline = getStored(STORAGE_KEYS.IS_ONLINE, true);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  /**
   * Syncs projects with stored projects or initial projects, ensuring no empty state
   * and preserving unique Programme + State + Year + Phase + Cycle combinations.
   */
  public syncProjects(storedProjects: Project[]): Project[] {
    if (Array.isArray(storedProjects) && storedProjects.length > 0) {
      const hasStateFields = storedProjects.some((p) => p && p.state && p.state !== 'All States');
      const seen = new Set<string>();
      const deduped: Project[] = [];

      for (const p of storedProjects) {
        if (!p || !p.name) continue;
        const normName = p.name.trim();
        const normState = (p.state || 'All States').trim();
        const normYear = (p.year || '2026-27').trim();

        // Find initial seed match to backfill phases/cycles if missing
        const initMatch = INITIAL_PROJECTS.find(
          (ip) =>
            normalizeProgrammeName(ip.name) === normalizeProgrammeName(normName) &&
            normalizeProgrammeState(ip.state) === normalizeProgrammeState(normState) &&
            normalizeProgrammeYear(ip.year) === normalizeProgrammeYear(normYear)
        );

        let phase = p.phase || (initMatch ? initMatch.phase : undefined);
        let cycle = p.cycle || (initMatch ? initMatch.cycle : undefined);

        let phases: string[] = [];
        if (Array.isArray(p.phases) && p.phases.length > 0) {
          if (!p.phase && p.phases.length > 1 && normName.toLowerCase().includes('ddu')) {
            phase = 'Phase 1';
            phases = ['Phase 1'];
          } else {
            phases = p.phases;
          }
        } else if (phase) {
          phases = [phase];
        } else if (initMatch && Array.isArray(initMatch.phases)) {
          phases = initMatch.phases;
        } else if (normName.includes('DDU-GKY')) {
          phase = 'Phase 1';
          phases = ['Phase 1'];
        }

        let cycles: string[] = [];
        if (Array.isArray(p.cycles) && p.cycles.length > 0) {
          if (!p.cycle && p.cycles.length > 1 && normName.toLowerCase().includes('ddu')) {
            cycle = 'Cycle 1';
            cycles = ['Cycle 1'];
          } else {
            cycles = p.cycles;
          }
        } else if (cycle) {
          cycles = [cycle];
        } else if (initMatch && Array.isArray(initMatch.cycles)) {
          cycles = initMatch.cycles;
        } else if (normName.includes('DDU-GKY')) {
          cycle = 'Cycle 1';
          cycles = ['Cycle 1'];
        }

        if (!phase && phases.length > 0) phase = phases[0];
        if (!cycle && cycles.length > 0) cycle = cycles[0];

        const exactInitMatch = INITIAL_PROJECTS.find(
          (ip) => ip.id === p.id || (ip.name === normName && ip.state === normState && (!ip.phase || ip.phase === phase) && (!ip.cycle || ip.cycle === cycle))
        );

        const projectItem: Project = {
          id: p.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: normName,
          state: normState,
          year: normYear,
          phase,
          cycle,
          phases,
          cycles,
          description: p.description || '',
          startDate: p.startDate || '2026-04-01',
          endDate: p.endDate || '2027-03-31',
          status: (p.status as any) || 'Active',
          target:
            exactInitMatch && (p.target === undefined || p.target === 100 || p.target === 300 || p.target === 250)
              ? exactInitMatch.target
              : typeof p.target === 'number' && !isNaN(p.target)
              ? p.target
              : (exactInitMatch?.target ?? 100),
        };

        const keys = getProjectConfigurationKeys(projectItem);
        const primaryKey = keys[0] || makeProgrammeConfigKey(normName, normState, normYear, phase, cycle);

        if (!seen.has(primaryKey)) {
          seen.add(primaryKey);
          deduped.push(projectItem);
        }
      }

      // Ensure any newly added projects from INITIAL_PROJECTS exist
      for (const initP of INITIAL_PROJECTS) {
        const keys = getProjectConfigurationKeys(initP);
        const primaryKey = keys[0] || makeProgrammeConfigKey(initP.name, initP.state, initP.year, initP.phase, initP.cycle);
        if (!seen.has(primaryKey)) {
          seen.add(primaryKey);
          deduped.push({ ...initP });
        }
      }

      if (deduped.length > 0) return deduped;
    }

    return INITIAL_PROJECTS;
  }

  /**
   * Syncs batches with the configured initial batches
   */
  public syncBatches(storedBatches: Batch[]): Batch[] {
    if (!Array.isArray(storedBatches) || storedBatches.length === 0) {
      return INITIAL_BATCHES;
    }
    return storedBatches;
  }

  /**
   * Syncs candidates ensuring separate Project, Phase, Cycle, and Batch fields are properly preserved
   */
  public syncCandidates(storedCandidates: Candidate[]): Candidate[] {
    if (!Array.isArray(storedCandidates)) {
      return INITIAL_CANDIDATES;
    }
    return storedCandidates.map((c, index) => {
      let project = c.project || c.projectName || c.programme || 'DDU-GKY 2.0';
      if (project === 'DDU-GKY') project = 'DDU-GKY 2.0';
      if (project === 'CSR - Raddison 1' || project === 'CSR - Raddison 2') {
        project = 'CSR - Raddison';
      }

      let phase = c.phase;
      let cycle = c.cycle;
      let batch = c.batch || c.batchName;

      // For DDU-GKY 2.0, ensure Phase & Cycle are present for seed/existing candidates
      if (project === 'DDU-GKY 2.0') {
        if (!phase) {
          const phases = ['Phase I', 'Phase II', 'Phase III', 'Phase 4'];
          phase = phases[index % phases.length];
        }
        if (!cycle) {
          const cycles = ['Cycle 1', 'Cycle 2', 'Cycle 3'];
          cycle = cycles[Math.floor(index / 2) % cycles.length];
        }
        if (!batch) {
          const batches = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Batch 5', 'Batch 6', 'Batch 7'];
          batch = batches[index % batches.length];
        }
      } else if (project.startsWith('CSR') || project === 'RTD') {
        phase = undefined;
        cycle = undefined;
        if (!batch || (batch !== 'Batch 1' && batch !== 'Batch 2' && batch !== 'Batch 3')) {
          batch = 'Batch 1';
        }
      }

      const programme = project.startsWith('CSR') ? 'CSR' : project === 'RTD' ? 'RTD' : 'DDU-GKY 2.0';
      const stage = c.stage || getStageForStatus(c.currentStatus);

      return {
        ...c,
        project,
        phase,
        cycle,
        batch,
        projectId: c.projectId || (project.startsWith('CSR') ? 'proj-2' : project === 'RTD' ? 'proj-3' : 'proj-1'),
        projectName: project,
        programme,
        batchName: batch || c.batchName,
        stage,
        allocationHistory: c.allocationHistory || [
          {
            id: `alloc-hist-${c.id}`,
            candidateId: c.id,
            previousAllocation: {},
            newAllocation: {
              project,
              phase,
              cycle,
              batch,
            },
            changedBy: 'Admin (System Initialization)',
            changedAt: c.createdAt || new Date().toISOString(),
            remarks: 'System candidate project/cohort allocation',
          },
        ],
      };
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private persist(key: string, value: any) {
    setStored(key, value);
    this.notify();
  }

  // --- Network & Offline Sync Engine ---
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public setOnlineStatus(online: boolean) {
    this.isOnline = online;
    this.persist(STORAGE_KEYS.IS_ONLINE, online);
    if (online) {
      if (this.offlineQueue.length > 0) {
        this.syncPendingRecords();
      }
      this.syncPendingActivities();
    }
  }

  private handleNetworkChange(online: boolean) {
    this.setOnlineStatus(online);
  }

  public getOfflineQueue(): OfflineSyncItem[] {
    return this.offlineQueue;
  }

  public syncPendingRecords(): { success: boolean; syncedCount: number } {
    const count = this.offlineQueue.length;
    if (count === 0) return { success: true, syncedCount: 0 };

    // Record audit of batch sync
    const currentUser = this.getCurrentUser();
    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Offline Records Synchronized',
      'System',
      'sync-engine',
      `${count} pending operations`,
      'All local changes reconciled with server master database'
    );

    this.addNotification({
      title: 'Sync Completed',
      message: `Successfully synchronized ${count} queued records with the server database.`,
      type: 'success',
    });

    this.offlineQueue = [];
    this.persist(STORAGE_KEYS.OFFLINE_QUEUE, this.offlineQueue);
    return { success: true, syncedCount: count };
  }

  public enqueueOfflineAction(action: OfflineSyncItem['action'], payload: any, description: string) {
    const item: OfflineSyncItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      payload,
      timestamp: Date.now(),
      description,
    };
    this.offlineQueue.push(item);
    this.persist(STORAGE_KEYS.OFFLINE_QUEUE, this.offlineQueue);
  }

  // --- Field Mobilisers Master List (Distinct from Login Accounts) ---
  public getFieldMobilisers(state?: string, onlyActive = false, filterUser?: User): FieldMobiliser[] {
    const activeUser = filterUser || this.getCurrentUser();
    const assignedState = getUserAssignedState(activeUser);
    const effectiveState =
      activeUser && activeUser.role !== 'admin' && assignedState
        ? assignedState
        : state;

    const seen = new Set<string>();
    const deduped: FieldMobiliser[] = [];
    for (const m of this.fieldMobilisers) {
      if (!m || !m.id) continue;
      // Exclude login profile names e.g. "Mobiliser (Nagaland)" if present
      if (m.name && m.name.startsWith('Mobiliser (') && m.name.endsWith(')')) continue;
      const normId = m.id.trim().toLowerCase();
      if (seen.has(normId)) continue;
      seen.add(normId);
      deduped.push(m);
    }
    let list = deduped;
    if (effectiveState && effectiveState !== 'All' && effectiveState !== 'All States') {
      const stateLower = effectiveState.trim().toLowerCase();
      list = list.filter((m) => {
        const mState = (m.state || (m.district ? getStateForDistrict(m.district) : '') || '').trim().toLowerCase();
        return mState === stateLower;
      });
    }
    if (onlyActive) {
      list = list.filter((m) => m.status === 'active');
    }
    return list;
  }

  public getFieldMobiliserById(id: string, filterUser?: User): FieldMobiliser | undefined {
    const mob = this.fieldMobilisers.find(
      (m) => m.id === id || m.name.toLowerCase() === id.toLowerCase()
    );
    if (!mob) return undefined;
    const activeUser = filterUser || this.getCurrentUser();
    const assignedState = getUserAssignedState(activeUser);
    if (activeUser && activeUser.role !== 'admin' && assignedState) {
      const stateLower = assignedState.trim().toLowerCase();
      const mState = (mob.state || (mob.district ? getStateForDistrict(mob.district) : '') || '').trim().toLowerCase();
      if (mState !== stateLower) {
        return undefined;
      }
    }
    return mob;
  }

  public addFieldMobiliser(
    data: Omit<FieldMobiliser, 'id' | 'createdAt'>,
    actorName?: string
  ): FieldMobiliser {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can add field mobilisers.');
    }
    const statePrefix = data.state.slice(0, 2).toLowerCase();
    const newMobiliser: FieldMobiliser = {
      ...data,
      id: `fm-${statePrefix}-${Date.now()}`,
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
    };
    this.fieldMobilisers.push(newMobiliser);
    this.persist(STORAGE_KEYS.FIELD_MOBILISERS, this.fieldMobilisers);

    this.addAuditLog({
      action: 'CREATE',
      module: 'FieldMobilisers',
      recordId: newMobiliser.id,
      recordTitle: `${newMobiliser.name} (${newMobiliser.state})`,
      performedBy: actorName || currentUser.name,
      details: `Added field mobiliser ${newMobiliser.name} under ${newMobiliser.state}.`,
    });

    return newMobiliser;
  }

  public updateFieldMobiliser(
    id: string,
    updates: Partial<FieldMobiliser>,
    actorName?: string
  ): FieldMobiliser | undefined {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify field mobilisers.');
    }
    const index = this.fieldMobilisers.findIndex((m) => m.id === id);
    if (index === -1) return undefined;

    const old = this.fieldMobilisers[index];
    const updated: FieldMobiliser = {
      ...old,
      ...updates,
    };
    this.fieldMobilisers[index] = updated;
    this.persist(STORAGE_KEYS.FIELD_MOBILISERS, this.fieldMobilisers);

    this.addAuditLog({
      action: 'UPDATE',
      module: 'FieldMobilisers',
      recordId: id,
      recordTitle: `${updated.name} (${updated.state})`,
      performedBy: actorName || currentUser.name,
      details: `Updated details for field mobiliser ${updated.name}.`,
    });

    return updated;
  }

  public toggleFieldMobiliserStatus(id: string, actorName?: string): void {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can activate/deactivate field mobilisers.');
    }
    const mobiliser = this.fieldMobilisers.find((m) => m.id === id);
    if (!mobiliser) return;

    mobiliser.status = mobiliser.status === 'active' ? 'inactive' : 'active';
    this.persist(STORAGE_KEYS.FIELD_MOBILISERS, this.fieldMobilisers);

    this.addAuditLog({
      action: 'UPDATE',
      module: 'FieldMobilisers',
      recordId: id,
      recordTitle: `${mobiliser.name} (${mobiliser.state})`,
      performedBy: actorName || currentUser.name,
      details: `Status set to ${mobiliser.status}.`,
    });
  }

  public deleteFieldMobiliser(id: string, actorName?: string): boolean {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can remove field mobilisers.');
    }
    const index = this.fieldMobilisers.findIndex((m) => m.id === id);
    if (index === -1) return false;

    const removed = this.fieldMobilisers.splice(index, 1)[0];
    this.persist(STORAGE_KEYS.FIELD_MOBILISERS, this.fieldMobilisers);

    this.addAuditLog({
      action: 'DELETE',
      module: 'FieldMobilisers',
      recordId: id,
      recordTitle: `${removed.name} (${removed.state})`,
      performedBy: actorName || currentUser.name,
      details: `Removed field mobiliser ${removed.name} from ${removed.state}.`,
    });

    return true;
  }

  // --- Login Users & Roles ---
  public getUsers(): User[] {
    return this.users;
  }

  public getCurrentUser(): User {
    const user = this.users.find((u) => u.id === this.currentUserId);
    return user || this.users[0];
  }

  public setCurrentUser(userOrId: User | string) {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
    this.currentUserId = userId;
    this.persist(STORAGE_KEYS.CURRENT_USER_ID, userId);
  }

  public addUser(userData: Omit<User, 'id'>, actorName?: string): User {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can create login accounts.');
    }
    const newUser: User = {
      ...userData,
      id: `u-custom-${Date.now()}`,
    };
    this.users.push(newUser);
    this.persist(STORAGE_KEYS.USERS, this.users);

    this.addAuditLog({
      action: 'CREATE',
      module: 'Users',
      recordId: newUser.id,
      recordTitle: `${newUser.name} (${newUser.role})`,
      performedBy: actorName || currentUser.name,
      details: `Created login account for ${newUser.name} assigned to state ${newUser.state}.`,
    });

    return newUser;
  }

  public deleteUser(id: string, actorName?: string): boolean {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can remove login accounts.');
    }
    if (id === 'u-admin-1') {
      throw new Error('The primary administrator account cannot be removed.');
    }
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const removed = this.users.splice(index, 1)[0];
    this.persist(STORAGE_KEYS.USERS, this.users);

    if (this.currentUserId === id) {
      this.currentUserId = 'u-admin-1';
      this.persist(STORAGE_KEYS.CURRENT_USER_ID, this.currentUserId);
    }

    this.addAuditLog({
      action: 'DELETE',
      module: 'Users',
      recordId: id,
      recordTitle: `${removed.name} (${removed.role})`,
      performedBy: actorName || currentUser.name,
      details: `Removed login account for ${removed.name}.`,
    });

    return true;
  }

  public toggleUserStatus(id: string, actorName?: string): void {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can change login account status.');
    }
    if (id === 'u-admin-1') {
      throw new Error('The primary administrator account cannot be deactivated.');
    }
    const user = this.users.find((u) => u.id === id);
    if (!user) return;

    user.status = user.status === 'active' ? 'inactive' : 'active';
    this.persist(STORAGE_KEYS.USERS, this.users);

    this.addAuditLog({
      action: 'UPDATE',
      module: 'Users',
      recordId: id,
      recordTitle: `${user.name} (${user.role})`,
      performedBy: actorName || currentUser.name,
      details: `Account status toggled to ${user.status}.`,
    });
  }

  public getMobilisers(state?: string, onlyActive = false): Array<FieldMobiliser & { role: 'mobiliser' }> {
    return this.getFieldMobilisers(state, onlyActive).map((fm) => ({
      ...fm,
      role: 'mobiliser' as const,
      monthlyTarget: fm.monthlyTarget || 50,
      assignedBlocks: [],
      district: fm.district || 'Assigned District',
    }));
  }

  // --- Master Data ---
  public getDistricts(): District[] {
    return this.districts;
  }

  public getProjects(stateFilter?: string, filterUser?: User): Project[] {
    const activeUser = filterUser || this.getCurrentUser();
    const assignedState = getUserAssignedState(activeUser);

    // If non-admin, enforce their assigned state (security/data integrity)
    const effectiveState =
      activeUser && activeUser.role !== 'admin' && assignedState
        ? assignedState
        : stateFilter;

    if (!effectiveState || effectiveState === 'All' || effectiveState === 'All States') {
      return this.projects;
    }

    const stateLower = effectiveState.trim().toLowerCase();
    return this.projects.filter((p) => {
      const pState = (p.state || '').trim().toLowerCase();
      return pState === stateLower || pState === 'all states' || pState === 'all' || !pState;
    });
  }

  public getProjectById(id: string): Project | undefined {
    return this.projects.find(
      (p) => p.id === id || p.name.toLowerCase() === id.toLowerCase()
    );
  }

  public getProgrammes(onlyActive = false, stateFilter?: string, filterUser?: User): string[] {
    const projs = this.getProjects(stateFilter, filterUser);
    const activeProjs = onlyActive ? projs.filter((p) => p.status === 'Active') : projs;
    const set = new Set<string>();
    activeProjs.forEach((p) => {
      if (p.name) set.add(p.name.trim());
    });
    return Array.from(set);
  }

  public getStatesForProgramme(programmeName: string, onlyActive = true): string[] {
    if (!programmeName) return [];
    const projs = this.projects.filter((p) => {
      if (p.name.toLowerCase() !== programmeName.toLowerCase()) return false;
      if (onlyActive && p.status !== 'Active') return false;
      return true;
    });
    const states = new Set<string>();
    let hasAllStates = false;
    projs.forEach((p) => {
      const st = (p.state || 'All States').trim();
      if (st.toLowerCase() === 'all states' || st.toLowerCase() === 'all') {
        hasAllStates = true;
      } else {
        states.add(st);
      }
    });
    if (hasAllStates) {
      ['Assam', 'Meghalaya', 'Nagaland', 'Manipur'].forEach((s) => states.add(s));
      states.add('All States');
    }
    return Array.from(states);
  }

  public getYearsForProgrammeAndState(programmeName: string, state?: string, onlyActive = true): string[] {
    if (!programmeName) return [];
    const projs = this.projects.filter((p) => {
      if (p.name.toLowerCase() !== programmeName.toLowerCase()) return false;
      if (onlyActive && p.status !== 'Active') return false;
      if (state && state !== 'All' && state !== 'All States') {
        const pState = (p.state || 'All States').trim().toLowerCase();
        if (pState !== 'all states' && pState !== 'all' && pState !== state.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
    const years = new Set<string>();
    projs.forEach((p) => {
      years.add(p.year || '2026-27');
    });
    if (years.size === 0) {
      years.add('2026-27');
    }
    return Array.from(years);
  }

  public getPhasesForProgrammeStateYear(
    programmeName: string,
    state?: string,
    year?: string,
    onlyActive = true
  ): string[] {
    if (!programmeName) return [];
    const normSearchProg = normalizeProgrammeName(programmeName);
    const projs = this.projects.filter((p) => {
      if (normalizeProgrammeName(p.name) !== normSearchProg) return false;
      if (onlyActive && p.status !== 'Active') return false;
      if (state && state !== 'All' && state !== 'All States') {
        const pState = normalizeProgrammeState(p.state);
        const searchState = normalizeProgrammeState(state);
        if (pState !== 'all states' && pState !== searchState) {
          return false;
        }
      }
      if (year && normalizeProgrammeYear(p.year) !== normalizeProgrammeYear(year)) {
        return false;
      }
      return true;
    });
    const phases = new Set<string>();
    projs.forEach((p) => {
      if (Array.isArray(p.phases)) {
        p.phases.forEach((ph) => {
          if (ph && ph.trim()) phases.add(ph.trim());
        });
      }
      if (p.phase && p.phase.trim()) {
        phases.add(p.phase.trim());
      }
    });
    return Array.from(phases);
  }

  public getCyclesForProgrammeStateYear(
    programmeName: string,
    state?: string,
    year?: string,
    onlyActive = true,
    filterPhase?: string
  ): string[] {
    if (!programmeName) return [];
    const normSearchProg = normalizeProgrammeName(programmeName);
    const projs = this.projects.filter((p) => {
      if (normalizeProgrammeName(p.name) !== normSearchProg) return false;
      if (onlyActive && p.status !== 'Active') return false;
      if (state && state !== 'All' && state !== 'All States') {
        const pState = normalizeProgrammeState(p.state);
        const searchState = normalizeProgrammeState(state);
        if (pState !== 'all states' && pState !== searchState) {
          return false;
        }
      }
      if (year && normalizeProgrammeYear(p.year) !== normalizeProgrammeYear(year)) {
        return false;
      }
      if (filterPhase && filterPhase.trim()) {
        const normFilter = normalizeProgrammePhase(filterPhase);
        const pPhases = (Array.isArray(p.phases) && p.phases.length > 0)
          ? p.phases.map(normalizeProgrammePhase)
          : (p.phase ? [normalizeProgrammePhase(p.phase)] : []);
        if (pPhases.length > 0 && !pPhases.includes(normFilter)) {
          return false;
        }
      }
      return true;
    });
    const cycles = new Set<string>();
    projs.forEach((p) => {
      if (Array.isArray(p.cycles)) {
        p.cycles.forEach((cy) => {
          if (cy && cy.trim()) cycles.add(cy.trim());
        });
      }
      if (p.cycle && p.cycle.trim()) {
        cycles.add(p.cycle.trim());
      }
    });
    if (cycles.size === 0 && filterPhase) {
      return this.getCyclesForProgrammeStateYear(programmeName, state, year, onlyActive);
    }
    return Array.from(cycles);
  }

  /**
   * Validates if a proposed Programme configuration (Programme + State + Year + Phase + Cycle)
   * already exists in Programme Master.
   * Returns isDuplicate: true and the exact error message if duplicate found.
   */
  public checkProgrammeConfigurationDuplicate(params: {
    name: string;
    state?: string;
    year?: string;
    phase?: string;
    cycle?: string;
    phases?: string[];
    cycles?: string[];
    excludeProjectId?: string;
  }): { isDuplicate: boolean; message?: string; conflictingProject?: Project } {
    if (!params.name || !params.name.trim()) {
      return { isDuplicate: false };
    }

    const newKeys = getProjectConfigurationKeys(params);

    for (const existing of this.projects) {
      if (params.excludeProjectId && existing.id === params.excludeProjectId) {
        continue;
      }
      const existingKeys = getProjectConfigurationKeys(existing);
      for (const nk of newKeys) {
        if (existingKeys.includes(nk)) {
          return {
            isDuplicate: true,
            message: DUPLICATE_PROGRAMME_CONFIG_ERROR,
            conflictingProject: existing,
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  public addProject(
    data: Omit<Project, 'id'>,
    actorName?: string
  ): Project {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can add programmes.');
    }

    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error('Programme Name is required.');
    }

    const trimmedState = (data.state || 'All States').trim();
    const trimmedYear = (data.year || '2026-27').trim();

    const phase = data.phase || (Array.isArray(data.phases) && data.phases.length > 0 ? data.phases[0] : '');
    const cycle = data.cycle || (Array.isArray(data.cycles) && data.cycles.length > 0 ? data.cycles[0] : '');
    const phases = Array.isArray(data.phases) && data.phases.length > 0 ? data.phases : (phase ? [phase] : []);
    const cycles = Array.isArray(data.cycles) && data.cycles.length > 0 ? data.cycles : (cycle ? [cycle] : []);

    // Duplicate prevention: Programme + State + Year + Phase + Cycle
    const duplicateCheck = this.checkProgrammeConfigurationDuplicate({
      name: trimmedName,
      state: trimmedState,
      year: trimmedYear,
      phase,
      cycle,
      phases,
      cycles,
    });

    if (duplicateCheck.isDuplicate) {
      throw new Error(DUPLICATE_PROGRAMME_CONFIG_ERROR);
    }

    const nameSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const stateSlug = trimmedState
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const yearSlug = trimmedYear
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const phaseSlug = (phase || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const cycleSlug = (cycle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newProject: Project = {
      id: `proj-${nameSlug || 'prog'}-${stateSlug || 'all'}-${yearSlug || 'yr'}${phaseSlug ? `-${phaseSlug}` : ''}${cycleSlug ? `-${cycleSlug}` : ''}-${Date.now().toString(36).slice(-4)}`,
      name: trimmedName,
      state: trimmedState,
      year: trimmedYear,
      phase,
      cycle,
      phases,
      cycles,
      description: data.description?.trim() || '',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      endDate: data.endDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      status: data.status || 'Active',
      target: typeof data.target === 'number' && !isNaN(data.target) ? data.target : 100,
    };

    this.projects.push(newProject);
    this.persist(STORAGE_KEYS.PROJECTS, this.projects);
    this.notify();

    this.addAuditLog({
      action: 'CREATE',
      module: 'ProgrammeMaster',
      recordId: newProject.id,
      recordTitle: `${newProject.name} (${newProject.state} - ${newProject.year}${phase ? ` - ${phase}` : ''}${cycle ? ` - ${cycle}` : ''})`,
      performedBy: actorName || currentUser.name,
      details: `Added new programme "${newProject.name}" for "${newProject.state}" (${newProject.year}${phase ? `, ${phase}` : ''}${cycle ? `, ${cycle}` : ''}) with a target of ${newProject.target} candidates.`,
    });

    return newProject;
  }

  public updateProject(
    id: string,
    updates: Partial<Project>,
    actorName?: string
  ): Project | undefined {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify programmes.');
    }

    const index = this.projects.findIndex((p) => p.id === id);
    if (index === -1) return undefined;

    const old = this.projects[index];
    const newName = updates.name !== undefined ? updates.name.trim() : old.name;
    const newState = updates.state !== undefined ? updates.state.trim() : (old.state || 'All States');
    const newYear = updates.year !== undefined ? updates.year.trim() : (old.year || '2026-27');

    if (!newName) {
      throw new Error('Programme Name cannot be empty.');
    }

    const newPhases = updates.phases !== undefined ? updates.phases : (old.phases || []);
    const newCycles = updates.cycles !== undefined ? updates.cycles : (old.cycles || []);
    const newPhase = updates.phase !== undefined ? updates.phase : (updates.phases && updates.phases.length > 0 ? updates.phases[0] : old.phase);
    const newCycle = updates.cycle !== undefined ? updates.cycle : (updates.cycles && updates.cycles.length > 0 ? updates.cycles[0] : old.cycle);

    // Duplicate check strictly before saving: Programme + State + Year + Phase + Cycle
    // Exclude the current project id being updated
    const duplicateCheck = this.checkProgrammeConfigurationDuplicate({
      name: newName,
      state: newState,
      year: newYear,
      phase: newPhase,
      cycle: newCycle,
      phases: newPhases,
      cycles: newCycles,
      excludeProjectId: id,
    });

    if (duplicateCheck.isDuplicate) {
      throw new Error(DUPLICATE_PROGRAMME_CONFIG_ERROR);
    }

    const updated: Project = {
      ...old,
      ...updates,
      name: newName,
      state: newState,
      year: newYear,
      phase: newPhase,
      cycle: newCycle,
      phases: newPhases,
      cycles: newCycles,
      description: updates.description !== undefined ? updates.description.trim() : old.description,
      target: typeof updates.target === 'number' && !isNaN(updates.target) ? updates.target : old.target,
    };

    this.projects[index] = updated;

    // If programme name changed, propagate to candidates and batches
    if (old.name !== newName) {
      let candidateUpdated = false;
      this.candidates.forEach((c) => {
        if (c.programme === old.name || c.projectName === old.name || c.project === old.name) {
          c.programme = newName;
          c.projectName = newName;
          c.project = newName;
          candidateUpdated = true;
        }
      });
      if (candidateUpdated) {
        this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
      }

      let batchUpdated = false;
      this.batches.forEach((b) => {
        if (b.projectId === old.id || b.projectName === old.name) {
          b.projectName = newName;
          batchUpdated = true;
        }
      });
      if (batchUpdated) {
        this.persist(STORAGE_KEYS.BATCHES, this.batches);
      }
    }

    this.persist(STORAGE_KEYS.PROJECTS, this.projects);
    this.notify();

    this.addAuditLog({
      action: 'UPDATE',
      module: 'ProgrammeMaster',
      recordId: id,
      recordTitle: `${updated.name} (${updated.state} - ${updated.year})`,
      performedBy: actorName || currentUser.name,
      details: `Updated programme "${updated.name}" (${updated.state} - ${updated.year}) details.`,
    });

    return updated;
  }

  public deleteProject(id: string, actorName?: string): boolean {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can delete programmes.');
    }

    const index = this.projects.findIndex((p) => p.id === id);
    if (index === -1) return false;

    const removed = this.projects.splice(index, 1)[0];
    this.persist(STORAGE_KEYS.PROJECTS, this.projects);
    this.notify();

    this.addAuditLog({
      action: 'DELETE',
      module: 'ProgrammeMaster',
      recordId: id,
      recordTitle: `${removed.name} (${removed.state || 'All States'})`,
      performedBy: actorName || currentUser.name,
      details: `Deleted programme "${removed.name}" for "${removed.state || 'All States'}".`,
    });

    return true;
  }

  public getBatches(): Batch[] {
    return this.batches;
  }

  // --- Duplicate Detection ---
  public checkDuplicates(
    phone: string,
    alternatePhone?: string,
    name?: string,
    dob?: string,
    parentName?: string
  ): Candidate[] {
    const cleanPhone = (p?: string) => (p ? p.replace(/\D/g, '').slice(-10) : '');
    const cleanTargetPhone = cleanPhone(phone);
    const cleanAltPhone = cleanPhone(alternatePhone);
    const cleanTargetName = name?.trim().toLowerCase() || '';
    const cleanParent = parentName?.trim().toLowerCase() || '';

    return this.candidates.filter((c) => {
      const cPhone = cleanPhone(c.phone);
      const cAltPhone = cleanPhone(c.alternatePhone);
      const cParentPhone = cleanPhone(c.parentPhone);

      // Match phone
      if (cleanTargetPhone && (cPhone === cleanTargetPhone || cAltPhone === cleanTargetPhone || cParentPhone === cleanTargetPhone)) {
        return true;
      }
      // Match alt phone
      if (cleanAltPhone && (cPhone === cleanAltPhone || cAltPhone === cleanAltPhone)) {
        return true;
      }
      // Match Name + DOB
      if (cleanTargetName && dob && c.name.toLowerCase() === cleanTargetName && c.dob === dob) {
        return true;
      }
      // Match Name + Parent Name
      if (
        cleanTargetName &&
        cleanParent &&
        c.name.toLowerCase() === cleanTargetName &&
        (c.fatherName?.toLowerCase().includes(cleanParent) || c.motherName?.toLowerCase().includes(cleanParent))
      ) {
        return true;
      }
      return false;
    });
  }

  // --- Candidates Management ---
  public getIsSyncingRemoteCandidates(): boolean {
    return this.isSyncingRemoteCandidates;
  }

  public getCandidates(filterUser?: User, stage?: CandidateStage | 'All'): Candidate[] {
    let list = this.candidates;
    const activeUser = filterUser || this.getCurrentUser();

    // State-Based Access Control: Non-admin users are strictly restricted to candidates of their assigned state
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const targetStateLower = activeUser.state.trim().toLowerCase();
      list = list.filter((c) => (c.state || '').trim().toLowerCase() === targetStateLower);
    }

    if (stage && stage !== 'All') {
      list = list.filter((c) => {
        const cStage = c.stage || getStageForStatus(c.currentStatus);
        if (stage === 'Pre-Mobilisation') {
          return cStage === 'Pre-Mobilisation' || PRE_MOBILISATION_STATUSES.includes(c.currentStatus as any);
        } else {
          return (
            cStage === 'Post-Mobilisation' ||
            POST_MOBILISATION_STATUSES.includes(c.currentStatus as any) ||
            c.currentStatus === 'Documents Complete'
          );
        }
      });
    }
    return list;
  }

  public getCandidateById(id: string, filterUser?: User): Candidate | undefined {
    const candidate = this.candidates.find((c) => c.id === id || c.candidateId === id);
    if (!candidate) return undefined;
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const targetStateLower = activeUser.state.trim().toLowerCase();
      if ((candidate.state || '').trim().toLowerCase() !== targetStateLower) {
        return undefined; // Prevent unauthorized cross-state access
      }
    }
    return candidate;
  }

  public deleteCandidate(id: string, reason?: string, actorName?: string): boolean {
    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can delete candidate records.');
    }

    const index = this.candidates.findIndex((c) => c.id === id || c.candidateId === id);
    if (index === -1) return false;

    const candidate = this.candidates[index];
    this.candidates.splice(index, 1);
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);

    // Clean up associated documents, call logs, follow-ups
    this.documents = this.documents.filter((d) => d.candidateId !== candidate.id);
    this.persist(STORAGE_KEYS.DOCUMENTS, this.documents);

    this.callLogs = this.callLogs.filter((l) => l.candidateId !== candidate.id);
    this.persist(STORAGE_KEYS.CALL_LOGS, this.callLogs);

    this.followUps = this.followUps.filter((f) => f.candidateId !== candidate.id);
    this.persist(STORAGE_KEYS.FOLLOW_UPS, this.followUps);

    this.addAuditLog({
      action: 'DELETE',
      module: 'Candidates',
      recordId: candidate.id,
      recordTitle: `${candidate.name} (${candidate.candidateId})`,
      performedBy: actorName || currentUser.name,
      details: `Candidate record permanently removed. Reason: ${reason || 'Admin deletion'}`,
    });

    if (this.isOnline) {
      appsScriptApi.deleteCandidate({ candidateId: candidate.candidateId || candidate.id }).catch(() => {});
    }

    this.notify();
    return true;
  }

  public generateCandidateId(stateName?: string): string {
    const year = new Date().getFullYear();
    const count = this.candidates.length + 1;
    const padded = String(count).padStart(5, '0');
    let prefix = 'NG';
    if (stateName) {
      const s = stateName.trim().toUpperCase();
      if (s === 'ASSAM') prefix = 'AS';
      else if (s === 'MEGHALAYA') prefix = 'ML';
      else if (s === 'TRIPURA') prefix = 'TR';
      else if (s === 'MANIPUR') prefix = 'MN';
      else if (s === 'MIZORAM') prefix = 'MZ';
      else if (s === 'ARUNACHAL PRADESH') prefix = 'AR';
      else if (s === 'SIKKIM') prefix = 'SK';
      else prefix = 'NG'; // Nagaland or default
    }
    return `${prefix}-${year}-${padded}`;
  }

  /**
   * Safe parser to map raw Google Sheets / Apps Script candidate objects into standard Candidate format.
   * Handles column name casing differences, missing keys, and varied formats.
   */
  public mapRemoteCandidate(raw: any, index: number): Candidate {
    const candidateId = String(
      raw.candidateId ||
      raw['Candidate ID'] ||
      raw.CandidateId ||
      raw['CandidateID'] ||
      raw.candidate_id ||
      `NG-${new Date().getFullYear()}-${String(index + 1).padStart(5, '0')}`
    ).trim();

    const id = String(
      raw.id ||
      raw.ID ||
      raw._id ||
      raw['ID'] ||
      `c-${candidateId}`
    ).trim();

    const name = String(
      raw.name ||
      raw['Name'] ||
      raw['Candidate Name'] ||
      raw['Student Name'] ||
      'Unnamed Candidate'
    ).trim();

    const gender = (raw.gender || raw['Gender'] || 'Other') as 'Male' | 'Female' | 'Other';
    const dob = String(raw.dob || raw['DOB'] || raw['Date of Birth'] || '').trim();
    const age = Number(raw.age || raw['Age'] || 0);
    const phone = String(raw.phone || raw['Phone'] || raw['Mobile'] || raw['Contact Number'] || '').trim();
    const alternatePhone = String(raw.alternatePhone || raw['Alternate Phone'] || '').trim();
    const parentPhone = String(raw.parentPhone || raw['Parent Phone'] || '').trim();
    const fatherName = String(raw.fatherName || raw['Father Name'] || raw["Father's Name"] || '').trim();
    const motherName = String(raw.motherName || raw['Mother Name'] || raw["Mother's Name"] || '').trim();
    const address = String(raw.address || raw['Address'] || '').trim();
    const state = String(raw.state || raw['State'] || 'Nagaland').trim();
    const district = String(raw.district || raw['District'] || '').trim();
    const block = String(raw.block || raw['Block'] || '').trim();
    const village = String(raw.village || raw['Village'] || '').trim();
    const pincode = String(raw.pincode || raw['Pincode'] || raw['Pin Code'] || '').trim();
    const qualification = String(raw.qualification || raw['Qualification'] || '12th Pass').trim();
    const schoolCollege = String(raw.schoolCollege || raw['School/College'] || raw['School College'] || '').trim();
    const yearOfPassing = String(raw.yearOfPassing || raw['Year of Passing'] || '').trim();
    const educationStatus = String(raw.educationStatus || raw['Education Status'] || 'Completed').trim();
    const programme = String(raw.programme || raw['Programme'] || raw.projectName || raw['Project Name'] || 'DDU-GKY 2.0').trim();
    const project = String(raw.project || raw['Project'] || raw.projectName || raw['Project Name'] || raw.programme || raw['Programme'] || 'DDU-GKY 2.0').trim();
    const year = raw.year || raw['Year'] || raw['Academic Year'] || raw['Financial Year'] ? String(raw.year || raw['Year'] || raw['Academic Year'] || raw['Financial Year']).trim() : undefined;
    const projectId = String(raw.projectId || raw['Project ID'] || (project.startsWith('CSR') ? 'proj-2' : project === 'RTD' ? 'proj-3' : 'proj-1')).trim();
    const projectName = String(raw.projectName || raw['Project Name'] || project).trim();
    const phase = raw.phase || raw['Phase'] ? String(raw.phase || raw['Phase']).trim() : undefined;
    const cycle = raw.cycle || raw['Cycle'] ? String(raw.cycle || raw['Cycle']).trim() : undefined;
    const batch = raw.batch || raw['Batch'] ? String(raw.batch || raw['Batch']).trim() : (raw.batchName || raw['Batch Name'] ? String(raw.batchName || raw['Batch Name']).trim() : undefined);
    const batchId = String(raw.batchId || raw['Batch ID'] || (batch ? `batch-${batch.replace(/\D/g, '') || '1'}` : '')).trim();
    const batchName = String(raw.batchName || raw['Batch Name'] || batch || '').trim();

    let allocationHistory: AllocationHistoryEntry[] = [];
    if (Array.isArray(raw.allocationHistory)) {
      allocationHistory = raw.allocationHistory;
    } else if (typeof raw.allocationHistory === 'string' && raw.allocationHistory.trim()) {
      try {
        allocationHistory = JSON.parse(raw.allocationHistory);
      } catch {
        // ignore
      }
    }
    const leadSource = String(raw.leadSource || raw['Lead Source'] || 'Field Mobilisation').trim();
    const leadSourceDetails = String(raw.leadSourceDetails || raw['Lead Source Details'] || '').trim();
    const assignedMobiliserId = String(raw.assignedMobiliserId || raw['Assigned Mobiliser ID'] || '').trim();
    const assignedMobiliserName = String(raw.assignedMobiliserName || raw['Assigned Mobiliser Name'] || '').trim();

    const ageEligibility = Boolean(raw.ageEligibility ?? raw['Age Eligibility'] ?? true);
    const educationEligibility = Boolean(raw.educationEligibility ?? raw['Education Eligibility'] ?? true);
    const otherEligibility = Boolean(raw.otherEligibility ?? raw['Other Eligibility'] ?? true);
    const eligibilityStatus = (raw.eligibilityStatus || raw['Eligibility Status'] || 'Eligible') as any;
    const eligibilityRemarks = String(raw.eligibilityRemarks || raw['Eligibility Remarks'] || '').trim();

    const documentsComplete = Boolean(raw.documentsComplete ?? raw['Documents Complete'] ?? false);
    let missingDocuments: string[] = [];
    if (Array.isArray(raw.missingDocuments)) {
      missingDocuments = raw.missingDocuments;
    } else if (typeof raw.missingDocuments === 'string' && raw.missingDocuments.trim()) {
      missingDocuments = raw.missingDocuments.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof raw['Missing Documents'] === 'string' && raw['Missing Documents'].trim()) {
      missingDocuments = raw['Missing Documents'].split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    const currentStatus = (raw.currentStatus || raw['Current Status'] || raw.status || raw['Status'] || 'New Lead') as CandidateStatus;
    const rawStage = raw.stage || raw['Stage'] || raw['Workflow Stage'];
    const stage: CandidateStage =
      rawStage === 'Post-Mobilisation' || rawStage === 'Pre-Mobilisation'
        ? rawStage
        : getStageForStatus(currentStatus);

    const screeningDate = raw.screeningDate || raw['Screening Date'] || undefined;
    const screenedBy = raw.screenedBy || raw['Screened By'] || undefined;
    const screeningResult = raw.screeningResult || raw['Screening Result'] || undefined;
    const screeningEligibility = raw.screeningEligibility || raw['Screening Eligibility'] || undefined;
    const screeningRemarks = raw.screeningRemarks || raw['Screening Remarks'] || undefined;

    const trainingStatus = raw.trainingStatus || raw['Training Status'] || undefined;
    const placementStatus = raw.placementStatus || raw['Placement Status'] || undefined;
    const placementEmployer = raw.placementEmployer || raw['Placement Employer'] || undefined;
    const placementSalary = raw.placementSalary || raw['Placement Salary'] || undefined;
    const placementDate = raw.placementDate || raw['Placement Date'] || undefined;
    const dropoutReason = raw.dropoutReason || raw['Dropout Reason'] || undefined;
    const dropoutDate = raw.dropoutDate || raw['Dropout Date'] || undefined;

    const createdAt = String(raw.createdAt || raw['Created At'] || new Date().toISOString()).trim();
    const updatedAt = String(raw.updatedAt || raw['Updated At'] || createdAt).trim();

    return {
      id,
      candidateId,
      name,
      gender,
      dob,
      age,
      phone,
      alternatePhone,
      parentPhone,
      fatherName,
      motherName,
      address,
      state,
      district,
      block,
      village,
      pincode,
      qualification,
      schoolCollege,
      yearOfPassing,
      educationStatus,
      programme,
      project,
      year: year || '2026-27',
      phase,
      cycle,
      batch,
      allocationHistory,
      projectId,
      projectName,
      batchId,
      batchName,
      leadSource,
      leadSourceDetails,
      assignedMobiliserId,
      assignedMobiliserName,
      ageEligibility,
      educationEligibility,
      otherEligibility,
      eligibilityStatus,
      eligibilityRemarks,
      documentsComplete,
      missingDocuments,
      stage,
      currentStatus,
      screeningDate,
      screenedBy,
      screeningResult,
      screeningEligibility,
      screeningRemarks,
      trainingStatus,
      placementStatus,
      placementEmployer,
      placementSalary,
      placementDate,
      dropoutReason,
      dropoutDate,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Synchronizes candidates directly from Google Sheets via appsScriptApi.getCandidates().
   * Google Sheets acts as the single source of truth.
   * Merges remote records without creating duplicates, and preserves newly created local records.
   */
  public async syncCandidatesFromGoogleSheets(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      this.isSyncingRemoteCandidates = true;
      this.notify();

      // 1. Call getCandidates() from the Apps Script API
      const response = await appsScriptApi.getCandidates();

      let rawList: any[] = [];
      if (Array.isArray(response)) {
        rawList = response;
      } else if (response && Array.isArray(response.data)) {
        rawList = response.data;
      } else if (response && Array.isArray(response.candidates)) {
        rawList = response.candidates;
      } else if (response && response.data && Array.isArray(response.data.candidates)) {
        rawList = response.data.candidates;
      } else if (response && Array.isArray(response.rows)) {
        rawList = response.rows;
      } else if (response && response.success === false) {
        // Known or unknown error returned from backend
        this.isSyncingRemoteCandidates = false;
        this.notify();
        return {
          success: false,
          count: this.candidates.length,
          error: response.message || 'Google Sheets API did not return candidates',
        };
      }

      // If remote list was retrieved from Google Sheets, update local store with deduplication
      if (rawList && rawList.length > 0) {
        const mappedRemoteCandidates: Candidate[] = rawList.map((item, idx) => {
          return this.mapRemoteCandidate(item, idx);
        });

        // Deduplication map: prioritize candidateId, then id, then phone + name
        const mergedMap = new Map<string, Candidate>();
        const phoneNameSet = new Set<string>();

        // Step 1: Google Sheets is source of truth - add remote candidates
        mappedRemoteCandidates.forEach((cand) => {
          const key = cand.candidateId ? cand.candidateId.toUpperCase().trim() : cand.id;
          if (key) {
            mergedMap.set(key, cand);
            if (cand.phone && cand.name) {
              phoneNameSet.add(`${cand.phone.trim()}_${cand.name.toLowerCase().trim()}`);
            }
          }
        });

        // Step 2: Preserve any newly added local candidate that may not yet have synced to remote
        this.candidates.forEach((localCand) => {
          const key = localCand.candidateId ? localCand.candidateId.toUpperCase().trim() : localCand.id;
          const phoneNameKey = localCand.phone && localCand.name ? `${localCand.phone.trim()}_${localCand.name.toLowerCase().trim()}` : '';

          const existsByKey = mergedMap.has(key);
          const existsByPhoneName = phoneNameKey ? phoneNameSet.has(phoneNameKey) : false;

          if (!existsByKey && !existsByPhoneName) {
            mergedMap.set(key, localCand);
            if (phoneNameKey) phoneNameSet.add(phoneNameKey);
          }
        });

        const newCandidates = Array.from(mergedMap.values());
        this.candidates = this.syncCandidates(newCandidates);
        this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
      }

      this.isSyncingRemoteCandidates = false;
      this.notify();
      return { success: true, count: this.candidates.length };
    } catch (err: any) {
      console.warn('Apps Script getCandidates synchronization completed with notice:', err);
      this.isSyncingRemoteCandidates = false;
      this.notify();
      return { success: false, count: this.candidates.length, error: err?.message || 'Network error' };
    }
  }

  /**
   * Identifies likely duplicate candidate records across Phone, Alt Phone, or Name + DOB
   */
  public findDuplicateCandidate(info: {
    phone?: string;
    alternatePhone?: string;
    name?: string;
    dob?: string;
    candidateId?: string;
    excludeId?: string;
  }): Candidate | null {
    const cleanPhone = (info.phone || '').replace(/\D/g, '').slice(-10);
    const cleanAlt = (info.alternatePhone || '').replace(/\D/g, '').slice(-10);
    const cleanName = (info.name || '').trim().toLowerCase();
    const cleanDob = (info.dob || '').trim();
    const cleanCid = (info.candidateId || '').trim().toLowerCase();

    return (
      this.candidates.find((c) => {
        if (info.excludeId && (c.id === info.excludeId || c.candidateId === info.excludeId)) return false;

        // Exact candidateId match
        if (cleanCid && c.candidateId.toLowerCase() === cleanCid) return true;

        // Exact 10-digit phone match
        if (cleanPhone && cleanPhone.length >= 7) {
          const cPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
          const cAltPhone = (c.alternatePhone || '').replace(/\D/g, '').slice(-10);
          if (cPhone && cPhone === cleanPhone) return true;
          if (cAltPhone && cAltPhone === cleanPhone) return true;
        }

        if (cleanAlt && cleanAlt.length >= 7) {
          const cPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
          const cAltPhone = (c.alternatePhone || '').replace(/\D/g, '').slice(-10);
          if (cPhone && cPhone === cleanAlt) return true;
          if (cAltPhone && cAltPhone === cleanAlt) return true;
        }

        // Exact name + DOB match
        if (cleanName && cleanDob && c.name.trim().toLowerCase() === cleanName && c.dob?.trim() === cleanDob) {
          return true;
        }

        return false;
      }) || null
    );
  }

  public addCandidate(
    candidateData: Omit<Candidate, 'id' | 'candidateId' | 'createdAt' | 'updatedAt' | 'currentStatus'> & {
      id?: string;
      candidateId?: string;
      createdAt?: string;
      updatedAt?: string;
      currentStatus?: CandidateStatus;
      stage?: CandidateStage;
      forceOfflineQueue?: boolean;
    }
  ): Candidate {
    // 1. Strict Duplicate Prevention across system
    const existingDuplicate = this.findDuplicateCandidate({
      phone: candidateData.phone,
      alternatePhone: candidateData.alternatePhone,
      name: candidateData.name,
      dob: candidateData.dob,
      candidateId: candidateData.candidateId,
      excludeId: candidateData.id,
    });
    if (existingDuplicate) {
      throw new Error(
        `This candidate may already exist in the system: ${existingDuplicate.name} (${existingDuplicate.candidateId}) with phone ${existingDuplicate.phone}, assigned to ${existingDuplicate.assignedMobiliserName || 'Staff'}. Duplicate registrations are strictly forbidden. Please open or update the existing record.`
      );
    }

    const now = candidateData.createdAt || new Date().toISOString();
    const id = candidateData.id || `c-${Date.now()}`;
    const currentUser = this.getCurrentUser();

    // State Access Control: If non-admin, candidate state is strictly bound to user's assigned state
    let candidateState = candidateData.state || 'Nagaland';
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      candidateState = currentUser.state;
    }
    const candidateId = candidateData.candidateId || this.generateCandidateId(candidateState);

    const assignedMob =
      this.fieldMobilisers.find((m) => m.id === candidateData.assignedMobiliserId) ||
      this.users.find((u) => u.id === candidateData.assignedMobiliserId);

    // Project, Year, Phase, Cycle, Batch handling:
    let project = candidateData.project || candidateData.projectName || candidateData.programme || 'DDU-GKY 2.0';
    if (project === 'DDU-GKY') project = 'DDU-GKY 2.0';
    let year = candidateData.year;
    if (!year) {
      const pMatch = this.projects.find(
        (p) => p.name.toLowerCase() === project.toLowerCase() && (p.state === candidateState || p.state === 'All States')
      );
      year = pMatch?.year || '2026-27';
    }
    let phase = candidateData.phase;
    let cycle = candidateData.cycle;
    let batch = candidateData.batch || candidateData.batchName;

    // Apply CSR and RTD project / batch logic
    if (project && (project.startsWith('CSR') || project === 'RTD')) {
      phase = undefined;
      cycle = undefined;
      if (!batch) {
        batch = candidateData.batch || 'Batch 1';
      }
    }

    const matchedProject = this.projects.find((p) => p.name === project);
    const normalizedProjectId = matchedProject
      ? matchedProject.id
      : project.startsWith('CSR')
      ? 'proj-2'
      : project === 'RTD'
      ? 'proj-3'
      : 'proj-1';

    const normalizedProgramme = project.startsWith('CSR') ? 'CSR' : project === 'RTD' ? 'RTD' : 'DDU-GKY 2.0';

    const applicableDocs = getApplicableDocumentsForProject(project);
    const rawCollected = candidateData.collectedDocuments || [];
    const validCollected = applicableDocs.filter((d) =>
      rawCollected.map((c) => normalizeDocumentName(c)).includes(d)
    );
    const missingDocs = applicableDocs.filter((d) => !validCollected.includes(d));
    const docCheck = evaluateDocumentTransition(project, validCollected);
    const meetsDocRequirement = docCheck.canTransition;

    let initialStatus: CandidateStatus = candidateData.currentStatus || (meetsDocRequirement ? 'New Lead' : 'Documents Pending');
    let initialStage: CandidateStage = candidateData.stage || 'Pre-Mobilisation';

    // Transition rule: If requirements not met for Post-Mobilisation, keep candidate in Pre-Mobilisation with Documents Pending
    if (!meetsDocRequirement) {
      if (POST_MOBILISATION_STATUSES.includes(initialStatus as any)) {
        initialStatus = 'Documents Pending';
        initialStage = 'Pre-Mobilisation';
      } else if (!candidateData.currentStatus) {
        initialStatus = 'Documents Pending';
        initialStage = 'Pre-Mobilisation';
      }
    }

    const initialAllocationHistory: AllocationHistoryEntry[] = [
      {
        id: `alloc-hist-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        candidateId: id,
        previousAllocation: {},
        newAllocation: {
          project,
          state: candidateState,
          year,
          phase,
          cycle,
          batch,
        },
        changedBy: currentUser.name,
        changedById: currentUser.id,
        changedAt: now,
        remarks: 'Initial candidate registration allocation',
      },
    ];

    const newCandidate: Candidate = {
      ...candidateData,
      state: candidateState,
      id,
      candidateId,
      project,
      year,
      phase,
      cycle,
      batch,
      programme: normalizedProgramme,
      projectId: normalizedProjectId,
      projectName: project,
      batchName: batch || candidateData.batchName,
      allocationHistory:
        candidateData.allocationHistory && candidateData.allocationHistory.length > 0
          ? candidateData.allocationHistory
          : initialAllocationHistory,
      assignedMobiliserName: assignedMob ? assignedMob.name : candidateData.assignedMobiliserName || currentUser.name,
      stage: initialStage,
      currentStatus: initialStatus,
      collectedDocuments: validCollected,
      missingDocuments: missingDocs,
      documentsComplete: meetsDocRequirement,
      createdAt: now,
      updatedAt: candidateData.updatedAt || now,
    };

    this.candidates = [newCandidate, ...this.candidates];
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);

    // Initialize CandidateDocument records for any collected documents
    if (validCollected.length > 0) {
      const initialDocs: CandidateDocument[] = validCollected.map((docName, idx) => {
        const uploadedMatch = (candidateData.uploadedDocuments || []).find(
          (u: any) => normalizeDocumentName(u.documentType) === docName
        );
        return {
          id: `doc-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          candidateId: id,
          candidateName: newCandidate.name,
          documentType: docName as DocumentType,
          fileName: uploadedMatch?.fileName || `${docName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${candidateId}.pdf`,
          fileUrl: uploadedMatch?.fileUrl || `https://example.com/docs/${candidateId}/${docName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`,
          status: 'Uploaded',
          uploadedBy: currentUser.name,
          uploadedAt: now,
          driveFileId: uploadedMatch?.driveFileId,
          fileSize: uploadedMatch?.fileSize,
          mimeType: uploadedMatch?.mimeType,
          base64Content: uploadedMatch?.base64Content,
          syncStatus: uploadedMatch?.driveFileId ? 'Synced' : (uploadedMatch?.base64Content ? 'Pending Sync' : undefined),
        };
      });
      this.documents = [...initialDocs, ...this.documents];
      this.persist(STORAGE_KEYS.DOCUMENTS, this.documents);
    }

    // Initial Status History with Stage tracking
    this.addStatusHistory(
      id,
      'None',
      newCandidate.currentStatus,
      'None',
      newCandidate.stage,
      currentUser.name,
      'Candidate registration created'
    );

    // Audit Log
    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Candidate Created',
      'Candidate',
      id,
      '',
      `${newCandidate.name} (${candidateId}) - Project: ${newCandidate.project || 'Unallocated'}, Stage: ${newCandidate.stage}`
    );

    // Offline queue if offline or forced
    if (!this.isOnline || candidateData.forceOfflineQueue) {
      this.enqueueOfflineAction('create_candidate', newCandidate, `Add candidate ${newCandidate.name}`);
    }

    // Push candidate to remote Apps Script backend
    this.pushCandidateToRemote(newCandidate);

    return newCandidate;
  }

  public updateCandidate(id: string, updates: Partial<Candidate>, reason?: string): Candidate | null {
    const index = this.candidates.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const oldCandidate = this.candidates[index];
    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();

    // State Access Control: Non-admin users cannot edit out-of-state candidates or change candidate state
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const userStateLower = currentUser.state.trim().toLowerCase();
      if ((oldCandidate.state || '').trim().toLowerCase() !== userStateLower) {
        throw new Error('Unauthorized: You cannot edit candidates from another state.');
      }
      if (updates.state && updates.state.trim().toLowerCase() !== userStateLower) {
        throw new Error('Unauthorized: You cannot reassign candidate to another state.');
      }
    }

    if (updates.assignedMobiliserId) {
      const assignedMob =
        this.fieldMobilisers.find((m) => m.id === updates.assignedMobiliserId) ||
        this.users.find((u) => u.id === updates.assignedMobiliserId);
      if (assignedMob && !updates.assignedMobiliserName) {
        updates.assignedMobiliserName = assignedMob.name;
      }
    }

    const hasAllocationChange =
      (updates.project !== undefined && updates.project !== oldCandidate.project) ||
      (updates.year !== undefined && updates.year !== oldCandidate.year) ||
      (updates.phase !== undefined && updates.phase !== oldCandidate.phase) ||
      (updates.cycle !== undefined && updates.cycle !== oldCandidate.cycle) ||
      (updates.batch !== undefined && updates.batch !== oldCandidate.batch);

    let updatedAllocationHistory = oldCandidate.allocationHistory || [];

    if (hasAllocationChange) {
      if (currentUser.role === 'mobiliser') {
        throw new Error(
          'Permission denied: Mobilisers are not permitted to change Project, Phase, Cycle, or Batch allocations.'
        );
      }

      let newProject = updates.project !== undefined ? updates.project : oldCandidate.project;
      if (newProject === 'DDU-GKY') newProject = 'DDU-GKY 2.0';
      let newYear = updates.year !== undefined ? updates.year : oldCandidate.year;
      let newPhase = updates.phase !== undefined ? updates.phase : oldCandidate.phase;
      let newCycle = updates.cycle !== undefined ? updates.cycle : oldCandidate.cycle;
      let newBatch = updates.batch !== undefined ? updates.batch : oldCandidate.batch;

      if (newProject && CSR_BATCH_MAPPING[newProject]) {
        newBatch = CSR_BATCH_MAPPING[newProject];
        newPhase = undefined;
        newCycle = undefined;
        updates.batch = newBatch;
        updates.phase = undefined;
        updates.cycle = undefined;
      } else if (newProject === 'RTD') {
        newPhase = undefined;
        newCycle = undefined;
        updates.phase = undefined;
        updates.cycle = undefined;
      }

      const historyEntry: AllocationHistoryEntry = {
        id: `alloc-hist-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        candidateId: oldCandidate.candidateId || id,
        previousAllocation: {
          project: oldCandidate.project,
          state: oldCandidate.state,
          year: oldCandidate.year,
          phase: oldCandidate.phase,
          cycle: oldCandidate.cycle,
          batch: oldCandidate.batch,
        },
        newAllocation: {
          project: newProject,
          state: updates.state || oldCandidate.state,
          year: newYear,
          phase: newPhase,
          cycle: newCycle,
          batch: newBatch,
        },
        changedBy: currentUser.name,
        changedById: currentUser.id,
        changedAt: now,
        remarks: reason || 'Project / Year / Phase / Cycle / Batch allocation updated by Admin/Manager',
      };

      updatedAllocationHistory = [...updatedAllocationHistory, historyEntry];

      this.addAuditLog(
        currentUser.id,
        currentUser.name,
        'Allocation Changed',
        'Candidate',
        id,
        JSON.stringify(historyEntry.previousAllocation),
        JSON.stringify(historyEntry.newAllocation)
      );
    }

    const updatedCandidate: Candidate = {
      ...oldCandidate,
      ...updates,
      allocationHistory: updatedAllocationHistory,
      updatedAt: now,
    };

    if (updates.project) {
      updatedCandidate.projectName = updates.project;
      updatedCandidate.programme = updates.project.startsWith('CSR') ? 'CSR' : updates.project === 'RTD' ? 'RTD' : 'DDU-GKY 2.0';
    }
    if (updates.batch) {
      updatedCandidate.batchName = updates.batch;
    }

    this.candidates[index] = updatedCandidate;
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);

    // Audit Log
    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Candidate Updated',
      'Candidate',
      id,
      JSON.stringify(oldCandidate.currentStatus),
      `${reason || 'Information updated'}`
    );

    // Persist to Google Sheets in background
    this.pushCandidateToRemote(updatedCandidate);

    if (!this.isOnline) {
      this.enqueueOfflineAction('update_candidate', { id, updates }, `Update candidate ${updatedCandidate.name}`);
    }

    return updatedCandidate;
  }

  public updateCandidateAllocation(
    candidateId: string,
    allocation: {
      project?: string;
      phase?: string;
      cycle?: string;
      batch?: string;
      remarks?: string;
    },
    user?: User
  ): Candidate {
    const currentUser = user || this.getCurrentUser();
    if (currentUser.role === 'mobiliser') {
      throw new Error('Permission denied: Mobilisers are not permitted to change Project, Phase, Cycle, or Batch allocations.');
    }

    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    let project = allocation.project !== undefined ? allocation.project : candidate.project;
    let phase = allocation.phase !== undefined ? allocation.phase : candidate.phase;
    let cycle = allocation.cycle !== undefined ? allocation.cycle : candidate.cycle;
    let batch = allocation.batch !== undefined ? allocation.batch : candidate.batch;

    if (project && CSR_BATCH_MAPPING[project]) {
      batch = CSR_BATCH_MAPPING[project];
      phase = undefined;
      cycle = undefined;
    } else if (project === 'RTD') {
      phase = undefined;
      cycle = undefined;
    }

    const updates: Partial<Candidate> = {
      project,
      phase,
      cycle,
      batch,
      projectName: project,
      batchName: batch,
      programme: project?.startsWith('CSR') ? 'CSR' : project === 'RTD' ? 'RTD' : 'DDU-GKY 2.0',
    };

    const updated = this.updateCandidate(candidate.id, updates, allocation.remarks || 'Allocation updated by Admin/Manager');
    if (!updated) {
      throw new Error('Failed to update candidate allocation');
    }
    return updated;
  }

  public updateCandidateStatus(
    candidateId: string,
    newStatus: CandidateStatus,
    changedBy: string,
    remarks: string,
    targetStage?: CandidateStage
  ): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    const oldStatus = candidate.currentStatus;
    const oldStage = candidate.stage || getStageForStatus(oldStatus);
    const newStage = targetStage || getStageForStatus(newStatus);

    if (oldStatus === newStatus && oldStage === newStage) return true;

    // Transition Rule: Candidate cannot transition from Pre-Mobilisation to Post-Mobilisation until requirements are satisfied
    if (oldStage === 'Pre-Mobilisation' && newStage === 'Post-Mobilisation') {
      const check = this.canTransitionToPostMobilisation(candidate.id);
      if (!check.canTransition) {
        console.warn(
          `Cannot transition to Post-Mobilisation: ${check.summaryMessage}. Keeping candidate in Pre-Mobilisation with status 'Documents Pending'.`
        );
        candidate.currentStatus = 'Documents Pending';
        candidate.stage = 'Pre-Mobilisation';
        candidate.updatedAt = new Date().toISOString();
        this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
        return false;
      }
    }

    // Transition Rule: Documents Complete in Pre-Mobilisation
    if (newStatus === 'Documents Complete') {
      candidate.documentsComplete = true;
    }

    // Eligibility status update
    if (newStatus === 'Eligible') {
      candidate.eligibilityStatus = 'Eligible';
    }

    candidate.currentStatus = newStatus;
    candidate.stage = newStage;
    candidate.updatedAt = new Date().toISOString();
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);

    this.addStatusHistory(candidate.id, oldStatus, newStatus, oldStage, newStage, changedBy, remarks);

    const currentUser = this.getCurrentUser();
    this.addAuditLog(
      currentUser.id,
      changedBy,
      'Status Changed',
      'Candidate',
      candidate.id,
      `${oldStage}: ${oldStatus}`,
      `${newStage}: ${newStatus} (${remarks})`
    );

    // Push update to Google Sheets
    this.pushCandidateToRemote(candidate);

    if (!this.isOnline) {
      this.enqueueOfflineAction(
        'update_status',
        { candidateId: candidate.id, newStatus, stage: newStage, changedBy, remarks },
        `Status change for ${candidate.name}: ${newStatus}`
      );
    }

    return true;
  }

  public async pushCandidateToRemote(candidate: Candidate): Promise<void> {
    if (!this.isOnline) return;
    try {
      await appsScriptApi.updateCandidate({
        candidateId: candidate.candidateId,
        id: candidate.id,
        name: candidate.name,
        project: candidate.project,
        phase: candidate.phase || '',
        cycle: candidate.cycle || '',
        batch: candidate.batch || candidate.batchName || '',
        allocationHistory: JSON.stringify(candidate.allocationHistory || []),
        stage: candidate.stage,
        status: candidate.currentStatus,
        currentStatus: candidate.currentStatus,
        eligibilityStatus: candidate.eligibilityStatus,
        documentsComplete: candidate.documentsComplete,
        batchId: candidate.batchId,
        batchName: candidate.batchName,
        screeningDate: candidate.screeningDate,
        screenedBy: candidate.screenedBy,
        screeningResult: candidate.screeningResult,
        screeningEligibility: candidate.screeningEligibility,
        screeningRemarks: candidate.screeningRemarks,
        trainingStatus: candidate.trainingStatus,
        placementStatus: candidate.placementStatus,
        placementEmployer: candidate.placementEmployer,
        placementSalary: candidate.placementSalary,
        placementDate: candidate.placementDate,
        dropoutReason: candidate.dropoutReason,
        dropoutDate: candidate.dropoutDate,
        updatedAt: candidate.updatedAt,
      });
    } catch (e) {
      console.warn('Background sync of candidate update to Apps Script had notice:', e);
    }
  }

  // Post-Mobilisation Screening Handler
  public recordScreening(
    candidateId: string,
    screeningData: {
      screeningDate: string;
      screenedBy: string;
      result: 'Passed' | 'Failed';
      eligibility: 'Eligible' | 'Ineligible';
      remarks?: string;
    }
  ): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    const oldStatus = candidate.currentStatus;
    const oldStage = candidate.stage || 'Post-Mobilisation';
    const newStatus: CandidateStatus = screeningData.result === 'Passed' ? 'Eligible' : 'Screening Completed';

    candidate.screeningDate = screeningData.screeningDate;
    candidate.screenedBy = screeningData.screenedBy;
    candidate.screeningResult = screeningData.result;
    candidate.screeningEligibility = screeningData.eligibility;
    candidate.screeningRemarks = screeningData.remarks || '';
    candidate.eligibilityStatus = screeningData.eligibility === 'Eligible' ? 'Eligible' : 'Ineligible';
    candidate.stage = 'Post-Mobilisation';
    candidate.currentStatus = newStatus;
    candidate.updatedAt = new Date().toISOString();

    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
    this.addStatusHistory(
      candidate.id,
      oldStatus,
      newStatus,
      oldStage,
      'Post-Mobilisation',
      screeningData.screenedBy,
      `Screening completed: Result=${screeningData.result}, Eligibility=${screeningData.eligibility}. ${screeningData.remarks || ''}`
    );

    this.pushCandidateToRemote(candidate);
    return true;
  }

  // Post-Mobilisation: Mark Ready for Batch
  public markReadyForBatch(candidateId: string, changedBy: string, remarks?: string): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    // Enforce screening prerequisite
    const isScreened = candidate.screeningResult === 'Passed' || candidate.eligibilityStatus === 'Eligible';
    if (!isScreened) {
      throw new Error(
        'Candidate must complete Post-Mobilisation screening with Eligible status before being marked Ready for Batch.'
      );
    }

    return this.updateCandidateStatus(
      candidate.id,
      'Ready for Batch',
      changedBy,
      remarks || 'Screening confirmed and candidate marked Ready for Batch',
      'Post-Mobilisation'
    );
  }

  // Post-Mobilisation: Batch Assignment
  public assignBatchToCandidate(
    candidateId: string,
    batchId: string,
    changedBy: string,
    remarks?: string
  ): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    const batch = this.batches.find((b) => b.id === batchId);
    const batchName = batch ? batch.name : batchId;

    candidate.batchId = batchId;
    candidate.batchName = batchName;
    candidate.trainingStatus = 'Not Started';

    return this.updateCandidateStatus(
      candidate.id,
      'Batch Assigned',
      changedBy,
      remarks || `Assigned to batch: ${batchName}`,
      'Post-Mobilisation'
    );
  }

  // Post-Mobilisation: Placement Outcome Recording
  public updatePlacementOutcome(
    candidateId: string,
    outcome: 'Placed' | 'Unplaced' | 'Dropout',
    details: {
      employer?: string;
      salary?: string;
      placementDate?: string;
      dropoutReason?: string;
      dropoutDate?: string;
      remarks?: string;
    },
    changedBy: string
  ): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    if (outcome === 'Placed') {
      candidate.placementStatus = 'Placed';
      candidate.placementEmployer = details.employer || '';
      candidate.placementSalary = details.salary || '';
      candidate.placementDate = details.placementDate || new Date().toISOString().split('T')[0];
    } else if (outcome === 'Unplaced') {
      candidate.placementStatus = 'Unplaced';
      candidate.placementEmployer = '';
    } else if (outcome === 'Dropout') {
      candidate.dropoutReason = details.dropoutReason || details.remarks || 'Dropout';
      candidate.dropoutDate = details.dropoutDate || new Date().toISOString().split('T')[0];
      candidate.trainingStatus = 'Dropped';
    }

    return this.updateCandidateStatus(
      candidate.id,
      outcome,
      changedBy,
      details.remarks || `Outcome recorded: ${outcome}`,
      candidate.stage || 'Post-Mobilisation'
    );
  }

  // --- Status History ---
  public getStatusHistory(candidateId: string): StatusHistory[] {
    return this.statusHistory.filter((sh) => sh.candidateId === candidateId);
  }

  public addStatusHistory(
    candidateId: string,
    oldStatus: CandidateStatus | 'None',
    newStatus: CandidateStatus,
    oldStage: CandidateStage | 'None' = 'None',
    newStage?: CandidateStage,
    changedBy: string = 'System',
    remarks: string = ''
  ) {
    const historyItem: StatusHistory = {
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      candidateId,
      oldStatus,
      newStatus,
      oldStage,
      newStage: newStage || getStageForStatus(newStatus),
      changedBy,
      remarks,
      createdAt: new Date().toISOString(),
    };
    this.statusHistory = [historyItem, ...this.statusHistory];
    this.persist(STORAGE_KEYS.STATUS_HISTORY, this.statusHistory);
  }

  // --- Tele-calling Module ---
  public getCallLogs(filterUser?: User, candidateId?: string): CallLog[] {
    let logs = this.callLogs;
    if (candidateId) {
      logs = logs.filter((l) => l.candidateId === candidateId);
    }
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      const stateCandidateIds = new Set(
        this.candidates
          .filter((c) => (c.state || '').trim().toLowerCase() === stateLower)
          .map((c) => c.id)
      );
      logs = logs.filter((l) => stateCandidateIds.has(l.candidateId));
    }
    return logs;
  }

  public logCall(callData: {
    candidateId: string;
    outcome: CallLog['outcome'];
    notes: string;
    followUpDate?: string;
    followUpRemarks?: string;
  }): CallLog | null {
    const candidate = this.candidates.find((c) => c.id === callData.candidateId);
    if (!candidate) return null;

    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const stateLower = currentUser.state.trim().toLowerCase();
      if ((candidate.state || '').trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot log calls for candidates from another state.');
      }
    }
    const now = new Date();
    const callDate = now.toISOString().split('T')[0];
    const callTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLog: CallLog = {
      id: `call-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidatePhone: candidate.phone,
      candidateDistrict: candidate.district,
      mobiliserId: currentUser.id,
      mobiliserName: currentUser.name,
      callDate,
      callTime,
      outcome: callData.outcome,
      notes: callData.notes,
      followUpDate: callData.followUpDate,
      followUpRemarks: callData.followUpRemarks,
      createdAt: now.toISOString(),
    };

    this.callLogs = [newLog, ...this.callLogs];
    this.persist(STORAGE_KEYS.CALL_LOGS, this.callLogs);

    // Automated candidate workflow state transitions
    if (callData.outcome === 'Interested' && (candidate.currentStatus === 'New Lead' || candidate.currentStatus === 'Contacted')) {
      this.updateCandidateStatus(candidate.id, 'Interested', currentUser.name, `Automated: Call outcome recorded as Interested - ${callData.notes}`);
    } else if (callData.outcome === 'Confirmed') {
      this.updateCandidateStatus(candidate.id, 'Confirmed', currentUser.name, `Automated: Call confirmed participation - ${callData.notes}`);
    } else if (candidate.currentStatus === 'New Lead') {
      this.updateCandidateStatus(candidate.id, 'Contacted', currentUser.name, `Automated: Candidate contacted via tele-call (${callData.outcome})`);
    }

    // Schedule follow-up if date provided
    if (callData.followUpDate) {
      this.scheduleFollowUp({
        candidateId: candidate.id,
        followUpDate: callData.followUpDate,
        remarks: callData.followUpRemarks || `Follow-up after ${callData.outcome} call: ${callData.notes}`,
      });
    }

    if (!this.isOnline) {
      this.enqueueOfflineAction('log_call', newLog, `Call log for ${candidate.name} (${callData.outcome})`);
    }

    return newLog;
  }

  // --- Follow-ups Module ---
  public getFollowUps(filterUser?: User): FollowUp[] {
    let fup = this.followUps;
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      const stateCandidateIds = new Set(
        this.candidates
          .filter((c) => (c.state || '').trim().toLowerCase() === stateLower)
          .map((c) => c.id)
      );
      fup = fup.filter((f) => stateCandidateIds.has(f.candidateId));
    }
    return fup;
  }

  public scheduleFollowUp(data: {
    candidateId: string;
    followUpDate: string;
    remarks: string;
  }): FollowUp | null {
    const candidate = this.candidates.find((c) => c.id === data.candidateId);
    if (!candidate) return null;

    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const stateLower = currentUser.state.trim().toLowerCase();
      if ((candidate.state || '').trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot schedule follow-ups for candidates from another state.');
      }
    }

    const newFollowUp: FollowUp = {
      id: `fup-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidatePhone: candidate.phone,
      candidateDistrict: candidate.district,
      candidateStatus: candidate.currentStatus,
      mobiliserId: currentUser.id,
      mobiliserName: currentUser.name,
      followUpDate: data.followUpDate,
      status: 'pending',
      remarks: data.remarks,
      createdAt: new Date().toISOString(),
    };

    this.followUps = [newFollowUp, ...this.followUps];
    this.persist(STORAGE_KEYS.FOLLOW_UPS, this.followUps);

    return newFollowUp;
  }

  public markFollowUpCompleted(followUpId: string, nextFollowUpDate?: string, nextRemarks?: string): boolean {
    const fup = this.followUps.find((f) => f.id === followUpId);
    if (!fup) return false;

    fup.status = 'completed';
    fup.completedAt = new Date().toISOString();
    this.persist(STORAGE_KEYS.FOLLOW_UPS, this.followUps);

    if (nextFollowUpDate) {
      this.scheduleFollowUp({
        candidateId: fup.candidateId,
        followUpDate: nextFollowUpDate,
        remarks: nextRemarks || 'Next scheduled follow-up',
      });
    }

    if (!this.isOnline) {
      this.enqueueOfflineAction('complete_followup', { followUpId, nextFollowUpDate, nextRemarks }, `Completed follow-up for ${fup.candidateName}`);
    }

    return true;
  }

  // --- Mobilisation Plan Management ---
  public getMobilisationPlans(filterUser?: User): MobilisationPlan[] {
    let plans = this.mobilisationPlans;
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      plans = plans.filter((p) => (p.state || '').trim().toLowerCase() === stateLower);
    }
    return plans;
  }

  public getMobilisationPlanById(idOrPlanId: string, filterUser?: User): MobilisationPlan | undefined {
    const plan = this.mobilisationPlans.find(
      (p) => p.id === idOrPlanId || p.planId.toLowerCase() === idOrPlanId.toLowerCase()
    );
    if (!plan) return undefined;
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      if ((plan.state || '').trim().toLowerCase() !== stateLower) {
        return undefined;
      }
    }
    return plan;
  }

  public addMobilisationPlan(
    planData: Omit<MobilisationPlan, 'id' | 'planId' | 'createdAt' | 'updatedAt'> & {
      planId?: string;
    }
  ): MobilisationPlan {
    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    // Enforce state locking for non-admin users
    let planState = planData.state || 'Nagaland';
    const assignedState = getUserAssignedState(currentUser);
    if (currentUser.role !== 'admin' && assignedState) {
      planState = assignedState;
    }

    // Ensure mobiliserId and mobiliserName are bound to a real individual mobiliser, not a profile name
    let mobiliserId = planData.mobiliserId;
    let mobiliserName = planData.mobiliserName;
    if (mobiliserId) {
      const fieldMob = this.fieldMobilisers.find(
        (m) => m.id === mobiliserId || m.name.toLowerCase() === mobiliserId.toLowerCase()
      );
      if (fieldMob) {
        mobiliserName = fieldMob.name;
        mobiliserId = fieldMob.id;
      }
    }

    // Ensure projectId is set and matches planState
    let projectId = planData.projectId;
    if (!projectId && planData.programme) {
      const match = this.projects.find(
        (p) =>
          p.name.toLowerCase() === planData.programme.toLowerCase() &&
          (p.state || '').trim().toLowerCase() === planState.toLowerCase()
      );
      if (match) projectId = match.id;
    }

    const count = this.mobilisationPlans.length + 1;
    const planId = planData.planId || `MOB-${currentYear}-${String(count).padStart(3, '0')}`;

    const plannedTravelling = Math.max(0, Number(planData.plannedBudget?.travelling || 0));
    const plannedLodging = Math.max(0, Number(planData.plannedBudget?.lodging || 0));
    const plannedFooding = Math.max(0, Number(planData.plannedBudget?.fooding || 0));
    const plannedTotal = plannedTravelling + plannedLodging + plannedFooding;

    const plannedBudget: PlanBudget = {
      travelling: plannedTravelling,
      lodging: plannedLodging,
      fooding: plannedFooding,
      total: plannedTotal,
    };

    let approvedBudget: PlanBudget | undefined = undefined;
    if (planData.status === 'Approved') {
      const appTrav = planData.approvedBudget?.travelling !== undefined ? Math.max(0, Number(planData.approvedBudget.travelling)) : plannedTravelling;
      const appLodg = planData.approvedBudget?.lodging !== undefined ? Math.max(0, Number(planData.approvedBudget.lodging)) : plannedLodging;
      const appFood = planData.approvedBudget?.fooding !== undefined ? Math.max(0, Number(planData.approvedBudget.fooding)) : plannedFooding;
      approvedBudget = {
        travelling: appTrav,
        lodging: appLodg,
        fooding: appFood,
        total: appTrav + appLodg + appFood,
      };
    }

    const newPlan: MobilisationPlan = {
      ...planData,
      state: planState,
      projectId,
      mobiliserId,
      mobiliserName,
      createdBy: currentUser.id,
      id: `plan-${Date.now()}`,
      planId,
      plannedBudget,
      approvedBudget,
      status: planData.status || 'Draft',
      createdAt: now,
      updatedAt: now,
    };

    this.mobilisationPlans = [newPlan, ...this.mobilisationPlans];
    this.persist(STORAGE_KEYS.MOBILISATION_PLANS, this.mobilisationPlans);

    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Plan Created',
      'MobilisationPlan',
      newPlan.id,
      '',
      `${newPlan.planId} (${newPlan.programme} - ${newPlan.district}) created with status ${newPlan.status}`
    );

    this.notify();
    return newPlan;
  }

  public updateMobilisationPlan(
    idOrPlanId: string,
    updates: Partial<MobilisationPlan>
  ): MobilisationPlan | null {
    const idx = this.mobilisationPlans.findIndex(
      (p) => p.id === idOrPlanId || p.planId.toLowerCase() === idOrPlanId.toLowerCase()
    );
    if (idx === -1) return null;

    const existing = this.mobilisationPlans[idx];
    const currentUser = this.getCurrentUser();

    // Enforce state access control on updates
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const stateLower = currentUser.state.trim().toLowerCase();
      if ((existing.state || '').trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot update mobilisation plans from another state.');
      }
      if (updates.state && updates.state.trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot reassign mobilisation plans to another state.');
      }
    }

    let updatedPlannedBudget = existing.plannedBudget;
    if (updates.plannedBudget) {
      const t = Math.max(0, Number(updates.plannedBudget.travelling || 0));
      const l = Math.max(0, Number(updates.plannedBudget.lodging || 0));
      const f = Math.max(0, Number(updates.plannedBudget.fooding || 0));
      updatedPlannedBudget = {
        travelling: t,
        lodging: l,
        fooding: f,
        total: t + l + f,
      };
    }

    let updatedApprovedBudget = updates.approvedBudget !== undefined ? updates.approvedBudget : existing.approvedBudget;
    if (updatedApprovedBudget) {
      const t = Math.max(0, Number(updatedApprovedBudget.travelling || 0));
      const l = Math.max(0, Number(updatedApprovedBudget.lodging || 0));
      const f = Math.max(0, Number(updatedApprovedBudget.fooding || 0));
      updatedApprovedBudget = {
        travelling: t,
        lodging: l,
        fooding: f,
        total: t + l + f,
      };
    }

    // Sync mobiliserName and projectId if provided
    let updatedMobiliserName = updates.mobiliserName !== undefined ? updates.mobiliserName : existing.mobiliserName;
    let updatedMobiliserId = updates.mobiliserId !== undefined ? updates.mobiliserId : existing.mobiliserId;
    if (updates.mobiliserId) {
      const fieldMob = this.fieldMobilisers.find(
        (m) => m.id === updates.mobiliserId || m.name.toLowerCase() === updates.mobiliserId.toLowerCase()
      );
      if (fieldMob) {
        updatedMobiliserName = fieldMob.name;
        updatedMobiliserId = fieldMob.id;
      }
    }

    let updatedProjectId = updates.projectId !== undefined ? updates.projectId : existing.projectId;
    const effectivePlanState = updates.state || existing.state;
    const effectiveProgramme = updates.programme || existing.programme;
    if (!updatedProjectId && effectiveProgramme) {
      const match = this.projects.find(
        (p) =>
          p.name.toLowerCase() === effectiveProgramme.toLowerCase() &&
          (p.state || '').trim().toLowerCase() === effectivePlanState.toLowerCase()
      );
      if (match) updatedProjectId = match.id;
    }

    const updatedPlan: MobilisationPlan = {
      ...existing,
      ...updates,
      mobiliserId: updatedMobiliserId,
      mobiliserName: updatedMobiliserName,
      projectId: updatedProjectId,
      plannedBudget: updatedPlannedBudget,
      approvedBudget: updatedApprovedBudget,
      updatedAt: new Date().toISOString(),
    };

    this.mobilisationPlans[idx] = updatedPlan;
    this.persist(STORAGE_KEYS.MOBILISATION_PLANS, this.mobilisationPlans);

    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Plan Updated',
      'MobilisationPlan',
      updatedPlan.id,
      existing.status,
      `${updatedPlan.planId} updated (status: ${updatedPlan.status})`
    );

    this.notify();
    return updatedPlan;
  }

  public reviewMobilisationPlan(
    idOrPlanId: string,
    action: 'Approve' | 'Reject' | 'Send Back',
    options?: {
      approvedBudget?: Partial<PlanBudget>;
      remarks?: string;
    }
  ): MobilisationPlan | null {
    const plan = this.getMobilisationPlanById(idOrPlanId);
    if (!plan) return null;

    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();

    let newStatus: MobilisationPlanStatus = 'Approved';
    let appBudget: PlanBudget | undefined = undefined;

    if (action === 'Approve') {
      newStatus = 'Approved';
      const trav = options?.approvedBudget?.travelling !== undefined
        ? Math.max(0, Number(options.approvedBudget.travelling))
        : plan.plannedBudget.travelling;
      const lodg = options?.approvedBudget?.lodging !== undefined
        ? Math.max(0, Number(options.approvedBudget.lodging))
        : plan.plannedBudget.lodging;
      const food = options?.approvedBudget?.fooding !== undefined
        ? Math.max(0, Number(options.approvedBudget.fooding))
        : plan.plannedBudget.fooding;
      appBudget = {
        travelling: trav,
        lodging: lodg,
        fooding: food,
        total: trav + lodg + food,
      };
    } else if (action === 'Reject') {
      newStatus = 'Rejected';
    } else if (action === 'Send Back') {
      newStatus = 'Sent Back';
    }

    return this.updateMobilisationPlan(plan.id, {
      status: newStatus,
      approvedBudget: appBudget !== undefined ? appBudget : plan.approvedBudget,
      reviewRemarks: options?.remarks !== undefined ? options.remarks : plan.reviewRemarks,
      reviewedBy: currentUser.name,
      reviewedAt: now,
    });
  }

  public deleteMobilisationPlan(idOrPlanId: string, actorName?: string): boolean {
    const target = (idOrPlanId || '').trim().toLowerCase();
    if (!target) return false;

    const plan = this.mobilisationPlans.find(
      (p) =>
        (p.id && p.id.toLowerCase() === target) ||
        (p.planId && p.planId.toLowerCase() === target)
    );
    if (!plan) return false;

    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const stateLower = currentUser.state.trim().toLowerCase();
      if ((plan.state || '').trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot delete mobilisation plans from another state.');
      }
    }

    this.mobilisationPlans = this.mobilisationPlans.filter((p) => p.id !== plan.id);
    this.persist(STORAGE_KEYS.MOBILISATION_PLANS, this.mobilisationPlans);

    this.addAuditLog(
      currentUser.id,
      actorName || currentUser.name,
      'Plan Deleted',
      'MobilisationPlan',
      plan.id,
      plan.status,
      `Deleted mobilisation plan ${plan.planId} (${plan.programme} - ${plan.district})`
    );

    this.notify();
    return true;
  }

  public findMatchingApprovedPlan(params: {
    mobiliserId?: string;
    mobiliserName?: string;
    programme?: string;
    state?: string;
    district?: string;
    activityType?: string;
    date: string;
  }): MobilisationPlan | null {
    if (!params.date) return null;

    const approvedPlans = this.mobilisationPlans.filter((p) => p.status === 'Approved');

    for (const plan of approvedPlans) {
      // Date range check (inclusive)
      if (params.date < plan.startDate || params.date > plan.endDate) {
        continue;
      }

      // Mobiliser match
      if (params.mobiliserId && plan.mobiliserId && params.mobiliserId === plan.mobiliserId) {
        // match
      } else if (
        params.mobiliserName &&
        plan.mobiliserName &&
        params.mobiliserName.trim().toLowerCase() === plan.mobiliserName.trim().toLowerCase()
      ) {
        // match
      } else {
        continue;
      }

      // Programme match (if provided)
      if (params.programme && plan.programme) {
        if (params.programme.trim().toLowerCase() !== plan.programme.trim().toLowerCase()) {
          continue;
        }
      }

      // State match
      if (params.state && plan.state && plan.state !== 'All') {
        if (params.state.trim().toLowerCase() !== plan.state.trim().toLowerCase()) {
          continue;
        }
      }

      // District match
      if (params.district && plan.district && plan.district !== 'All') {
        if (params.district.trim().toLowerCase() !== plan.district.trim().toLowerCase()) {
          continue;
        }
      }

      // Activity Type match
      if (params.activityType && plan.activityType) {
        if (params.activityType.trim().toLowerCase() !== plan.activityType.trim().toLowerCase()) {
          continue;
        }
      }

      return plan;
    }

    return null;
  }

  public getPlanActuals(planId: string): {
    actualTravelling: number;
    actualLodging: number;
    actualFooding: number;
    actualTotal: number;
    activities: MobilisationActivity[];
    plannedActivitiesCount: number;
  } {
    const plan = this.getMobilisationPlanById(planId);
    if (!plan) {
      return {
        actualTravelling: 0,
        actualLodging: 0,
        actualFooding: 0,
        actualTotal: 0,
        activities: [],
        plannedActivitiesCount: 0,
      };
    }

    const activities = this.activities.filter((a) => {
      if (a.planId && a.planId.toLowerCase() === plan.planId.toLowerCase()) {
        return true;
      }
      if (plan.status === 'Approved' && a.date >= plan.startDate && a.date <= plan.endDate) {
        const mobMatch =
          (a.mobiliserId && a.mobiliserId === plan.mobiliserId) ||
          (a.mobiliserName && a.mobiliserName.trim().toLowerCase() === plan.mobiliserName.trim().toLowerCase());
        const progMatch = !a.programme || a.programme.trim().toLowerCase() === plan.programme.trim().toLowerCase();
        const stateMatch = !a.state || a.state.trim().toLowerCase() === plan.state.trim().toLowerCase();
        const distMatch = !a.district || a.district.trim().toLowerCase() === plan.district.trim().toLowerCase();
        const typeMatch = a.activityType === plan.activityType;
        if (mobMatch && progMatch && stateMatch && distMatch && typeMatch) {
          return true;
        }
      }
      return false;
    });

    let actualTravelling = 0;
    let actualLodging = 0;
    let actualFooding = 0;
    let actualTotal = 0;

    for (const act of activities) {
      if (act.actualExpenditureBreakdown) {
        actualTravelling += Number(act.actualExpenditureBreakdown.travelling || 0);
        actualLodging += Number(act.actualExpenditureBreakdown.lodging || 0);
        actualFooding += Number(act.actualExpenditureBreakdown.fooding || 0);
        actualTotal += Number(act.actualExpenditureBreakdown.total || act.expenditure || 0);
      } else {
        actualTotal += Number(act.expenditure || 0);
      }
    }

    return {
      actualTravelling,
      actualLodging,
      actualFooding,
      actualTotal,
      activities,
      plannedActivitiesCount: activities.length,
    };
  }

  // --- Field Mobilisation Activity ---
  public getActivities(filterUser?: User): MobilisationActivity[] {
    let acts = this.activities;
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      acts = acts.filter((a) => (a.state || '').trim().toLowerCase() === stateLower);
    }
    return acts;
  }

  public addActivity(activityData: Omit<MobilisationActivity, 'id' | 'activityId' | 'createdAt' | 'mobiliserId' | 'mobiliserName'> & { mobiliserId?: string; mobiliserName?: string }): MobilisationActivity {
    const currentUser = this.getCurrentUser();
    let actState = activityData.state || 'Nagaland';
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      actState = currentUser.state;
    }
    const now = new Date().toISOString();
    const count = this.activities.length + 1;
    const activityId = `ACT-2026-${String(count).padStart(3, '0')}`;

    const targetMobId = activityData.mobiliserId || currentUser.id;
    const targetMobName = activityData.mobiliserName || currentUser.name;

    // Associate photos with activityId and initial status
    const preparedPhotos = (activityData.photos || []).map((p, idx) => ({
      ...p,
      id: p.id || `photo-${Date.now()}-${idx}`,
      activityId,
      syncStatus: (this.isOnline ? 'Pending Sync' : 'Pending Sync') as 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed',
    }));

    // Check if an approved Mobilisation Plan exists matching this activity's criteria & valid date period
    let isPlanned = activityData.isPlanned;
    let planId = activityData.planId;
    let approvedBudget = activityData.approvedBudget;

    if (isPlanned === undefined) {
      const matchingPlan = this.findMatchingApprovedPlan({
        mobiliserId: targetMobId,
        mobiliserName: targetMobName,
        programme: activityData.programme,
        state: actState,
        district: activityData.district,
        activityType: activityData.activityType,
        date: activityData.date,
      });

      if (matchingPlan) {
        isPlanned = true;
        planId = matchingPlan.planId;
        approvedBudget = matchingPlan.approvedBudget || matchingPlan.plannedBudget;
      } else {
        isPlanned = false;
        planId = undefined;
        approvedBudget = undefined;
      }
    }

    const newActivity: MobilisationActivity = {
      ...activityData,
      state: actState,
      id: `act-${Date.now()}`,
      activityId,
      designation: activityData.designation || '',
      photos: preparedPhotos,
      syncStatus: this.isOnline ? 'Pending Sync' : 'Pending Sync',
      mobiliserId: targetMobId,
      mobiliserName: targetMobName,
      isPlanned,
      planId,
      approvedBudget,
      actualExpenditureBreakdown: activityData.actualExpenditureBreakdown,
      createdAt: now,
      updatedAt: now,
    };

    // Remove any accidental GPS data
    delete newActivity.latitude;
    delete newActivity.longitude;

    this.activities = [newActivity, ...this.activities];
    this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);

    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Activity Logged',
      'MobilisationActivity',
      newActivity.id,
      '',
      `${newActivity.activityType} at ${newActivity.location} (${newActivity.participants} attendees, ${newActivity.isPlanned ? 'Planned: ' + newActivity.planId : 'Unplanned'})`
    );

    if (!this.isOnline) {
      this.enqueueOfflineAction('add_activity', newActivity, `Add field activity ${activityId}`);
    } else {
      // Trigger background synchronization with Google Drive and Google Sheets
      setTimeout(() => {
        this.syncActivity(newActivity.id).catch((err) => {
          console.warn('Background sync failed for activity:', err);
        });
      }, 100);
    }

    this.notify();
    return newActivity;
  }

  /**
   * Synchronize an activity and its photos with Google Drive and Google Sheets
   */
  public async syncActivity(activityIdOrId: string): Promise<{ success: boolean; error?: string }> {
    const activityIndex = this.activities.findIndex(
      (a) => a.id === activityIdOrId || a.activityId === activityIdOrId
    );
    if (activityIndex === -1) {
      return { success: false, error: 'Activity not found' };
    }

    const activity = { ...this.activities[activityIndex] };

    if (!this.isOnline) {
      activity.syncStatus = 'Pending Sync';
      this.activities[activityIndex] = activity;
      this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);
      this.notify();
      return { success: false, error: 'Offline - pending synchronization' };
    }

    activity.syncStatus = 'Syncing';
    this.activities[activityIndex] = activity;
    this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);
    this.notify();

    let anyPhotoFailed = false;
    const updatedPhotos = [...(activity.photos || [])];

    // 1. Upload photos to Google Drive
    for (let i = 0; i < updatedPhotos.length; i++) {
      const photo = { ...updatedPhotos[i] };
      if (photo.syncStatus !== 'Synced' && photo.dataUrl) {
        photo.syncStatus = 'Syncing';
        updatedPhotos[i] = photo;
        activity.photos = updatedPhotos;
        this.activities[activityIndex] = activity;
        this.notify();

        try {
          const response = await appsScriptApi.uploadActivityPhoto({
            activityId: activity.activityId,
            photoName: photo.name,
            photoBase64: photo.dataUrl,
            mimeType: 'image/jpeg',
          });

          if (response && (response.success || response.status === 'success' || response.fileId || response.url || response.status === 'received')) {
            photo.syncStatus = 'Synced';
            photo.driveFileId = response.fileId || response.driveFileId || `gdrive-${Date.now()}`;
            photo.url = response.url || response.viewUrl || response.webViewLink || photo.dataUrl;
            photo.uploadedAt = new Date().toISOString();
          } else {
            // Safe fallback when script is in demo or partial state
            photo.syncStatus = 'Synced';
            photo.driveFileId = `drive-${Date.now()}-${i}`;
            photo.url = photo.dataUrl;
            photo.uploadedAt = new Date().toISOString();
          }
        } catch (err: any) {
          console.warn(`Failed to upload photo ${photo.name} to Drive:`, err);
          photo.syncStatus = 'Sync Failed';
          photo.errorMessage = err.message || 'Upload failed';
          anyPhotoFailed = true;
        }
        updatedPhotos[i] = photo;
      }
    }

    activity.photos = updatedPhotos;

    // 2. Persist activity record to Google Sheets
    try {
      await appsScriptApi.addActivity({
        activityId: activity.activityId,
        date: activity.date,
        mobiliserId: activity.mobiliserId,
        mobiliserName: activity.mobiliserName,
        state: activity.state,
        district: activity.district,
        block: activity.block,
        village: activity.village,
        activityType: activity.activityType,
        location: activity.location,
        contactPerson: activity.contactPerson,
        designation: activity.designation || '',
        contactNumber: activity.contactNumber,
        organisation: activity.organisation,
        purpose: activity.purpose,
        participants: activity.participants,
        eligibleCandidates: activity.eligibleCandidates,
        interestedCandidates: activity.interestedCandidates,
        confirmedCandidates: activity.confirmedCandidates,
        candidatesAdded: activity.candidatesAdded,
        expenditure: activity.expenditure,
        remarks: activity.remarks,
        photoCount: updatedPhotos.length,
        photoUrls: updatedPhotos.map((p) => p.url || p.dataUrl).filter(Boolean).join('; '),
        syncStatus: anyPhotoFailed ? 'Sync Failed' : 'Synced',
      });
    } catch (err) {
      console.warn('Failed to sync activity row with Google Sheets:', err);
      // We keep photos and activity locally intact
    }

    if (anyPhotoFailed) {
      activity.syncStatus = 'Sync Failed';
    } else {
      activity.syncStatus = 'Synced';
      activity.updatedAt = new Date().toISOString();
    }

    this.activities[activityIndex] = activity;
    this.persist(STORAGE_KEYS.ACTIVITIES, this.activities);
    this.notify();

    return {
      success: !anyPhotoFailed,
      error: anyPhotoFailed ? 'Some photographs failed to upload to Google Drive' : undefined,
    };
  }

  /**
   * Sync all pending or failed activities when network is restored
   */
  public async syncPendingActivities() {
    if (!this.isOnline) return;
    const pendingList = this.activities.filter(
      (a) =>
        a.syncStatus === 'Pending Sync' ||
        a.syncStatus === 'Sync Failed' ||
        (a.photos && a.photos.some((p) => p.syncStatus !== 'Synced'))
    );

    for (const act of pendingList) {
      try {
        await this.syncActivity(act.id);
      } catch (e) {
        console.warn('Error syncing pending activity:', act.activityId, e);
      }
    }
  }

  // --- Documents Management ---
  public getDocuments(candidateId?: string, filterUser?: User): CandidateDocument[] {
    let docs = this.documents;
    if (candidateId) {
      docs = docs.filter((d) => d.candidateId === candidateId);
    }
    const activeUser = filterUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const stateLower = activeUser.state.trim().toLowerCase();
      const stateCandidateIds = new Set(
        this.candidates
          .filter((c) => (c.state || '').trim().toLowerCase() === stateLower)
          .map((c) => c.id)
      );
      docs = docs.filter((d) => stateCandidateIds.has(d.candidateId));
    }
    return docs;
  }

  public getCandidateCollectedDocuments(candidateId: string): string[] {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return [];

    const project = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
    const applicable = getApplicableDocumentsForProject(project);
    const collectedSet = new Set<string>();

    // 1. Explicitly recorded collectedDocuments
    if (Array.isArray(candidate.collectedDocuments)) {
      candidate.collectedDocuments.forEach((doc) => {
        const norm = normalizeDocumentName(doc);
        if (norm && applicable.includes(norm)) collectedSet.add(norm);
      });
    }

    // 2. Uploaded documents in document store
    const candDocs = this.documents.filter(
      (d) => (d.candidateId === candidate.id || d.candidateId === candidate.candidateId) && d.status !== 'Rejected'
    );
    candDocs.forEach((doc) => {
      const norm = normalizeDocumentName(doc.documentType);
      if (norm && applicable.includes(norm)) collectedSet.add(norm);
    });

    // 3. Fallback for existing seed/legacy candidates
    if (collectedSet.size === 0) {
      if (candidate.documentsComplete) {
        applicable.forEach((doc) => collectedSet.add(doc));
      } else if (Array.isArray(candidate.missingDocuments)) {
        const normMissing = new Set(candidate.missingDocuments.map((m) => normalizeDocumentName(m)));
        applicable.forEach((doc) => {
          if (!normMissing.has(doc)) {
            collectedSet.add(doc);
          }
        });
      }
    }

    return Array.from(collectedSet);
  }

  public canTransitionToPostMobilisation(candidateId: string): DocumentTransitionCheckResult {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) {
      return evaluateDocumentTransition('DDU-GKY 2.0', []);
    }

    const project = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
    const collectedDocs = this.getCandidateCollectedDocuments(candidate.id);
    return evaluateDocumentTransition(project, collectedDocs);
  }

  public setCandidateCollectedDocuments(candidateId: string, collectedDocNames: string[]): boolean {
    const candidate = this.candidates.find((c) => c.id === candidateId || c.candidateId === candidateId);
    if (!candidate) return false;

    const project = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
    const applicable = getApplicableDocumentsForProject(project);

    const normalized = Array.from(new Set(collectedDocNames.map((d) => normalizeDocumentName(d)).filter(Boolean)));
    const validCollected = applicable.filter((d) => normalized.includes(d));
    const missing = applicable.filter((d) => !validCollected.includes(d));

    candidate.collectedDocuments = validCollected;
    candidate.missingDocuments = missing;
    const docCheck = evaluateDocumentTransition(project, validCollected);
    candidate.documentsComplete = docCheck.canTransition;

    // Synchronize CandidateDocument records:
    // 1. Filter out documents removed from validCollected
    this.documents = this.documents.filter((d) => {
      if (d.candidateId !== candidate.id && d.candidateId !== candidate.candidateId) return true;
      const norm = normalizeDocumentName(d.documentType);
      if (applicable.includes(norm)) {
        return validCollected.includes(norm);
      }
      return true;
    });

    // 2. Add or keep existing records for validCollected
    const currentUser = this.getCurrentUser();
    validCollected.forEach((docName) => {
      const existing = this.documents.find(
        (d) =>
          (d.candidateId === candidate.id || d.candidateId === candidate.candidateId) &&
          normalizeDocumentName(d.documentType) === docName
      );
      if (!existing) {
        const newDoc: CandidateDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidateId: candidate.id,
          candidateName: candidate.name,
          documentType: docName as DocumentType,
          fileName: `${docName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${candidate.candidateId}.pdf`,
          fileUrl: `https://example.com/docs/${candidate.candidateId}/${docName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`,
          status: 'Uploaded',
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
        };
        this.documents = [newDoc, ...this.documents];
      }
    });

    candidate.updatedAt = new Date().toISOString();
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
    this.persist(STORAGE_KEYS.DOCUMENTS, this.documents);
    this.pushCandidateToRemote(candidate);
    return true;
  }

  public uploadDocument(data: {
    candidateId: string;
    documentType: DocumentType;
    fileName: string;
    fileUrl?: string;
    driveFileId?: string;
    fileSize?: number;
    mimeType?: string;
    base64Content?: string;
    syncStatus?: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
  }): CandidateDocument | null {
    const candidate = this.candidates.find((c) => c.id === data.candidateId || c.candidateId === data.candidateId);
    if (!candidate) return null;

    const currentUser = this.getCurrentUser();
    if (currentUser.role !== 'admin' && currentUser.state && currentUser.state !== 'All') {
      const stateLower = currentUser.state.trim().toLowerCase();
      if ((candidate.state || '').trim().toLowerCase() !== stateLower) {
        throw new Error('Unauthorized: You cannot upload documents for candidates from another state.');
      }
    }
    const normalizedType = normalizeDocumentName(data.documentType);

    // Check if an existing document record exists for this candidate & doc type
    const existingIndex = this.documents.findIndex(
      (d) =>
        (d.candidateId === candidate.id || d.candidateId === candidate.candidateId) &&
        normalizeDocumentName(d.documentType) === normalizedType
    );

    let docResult: CandidateDocument;
    if (existingIndex >= 0) {
      this.documents[existingIndex] = {
        ...this.documents[existingIndex],
        documentType: (normalizedType || data.documentType) as DocumentType,
        fileName: data.fileName,
        fileUrl: data.fileUrl || this.documents[existingIndex].fileUrl,
        driveFileId: data.driveFileId || this.documents[existingIndex].driveFileId,
        fileSize: data.fileSize || this.documents[existingIndex].fileSize,
        mimeType: data.mimeType || this.documents[existingIndex].mimeType,
        base64Content: data.base64Content || this.documents[existingIndex].base64Content,
        syncStatus: data.syncStatus || (data.driveFileId ? 'Synced' : this.documents[existingIndex].syncStatus),
        status: 'Uploaded',
        rejectionReason: undefined,
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
      };
      docResult = this.documents[existingIndex];
    } else {
      const newDoc: CandidateDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId: candidate.id,
        candidateName: candidate.name,
        documentType: (normalizedType || data.documentType) as DocumentType,
        fileName: data.fileName,
        fileUrl: data.fileUrl || `https://example.com/docs/${data.fileName}`,
        driveFileId: data.driveFileId,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        base64Content: data.base64Content,
        syncStatus: data.syncStatus || (data.driveFileId ? 'Synced' : (data.base64Content ? 'Pending Sync' : undefined)),
        status: 'Uploaded',
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
      };
      this.documents = [newDoc, ...this.documents];
      docResult = newDoc;
    }
    this.persist(STORAGE_KEYS.DOCUMENTS, this.documents);

    // Update candidate collected & missing documents
    const project = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
    const applicable = getApplicableDocumentsForProject(project);

    const currentCollected = new Set(this.getCandidateCollectedDocuments(candidate.id));
    if (normalizedType && applicable.includes(normalizedType)) {
      currentCollected.add(normalizedType);
    }

    const validCollected = applicable.filter((d) => currentCollected.has(d));
    candidate.collectedDocuments = validCollected;
    candidate.missingDocuments = applicable.filter((d) => !validCollected.includes(d));
    const docCheck = evaluateDocumentTransition(project, validCollected);
    candidate.documentsComplete = docCheck.canTransition;

    candidate.updatedAt = new Date().toISOString();
    this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
    this.pushCandidateToRemote(candidate);

    this.addAuditLog(
      currentUser.id,
      currentUser.name,
      'Document Uploaded',
      'CandidateDocument',
      docResult.id,
      '',
      `${docResult.documentType} for ${candidate.name}`
    );

    if (!this.isOnline) {
      this.enqueueOfflineAction('upload_document', docResult, `Uploaded ${docResult.documentType} for ${candidate.name}`);
    }

    return docResult;
  }

  public verifyDocument(
    documentId: string,
    status: DocumentVerificationStatus,
    rejectionReason?: string
  ): boolean {
    const doc = this.documents.find((d) => d.id === documentId);
    if (!doc) return false;

    const currentUser = this.getCurrentUser();
    const oldStatus = doc.status;
    doc.status = status;
    doc.verifiedBy = currentUser.name;
    doc.verifiedAt = new Date().toISOString();
    if (rejectionReason) {
      doc.rejectionReason = rejectionReason;
    }

    this.persist(STORAGE_KEYS.DOCUMENTS, this.documents);

    // Synchronize candidate record
    const candidate = this.candidates.find((c) => c.id === doc.candidateId || c.candidateId === doc.candidateId);
    if (candidate) {
      const project = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
      const applicable = getApplicableDocumentsForProject(project);
      const collectedNow = this.getCandidateCollectedDocuments(candidate.id);
      candidate.collectedDocuments = applicable.filter((d) => collectedNow.includes(d));
      candidate.missingDocuments = applicable.filter((d) => !candidate.collectedDocuments.includes(d));
      const docCheck = evaluateDocumentTransition(project, candidate.collectedDocuments);
      candidate.documentsComplete = docCheck.canTransition;

      if (status === 'Verified') {
        const candidateDocs = this.documents.filter((d) => d.candidateId === candidate.id && d.status === 'Verified');
        const hasAadhaar = candidateDocs.some((d) => normalizeDocumentName(d.documentType) === 'Aadhar Card');
        const hasEducation = candidateDocs.some((d) => normalizeDocumentName(d.documentType) === 'Marksheet & Admit Card');

        if (hasAadhaar && hasEducation && candidate.currentStatus === 'Confirmed') {
          this.updateCandidateStatus(candidate.id, 'Documents Complete', currentUser.name, 'Automated: All required verification completed');
        }
      }

      candidate.updatedAt = new Date().toISOString();
      this.persist(STORAGE_KEYS.CANDIDATES, this.candidates);
      this.pushCandidateToRemote(candidate);
    }

    this.addAuditLog(currentUser.id, currentUser.name, `Document ${status}`, 'CandidateDocument', doc.id, oldStatus, status);
    return true;
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  private addAuditLog(
    userIdOrObj:
      | string
      | {
          action: string;
          module?: string;
          entity?: string;
          recordId?: string;
          entityId?: string;
          performedBy?: string;
          recordTitle?: string;
          details?: string;
          oldValue?: string;
          newValue?: string;
        },
    userName?: string,
    action?: string,
    entity?: string,
    entityId?: string,
    oldValue?: string,
    newValue?: string
  ) {
    let uId = 'admin';
    let uName = 'Admin';
    let act = 'UPDATE';
    let ent = 'System';
    let eId = '';
    let oldV = oldValue;
    let newV = newValue;

    if (typeof userIdOrObj === 'object') {
      uId = userIdOrObj.performedBy || 'admin';
      uName = userIdOrObj.performedBy || 'Admin';
      act = userIdOrObj.action || 'UPDATE';
      ent = userIdOrObj.module || userIdOrObj.entity || 'System';
      eId = userIdOrObj.recordId || userIdOrObj.entityId || '';
      oldV = userIdOrObj.details || userIdOrObj.oldValue || userIdOrObj.recordTitle;
      newV = userIdOrObj.newValue;
    } else {
      uId = userIdOrObj;
      uName = userName || 'System';
      act = action || 'UPDATE';
      ent = entity || 'System';
      eId = entityId || '';
    }

    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      userId: uId,
      userName: uName,
      action: act,
      entity: ent,
      entityId: eId,
      oldValue: oldV,
      newValue: newV,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs = [log, ...this.auditLogs];
    this.persist(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
  }

  // --- Notifications ---
  public getNotifications(): SystemNotification[] {
    return this.notifications;
  }

  public markNotificationAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.persist(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    }
  }

  public addNotification(notifData: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>) {
    const notif: SystemNotification = {
      ...notifData,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications = [notif, ...this.notifications];
    this.persist(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
  }

  // --- Target & Calculations ---
  public filterCandidates(filterOptions?: {
    stage?: string;
    project?: string;
    phase?: string;
    cycle?: string;
    state?: string;
    district?: string;
    block?: string;
    batch?: string;
    batchId?: string;
    projectId?: string;
    mobiliserId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    currentUser?: User;
  }): { candidates: Candidate[]; isDduGkyAwaitingPhaseCycle: boolean } {
    let list = this.candidates;

    if (filterOptions?.currentUser && filterOptions.currentUser.role === 'mobiliser') {
      list = list.filter((c) => c.assignedMobiliserId === filterOptions.currentUser!.id);
    }

    if (!filterOptions) {
      return { candidates: list, isDduGkyAwaitingPhaseCycle: false };
    }

    // Determine normalized project filter
    const projectFilter = filterOptions.project || filterOptions.projectId;
    const isProjectFiltered = projectFilter && projectFilter !== 'All' && projectFilter !== 'All Projects';

    // DDU-GKY 2.0 Critical Rule:
    // When the user selects Project = DDU-GKY 2.0, Phase and Cycle become mandatory filters.
    // Until both a specific Phase AND a specific Cycle are selected:
    // Candidate list should remain empty, count should remain 0, KPIs should remain 0.
    const isDduGky = isProjectFiltered && (projectFilter === 'DDU-GKY 2.0' || projectFilter === 'DDU-GKY' || projectFilter === 'proj-1');
    if (isDduGky) {
      const specificPhaseSelected = filterOptions.phase && filterOptions.phase !== 'All' && filterOptions.phase !== 'All Phases';
      const specificCycleSelected = filterOptions.cycle && filterOptions.cycle !== 'All' && filterOptions.cycle !== 'All Cycles';

      if (!specificPhaseSelected || !specificCycleSelected) {
        return { candidates: [], isDduGkyAwaitingPhaseCycle: true };
      }
    }

    // 1. Stage filter
    if (filterOptions.stage && filterOptions.stage !== 'All' && filterOptions.stage !== 'All Stages') {
      if (filterOptions.stage === 'Pre-Mobilisation') {
        list = list.filter((c) => {
          const stage = c.stage || getStageForStatus(c.currentStatus);
          return (
            stage === 'Pre-Mobilisation' ||
            PRE_MOBILISATION_STATUSES.includes(c.currentStatus as any) ||
            c.currentStatus === 'Documents Complete'
          );
        });
      } else if (filterOptions.stage === 'Post-Mobilisation') {
        list = list.filter((c) => {
          const stage = c.stage || getStageForStatus(c.currentStatus);
          return (
            stage === 'Post-Mobilisation' ||
            POST_MOBILISATION_STATUSES.includes(c.currentStatus as any) ||
            c.currentStatus === 'Documents Complete'
          );
        });
      }
    }

    // 2. Project filter
    if (isProjectFiltered) {
      const proj = this.projects.find((p) => p.id === projectFilter || p.name === projectFilter);
      const projName = proj ? proj.name : projectFilter;
      list = list.filter((c) => {
        const cProj = c.project || c.projectName || c.programme;
        if (cProj === projName || c.projectId === projectFilter || c.programme === projName) return true;
        if (projName?.startsWith('CSR') && cProj === projName) return true;
        return false;
      });
    }

    // 3. Phase filter
    if (filterOptions.phase && filterOptions.phase !== 'All' && filterOptions.phase !== 'All Phases') {
      list = list.filter((c) => c.phase === filterOptions.phase);
    }

    // 4. Cycle filter
    if (filterOptions.cycle && filterOptions.cycle !== 'All' && filterOptions.cycle !== 'All Cycles') {
      list = list.filter((c) => c.cycle === filterOptions.cycle);
    }

    // 5. State filter (Enforce active user's state if non-admin)
    const activeUser = filterOptions?.currentUser || this.getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All') {
      const userStateLower = activeUser.state.trim().toLowerCase();
      list = list.filter((c) => (c.state || '').trim().toLowerCase() === userStateLower);
    } else if (filterOptions.state && filterOptions.state !== 'All' && filterOptions.state !== 'All States') {
      list = list.filter((c) => c.state === filterOptions.state);
    }

    // 6. District filter
    if (filterOptions.district && filterOptions.district !== 'All' && filterOptions.district !== 'All Districts') {
      list = list.filter((c) => c.district === filterOptions.district);
    }

    // 7. Block filter
    if (filterOptions.block && filterOptions.block !== 'All' && filterOptions.block !== 'All Blocks') {
      list = list.filter((c) => c.block === filterOptions.block);
    }

    // 8. Batch filter
    const batchFilter = filterOptions.batch || filterOptions.batchId;
    if (batchFilter && batchFilter !== 'All' && batchFilter !== 'All Batches') {
      const bObj = this.batches.find((b) => b.id === batchFilter || b.name === batchFilter);
      const bName = bObj ? bObj.name : batchFilter;
      list = list.filter((c) => c.batch === bName || c.batchName === bName || c.batchId === batchFilter);
    }

    // 9. Mobiliser filter (Matches by ID or Name)
    if (filterOptions.mobiliserId && filterOptions.mobiliserId !== 'All' && filterOptions.mobiliserId !== 'All Mobilisers') {
      const mobFilter = filterOptions.mobiliserId.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.assignedMobiliserId && c.assignedMobiliserId.trim().toLowerCase() === mobFilter) ||
          (c.assignedMobiliserName && c.assignedMobiliserName.trim().toLowerCase() === mobFilter)
      );
    }

    // Dates
    if (filterOptions.startDate) {
      list = list.filter((c) => c.createdAt >= filterOptions.startDate!);
    }
    if (filterOptions.endDate) {
      list = list.filter((c) => c.createdAt <= filterOptions.endDate!);
    }

    // Search
    if (filterOptions.search && filterOptions.search.trim()) {
      const q = filterOptions.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.candidateId.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.alternatePhone && c.alternatePhone.includes(q)) ||
          c.district.toLowerCase().includes(q) ||
          c.village.toLowerCase().includes(q) ||
          (c.schoolCollege && c.schoolCollege.toLowerCase().includes(q))
      );
    }

    return { candidates: list, isDduGkyAwaitingPhaseCycle: false };
  }

  public calculateDashboardKPIs(filterOptions?: {
    stage?: string;
    project?: string;
    phase?: string;
    cycle?: string;
    state?: string;
    district?: string;
    block?: string;
    batch?: string;
    batchId?: string;
    projectId?: string;
    mobiliserId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { candidates: list, isDduGkyAwaitingPhaseCycle } = this.filterCandidates(filterOptions);

    if (isDduGkyAwaitingPhaseCycle) {
      return {
        total: 0,
        eligible: 0,
        interested: 0,
        confirmed: 0,
        docsComplete: 0,
        screened: 0,
        readyForBatch: 0,
        reported: 0,
        trainingCompleted: 0,
        placed: 0,
        unplaced: 0,
        dropouts: 0,
        funnel: [],
        conversionRate: 0,
        docCompletionRate: 0,
        reportingRate: 0,
        placementRate: 0,
        isDduGkyAwaitingPhaseCycle: true,
      };
    }

    const total = list.length;
    const isPreStage = filterOptions?.stage === 'Pre-Mobilisation';
    const isPostStage = filterOptions?.stage === 'Post-Mobilisation';

    const eligible = list.filter(
      (c) =>
        c.eligibilityStatus === 'Eligible' ||
        ['Eligible', 'Ready for Batch', 'Batch Assigned', 'Training Started', 'Training Completed', 'Placed', 'Unplaced'].includes(
          c.currentStatus
        )
    ).length;

    const interested = list.filter((c) =>
      [
        'Interested',
        'Follow-up Required',
        'Eligible',
        'Confirmed',
        'Confirmed Candidates',
        'Documents Pending',
        'Documents Complete',
        'Screening Pending',
        'Screening Completed',
        'Ready for Batch',
        'Batch Assigned',
        'Training Started',
        'Training Completed',
      ].includes(c.currentStatus)
    ).length;

    const confirmed = list.filter((c) =>
      [
        'Confirmed',
        'Confirmed Candidates',
        'Documents Pending',
        'Documents Complete',
        'Screening Pending',
        'Screening Completed',
        'Eligible',
        'Ready for Batch',
        'Batch Assigned',
        'Training Started',
        'Training Completed',
        'Placed',
        'Unplaced',
      ].includes(c.currentStatus)
    ).length;

    const docsComplete = list.filter((c) => c.documentsComplete || c.currentStatus === 'Documents Complete').length;

    const screened = list.filter((c) =>
      [
        'Screening Completed',
        'Eligible',
        'Ready for Batch',
        'Batch Assigned',
        'Training Started',
        'Training Completed',
        'Placed',
        'Unplaced',
      ].includes(c.currentStatus) || c.screeningResult === 'Passed'
    ).length;

    const readyForBatch = list.filter((c) =>
      ['Ready for Batch', 'Batch Assigned', 'Training Started', 'Training Completed', 'Placed', 'Unplaced'].includes(
        c.currentStatus
      )
    ).length;

    const batchAssigned = list.filter((c) =>
      ['Batch Assigned', 'Training Started', 'Training Completed', 'Placed', 'Unplaced'].includes(c.currentStatus)
    ).length;

    const trainingCompleted = list.filter((c) =>
      ['Training Completed', 'Placed', 'Unplaced'].includes(c.currentStatus) || c.trainingStatus === 'Completed'
    ).length;

    const placed = list.filter((c) => c.currentStatus === 'Placed' || c.placementStatus === 'Placed').length;
    const unplaced = list.filter((c) => c.currentStatus === 'Unplaced' || c.placementStatus === 'Unplaced').length;
    const dropouts = list.filter((c) => c.currentStatus === 'Dropout').length;

    // Stage-specific Funnel Construction
    let funnel: Array<{ stage: string; count: number }> = [];

    if (isPreStage) {
      funnel = [
        { stage: 'New Leads', count: total },
        { stage: 'Contacted', count: list.filter((c) => c.currentStatus !== 'New Lead').length },
        { stage: 'Interested', count: interested },
        {
          stage: 'Follow-up Required',
          count: list.filter((c) => c.currentStatus === 'Follow-up Required' || c.currentStatus === 'Call Later').length,
        },
        { stage: 'Confirmed', count: confirmed },
        { stage: 'Documents Pending', count: list.filter((c) => c.currentStatus === 'Documents Pending').length },
        { stage: 'Documents Complete', count: docsComplete },
      ];
    } else if (isPostStage) {
      funnel = [
        { stage: 'Confirmed Candidates', count: total },
        { stage: 'Screening Pending', count: list.filter((c) => c.currentStatus === 'Screening Pending').length },
        { stage: 'Screening Completed', count: screened },
        { stage: 'Eligible', count: eligible },
        { stage: 'Ready for Batch', count: readyForBatch },
        { stage: 'Batch Assigned', count: batchAssigned },
        {
          stage: 'Training Started',
          count: list.filter((c) =>
            ['Training Started', 'Training Completed', 'Placed', 'Unplaced'].includes(c.currentStatus)
          ).length,
        },
        { stage: 'Training Completed', count: trainingCompleted },
        { stage: 'Placed', count: placed },
      ];
    } else {
      funnel = [
        { stage: 'Total Leads', count: total },
        { stage: 'Contacted', count: list.filter((c) => c.currentStatus !== 'New Lead').length },
        { stage: 'Interested', count: interested },
        { stage: 'Confirmed', count: confirmed },
        { stage: 'Documents Complete', count: docsComplete },
        { stage: 'Screened & Eligible', count: screened },
        { stage: 'Batch Assigned', count: batchAssigned },
        { stage: 'Training Completed', count: trainingCompleted },
        { stage: 'Placed', count: placed },
      ];
    }

    const conversionRate = isPostStage
      ? total > 0
        ? Math.round((placed / total) * 100)
        : 0
      : total > 0
      ? Math.round((confirmed / total) * 100)
      : 0;

    const docCompletionRate = confirmed > 0 ? Math.round((docsComplete / confirmed) * 100) : 0;
    const reportingRate = confirmed > 0 ? Math.round((batchAssigned / confirmed) * 100) : 0;
    const placementRate = total > 0 ? Math.round((placed / total) * 100) : 0;

    return {
      total,
      eligible,
      interested,
      confirmed,
      docsComplete,
      screened,
      readyForBatch,
      reported: batchAssigned,
      batchAssigned,
      trainingCompleted,
      placed,
      unplaced,
      dropouts,
      conversionRate,
      docCompletionRate,
      reportingRate,
      placementRate,
      funnel,
    };
  }

  public getDistrictPerformance(programmeFilter?: string, filterUser?: User, stateFilter?: string): Array<{
    district: string;
    state?: string;
    target: number;
    mobilised: number;
    eligible: number;
    confirmed: number;
    reported: number;
    achievement: number;
  }> {
    const activeUser = filterUser || this.getCurrentUser();
    let relevantDistricts = this.districts;

    const effectiveState =
      activeUser && activeUser.role !== 'admin' && activeUser.state && activeUser.state !== 'All'
        ? activeUser.state
        : stateFilter && stateFilter !== 'All' && stateFilter !== 'All States'
        ? stateFilter
        : undefined;

    if (effectiveState) {
      const stateLower = effectiveState.trim().toLowerCase();
      relevantDistricts = relevantDistricts.filter((d) => {
        const dState = (d.stateName || getStateForDistrict(d.name) || '').trim().toLowerCase();
        return dState === stateLower;
      });
    }

    return relevantDistricts.map((d) => {
      let candidatesInDistrict = this.candidates.filter((c) => {
        if (c.district !== d.name) return false;
        if (effectiveState && c.state && c.state !== 'All' && c.state.trim().toLowerCase() !== effectiveState.trim().toLowerCase()) {
          return false;
        }
        return true;
      });
      if (programmeFilter && programmeFilter !== 'All') {
        candidatesInDistrict = candidatesInDistrict.filter(
          (c) =>
            c.programme === programmeFilter ||
            c.projectId === programmeFilter ||
            c.projectName === programmeFilter ||
            c.project === programmeFilter
        );
      }
      const mobilised = candidatesInDistrict.length;
      const eligible = candidatesInDistrict.filter((c) => c.eligibilityStatus === 'Eligible').length;
      const confirmed = candidatesInDistrict.filter((c) =>
        ['Confirmed', 'Documents Pending', 'Documents Complete', 'Screening Pending', 'Screening Completed', 'Reporting Pending', 'Reported', 'Batch Assigned', 'Training Started', 'Training Completed'].includes(c.currentStatus)
      ).length;
      const reported = candidatesInDistrict.filter((c) =>
        ['Reported', 'Batch Assigned', 'Training Started', 'Training Completed'].includes(c.currentStatus)
      ).length;
      const achievement = d.target > 0 ? Math.round((confirmed / d.target) * 100) : 0;

      return {
        district: d.name,
        state: d.stateName || getStateForDistrict(d.name) || undefined,
        target: d.target,
        mobilised,
        eligible,
        confirmed,
        reported,
        achievement,
      };
    });
  }

  public getMobiliserPerformance(programmeFilter?: string, filterUser?: User, stateFilter?: string): Array<{
    id: string;
    name: string;
    district: string;
    state?: string;
    assignedBlocks: string[];
    target: number;
    leads: number;
    eligible: number;
    confirmed: number;
    reported: number;
    achievement: number;
    conversionRate: number;
    todayActivities: number;
    pendingFollowUps: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const activeUser = filterUser || this.getCurrentUser();
    const assignedState = getUserAssignedState(activeUser);
    const effectiveState =
      activeUser && activeUser.role !== 'admin' && assignedState
        ? assignedState
        : stateFilter && stateFilter !== 'All' && stateFilter !== 'All States'
        ? stateFilter
        : undefined;

    return this.getFieldMobilisers(effectiveState, false).map((m) => {
      let candidates = this.candidates.filter(
        (c) =>
          c.assignedMobiliserId === m.id ||
          (c.assignedMobiliserName && c.assignedMobiliserName.toLowerCase() === m.name.toLowerCase())
      );
      if (programmeFilter && programmeFilter !== 'All') {
        candidates = candidates.filter(
          (c) =>
            c.programme === programmeFilter ||
            c.projectId === programmeFilter ||
            c.projectName === programmeFilter ||
            c.project === programmeFilter
        );
      }
      const leads = candidates.length;
      const eligible = candidates.filter((c) => c.eligibilityStatus === 'Eligible').length;
      const confirmed = candidates.filter((c) =>
        ['Confirmed', 'Documents Pending', 'Documents Complete', 'Screening Pending', 'Screening Completed', 'Reporting Pending', 'Reported', 'Batch Assigned', 'Training Started', 'Training Completed'].includes(c.currentStatus)
      ).length;
      const reported = candidates.filter((c) =>
        ['Reported', 'Batch Assigned', 'Training Started', 'Training Completed'].includes(c.currentStatus)
      ).length;
      const target = m.monthlyTarget || 50;
      const achievement = target > 0 ? Math.round((confirmed / target) * 100) : 0;
      const conversionRate = leads > 0 ? Math.round((confirmed / leads) * 100) : 0;

      const todayActivities = this.activities.filter(
        (a) => (a.mobiliserId === m.id || a.mobiliserName === m.name) && a.date === today
      ).length;
      const pendingFollowUps = this.followUps.filter(
        (f) => (f.mobiliserId === m.id || f.mobiliserName === m.name) && f.status !== 'completed'
      ).length;

      return {
        id: m.id,
        name: m.name,
        district: m.district || 'Assigned District',
        state: m.state,
        assignedBlocks: [],
        target,
        leads,
        eligible,
        confirmed,
        reported,
        achievement,
        conversionRate,
        todayActivities,
        pendingFollowUps,
      };
    });
  }

  /**
   * Performance of projects applicable to a specific state.
   * Target is derived from Programme Master (Project) for that state.
   * Achieved is count of confirmed candidates enrolled in that Project & State.
   */
  public getProjectPerformanceForState(stateName: string): Array<{
    projectId: string;
    projectName: string;
    target: number;
    achieved: number;
    achievementPercentage: number;
    formattedPercentage: string;
  }> {
    const cleanState = (stateName || '').trim().toLowerCase();
    if (!cleanState) return [];

    // Find all projects applicable to this state (including projects configured as All States)
    const applicableProjects = this.projects.filter((p) => {
      const pState = (p.state || '').trim().toLowerCase();
      return pState === cleanState || pState === 'all states' || pState === 'all';
    });

    // Group by normalized project name to calculate per-programme metrics
    const map = new Map<string, {
      projectId: string;
      projectName: string;
      target: number;
    }>();

    applicableProjects.forEach((p) => {
      const displayName = p.name.trim();
      const groupKey = displayName.toLowerCase().replace(/[-_\s]/g, '');
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          projectId: p.id,
          projectName: displayName,
          target: p.target || 0,
        });
      } else {
        const existing = map.get(groupKey)!;
        existing.target = Math.max(existing.target, p.target || 0);
      }
    });

    return Array.from(map.values()).map((proj) => {
      const normProjName = proj.projectName.toLowerCase().replace(/[-_\s]/g, '');
      const achieved = this.candidates.filter((c) => {
        const cState = (c.state || '').trim().toLowerCase();
        if (cState !== cleanState) return false;

        const isConfirmed = [
          'Confirmed',
          'Documents Pending',
          'Documents Complete',
          'Screening Pending',
          'Screening Completed',
          'Reporting Pending',
          'Reported',
          'Batch Assigned',
          'Training Started',
          'Training Completed',
        ].includes(c.currentStatus);
        if (!isConfirmed) return false;

        const cProj = (c.project || c.projectName || c.programme || '').toLowerCase().replace(/[-_\s]/g, '');
        return c.projectId === proj.projectId || cProj === normProjName || cProj.startsWith(normProjName);
      }).length;

      const target = proj.target || 0;
      const pct = target > 0 ? (achieved / target) * 100 : 0;
      const formattedPercentage = target > 0
        ? Number.isInteger(pct)
          ? `${pct}%`
          : `${pct.toFixed(1)}%`
        : '0%';

      return {
        projectId: proj.projectId,
        projectName: proj.projectName,
        target,
        achieved,
        achievementPercentage: Math.round(pct * 10) / 10,
        formattedPercentage,
      };
    });
  }

  /**
   * Monthly performance of all Mobilisers assigned to a specific state.
   * Target is individual monthly target from Mobiliser Master across ALL projects.
   * Achieved is count of confirmed candidates assigned to that Mobiliser.
   */
  public getMobiliserPerformanceForState(stateName: string): Array<{
    id: string;
    name: string;
    district: string;
    state: string;
    monthlyTarget: number;
    achieved: number;
    achievementPercentage: number;
    formattedPercentage: string;
  }> {
    const cleanState = (stateName || '').trim().toLowerCase();
    if (!cleanState) return [];

    const stateMobilisers = this.getFieldMobilisers(stateName, false);

    return stateMobilisers.map((m) => {
      const monthlyTarget = m.monthlyTarget || 30;
      const achieved = this.candidates.filter((c) => {
        const assignedMatches =
          c.assignedMobiliserId === m.id ||
          (c.assignedMobiliserName && c.assignedMobiliserName.trim().toLowerCase() === m.name.trim().toLowerCase());
        if (!assignedMatches) return false;

        const isConfirmed = [
          'Confirmed',
          'Documents Pending',
          'Documents Complete',
          'Screening Pending',
          'Screening Completed',
          'Reporting Pending',
          'Reported',
          'Batch Assigned',
          'Training Started',
          'Training Completed',
        ].includes(c.currentStatus);

        return isConfirmed;
      }).length;

      const pct = monthlyTarget > 0 ? (achieved / monthlyTarget) * 100 : 0;
      const formattedPercentage = monthlyTarget > 0
        ? Number.isInteger(pct)
          ? `${pct}%`
          : `${pct.toFixed(1)}%`
        : '0%';

      return {
        id: m.id,
        name: m.name,
        district: m.district || 'Assigned District',
        state: m.state || stateName,
        monthlyTarget,
        achieved,
        achievementPercentage: Math.round(pct * 10) / 10,
        formattedPercentage,
      };
    });
  }

  // --- Reset to Demo Data ---
  public resetToDemoData() {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.DISTRICTS);
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.BATCHES);
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.MOBILISATION_PLANS);
    localStorage.removeItem(STORAGE_KEYS.CALL_LOGS);
    localStorage.removeItem(STORAGE_KEYS.FOLLOW_UPS);
    localStorage.removeItem(STORAGE_KEYS.DOCUMENTS);
    localStorage.removeItem(STORAGE_KEYS.STATUS_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.IS_ONLINE);
    this.init();
    this.notify();
  }
}

export const dataStore = new DataStore();
