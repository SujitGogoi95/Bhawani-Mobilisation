import { Candidate, MobilisationActivity, CallLog } from '../types';

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const processRow = (row: (string | number)[]) => {
    return row
      .map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  };

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(processRow).join('\r\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCandidateMasterCSV(candidates: Candidate[]) {
  const headers = [
    'Candidate ID',
    'Full Name',
    'Gender',
    'Age',
    'Date of Birth',
    'Phone',
    'Alternate Phone',
    'Parent Contact',
    'Father Name',
    'Mother Name',
    'State',
    'District',
    'Block',
    'Village',
    'PIN Code',
    'Qualification',
    'School/College',
    'Project',
    'Phase',
    'Cycle',
    'Batch',
    'Programme',
    'Lead Source',
    'Assigned Mobiliser',
    'Eligibility Status',
    'Documents Complete',
    'Current Status',
    'Created Date',
  ];

  const rows: (string | number)[][] = [
    headers,
    ...candidates.map((c) => [
      c.candidateId,
      c.name,
      c.gender,
      c.age,
      c.dob,
      c.phone,
      c.alternatePhone || '',
      c.parentPhone || '',
      c.fatherName,
      c.motherName,
      c.state,
      c.district,
      c.block,
      c.village,
      c.pincode,
      c.qualification,
      c.schoolCollege,
      c.project || c.projectName || '',
      c.phase || '',
      c.cycle || '',
      c.batch || c.batchName || '',
      c.programme,
      c.leadSource,
      c.assignedMobiliserName || '',
      c.eligibilityStatus,
      c.documentsComplete ? 'Yes' : 'No',
      c.currentStatus,
      c.createdAt.split('T')[0],
    ]),
  ];

  downloadCSV(`Candidate_Master_Report_${new Date().toISOString().split('T')[0]}.csv`, rows);
}

export function exportActivitiesCSV(activities: MobilisationActivity[]) {
  const headers = [
    'Activity ID',
    'Date',
    'Mobiliser',
    'State',
    'District',
    'Block',
    'Village',
    'Activity Type',
    'Location',
    'Contact Person',
    'Designation',
    'Contact Phone',
    'Organisation',
    'Participants',
    'Eligible',
    'Interested',
    'Confirmed',
    'Candidates Added',
    'Expenditure (INR)',
    'Photos Count',
    'Sync Status',
    'Remarks',
  ];

  const rows: (string | number)[][] = [
    headers,
    ...activities.map((a) => [
      a.activityId,
      a.date,
      a.mobiliserName,
      a.state || '',
      a.district,
      a.block,
      a.village,
      a.activityType,
      a.location,
      a.contactPerson,
      a.designation || '',
      a.contactNumber,
      a.organisation,
      a.participants,
      a.eligibleCandidates,
      a.interestedCandidates,
      a.confirmedCandidates,
      a.candidatesAdded,
      a.expenditure,
      a.photos?.length || (a.photoUrl ? 1 : 0),
      a.syncStatus || 'Synced',
      a.remarks,
    ]),
  ];

  downloadCSV(`Daily_Mobilisation_Report_${new Date().toISOString().split('T')[0]}.csv`, rows);
}

export function exportCallLogsCSV(calls: CallLog[]) {
  const headers = [
    'Call Date',
    'Call Time',
    'Candidate Name',
    'Candidate Phone',
    'District',
    'Mobiliser',
    'Call Outcome',
    'Conversation Notes',
    'Follow-up Date',
    'Follow-up Remarks',
  ];

  const rows: (string | number)[][] = [
    headers,
    ...calls.map((c) => [
      c.callDate,
      c.callTime,
      c.candidateName,
      c.candidatePhone,
      c.candidateDistrict,
      c.mobiliserName,
      c.outcome,
      c.notes,
      c.followUpDate || '',
      c.followUpRemarks || '',
    ]),
  ];

  downloadCSV(`Telecalling_Report_${new Date().toISOString().split('T')[0]}.csv`, rows);
}
