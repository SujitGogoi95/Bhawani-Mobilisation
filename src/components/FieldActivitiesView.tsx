import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Users,
  Plus,
  Download,
  CheckCircle2,
  Camera,
  X,
  IndianRupee,
  Building,
  Phone,
  FileText,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
  Clock,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { MobilisationActivity, ActivityType, User as UserType, ActivityPhoto } from '../types';
import { exportActivitiesCSV } from '../utils/exportUtils';
import { getAllStates, getDistrictsForState, getBlocksForDistrict, getStateForDistrict } from '../utils/locationData';
import { getUserAssignedState } from '../utils/userState';
import { processPhotoFile, formatFileSize, ProcessedPhoto } from '../utils/photoUtils';

interface FieldActivitiesViewProps {
  currentUser: UserType;
}

export const FieldActivitiesView: React.FC<FieldActivitiesViewProps> = ({ currentUser }) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<'All' | 'Planned' | 'Unplanned'>('All');
  const [selectedMobiliser, setSelectedMobiliser] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    currentUser.role === 'mobiliser' ? currentUser.district : 'All'
  );

  // Active sync state for activities being manually synchronized
  const [syncingActivityId, setSyncingActivityId] = useState<string | null>(null);

  // Full-screen / lightbox photo preview modal
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<{
    url: string;
    name: string;
    activityId: string;
    status: string;
    driveFileId?: string;
  } | null>(null);

  const districts = dataStore.getDistricts();
  const availableStates = useMemo(() => getAllStates(), []);

  const activities = useMemo(() => {
    return dataStore.getActivities(currentUser);
  }, [currentUser, syncingActivityId]);

  const isOnline = dataStore.getOnlineStatus();

  // Form State
  const userAssignedState = getUserAssignedState(currentUser);
  const initialModalState = userAssignedState || getStateForDistrict(currentUser.district || 'Kohima') || 'Nagaland';
  const [modalState, setModalState] = useState(initialModalState);

  const availableModalDistricts = useMemo(() => {
    const list = getDistrictsForState(modalState);
    if (list.length > 0) return list;
    return districts
      .filter((d) => !d.stateName || d.stateName.toLowerCase() === modalState.toLowerCase())
      .map((d) => d.name);
  }, [modalState, districts]);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [district, setDistrict] = useState(currentUser.district || 'Kohima');

  // Available blocks derived from district and state
  const availableBlocks = useMemo(() => {
    return getBlocksForDistrict(district, modalState);
  }, [district, modalState]);

  const [block, setBlock] = useState('Kohima Sadar');
  const [village, setVillage] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('Community Meeting');
  const [location, setLocation] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [purpose, setPurpose] = useState('Candidate identification and community awareness');
  const [participants, setParticipants] = useState(25);
  const [eligible, setEligible] = useState(15);
  const [interested, setInterested] = useState(10);
  const [confirmed, setConfirmed] = useState(4);
  const modalProjects = useMemo(() => {
    return dataStore.getProjects(modalState, currentUser);
  }, [modalState, currentUser]);
  const [modalProgramme, setModalProgramme] = useState(modalProjects[0]?.name || 'DDU-GKY 2.0');

  const modalMobilisers = useMemo(() => {
    const list = dataStore.getFieldMobilisers(modalState, false, currentUser);
    return list;
  }, [modalState, currentUser]);

  const [modalMobiliserId, setModalMobiliserId] = useState(
    modalMobilisers[0]?.id || currentUser.id
  );
  const [modalMobiliserName, setModalMobiliserName] = useState(
    modalMobilisers[0]?.name || currentUser.name
  );

  const [actualTravelling, setActualTravelling] = useState<number | string>(150);
  const [actualLodging, setActualLodging] = useState<number | string>(0);
  const [actualFooding, setActualFooding] = useState<number | string>(100);

  const [candidatesAdded, setCandidatesAdded] = useState(4);
  const [expenditure, setExpenditure] = useState(250);
  const [remarks, setRemarks] = useState('');

  // Selected Photos for upload in the wizard
  const [selectedPhotos, setSelectedPhotos] = useState<ProcessedPhoto[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  // Hidden file inputs for photo capture and file browsing
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Modal location cascade handlers
  const handleModalStateChange = (newState: string) => {
    setModalState(newState);
    const newDistricts = getDistrictsForState(newState);
    if (newDistricts.length > 0) {
      const firstDist = newDistricts[0];
      setDistrict(firstDist);
      const newBlocks = getBlocksForDistrict(firstDist, newState);
      setBlock(newBlocks.length > 0 ? newBlocks[0] : '');
    } else {
      setDistrict('');
      setBlock('');
    }
  };

  const handleModalDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const newBlocks = getBlocksForDistrict(newDist, modalState);
    setBlock(newBlocks.length > 0 ? newBlocks[0] : '');
  };

  // Automatically check if an approved mobilisation plan exists matching this activity's parameters
  const matchingPlan = useMemo(() => {
    return dataStore.findMatchingApprovedPlan({
      mobiliserId: modalMobiliserId || currentUser.id,
      mobiliserName: modalMobiliserName || currentUser.name,
      programme: modalProgramme,
      state: modalState,
      district,
      activityType,
      date,
    });
  }, [modalMobiliserId, modalMobiliserName, modalProgramme, modalState, district, activityType, date]);

  // Real-time calculation of modal total actual expenditure
  const modalActualTotal = useMemo(() => {
    const t = Math.max(0, Number(actualTravelling) || 0);
    const l = Math.max(0, Number(actualLodging) || 0);
    const f = Math.max(0, Number(actualFooding) || 0);
    return t + l + f;
  }, [actualTravelling, actualLodging, actualFooding]);

  // Filter districts derived from selectedState
  const availableFilterDistricts = useMemo(() => {
    if (selectedState === 'All') return districts.map((d) => d.name);
    return getDistrictsForState(selectedState);
  }, [selectedState, districts]);

  // Reset filter district if no longer in state
  const handleFilterStateChange = (newState: string) => {
    setSelectedState(newState);
    if (newState !== 'All') {
      const dists = getDistrictsForState(newState);
      if (!dists.includes(selectedDistrict)) {
        setSelectedDistrict('All');
      }
    }
  };

  // Available mobilisers collected from dataStore master list, user accounts, and activities
  const availableMobilisers = useMemo(() => {
    const fieldMobs = dataStore.getFieldMobilisers(undefined, false);
    const mobUsers = dataStore.getUsers().filter((u) => u.role === 'mobiliser');
    const map = new Map<string, { id: string; name: string; state: string; district?: string }>();

    fieldMobs.forEach((m) => {
      if (m.name) {
        const key = m.name.toLowerCase().trim();
        const st = m.state || (m.district ? getStateForDistrict(m.district) : '') || '';
        map.set(key, { id: m.id, name: m.name, state: st, district: m.district });
      }
    });

    mobUsers.forEach((u) => {
      if (u.name) {
        const key = u.name.toLowerCase().trim();
        const st = u.state && u.state !== 'All' ? u.state : (u.district ? getStateForDistrict(u.district) : '') || '';
        if (!map.has(key) || (!map.get(key)!.state && st)) {
          map.set(key, { id: u.id, name: u.name, state: st, district: u.district });
        }
      }
    });

    activities.forEach((a) => {
      if (a.mobiliserName) {
        const key = a.mobiliserName.toLowerCase().trim();
        const st = a.state || (a.district ? getStateForDistrict(a.district) : '') || '';
        if (!map.has(key)) {
          map.set(key, { id: a.mobiliserId, name: a.mobiliserName, state: st, district: a.district });
        } else if (!map.get(key)!.state && st) {
          map.get(key)!.state = st;
        }
      }
    });

    // Deduplicate by both trimmed name and ID
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const result: Array<{ id: string; name: string; state: string; district?: string }> = [];

    map.forEach((item) => {
      const nameKey = item.name.trim().toLowerCase();
      const idKey = item.id ? item.id.trim().toLowerCase() : '';
      if (!seenNames.has(nameKey) && (!idKey || !seenIds.has(idKey))) {
        seenNames.add(nameKey);
        if (idKey) seenIds.add(idKey);
        result.push(item);
      }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const selectedMobiliserObj = useMemo(() => {
    if (selectedMobiliser === 'All') return null;
    return (
      availableMobilisers.find(
        (m) => m.name.toLowerCase() === selectedMobiliser.toLowerCase() || m.id === selectedMobiliser
      ) || null
    );
  }, [selectedMobiliser, availableMobilisers]);

  const mobiliserAssignedState = useMemo(() => {
    if (!selectedMobiliserObj) return null;
    return (
      selectedMobiliserObj.state ||
      (selectedMobiliserObj.district ? getStateForDistrict(selectedMobiliserObj.district) : null)
    );
  }, [selectedMobiliserObj]);

  const handleMobiliserChange = (mobValue: string) => {
    setSelectedMobiliser(mobValue);
    if (mobValue === 'All') {
      setSelectedState('All');
      setSelectedDistrict('All');
    } else {
      const mob = availableMobilisers.find(
        (m) => m.name.toLowerCase() === mobValue.toLowerCase() || m.id === mobValue
      );
      const assignedSt = mob?.state || (mob?.district ? getStateForDistrict(mob.district) : null);
      if (assignedSt && assignedSt !== 'All') {
        setSelectedState(assignedSt);
        setSelectedDistrict('All');
      }
    }
  };

  const isStateDisabled =
    (selectedMobiliser !== 'All' && Boolean(mobiliserAssignedState)) ||
    (currentUser.role === 'mobiliser' && Boolean(currentUser.state) && currentUser.state !== 'All');

  // Month options derived from activities and calendar months
  const monthOptions = useMemo(() => {
    const monthMap = new Map<string, string>(); // 'YYYY-MM' -> 'Month Year'

    activities.forEach((a) => {
      if (a.date && a.date.length >= 7) {
        const ym = a.date.slice(0, 7);
        const [year, month] = ym.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, 1);
        if (!isNaN(dateObj.getTime())) {
          const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          monthMap.set(ym, label);
        }
      }
    });

    const currentYear = new Date().getFullYear();
    for (let m = 0; m < 12; m++) {
      const ym = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
      const dateObj = new Date(currentYear, m, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!monthMap.has(ym)) {
        monthMap.set(ym, label);
      }
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [activities]);

  // Handle Photo selection from files or camera
  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhotos(true);
    try {
      const newProcessed: ProcessedPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const processed = await processPhotoFile(file);
          newProcessed.push(processed);
        }
      }
      setSelectedPhotos((prev) => [...prev, ...newProcessed]);
    } catch (err) {
      console.error('Error processing photos:', err);
    } finally {
      setIsProcessingPhotos(false);
      // Reset input value so same files can be re-selected if removed
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setSelectedPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      // 1. Activity Type
      if (selectedType !== 'All' && a.activityType !== selectedType) {
        return false;
      }

      // 2. Mobiliser
      if (selectedMobiliser !== 'All') {
        const matchesName = Boolean(a.mobiliserName && a.mobiliserName.toLowerCase() === selectedMobiliser.toLowerCase());
        const matchesId = a.mobiliserId === selectedMobiliser;
        const matchesObj = selectedMobiliserObj && (
          (a.mobiliserName && a.mobiliserName.toLowerCase() === selectedMobiliserObj.name.toLowerCase()) ||
          a.mobiliserId === selectedMobiliserObj.id
        );
        if (!matchesName && !matchesId && !matchesObj) {
          return false;
        }
      }

      // 3. State
      if (selectedState !== 'All') {
        if (a.state && a.state.toLowerCase() !== selectedState.toLowerCase()) {
          return false;
        }
      }

      // 4. Month
      if (selectedMonth !== 'All') {
        if (!a.date || !a.date.startsWith(selectedMonth)) {
          return false;
        }
      }

      // 5. Date
      if (selectedDate) {
        if (a.date !== selectedDate) {
          return false;
        }
      }

      // 6. District
      if (selectedDistrict !== 'All') {
        if (!a.district || a.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
          return false;
        }
      }

      // 7. Plan Status
      if (selectedPlanFilter === 'Planned' && !a.isPlanned) {
        return false;
      }
      if (selectedPlanFilter === 'Unplanned' && a.isPlanned) {
        return false;
      }

      return true;
    });
  }, [
    activities,
    selectedType,
    selectedPlanFilter,
    selectedMobiliser,
    selectedMobiliserObj,
    selectedState,
    selectedMonth,
    selectedDate,
    selectedDistrict,
  ]);

  // Manual Trigger to sync an individual activity with Google Drive / Sheets
  const handleSyncActivity = async (activityId: string) => {
    setSyncingActivityId(activityId);
    try {
      await dataStore.syncActivity(activityId);
    } finally {
      setSyncingActivityId(null);
    }
  };

  const handleLogActivity = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare photos data
    const activityPhotos: ActivityPhoto[] = selectedPhotos.map((p) => ({
      id: p.id,
      activityId: '',
      name: p.name,
      dataUrl: p.dataUrl,
      size: p.size,
      syncStatus: isOnline ? 'Pending Sync' : 'Pending Sync',
    }));

    const totalExp = modalActualTotal > 0 ? modalActualTotal : Number(expenditure);

    dataStore.addActivity({
      date,
      programme: modalProgramme,
      state: modalState,
      district,
      block,
      village: village.trim() || 'Village Community Hall',
      activityType,
      location: location.trim() || village || 'Community Ground',
      contactPerson: contactPerson.trim() || 'Village Chairman',
      designation: designation.trim(),
      contactNumber: contactNumber.trim() || '9862000000',
      organisation: organisation.trim() || 'Village Council',
      purpose: purpose.trim(),
      participants: Number(participants),
      eligibleCandidates: Number(eligible),
      interestedCandidates: Number(interested),
      confirmedCandidates: Number(confirmed),
      candidatesAdded: Number(candidatesAdded),
      expenditure: totalExp,
      isPlanned: Boolean(matchingPlan),
      planId: matchingPlan?.planId,
      approvedBudget: matchingPlan ? (matchingPlan.approvedBudget || matchingPlan.plannedBudget) : undefined,
      actualExpenditureBreakdown: {
        travelling: Number(actualTravelling) || 0,
        lodging: Number(actualLodging) || 0,
        fooding: Number(actualFooding) || 0,
        total: totalExp,
      },
      remarks: remarks.trim() || 'Activity conducted successfully.',
      photos: activityPhotos,
      mobiliserId: modalMobiliserId,
      mobiliserName: modalMobiliserName,
    });

    setShowLogModal(false);
    // Reset form
    setVillage('');
    setLocation('');
    setContactPerson('');
    setDesignation('');
    setContactNumber('');
    setRemarks('');
    setSelectedPhotos([]);
    setActualTravelling(150);
    setActualLodging(0);
    setActualFooding(100);
  };

  const activityTypeOptions: ActivityType[] = [
    'Community Meeting',
    'School Visit',
    'College Visit',
    'Village Visit',
    'Stakeholder Meeting',
    'Seminar',
    'Awareness Campaign',
    'Flyer Distribution',
    'Door-to-Door Mobilisation',
    'Counselling',
    'Other',
  ];

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Field Mobilisation Activity Tracker</h2>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isOnline ? <Cloud className="w-3 h-3 text-emerald-600" /> : <CloudOff className="w-3 h-3 text-amber-600" />}
              {isOnline ? 'Online Sync Ready' : 'Offline Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Log outreach drives, village meetings, campus campaigns, and attach photo evidence offline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-activities-csv-btn"
            onClick={() => exportActivitiesCSV(filteredActivities)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="open-log-activity-modal-btn"
            onClick={() => {
              setSelectedPhotos([]);
              setShowLogModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Log Field Activity</span>
          </button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 flex-wrap text-xs">
        {/* 0. Plan Status Filter */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">Plan:</label>
          <select
            id="field-activities-plan-status-filter"
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value as 'All' | 'Planned' | 'Unplanned')}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 cursor-pointer"
          >
            <option value="All">All (Planned & Unplanned)</option>
            <option value="Planned">Planned Activities Only</option>
            <option value="Unplanned">Unplanned Activities Only</option>
          </select>
        </div>

        {/* 1. Activity Type */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">Activity Type:</label>
          <select
            id="field-activities-type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 cursor-pointer"
          >
            <option value="All">All Types</option>
            {activityTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Mobiliser */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">Mobiliser:</label>
          <select
            id="field-activities-mobiliser-filter"
            value={selectedMobiliser}
            onChange={(e) => handleMobiliserChange(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 cursor-pointer"
          >
            <option value="All">All Mobilisers</option>
            {availableMobilisers.map((m, idx) => (
              <option key={`fa-mob-opt-${m.id || m.name}-${idx}`} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. State */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">State:</label>
          <select
            id="field-activities-state-filter"
            value={selectedState}
            onChange={(e) => handleFilterStateChange(e.target.value)}
            disabled={isStateDisabled}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
          >
            {selectedMobiliser !== 'All' && mobiliserAssignedState ? (
              <option value={mobiliserAssignedState}>{mobiliserAssignedState}</option>
            ) : (
              <>
                <option value="All">All States</option>
                {availableStates.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* 4. Month */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">Month:</label>
          <select
            id="field-activities-month-filter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 cursor-pointer"
          >
            <option value="All">All Months</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Date */}
        <div className="flex items-center">
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">Date:</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              id="field-activities-date-filter"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 cursor-pointer text-xs"
              title={selectedDate ? `Date: ${selectedDate}` : 'All Dates (click to pick a date)'}
            />
            {selectedDate ? (
              <button
                type="button"
                id="clear-activity-date-filter"
                onClick={() => setSelectedDate('')}
                className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
                title="Reset to All Dates"
              >
                <X className="w-3 h-3" />
                <span>All Dates</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                (All Dates)
              </span>
            )}
          </div>
        </div>

        {/* 6. District */}
        <div>
          <label className="font-bold text-slate-500 uppercase text-[10px] mr-2">District:</label>
          <select
            id="field-activities-district-filter"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={currentUser.role === 'mobiliser'}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium disabled:opacity-75 text-slate-700 cursor-pointer"
          >
            <option value="All">All Districts</option>
            {availableFilterDistricts.map((dName) => (
              <option key={dName} value={dName}>
                {dName}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 text-xs ml-auto">
          Showing {filteredActivities.length} activities
        </span>
      </div>

      {/* Activity Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredActivities.map((act) => {
          const actPhotos = act.photos || [];
          const hasLegacyPhoto = !act.photos && act.photoUrl;
          const totalPhotosCount = actPhotos.length + (hasLegacyPhoto ? 1 : 0);
          const isPending =
            act.syncStatus === 'Pending Sync' ||
            actPhotos.some((p) => p.syncStatus === 'Pending Sync');
          const isFailed =
            act.syncStatus === 'Sync Failed' ||
            actPhotos.some((p) => p.syncStatus === 'Sync Failed');
          const isSyncing =
            syncingActivityId === act.id ||
            act.syncStatus === 'Syncing' ||
            actPhotos.some((p) => p.syncStatus === 'Syncing');

          return (
            <div
              key={act.id}
              id={`activity-card-${act.activityId}`}
              className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-bold">
                        {act.activityId}
                      </span>

                      {/* Sync Status Badge */}
                      {isSyncing ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Syncing
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                          Sync Failed
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          Pending Sync
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Synced
                        </span>
                      )}
                      {/* Planned vs Unplanned Indicator */}
                      {act.isPlanned ? (
                        <span
                          id={`plan-badge-${act.activityId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full"
                          title={act.planId ? `Linked to approved plan: ${act.planId}` : 'Planned Activity'}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Planned {act.planId ? `(${act.planId})` : ''}</span>
                        </span>
                      ) : (
                        <span
                          id={`unplanned-badge-${act.activityId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full"
                          title="Conducted without an approved mobilisation plan"
                        >
                          <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                          <span>Unplanned Activity</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-1">{act.activityType}</h3>
                    <p className="text-xs text-slate-500">
                      {act.village}, {act.block}, {act.district}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-800">{act.date}</span>
                    <p className="text-[11px] text-slate-400 font-medium">By {act.mobiliserName}</p>
                  </div>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-5 gap-1.5 bg-slate-50 p-2.5 rounded-lg text-center text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Attended</span>
                    <span className="font-bold text-slate-800">{act.participants}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-600 font-semibold block">Eligible</span>
                    <span className="font-bold text-teal-700">{act.eligibleCandidates}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sky-600 font-semibold block">Interested</span>
                    <span className="font-bold text-sky-700">{act.interestedCandidates}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 font-semibold block">Confirmed</span>
                    <span className="font-bold text-emerald-700">{act.confirmedCandidates}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-600 font-semibold block">Added</span>
                    <span className="font-bold text-indigo-700">{act.candidatesAdded}</span>
                  </div>
                </div>

                {/* Contact & Designation Details */}
                <div className="text-xs space-y-1.5 text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-700">Location:</strong> {act.location}
                    </span>
                  </div>

                  {act.contactPerson && (
                    <div className="flex items-start gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-700">Contact:</strong> {act.contactPerson}
                        {act.designation && (
                          <span className="text-indigo-700 font-medium ml-1">
                            • {act.designation}
                          </span>
                        )}
                        {act.contactNumber && (
                          <span className="text-slate-500 ml-1">
                            ({act.contactNumber})
                          </span>
                        )}
                        {act.organisation && (
                          <span className="text-slate-400 ml-1">
                            - {act.organisation}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {act.remarks && (
                    <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                      "{act.remarks}"
                    </p>
                  )}
                </div>

                {/* Geo-tagged Activity Photos Gallery */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      Geo-tagged Activity Photos ({totalPhotosCount})
                    </span>

                    {(isPending || isFailed) && (
                      <button
                        onClick={() => handleSyncActivity(act.id)}
                        disabled={isSyncing}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                        title="Upload photos to Google Drive and sync with Google Sheets"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync with Drive'}</span>
                      </button>
                    )}
                  </div>

                  {totalPhotosCount > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {actPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() =>
                            setActivePreviewPhoto({
                              url: photo.url || photo.dataUrl || '',
                              name: photo.name,
                              activityId: act.activityId,
                              status: photo.syncStatus,
                              driveFileId: photo.driveFileId,
                            })
                          }
                          className="group relative aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:border-indigo-400 transition-all"
                        >
                          <img
                            src={photo.url || photo.dataUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />

                          {/* Sync status overlay badge on thumbnail */}
                          <div className="absolute bottom-1 right-1">
                            {photo.syncStatus === 'Synced' ? (
                              <span className="bg-emerald-600 text-white p-0.5 rounded-full inline-block shadow-xs" title="Synced to Google Drive">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              </span>
                            ) : photo.syncStatus === 'Syncing' ? (
                              <span className="bg-blue-600 text-white p-0.5 rounded-full inline-block shadow-xs" title="Syncing...">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              </span>
                            ) : photo.syncStatus === 'Sync Failed' ? (
                              <span className="bg-rose-600 text-white p-0.5 rounded-full inline-block shadow-xs" title="Sync Failed">
                                <AlertCircle className="w-2.5 h-2.5" />
                              </span>
                            ) : (
                              <span className="bg-amber-600 text-white p-0.5 rounded-full inline-block shadow-xs" title="Pending Sync (Offline)">
                                <Clock className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {hasLegacyPhoto && (
                        <div
                          onClick={() =>
                            setActivePreviewPhoto({
                              url: act.photoUrl!,
                              name: `${act.activityId}_photo.jpg`,
                              activityId: act.activityId,
                              status: 'Synced',
                            })
                          }
                          className="group relative aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:border-indigo-400 transition-all"
                        >
                          <img
                            src={act.photoUrl}
                            alt="Activity Photo"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                          <div className="absolute bottom-1 right-1">
                            <span className="bg-emerald-600 text-white p-0.5 rounded-full inline-block shadow-xs">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-[11px]">
                      No activity photographs attached
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with Planned Budget Utilization or Unplanned Warning */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px]">
                {act.isPlanned && act.approvedBudget ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-500" /> Cost: ₹{act.expenditure}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Approved Budget: <strong className="text-slate-900">₹{act.approvedBudget.total}</strong>
                      </span>
                    </div>

                    {/* Utilization Progress and Breakdown */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 font-medium">
                          Budget Utilization:{' '}
                          <strong className={act.expenditure > act.approvedBudget.total ? 'text-rose-600' : 'text-emerald-700'}>
                            {act.approvedBudget.total > 0
                              ? Math.round((act.expenditure / act.approvedBudget.total) * 100)
                              : 0}%
                          </strong>
                        </span>
                        <span className={`font-semibold ${act.approvedBudget.total >= act.expenditure ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {act.approvedBudget.total >= act.expenditure
                            ? `₹${act.approvedBudget.total - act.expenditure} remaining`
                            : `₹${act.expenditure - act.approvedBudget.total} over approved`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            act.expenditure > act.approvedBudget.total ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              act.approvedBudget.total > 0 ? (act.expenditure / act.approvedBudget.total) * 100 : 0
                            )}%`,
                          }}
                        />
                      </div>

                      {act.actualExpenditureBreakdown && (
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                          <span>Travel: ₹{act.actualExpenditureBreakdown.travelling}</span>
                          <span>Lodging: ₹{act.actualExpenditureBreakdown.lodging}</span>
                          <span>Food: ₹{act.actualExpenditureBreakdown.fooding}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-500" /> Cost: ₹{act.expenditure}
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                        Unplanned Activity
                      </span>
                    </div>
                    <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200 text-[10px] text-amber-800 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>Conducted without an approved mobilisation plan. Recorded as unplanned field expenditure.</span>
                    </div>
                    {act.actualExpenditureBreakdown && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                        <span>Travel: ₹{act.actualExpenditureBreakdown.travelling}</span>
                        <span>Lodging: ₹{act.actualExpenditureBreakdown.lodging}</span>
                        <span>Food: ₹{act.actualExpenditureBreakdown.fooding}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>{totalPhotosCount} {totalPhotosCount === 1 ? 'photo' : 'photos'}</span>
                  <span>Programme: {act.programme || 'DDU-GKY 2.0'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Field Activity Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleLogActivity}
            className="bg-white rounded-2xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in my-auto max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Field Mobilisation Activity</h3>
                <p className="text-xs text-slate-500">Record outreach details, candidate numbers, and photo evidence</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline Alert in Wizard if disconnected */}
            {!isOnline && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                <CloudOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Offline Field Mode Active:</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Your activity and photos will be safely saved locally on this device and automatically synced to Google Drive when connectivity is restored.
                  </p>
                </div>
              </div>
            )}

            {/* Hidden file inputs for photo capture and library selection */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoFilesSelected}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFilesSelected}
              className="hidden"
            />

            {/* Real-time Mobilisation Plan Matching Indicator Banner */}
            {matchingPlan ? (
              <div
                id="matched-plan-banner"
                className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Matched Approved Plan: {matchingPlan.planId}
                  </span>
                  <span className="text-[10px] bg-emerald-200/70 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                    Planned Activity
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Planned Period: <strong>{matchingPlan.startDate}</strong> to <strong>{matchingPlan.endDate}</strong> • {matchingPlan.activityType}
                </p>
                <div className="grid grid-cols-4 gap-2 bg-white/90 p-2 rounded-lg border border-emerald-200 text-center text-[11px]">
                  <div>
                    <span className="block text-[10px] text-slate-500">Travel</span>
                    <span className="font-bold text-slate-800">
                      ₹{matchingPlan.approvedBudget?.travelling ?? matchingPlan.plannedBudget.travelling}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Lodging</span>
                    <span className="font-bold text-slate-800">
                      ₹{matchingPlan.approvedBudget?.lodging ?? matchingPlan.plannedBudget.lodging}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Food</span>
                    <span className="font-bold text-slate-800">
                      ₹{matchingPlan.approvedBudget?.fooding ?? matchingPlan.plannedBudget.fooding}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Total Approved</span>
                    <span className="font-bold text-emerald-700">
                      ₹{matchingPlan.approvedBudget?.total ?? matchingPlan.plannedBudget.total}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                id="unmatched-plan-banner"
                className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs text-amber-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Unplanned Activity Warning
                  </span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    Unplanned
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  No approved mobilisation plan was found for date <strong>{date}</strong>, location ({district}, {modalState}), and activity type ({activityType}).
                </p>
                <p className="text-[10px] text-amber-700 font-medium">
                  You may still log this activity and record expenditure. It will be tracked under Unplanned Activities.
                </p>
              </div>
            )}

            {/* Form Fields according to strictly specified order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Programme Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Programme *</label>
                <select
                  id="activity-programme-select"
                  value={modalProgramme}
                  onChange={(e) => setModalProgramme(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  {modalProjects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobiliser Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobiliser *</label>
                <select
                  id="activity-mobiliser-select"
                  value={modalMobiliserName}
                  onChange={(e) => {
                    const mob = modalMobilisers.find((m) => m.name === e.target.value) ||
                                availableMobilisers.find((m) => m.name === e.target.value);
                    setModalMobiliserName(e.target.value);
                    if (mob) setModalMobiliserId(mob.id);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  {modalMobilisers.length > 0 ? (
                    modalMobilisers.map((m) => (
                      <option key={`fa-modal-mob-${m.id}`} value={m.name}>
                        {m.name} {m.district ? `(${m.district})` : m.state ? `(${m.state})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value={currentUser.name}>
                      {currentUser.name}
                    </option>
                  )}
                </select>
              </div>

              {/* 1. Date of Activity * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Activity *</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 2. Activity Type * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity Type *</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {activityTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. State * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State *</label>
                <select
                  id="field-activity-state-select"
                  value={modalState}
                  onChange={(e) => handleModalStateChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {availableStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. District * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">District *</label>
                <select
                  id="field-activity-district-select"
                  value={district}
                  onChange={(e) => handleModalDistrictChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {availableModalDistricts.map((dName) => (
                    <option key={dName} value={dName}>
                      {dName}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Block * */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Block *</label>
                <select
                  id="field-activity-block-select"
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {availableBlocks.length > 0 ? (
                    availableBlocks.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  ) : (
                    <option value="">No blocks found</option>
                  )}
                </select>
              </div>

              {/* 6. Village / Colony / Specific Location * */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Village / Colony / Specific Location *
                </label>
                <input
                  required
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="e.g., Jotsoma Village Panchayat Hall"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 7. Contact Person Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g., Mr. Kevechutuo"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 8. Designation (immediately after Contact Person Name) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g., Village Head / Principal / Community Leader"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 9. Contact Phone */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g., 9862111111"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* 10. Participants Attended */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Participants Attended</label>
                <input
                  type="number"
                  min={0}
                  value={participants}
                  onChange={(e) => setParticipants(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                />
              </div>

              {/* 11. Eligible Candidates */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Eligible Candidates</label>
                <input
                  type="number"
                  min={0}
                  value={eligible}
                  onChange={(e) => setEligible(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                />
              </div>

              {/* 12. Interested Candidates */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Interested Candidates</label>
                <input
                  type="number"
                  min={0}
                  value={interested}
                  onChange={(e) => setInterested(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                />
              </div>

              {/* 13. Confirmed Candidates */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirmed Candidates</label>
                <input
                  type="number"
                  min={0}
                  value={confirmed}
                  onChange={(e) => setConfirmed(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-emerald-700 text-xs"
                />
              </div>

              {/* 14. Expenditure Incurred Breakdown (Travelling, Lodging, Fooding) */}
              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 text-xs">
                    Actual Expenditure Incurred (₹)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {matchingPlan ? 'Tracked against Approved Plan Budget' : 'Logged as Unplanned Expenditure'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Travelling (₹)</label>
                    <input
                      id="actual-travelling-input"
                      type="number"
                      min={0}
                      value={actualTravelling}
                      onChange={(e) => setActualTravelling(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                    {matchingPlan && (
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Approved: ₹{matchingPlan.approvedBudget?.travelling ?? matchingPlan.plannedBudget.travelling}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lodging (₹)</label>
                    <input
                      id="actual-lodging-input"
                      type="number"
                      min={0}
                      value={actualLodging}
                      onChange={(e) => setActualLodging(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                    {matchingPlan && (
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Approved: ₹{matchingPlan.approvedBudget?.lodging ?? matchingPlan.plannedBudget.lodging}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fooding (₹)</label>
                    <input
                      id="actual-fooding-input"
                      type="number"
                      min={0}
                      value={actualFooding}
                      onChange={(e) => setActualFooding(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                    {matchingPlan && (
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Approved: ₹{matchingPlan.approvedBudget?.fooding ?? matchingPlan.plannedBudget.fooding}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total and Variance Preview */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Total Actual Expenditure:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">₹{modalActualTotal}</span>
                    {matchingPlan && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          (matchingPlan.approvedBudget?.total ?? matchingPlan.plannedBudget.total) >= modalActualTotal
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {(matchingPlan.approvedBudget?.total ?? matchingPlan.plannedBudget.total) >= modalActualTotal
                          ? `Within Budget (₹${(matchingPlan.approvedBudget?.total ?? matchingPlan.plannedBudget.total) - modalActualTotal} left)`
                          : `Over Budget by ₹${modalActualTotal - (matchingPlan.approvedBudget?.total ?? matchingPlan.plannedBudget.total)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 15. Geo-tagged Activity Photos */}
              <div className="sm:col-span-2 space-y-2 pt-1 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="block font-semibold text-slate-800 text-xs">
                      Geo-tagged Activity Photos
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Visual evidence of mobilisation drive. Photos are stored in Google Drive and referenced in Google Sheets.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {selectedPhotos.length} selected
                  </span>
                </div>

                {/* Prominent Mobile-Friendly Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    id="capture-upload-activity-photos-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhotos}
                    className="flex-1 py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 border-dashed rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs min-h-[44px]"
                  >
                    {isProcessingPhotos ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Processing Photos...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <span>📷 Capture / Upload Activity Photos</span>
                      </>
                    )}
                  </button>

                  {/* Direct Camera Button for Mobile convenience */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessingPhotos}
                    className="px-3 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                    title="Open Camera Directly"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span className="sm:inline">Camera</span>
                  </button>
                </div>

                {/* Previews of selected photos with Remove action */}
                {selectedPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {selectedPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group bg-slate-50 border border-slate-200 rounded-xl p-1.5 space-y-1 shadow-2xs"
                      >
                        <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-200">
                          <img
                            src={photo.dataUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] px-1">
                          <div className="truncate max-w-[100px] text-slate-600 font-medium" title={photo.name}>
                            {photo.name}
                          </div>
                          <span className="text-slate-400 text-[9px] shrink-0">
                            {formatFileSize(photo.size)}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center justify-between pt-0.5 px-1">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            Pending Sync
                          </span>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 16. Remarks & Observations */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Remarks & Observations</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Youth showed high interest in Solar PV course. Village elder supported the session."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                id="submit-activity-report-btn"
                type="submit"
                className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition-colors"
              >
                Save Activity Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox / Modal for Previewing Activity Photo Evidence */}
      {activePreviewPhoto && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {activePreviewPhoto.activityId}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1 truncate max-w-sm sm:max-w-md">
                  {activePreviewPhoto.name}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activePreviewPhoto.status === 'Synced'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {activePreviewPhoto.status}
                </span>
                <button
                  onClick={() => setActivePreviewPhoto(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo display */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[65vh] p-2">
              <img
                src={activePreviewPhoto.url}
                alt={activePreviewPhoto.name}
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                {activePreviewPhoto.driveFileId ? (
                  <span className="font-mono text-[10px] text-slate-600">
                    Google Drive File: {activePreviewPhoto.driveFileId}
                  </span>
                ) : (
                  <span>Stored locally (Pending Google Drive Sync)</span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <a
                  href={activePreviewPhoto.url}
                  download={activePreviewPhoto.name}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setActivePreviewPhoto(null)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

