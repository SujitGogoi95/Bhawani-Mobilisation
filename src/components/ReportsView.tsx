import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { downloadCSV, exportCandidateMasterCSV, exportActivitiesCSV, exportCallLogsCSV } from '../utils/exportUtils';
import {
  Candidate,
  MobilisationActivity,
  CallLog,
  PROJECT_OPTIONS,
  DDU_GKY_PHASES,
  DDU_GKY_CYCLES,
  CSR_BATCH_MAPPING,
  BATCH_OPTIONS,
} from '../types';

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<string>('daily_activities');
  const [selectedProgramme, setSelectedProgramme] = useState<string>('All');
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedCycle, setSelectedCycle] = useState<string>('All');
  const [selectedBatch, setSelectedBatch] = useState<string>('All');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [selectedMobiliser, setSelectedMobiliser] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const projects = dataStore.getProjects();
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.name)));
  }, [projects]);
  const districts = dataStore.getDistricts();
  const mobilisers = dataStore.getMobilisers();
  const candidates = dataStore.getCandidates();
  const activities = dataStore.getActivities();
  const callLogs = dataStore.getCallLogs();

  const handleProjectChange = (proj: string) => {
    setSelectedProject(proj);
    setSelectedPhase('All');
    setSelectedCycle('All');
    setSelectedBatch('All');
  };

  const availableBatches = useMemo(() => {
    if (selectedProject !== 'All' && CSR_BATCH_MAPPING[selectedProject]) {
      return [CSR_BATCH_MAPPING[selectedProject]];
    }
    if (selectedProject === 'DDU-GKY 2.0' || selectedProject === 'All') {
      return BATCH_OPTIONS;
    }
    return [];
  }, [selectedProject]);

  const reportOptions = [
    { id: 'daily_activities', label: '1. Daily Mobilisation Report (Field Drives)', desc: 'Detailed log of village meetings, schools visited, attendees & costs' },
    { id: 'district_wise', label: '2. District-wise Mobilisation Report', desc: 'Regional targets, registrations, confirmations, and % achievement' },
    { id: 'block_wise', label: '3. Block-wise Mobilisation Report', desc: 'Granular block breakdown of candidates and conversions' },
    { id: 'mobiliser_wise', label: '4. Mobiliser-wise Performance Report', desc: 'Mobiliser targets, lead generation, conversions & rankings' },
    { id: 'telecalling', label: '5. Tele-calling & Outreach Report', desc: 'Phone call outcomes, follow-up dates, and candidate notes' },
    { id: 'confirmed', label: '6. Confirmed Candidates Report', desc: 'Candidates ready and confirmed for upcoming training batches' },
    { id: 'docs_pending', label: '7. Documents Pending Report', desc: 'Candidates with missing Aadhaar, certificates, or photos' },
    { id: 'screening', label: '8. Screening & Interview Report', desc: 'Aptitude screening status and center evaluations' },
    { id: 'reporting', label: '9. Center Reporting & Joining Report', desc: 'Candidates who physically reported and joined at training center' },
    { id: 'dropouts', label: '10. Dropout & Ineligible Report', desc: 'Dropouts with recorded reasons and stage of exit' },
    { id: 'candidate_master', label: '11. Candidate Master Database (Complete)', desc: 'Full database export with all 30+ personal and program fields' },
  ];

  // Generate Report Data & Headers
  const reportData = useMemo(() => {
    let candList = candidates;
    if (selectedProject !== 'All') {
      candList = candList.filter((c) => (c.project || c.projectName || c.programme) === selectedProject);
    } else if (selectedProgramme !== 'All') {
      candList = candList.filter((c) => (c.project || c.projectName || c.programme) === selectedProgramme);
    }
    if (selectedPhase !== 'All') candList = candList.filter((c) => c.phase === selectedPhase);
    if (selectedCycle !== 'All') candList = candList.filter((c) => c.cycle === selectedCycle);
    if (selectedBatch !== 'All') candList = candList.filter((c) => (c.batch || c.batchName) === selectedBatch);
    if (selectedDistrict !== 'All') candList = candList.filter((c) => c.district === selectedDistrict);
    if (selectedMobiliser !== 'All') candList = candList.filter((c) => c.assignedMobiliserId === selectedMobiliser);

    switch (reportType) {
      case 'daily_activities': {
        let acts = activities;
        if (selectedDistrict !== 'All') acts = acts.filter((a) => a.district === selectedDistrict);
        if (selectedMobiliser !== 'All') acts = acts.filter((a) => a.mobiliserId === selectedMobiliser);
        return {
          headers: ['Activity ID', 'Date', 'Mobiliser', 'District', 'Block', 'Activity Type', 'Location', 'Attended', 'Eligible', 'Confirmed', 'Cost (₹)'],
          rows: acts.map((a) => [
            a.activityId,
            a.date,
            a.mobiliserName,
            a.district,
            a.block,
            a.activityType,
            a.location,
            a.participants,
            a.eligibleCandidates,
            a.confirmedCandidates,
            a.expenditure,
          ]),
          filename: `Daily_Mobilisation_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'district_wise': {
        const perf = dataStore.getDistrictPerformance(selectedProject !== 'All' ? selectedProject : (selectedProgramme !== 'All' ? selectedProgramme : undefined));
        return {
          headers: ['District', 'Target', 'Mobilised', 'Eligible', 'Confirmed', 'Reported', 'Achievement %'],
          rows: perf.map((p) => [p.district, p.target, p.mobilised, p.eligible, p.confirmed, p.reported, `${p.achievement}%`]),
          filename: `District_Wise_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'mobiliser_wise': {
        const perf = dataStore.getMobiliserPerformance(selectedProject !== 'All' ? selectedProject : (selectedProgramme !== 'All' ? selectedProgramme : undefined));
        return {
          headers: ['Mobiliser', 'District', 'Target', 'Leads', 'Eligible', 'Confirmed', 'Reported', 'Achievement %', 'Conv. Rate %'],
          rows: perf.map((p) => [p.name, p.district, p.target, p.leads, p.eligible, p.confirmed, p.reported, `${p.achievement}%`, `${p.conversionRate}%`]),
          filename: `Mobiliser_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'telecalling': {
        let calls = callLogs;
        if (selectedDistrict !== 'All') calls = calls.filter((c) => c.candidateDistrict === selectedDistrict);
        return {
          headers: ['Call Date', 'Time', 'Candidate', 'Phone', 'District', 'Outcome', 'Notes', 'Follow-up Date'],
          rows: calls.map((c) => [c.callDate, c.callTime, c.candidateName, c.candidatePhone, c.candidateDistrict, c.outcome, c.notes, c.followUpDate || 'None']),
          filename: `Telecalling_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'confirmed': {
        const conf = candList.filter((c) =>
          ['Confirmed', 'Documents Pending', 'Documents Complete', 'Screening Completed', 'Reported', 'Batch Assigned'].includes(c.currentStatus)
        );
        return {
          headers: ['Candidate ID', 'Name', 'Phone', 'District', 'Block', 'Qualification', 'Project', 'Phase', 'Cycle', 'Batch', 'Mobiliser', 'Status'],
          rows: conf.map((c) => [
            c.candidateId,
            c.name,
            c.phone,
            c.district,
            c.block,
            c.qualification,
            c.project || c.projectName || c.programme || 'Unallocated',
            c.phase || 'N/A',
            c.cycle || 'N/A',
            c.batch || c.batchName || 'Unassigned',
            c.assignedMobiliserName,
            c.currentStatus,
          ]),
          filename: `Confirmed_Candidates_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'docs_pending': {
        const pending = candList.filter((c) => !c.documentsComplete);
        return {
          headers: ['Candidate ID', 'Name', 'Phone', 'District', 'Missing Documents', 'Mobiliser'],
          rows: pending.map((c) => [c.candidateId, c.name, c.phone, c.district, c.missingDocuments?.join(', ') || 'Aadhaar / Photo', c.assignedMobiliserName]),
          filename: `Documents_Pending_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'screening': {
        const screened = candList.filter((c) => c.screening || ['Screening Completed', 'Eligible', 'Ready for Batch', 'Batch Assigned'].includes(c.currentStatus));
        return {
          headers: ['Candidate ID', 'Name', 'Phone', 'District', 'Project', 'Phase', 'Cycle', 'Batch', 'Qualification', 'Screening Status', 'Screening Date', 'Mobiliser'],
          rows: screened.map((c) => [
            c.candidateId,
            c.name,
            c.phone,
            c.district,
            c.project || c.projectName || c.programme || 'Unallocated',
            c.phase || 'N/A',
            c.cycle || 'N/A',
            c.batch || c.batchName || 'Unassigned',
            c.qualification,
            c.screening?.status || c.currentStatus,
            c.screening?.screenedDate || 'N/A',
            c.assignedMobiliserName,
          ]),
          filename: `Screening_Assessment_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'reporting': {
        const reporting = candList.filter((c) => ['Reported', 'Batch Assigned', 'In Training', 'Training Started'].includes(c.currentStatus));
        return {
          headers: ['Candidate ID', 'Name', 'Phone', 'District', 'Project', 'Phase', 'Cycle', 'Batch', 'Status', 'Mobiliser'],
          rows: reporting.map((c) => [
            c.candidateId,
            c.name,
            c.phone,
            c.district,
            c.project || c.projectName || c.programme || 'Unallocated',
            c.phase || 'N/A',
            c.cycle || 'N/A',
            c.batch || c.batchName || 'Unassigned',
            c.currentStatus,
            c.assignedMobiliserName,
          ]),
          filename: `Center_Reporting_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'dropouts': {
        const drops = candList.filter((c) => c.currentStatus === 'Dropout' || c.currentStatus === 'Rejected' || c.eligibilityStatus === 'Ineligible');
        return {
          headers: ['Candidate ID', 'Name', 'Phone', 'District', 'Block', 'Project', 'Phase', 'Cycle', 'Batch', 'Status', 'Eligibility Status', 'Mobiliser'],
          rows: drops.map((c) => [
            c.candidateId,
            c.name,
            c.phone,
            c.district,
            c.block,
            c.project || c.projectName || c.programme || 'Unallocated',
            c.phase || 'N/A',
            c.cycle || 'N/A',
            c.batch || c.batchName || 'Unassigned',
            c.currentStatus,
            c.eligibilityStatus,
            c.assignedMobiliserName,
          ]),
          filename: `Dropout_Ineligible_Report_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
      case 'candidate_master':
      default: {
        return {
          headers: ['Candidate ID', 'Name', 'Gender', 'Age', 'DOB', 'Phone', 'District', 'Block', 'Village', 'Qualification', 'Project', 'Phase', 'Cycle', 'Batch', 'Status', 'Mobiliser'],
          rows: candList.map((c) => [
            c.candidateId,
            c.name,
            c.gender,
            c.age,
            c.dob,
            c.phone,
            c.district,
            c.block,
            c.village,
            c.qualification,
            c.project || c.projectName || c.programme || 'Unallocated',
            c.phase || 'N/A',
            c.cycle || 'N/A',
            c.batch || c.batchName || 'Unassigned',
            c.currentStatus,
            c.assignedMobiliserName,
          ]),
          filename: `Candidate_Master_Export_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }
    }
  }, [reportType, selectedProject, selectedPhase, selectedCycle, selectedBatch, selectedProgramme, selectedDistrict, selectedMobiliser, candidates, activities, callLogs]);

  const handleExportCSV = () => {
    downloadCSV(reportData.filename, [reportData.headers, ...reportData.rows]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reports & Analytics Engine</h2>
          <p className="text-xs text-slate-500">
            Generate, preview, and export 11 operational mobilization reports for leadership & sponsors
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selection & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Report Type Selector */}
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Report Type *</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-700 focus:bg-white"
            >
              {reportOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
            >
              <option value="All">All Projects</option>
              {uniqueProjects.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
            </select>
          </div>

          {/* Phase Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phase {selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0' ? '(N/A)' : ''}
            </label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              disabled={selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0'}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium disabled:opacity-50"
            >
              <option value="All">All Phases</option>
              {DDU_GKY_PHASES.map((ph) => (
                <option key={ph} value={ph}>
                  {ph}
                </option>
              ))}
            </select>
          </div>

          {/* Cycle Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cycle {selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0' ? '(N/A)' : ''}
            </label>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              disabled={selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0'}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium disabled:opacity-50"
            >
              <option value="All">All Cycles</option>
              {DDU_GKY_CYCLES.map((cy) => (
                <option key={cy} value={cy}>
                  {cy}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={selectedProject === 'RTD'}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium disabled:opacity-50"
            >
              <option value="All">All Batches</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="All">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mobiliser Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mobiliser</label>
            <select
              value={selectedMobiliser}
              onChange={(e) => setSelectedMobiliser(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="All">All Mobilisers</option>
              {mobilisers.map((m, idx) => (
                <option key={`report-mob-${m.id}-${idx}`} value={m.id}>
                  {m.name} ({m.district})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Report Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {reportOptions.find((o) => o.id === reportType)?.label}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {reportData.rows.length} records generated
          </span>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                {reportData.headers.map((h) => (
                  <th key={h} className="py-3 px-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {row.map((val, cIdx) => (
                    <td key={cIdx} className="py-3 px-4 whitespace-nowrap">
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
