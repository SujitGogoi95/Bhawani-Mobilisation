/**
 * ==============================================================================
 * BHAWANI MMS - GOOGLE APPS SCRIPT WEB APP BACKEND
 * ==============================================================================
 * 
 * Features:
 * - Candidate Registration & Continuous Directory
 * - Google Drive Document Uploads (KYC, Certificates, Consent Forms)
 * - Strict Restricted Access: Files are NOT public or ANYONE_WITH_LINK
 * - Google Sheets Synchronization (Candidates, Documents, Activities, Call Logs, Follow-Ups)
 * - Safe CORS handling for browser fetch requests
 * 
 * Parent Drive Folder ID: 1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp
 */

// Default Configuration
var DEFAULT_PARENT_DRIVE_FOLDER_ID = '1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp';
var SPREADSHEET_ID = '1DWr_SELbKx2aiPM7KGGfG9iMBB14tdnFIxfnDpFTkRg'; // Explicitly configured Google Spreadsheet ID

/**
 * Handle HTTP GET requests (for testing and connectivity diagnostics)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';
  var responseData = {
    status: 'ok',
    success: true,
    message: 'Bhawani MMS Google Apps Script Web App is online and operational.',
    action: action,
    timestamp: new Date().toISOString(),
    parentDriveFolderId: DEFAULT_PARENT_DRIVE_FOLDER_ID,
  };
  return createCorsResponse(responseData);
}

/**
 * Handle HTTP POST requests (Primary API router for frontend)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createCorsResponse({
        success: false,
        status: 'error',
        message: 'No post data received',
      });
    }

    var payload = {};
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createCorsResponse({
        success: false,
        status: 'error',
        message: 'Invalid JSON payload: ' + parseErr.message,
      });
    }

    var action = payload.action || 'test';

    switch (action) {
      case 'test':
        return createCorsResponse({
          success: true,
          status: 'ok',
          message: 'Connection to Apps Script backend is successful!',
          timestamp: new Date().toISOString(),
        });

      case 'uploadDocument':
        return handleUploadDocument(payload);

      case 'addCandidate':
        return handleAddCandidate(payload);

      case 'getCandidates':
        return handleGetCandidates(payload);

      case 'updateCandidate':
        return handleUpdateCandidate(payload);

      case 'deleteCandidate':
        return handleDeleteCandidate(payload);

      case 'getDocuments':
        return handleGetDocuments(payload);

      case 'updateDocument':
        return handleUpdateDocument(payload);

      case 'addActivity':
        return handleAddActivity(payload);

      case 'getActivities':
        return handleGetActivities(payload);

      case 'uploadActivityPhoto':
        return handleUploadActivityPhoto(payload);

      case 'getActivityPhotos':
        return handleGetActivityPhotos(payload);

      case 'addCallLog':
        return handleAddCallLog(payload);

      case 'getCallLogs':
        return handleGetCallLogs(payload);

      case 'addFollowUp':
        return handleAddFollowUp(payload);

      case 'getFollowUps':
        return handleGetFollowUps(payload);

      case 'getDashboard':
        return handleGetDashboard(payload);

      case 'getProjects':
        return handleGetProjects(payload);

      case 'login':
        return handleLogin(payload);

      default:
        return createCorsResponse({
          success: false,
          status: 'error',
          message: 'Unknown action requested: ' + action,
        });
    }
  } catch (error) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Server error in doPost: ' + error.message,
      stack: error.stack,
    });
  }
}

/**
 * Helper: Output JSON response with CORS headers
 */
function createCorsResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Retrieve active Google Spreadsheet
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Helper: Get or create sheet with specified headers
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * ==============================================================================
 * 1. GOOGLE DRIVE DOCUMENT UPLOAD (uploadDocument)
 * ==============================================================================
 * Strict Access Rule:
 * Uploaded files remain restricted (private to Google Apps Script owner/domain).
 * We DO NOT make files public or use ANYONE_WITH_LINK.
 */
function handleUploadDocument(payload) {
  try {
    var candidateId = payload.candidateId || 'Unknown_Candidate';
    var candidateName = payload.candidateName || 'Candidate';
    var documentType = payload.documentType || 'General_Document';
    var fileName = payload.fileName || (documentType.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');
    var mimeType = payload.mimeType || 'application/pdf';
    var base64Content = payload.base64Content || '';
    var parentFolderId = payload.parentFolderId || DEFAULT_PARENT_DRIVE_FOLDER_ID;
    var uploadedBy = payload.uploadedBy || payload.userRole || 'System';

    if (!base64Content) {
      return createCorsResponse({
        success: false,
        status: 'error',
        message: 'No file data (base64Content) provided for upload',
      });
    }

    // 1. Strip data URL prefix if present (e.g. data:application/pdf;base64,...)
    var cleanBase64 = base64Content;
    if (cleanBase64.indexOf(';base64,') !== -1) {
      cleanBase64 = cleanBase64.split(';base64,')[1];
    }

    // 2. Decode base64 to byte array
    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // 3. Open parent Google Drive folder
    var parentFolder;
    try {
      parentFolder = DriveApp.getFolderById(parentFolderId);
    } catch (folderErr) {
      // Fallback: If folder ID not found or unauthorized, use root
      parentFolder = DriveApp.getRootFolder();
    }

    // 4. Create or locate a candidate-specific subfolder to keep files organized
    var subfolderName = candidateId + ' - ' + candidateName;
    var candidateFolder;
    var folders = parentFolder.getFoldersByName(subfolderName);
    if (folders.hasNext()) {
      candidateFolder = folders.next();
    } else {
      candidateFolder = parentFolder.createFolder(subfolderName);
      // NOTE: candidateFolder inherits parent folder permissions (RESTRICTED).
      // We NEVER call setSharing(DriveApp.Access.ANYONE_WITH_LINK, ...).
    }

    // 5. Create file in candidate's subfolder
    var file = candidateFolder.createFile(blob);
    var fileId = file.getId();
    var fileUrl = file.getUrl();

    // NOTE: Strictly preserve restricted access. DO NOT call setSharing().
    // The file URL is accessible only to authorized team members.

    // 6. Record upload in Google Sheets "Documents" tab
    try {
      var docSheet = getOrCreateSheet('Documents', [
        'Document ID',
        'Candidate ID',
        'Candidate Name',
        'Document Type',
        'File Name',
        'Google Drive File URL',
        'Drive File ID',
        'Folder ID',
        'Status',
        'Uploaded By',
        'Uploaded At',
        'Verified By',
        'Verified At',
        'Rejection Reason'
      ]);

      var docId = 'DOC-' + Utilities.getUuid().substring(0, 8);
      var timestamp = new Date().toISOString();

      docSheet.appendRow([
        docId,
        candidateId,
        candidateName,
        documentType,
        fileName,
        fileUrl,
        fileId,
        candidateFolder.getId(),
        'Uploaded',
        uploadedBy,
        timestamp,
        '',
        '',
        ''
      ]);
    } catch (sheetErr) {
      Logger.log('Could not write to Documents sheet: ' + sheetErr.message);
    }

    return createCorsResponse({
      success: true,
      status: 'success',
      message: 'Document uploaded successfully to Google Drive',
      fileId: fileId,
      fileUrl: fileUrl,
      fileName: fileName,
      documentType: documentType,
      candidateId: candidateId,
      folderId: candidateFolder.getId(),
      folderUrl: candidateFolder.getUrl(),
    });
  } catch (err) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Failed to upload document to Google Drive: ' + err.message,
    });
  }
}

/**
 * ==============================================================================
 * 2. CANDIDATE REGISTRATION (addCandidate)
 * ==============================================================================
 * Dynamically maps incoming candidate fields to the existing sheet headers.
 * Does NOT change, delete, reorder, or recreate existing columns.
 * Appends missing Drive/document fields ONLY at the far right of the sheet.
 */
function handleAddCandidate(payload) {
  try {
    // Backend Security Enforcement: Validate State Lock for Mobilisers
    var userRole = String(payload.userRole || '').toLowerCase();
    var userState = String(payload.userState || '').trim();
    var candidateState = String(payload.state || payload.State || '').trim();

    if (userRole && userRole !== 'admin' && userState && userState.toLowerCase() !== 'all') {
      if (!candidateState) {
        payload.state = userState;
        candidateState = userState;
      } else if (candidateState.toLowerCase() !== userState.toLowerCase()) {
        return createCorsResponse({
          success: false,
          status: 'error',
          message: 'Access Denied: As a State Mobiliser for ' + userState + ', you are not permitted to register candidates in ' + candidateState + '.',
        });
      }
    }

    var candidateId = payload.candidateId || payload.id || ('CAN-' + Utilities.getUuid().substring(0, 8).toUpperCase());
    payload.candidateId = candidateId;

    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet('Candidates');

    // 1. Read existing header row from the sheet
    var lastCol = sheet.getLastColumn();
    var existingHeaders = [];
    if (lastCol > 0) {
      existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    // If sheet was empty with no headers at all, seed with standard headers
    if (existingHeaders.length === 0) {
      existingHeaders = [
        'Candidate ID', 'Full Name', 'Date of Birth', 'Age', 'Gender',
        "Father's Name", "Mother's Name", 'Primary Phone', 'Alternate / Parent Phone',
        'State', 'District', 'Block', 'Village / Locality', 'Address', 'Pincode',
        'Qualification', 'School/College', 'Year of Passing', 'Education Status',
        'Programme', 'Project', 'Phase', 'Cycle', 'Batch',
        'Lead Source', 'Lead Source Details',
        'Mobiliser Name', 'Mobiliser Phone', 'Mobiliser State',
        'Eligibility Status', 'Collected Documents', 'Documents Complete', 'Missing Documents',
        'Drive Document Links', 'Drive Folder ID', 'Uploaded Documents JSON',
        'Stage', 'Current Status', 'Created At', 'Updated At'
      ];
      sheet.appendRow(existingHeaders);
      sheet.getRange(1, 1, 1, existingHeaders.length).setFontWeight('bold').setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    } else {
      // 2. Check if any NEW fields required by Drive/document functionality are missing.
      // If missing, add those new columns ONLY at the far right of the sheet.
      // NEVER insert them in the middle or reorder existing columns.
      var requiredDriveHeaders = [
        'Drive Document Links',
        'Drive Folder ID',
        'Uploaded Documents JSON'
      ];

      for (var d = 0; d < requiredDriveHeaders.length; d++) {
        var reqHeader = requiredDriveHeaders[d];
        var headerFound = false;
        for (var h = 0; h < existingHeaders.length; h++) {
          if (normalizeHeaderKey(existingHeaders[h]) === normalizeHeaderKey(reqHeader)) {
            headerFound = true;
            break;
          }
        }
        if (!headerFound) {
          var newColIndex = existingHeaders.length + 1;
          sheet.getRange(1, newColIndex).setValue(reqHeader).setFontWeight('bold').setBackground('#f3f4f6');
          existingHeaders.push(reqHeader);
        }
      }
    }

    // 3. Build the new candidate row according to the ACTUAL existing header order
    var timestamp = new Date().toISOString();
    var newRow = [];

    for (var c = 0; c < existingHeaders.length; c++) {
      var headerName = existingHeaders[c];
      var cellVal = getValueForCandidateHeader(headerName, payload, timestamp);
      newRow.push(cellVal);
    }

    // 4. Append the new candidate row (preserves all existing candidate rows without overwriting)
    sheet.appendRow(newRow);

    return createCorsResponse({
      success: true,
      status: 'success',
      candidateId: candidateId,
      id: payload.id || candidateId,
      message: 'Candidate saved successfully to Google Sheets',
    });
  } catch (err) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Failed to add candidate: ' + err.message,
    });
  }
}

/**
 * ==============================================================================
 * 3. RETRIEVE CANDIDATES (getCandidates)
 * ==============================================================================
 * Reads existing sheet headers dynamically and returns full candidate objects.
 */
function handleGetCandidates(payload) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Candidates');
    if (!sheet) {
      return createCorsResponse({ success: true, status: 'success', candidates: [] });
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createCorsResponse({ success: true, status: 'success', candidates: [] });
    }

    var headers = data[0];
    var candidates = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0 || !row[0]) continue;

      var rowMap = {};
      for (var h = 0; h < headers.length; h++) {
        var hName = String(headers[h] || '').trim();
        if (hName) {
          rowMap[normalizeHeaderKey(hName)] = row[h];
        }
      }

      var getCol = function(candidatesKeys, fallback) {
        for (var k = 0; k < candidatesKeys.length; k++) {
          var val = rowMap[normalizeHeaderKey(candidatesKeys[k])];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return val;
          }
        }
        return fallback !== undefined ? fallback : '';
      };

      var candId = String(getCol(['Candidate ID', 'CandidateID', 'ID', 'Cand ID'], 'CAND-' + i)).trim();
      var candName = String(getCol(['Full Name', 'Name', 'Candidate Name', 'Student Name'], '')).trim();
      var candPhone = String(getCol(['Primary Phone', 'Phone', 'Phone Number', 'Mobile', 'Mobile Number', 'Contact Number'], '')).trim();
      var altPhone = String(getCol(['Alternate / Parent Phone', 'Alternate Phone', 'Secondary Phone'], '')).trim();
      var parPhone = String(getCol(['Parent Phone', 'Alternate / Parent Phone', 'Guardian Phone'], '')).trim();

      var collectedDocsRaw = getCol(['Collected Documents'], '');
      var collectedDocsArr = [];
      if (collectedDocsRaw) {
        collectedDocsArr = String(collectedDocsRaw).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      }

      var missingDocsRaw = getCol(['Missing Documents'], '');
      var missingDocsArr = [];
      if (missingDocsRaw) {
        missingDocsArr = String(missingDocsRaw).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      }

      var isDocComplete = String(getCol(['Documents Complete'], '')).toLowerCase();
      var docCompleteBool = isDocComplete === 'yes' || isDocComplete === 'true';

      candidates.push({
        id: candId,
        candidateId: candId,
        name: candName,
        gender: String(getCol(['Gender', 'Sex'], '')),
        dob: String(getCol(['Date of Birth', 'DOB', 'Birth Date', 'D.O.B.'], '')),
        age: Number(getCol(['Age'], 0)) || 0,
        phone: candPhone,
        alternatePhone: altPhone,
        parentPhone: parPhone,
        fatherName: String(getCol(["Father's Name", 'Father Name', 'Fathers Name', 'Father'], '')),
        motherName: String(getCol(["Mother's Name", 'Mother Name', 'Mothers Name', 'Mother'], '')),
        address: String(getCol(['Address', 'Full Address', 'Residential Address'], '')),
        state: String(getCol(['State', 'State Name'], '')),
        district: String(getCol(['District', 'District Name'], '')),
        block: String(getCol(['Block', 'Block Name'], '')),
        village: String(getCol(['Village / Locality', 'Village', 'Locality', 'Town', 'City'], '')),
        pincode: String(getCol(['Pincode', 'Pin Code', 'Postal Code', 'Zip'], '')),
        qualification: String(getCol(['Qualification', 'Highest Qualification', 'Education Qualification'], '')),
        schoolCollege: String(getCol(['School/College', 'School / College', 'School', 'College', 'Institute'], '')),
        yearOfPassing: String(getCol(['Year of Passing', 'Passing Year', 'Pass Year'], '')),
        educationStatus: String(getCol(['Education Status', 'Qualification Status'], '')),
        programme: String(getCol(['Programme', 'Program', 'Scheme'], '')),
        project: String(getCol(['Project', 'Project Name', 'Project Title', 'Programme'], '')),
        projectName: String(getCol(['Project Name', 'Project', 'Programme'], '')),
        phase: String(getCol(['Phase', 'Project Phase'], '')),
        cycle: String(getCol(['Cycle', 'Project Cycle'], '')),
        batch: String(getCol(['Batch', 'Batch Name', 'Assigned Batch', 'Cohort'], '')),
        batchName: String(getCol(['Batch Name', 'Batch'], '')),
        leadSource: String(getCol(['Lead Source', 'Source', 'Mobilisation Source'], '')),
        leadSourceDetails: String(getCol(['Lead Source Details', 'Source Details'], '')),
        assignedMobiliserName: String(getCol(['Mobiliser Name', 'Assigned Mobiliser Name', 'Assigned Mobiliser', 'Mobiliser'], '')),
        assignedMobiliserPhone: String(getCol(['Mobiliser Phone', 'Assigned Mobiliser Phone'], '')),
        assignedMobiliserState: String(getCol(['Mobiliser State', 'Assigned Mobiliser State'], '')),
        eligibilityStatus: String(getCol(['Eligibility Status', 'Overall Eligibility'], 'Eligible')),
        collectedDocuments: collectedDocsArr,
        documentsComplete: docCompleteBool,
        missingDocuments: missingDocsArr,
        documentDriveLinks: tryParseJson(getCol(['Drive Document Links', 'Document Drive Links', 'Drive Links'], '{}'), {}),
        googleDriveFolderId: String(getCol(['Drive Folder ID', 'Google Drive Folder ID', 'Folder ID'], DEFAULT_PARENT_DRIVE_FOLDER_ID)),
        stage: String(getCol(['Stage', 'Workflow Stage'], 'Pre-Mobilisation')),
        currentStatus: String(getCol(['Current Status', 'Status', 'Candidate Status'], 'New Lead')),
        createdAt: String(getCol(['Created At', 'Registration Date', 'Created Date'], '')),
        updatedAt: String(getCol(['Updated At', 'Last Modified', 'Modified At'], '')),
      });
    }

    return createCorsResponse({
      success: true,
      status: 'success',
      candidates: candidates,
      total: candidates.length,
    });
  } catch (err) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Failed to get candidates: ' + err.message,
    });
  }
}

/**
 * ==============================================================================
 * 4. UPDATE CANDIDATE (updateCandidate)
 * ==============================================================================
 */
function handleUpdateCandidate(payload) {
  try {
    var candidateId = payload.candidateId || payload.id;
    if (!candidateId) {
      return createCorsResponse({ success: false, status: 'error', message: 'Candidate ID is required' });
    }

    var sheet = getOrCreateSheet('Candidates');
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createCorsResponse({ success: false, status: 'error', message: 'Candidates sheet is empty' });
    }

    var headers = data[0];
    var candIdCol = 0; // Default first column
    for (var h = 0; h < headers.length; h++) {
      var normH = normalizeHeaderKey(headers[h]);
      if (normH === 'candidateid' || normH === 'id' || normH === 'candid') {
        candIdCol = h;
        break;
      }
    }

    var updated = false;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][candIdCol]).trim() === String(candidateId).trim()) {
        var rowIndex = i + 1;

        var setCell = function(colVariants, val) {
          var colIdx = findColIndex(headers, colVariants);
          if (colIdx > 0) {
            sheet.getRange(rowIndex, colIdx).setValue(val);
          }
        };

        if (payload.currentStatus) setCell(['Current Status', 'Status', 'Candidate Status'], payload.currentStatus);
        if (payload.stage) setCell(['Stage', 'Workflow Stage'], payload.stage);
        if (payload.batch) setCell(['Batch', 'Batch Name', 'Assigned Batch'], payload.batch);
        if (payload.phase) setCell(['Phase', 'Project Phase'], payload.phase);
        if (payload.cycle) setCell(['Cycle', 'Project Cycle'], payload.cycle);
        if (payload.project) setCell(['Project', 'Project Name', 'Programme'], payload.project);
        if (payload.collectedDocuments) {
          var docsStr = Array.isArray(payload.collectedDocuments) ? payload.collectedDocuments.join(', ') : payload.collectedDocuments;
          setCell(['Collected Documents'], docsStr);
        }
        if (payload.documentsComplete !== undefined) {
          var isComp = payload.documentsComplete === true || payload.documentsComplete === 'true' || payload.documentsComplete === 'Yes';
          setCell(['Documents Complete'], isComp ? 'Yes' : 'No');
        }
        if (payload.documentDriveLinks) {
          var linksStr = typeof payload.documentDriveLinks === 'object' ? JSON.stringify(payload.documentDriveLinks) : payload.documentDriveLinks;
          setCell(['Drive Document Links', 'Document Drive Links', 'Drive Links'], linksStr);
        }
        setCell(['Updated At', 'Last Modified', 'Modified At'], new Date().toISOString());
        updated = true;
        break;
      }
    }

    return createCorsResponse({
      success: updated,
      status: updated ? 'success' : 'not_found',
      message: updated ? 'Candidate updated successfully' : 'Candidate not found in sheet',
    });
  } catch (err) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Failed to update candidate: ' + err.message,
    });
  }
}

/**
 * ==============================================================================
 * 5. DELETE CANDIDATE (deleteCandidate)
 * ==============================================================================
 */
function handleDeleteCandidate(payload) {
  try {
    var candidateId = payload.candidateId || payload.id;
    var sheet = getOrCreateSheet('Candidates');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(candidateId)) {
        sheet.deleteRow(i + 1);
        return createCorsResponse({
          success: true,
          status: 'success',
          message: 'Candidate deleted successfully',
        });
      }
    }
    return createCorsResponse({
      success: false,
      status: 'not_found',
      message: 'Candidate not found',
    });
  } catch (err) {
    return createCorsResponse({
      success: false,
      status: 'error',
      message: 'Failed to delete candidate: ' + err.message,
    });
  }
}

/**
 * ==============================================================================
 * 6. RETRIEVE DOCUMENTS (getDocuments)
 * ==============================================================================
 */
function handleGetDocuments(payload) {
  try {
    var sheet = getOrCreateSheet('Documents');
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createCorsResponse({ success: true, status: 'success', documents: [] });
    }

    var headers = data[0];
    var docs = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      docs.push({
        id: row[0],
        candidateId: row[1],
        candidateName: row[2],
        documentType: row[3],
        fileName: row[4],
        fileUrl: row[5],
        driveFileId: row[6],
        folderId: row[7],
        status: row[8] || 'Uploaded',
        uploadedBy: row[9] || '',
        uploadedAt: row[10] || '',
        verifiedBy: row[11] || '',
        verifiedAt: row[12] || '',
        rejectionReason: row[13] || '',
      });
    }

    return createCorsResponse({ success: true, status: 'success', documents: docs });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

/**
 * ==============================================================================
 * 7. UPDATE DOCUMENT (updateDocument - Verify/Reject)
 * ==============================================================================
 */
function handleUpdateDocument(payload) {
  try {
    var docId = payload.id || payload.documentId;
    var status = payload.status || 'Verified';
    var sheet = getOrCreateSheet('Documents');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(docId)) {
        var row = i + 1;
        sheet.getRange(row, 9).setValue(status); // Status col
        sheet.getRange(row, 12).setValue(payload.verifiedBy || 'Admin'); // Verified By
        sheet.getRange(row, 13).setValue(new Date().toISOString()); // Verified At
        if (payload.rejectionReason) {
          sheet.getRange(row, 14).setValue(payload.rejectionReason);
        }
        return createCorsResponse({ success: true, status: 'success', message: 'Document status updated' });
      }
    }
    return createCorsResponse({ success: false, status: 'not_found', message: 'Document not found' });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

/**
 * ==============================================================================
 * 8. ACTIVITIES & PHOTOS (addActivity, getActivities, uploadActivityPhoto)
 * ==============================================================================
 */
function handleAddActivity(payload) {
  try {
    var sheet = getOrCreateSheet('Activities', [
      'Activity ID',
      'Title',
      'Type',
      'Date',
      'Location',
      'District',
      'State',
      'Mobiliser Name',
      'Attendees Count',
      'Interested Count',
      'Notes',
      'Created At'
    ]);
    var id = payload.id || ('ACT-' + Utilities.getUuid().substring(0, 8).toUpperCase());
    sheet.appendRow([
      id,
      payload.title || '',
      payload.type || '',
      payload.date || new Date().toISOString().split('T')[0],
      payload.location || '',
      payload.district || '',
      payload.state || '',
      payload.mobiliserName || '',
      payload.attendeesCount || 0,
      payload.interestedCount || 0,
      payload.notes || '',
      new Date().toISOString(),
    ]);
    return createCorsResponse({ success: true, status: 'success', id: id });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleGetActivities(payload) {
  try {
    var sheet = getOrCreateSheet('Activities');
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return createCorsResponse({ success: true, status: 'success', activities: [] });
    var headers = data[0];
    var activities = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      activities.push({
        id: row[0],
        title: row[1],
        type: row[2],
        date: row[3],
        location: row[4],
        district: row[5],
        state: row[6],
        mobiliserName: row[7],
        attendeesCount: row[8],
        interestedCount: row[9],
        notes: row[10],
      });
    }
    return createCorsResponse({ success: true, status: 'success', activities: activities });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleUploadActivityPhoto(payload) {
  try {
    var activityId = payload.activityId || 'General_Activity';
    var photoName = payload.photoName || 'photo.jpg';
    var photoBase64 = payload.photoBase64 || '';
    var parentFolder = DriveApp.getFolderById(DEFAULT_PARENT_DRIVE_FOLDER_ID);
    
    var cleanBase64 = photoBase64;
    if (cleanBase64.indexOf(';base64,') !== -1) {
      cleanBase64 = cleanBase64.split(';base64,')[1];
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'image/jpeg', photoName);
    var file = parentFolder.createFile(blob);

    var sheet = getOrCreateSheet('ActivityPhotos', ['Photo ID', 'Activity ID', 'Photo Name', 'Drive URL', 'Uploaded At']);
    sheet.appendRow(['PHT-' + Utilities.getUuid().substring(0, 8), activityId, photoName, file.getUrl(), new Date().toISOString()]);

    return createCorsResponse({ success: true, status: 'success', photoUrl: file.getUrl(), photoId: file.getId() });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleGetActivityPhotos(payload) {
  try {
    var sheet = getOrCreateSheet('ActivityPhotos');
    var data = sheet.getDataRange().getValues();
    var photos = [];
    for (var i = 1; i < data.length; i++) {
      if (!payload.activityId || data[i][1] === payload.activityId) {
        photos.push({ id: data[i][0], activityId: data[i][1], photoName: data[i][2], photoUrl: data[i][3] });
      }
    }
    return createCorsResponse({ success: true, status: 'success', photos: photos });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

/**
 * ==============================================================================
 * 9. CALL LOGS & FOLLOW-UPS
 * ==============================================================================
 */
function handleAddCallLog(payload) {
  try {
    var sheet = getOrCreateSheet('CallLogs', ['Log ID', 'Candidate ID', 'Candidate Name', 'Caller Name', 'Call Type', 'Duration Seconds', 'Outcome', 'Notes', 'Timestamp']);
    var id = 'CALL-' + Utilities.getUuid().substring(0, 8);
    sheet.appendRow([id, payload.candidateId, payload.candidateName, payload.callerName, payload.callType, payload.durationSeconds, payload.outcome, payload.notes, new Date().toISOString()]);
    return createCorsResponse({ success: true, status: 'success', id: id });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleGetCallLogs(payload) {
  try {
    var sheet = getOrCreateSheet('CallLogs');
    var data = sheet.getDataRange().getValues();
    var logs = [];
    for (var i = 1; i < data.length; i++) {
      if (!payload.candidateId || data[i][1] === payload.candidateId) {
        logs.push({ id: data[i][0], candidateId: data[i][1], candidateName: data[i][2], callerName: data[i][3], callType: data[i][4], durationSeconds: data[i][5], outcome: data[i][6], notes: data[i][7], timestamp: data[i][8] });
      }
    }
    return createCorsResponse({ success: true, status: 'success', callLogs: logs });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleAddFollowUp(payload) {
  try {
    var sheet = getOrCreateSheet('FollowUps', ['Task ID', 'Candidate ID', 'Candidate Name', 'Due Date', 'Assigned Mobiliser', 'Priority', 'Status', 'Notes', 'Created At']);
    var id = 'TSK-' + Utilities.getUuid().substring(0, 8);
    sheet.appendRow([id, payload.candidateId, payload.candidateName, payload.dueDate, payload.assignedMobiliser, payload.priority, 'Pending', payload.notes, new Date().toISOString()]);
    return createCorsResponse({ success: true, status: 'success', id: id });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleGetFollowUps(payload) {
  try {
    var sheet = getOrCreateSheet('FollowUps');
    var data = sheet.getDataRange().getValues();
    var tasks = [];
    for (var i = 1; i < data.length; i++) {
      tasks.push({ id: data[i][0], candidateId: data[i][1], candidateName: data[i][2], dueDate: data[i][3], assignedMobiliser: data[i][4], priority: data[i][5], status: data[i][6], notes: data[i][7] });
    }
    return createCorsResponse({ success: true, status: 'success', followUps: tasks });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

/**
 * ==============================================================================
 * 10. DASHBOARD & MASTER DATA (getDashboard, getProjects, login)
 * ==============================================================================
 */
function handleGetDashboard(payload) {
  try {
    var candSheet = getOrCreateSheet('Candidates');
    var cands = candSheet.getDataRange().getValues();
    var totalCandidates = Math.max(0, cands.length - 1);

    var actSheet = getOrCreateSheet('Activities');
    var acts = actSheet.getDataRange().getValues();
    var totalActivities = Math.max(0, acts.length - 1);

    var docSheet = getOrCreateSheet('Documents');
    var docs = docSheet.getDataRange().getValues();
    var totalDocuments = Math.max(0, docs.length - 1);

    return createCorsResponse({
      success: true,
      status: 'success',
      metrics: {
        totalCandidates: totalCandidates,
        totalActivities: totalActivities,
        totalDocuments: totalDocuments,
        driveFolderId: DEFAULT_PARENT_DRIVE_FOLDER_ID,
      },
    });
  } catch (err) {
    return createCorsResponse({ success: false, status: 'error', message: err.message });
  }
}

function handleGetProjects(payload) {
  return createCorsResponse({
    success: true,
    status: 'success',
    projects: [
      { name: 'DDU-GKY 2.0', phases: ['Phase I', 'Phase II'], cycles: ['Cycle 1', 'Cycle 2'], batches: ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'] },
      { name: 'CSR-Solar', batches: ['Solar Technician Batch A', 'Solar Technician Batch B'] },
      { name: 'CSR-Retail', batches: ['Retail Sales Batch 1', 'Retail Sales Batch 2'] },
      { name: 'CSR-Healthcare', batches: ['General Duty Assistant Batch 1'] },
    ],
  });
}

function handleLogin(payload) {
  var email = payload.email || '';
  return createCorsResponse({
    success: true,
    status: 'success',
    user: {
      id: 'USR-' + (email.split('@')[0] || 'admin'),
      name: email ? (email.split('@')[0].toUpperCase()) : 'System User',
      email: email,
      role: email.indexOf('admin') !== -1 ? 'admin' : 'mobiliser',
    },
  });
}

/**
 * Utilities
 */
function normalizeHeaderKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getValueForCandidateHeader(headerName, payload, timestamp) {
  var key = normalizeHeaderKey(headerName);

  // 1. Candidate ID
  if (key === 'candidateid' || key === 'id' || key === 'candid' || key === 'candcode') {
    return payload.candidateId || payload.id || '';
  }

  // 2. Full Name / Name
  if (key === 'fullname' || key === 'name' || key === 'candidatename' || key === 'studentname') {
    return payload.name || '';
  }

  // 3. Date of Birth / DOB
  if (key === 'dateofbirth' || key === 'dob' || key === 'birthdate' || key === 'dobirth') {
    return payload.dob || '';
  }

  // 4. Age
  if (key === 'age') {
    return (payload.age !== undefined && payload.age !== null) ? payload.age : '';
  }

  // 5. Gender / Sex
  if (key === 'gender' || key === 'sex') {
    return payload.gender || '';
  }

  // 6. Father's Name
  if (key === 'fathersname' || key === 'fathername' || key === 'father') {
    return payload.fatherName || '';
  }

  // 7. Mother's Name
  if (key === 'mothersname' || key === 'mothername' || key === 'mother') {
    return payload.motherName || '';
  }

  // 8. Primary Phone
  if (key === 'primaryphone' || key === 'phone' || key === 'phonenumber' || key === 'mobile' || key === 'mobilenumber' || key === 'contactnumber' || key === 'candidatephone') {
    return payload.phone || '';
  }

  // 9. Alternate / Parent Phone
  if (key === 'alternateparentphone' || key === 'alternateorparentphone') {
    return payload.alternatePhone || payload.parentPhone || '';
  }
  if (key === 'alternatephone' || key === 'secondaryphone') {
    return payload.alternatePhone || '';
  }
  if (key === 'parentphone' || key === 'guardianphone') {
    return payload.parentPhone || '';
  }

  // 10. Geography / Address
  if (key === 'state' || key === 'statename') {
    return payload.state || '';
  }
  if (key === 'district' || key === 'districtname') {
    return payload.district || '';
  }
  if (key === 'block' || key === 'blockname') {
    return payload.block || '';
  }
  if (key === 'villagelocality' || key === 'village' || key === 'locality' || key === 'villageorlocality' || key === 'town' || key === 'city') {
    return payload.village || '';
  }
  if (key === 'address' || key === 'fulladdress' || key === 'residentialaddress') {
    return payload.address || '';
  }
  if (key === 'pincode' || key === 'pin' || key === 'pincodeno' || key === 'postalcode' || key === 'zip' || key === 'zipcode') {
    return payload.pincode || '';
  }

  // 11. Qualification & Education
  if (key === 'qualification' || key === 'highestqualification' || key === 'educationqualification' || key === 'education') {
    return payload.qualification || '';
  }
  if (key === 'schoolcollege' || key === 'school' || key === 'college' || key === 'institute' || key === 'schoolcollegename') {
    return payload.schoolCollege || '';
  }
  if (key === 'yearofpassing' || key === 'passingyear' || key === 'passyear') {
    return payload.yearOfPassing || '';
  }
  if (key === 'educationstatus' || key === 'educationqualificationstatus' || key === 'qualificationstatus') {
    return payload.educationStatus || '';
  }

  // 12. Programme, Project, Phase, Cycle, Batch
  if (key === 'programme' || key === 'program' || key === 'programname' || key === 'scheme') {
    return payload.programme || payload.project || payload.projectName || '';
  }
  if (key === 'project' || key === 'projectname' || key === 'projecttitle') {
    return payload.project || payload.projectName || payload.programme || '';
  }
  if (key === 'projectid') {
    return payload.projectId || '';
  }
  if (key === 'phase' || key === 'projectphase') {
    return payload.phase || '';
  }
  if (key === 'cycle' || key === 'projectcycle') {
    return payload.cycle || '';
  }
  if (key === 'batch' || key === 'batchname' || key === 'assignedbatch' || key === 'cohort') {
    return payload.batch || payload.batchName || '';
  }
  if (key === 'batchid') {
    return payload.batchId || '';
  }

  // 13. Lead Source
  if (key === 'leadsource' || key === 'source' || key === 'mobilisationsource') {
    return payload.leadSource || '';
  }
  if (key === 'leadsourcedetails' || key === 'sourcedetails') {
    return payload.leadSourceDetails || '';
  }

  // 14. Mobiliser
  if (key === 'mobilisername' || key === 'assignedmobilisername' || key === 'assignedmobiliser' || key === 'mobiliser') {
    return payload.assignedMobiliserName || payload.mobiliserName || '';
  }
  if (key === 'mobiliserphone' || key === 'assignedmobiliserphone') {
    return payload.assignedMobiliserPhone || payload.mobiliserPhone || '';
  }
  if (key === 'mobiliserstate' || key === 'assignedmobiliserstate') {
    return payload.assignedMobiliserState || payload.mobiliserState || '';
  }
  if (key === 'mobiliserid' || key === 'assignedmobiliserid') {
    return payload.assignedMobiliserId || payload.mobiliserId || '';
  }

  // 15. Eligibility
  if (key === 'eligibilitystatus' || key === 'overalleligibility' || key === 'statuseligibility') {
    return payload.eligibilityStatus || 'Eligible';
  }
  if (key === 'ageeligibility' || key === 'ageeligible') {
    return payload.ageEligibility !== undefined ? (payload.ageEligibility ? 'Yes' : 'No') : '';
  }
  if (key === 'educationeligibility' || key === 'educationeligible') {
    return payload.educationEligibility !== undefined ? (payload.educationEligibility ? 'Yes' : 'No') : '';
  }
  if (key === 'othereligibility' || key === 'othereligible') {
    return payload.otherEligibility !== undefined ? (payload.otherEligibility ? 'Yes' : 'No') : '';
  }
  if (key === 'eligibilityremarks') {
    return payload.eligibilityRemarks || '';
  }

  // 16. Documents
  if (key === 'collecteddocuments') {
    return Array.isArray(payload.collectedDocuments) ? payload.collectedDocuments.join(', ') : (payload.collectedDocuments || '');
  }
  if (key === 'documentscomplete') {
    return (payload.documentsComplete === true || payload.documentsComplete === 'true' || payload.documentsComplete === 'Yes') ? 'Yes' : 'No';
  }
  if (key === 'missingdocuments') {
    return Array.isArray(payload.missingDocuments) ? payload.missingDocuments.join(', ') : (payload.missingDocuments || '');
  }

  // 17. Google Drive Links & Document Storage
  if (key === 'drivedocumentlinks' || key === 'documentdrivelinks' || key === 'drivelinks') {
    return typeof payload.documentDriveLinks === 'object' ? JSON.stringify(payload.documentDriveLinks) : (payload.documentDriveLinks || '{}');
  }
  if (key === 'drivefolderid' || key === 'googledrivefolderid' || key === 'folderid') {
    return payload.googleDriveFolderId || payload.parentFolderId || DEFAULT_PARENT_DRIVE_FOLDER_ID;
  }
  if (key === 'uploadeddocumentsjson' || key === 'uploadeddocuments') {
    return typeof payload.uploadedDocuments === 'object' ? JSON.stringify(payload.uploadedDocuments) : (payload.uploadedDocuments || '[]');
  }

  // 18. Workflow Status & Stage
  if (key === 'stage' || key === 'workflowstage') {
    return payload.stage || 'Pre-Mobilisation';
  }
  if (key === 'currentstatus' || key === 'status' || key === 'candidatestatus') {
    return payload.currentStatus || 'New Lead';
  }

  // 19. Timestamps
  if (key === 'createdat' || key === 'registrationdate' || key === 'createddate' || key === 'submissiondate') {
    return payload.createdAt || timestamp;
  }
  if (key === 'updatedat' || key === 'lastmodified' || key === 'modifiedat') {
    return payload.updatedAt || timestamp;
  }

  // Fallback: search payload properties for a normalized match
  var pKeys = Object.keys(payload);
  for (var i = 0; i < pKeys.length; i++) {
    if (normalizeHeaderKey(pKeys[i]) === key) {
      var val = payload[pKeys[i]];
      if (typeof val === 'object' && val !== null) return JSON.stringify(val);
      return (val !== undefined && val !== null) ? String(val) : '';
    }
  }

  return '';
}

function findColIndex(headers, colNames) {
  if (!Array.isArray(colNames)) {
    colNames = [colNames];
  }
  for (var k = 0; k < colNames.length; k++) {
    var targetKey = normalizeHeaderKey(colNames[k]);
    for (var i = 0; i < headers.length; i++) {
      if (normalizeHeaderKey(headers[i]) === targetKey) {
        return i + 1; // 1-indexed for Sheets
      }
    }
  }
  return -1;
}

function tryParseJson(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}
