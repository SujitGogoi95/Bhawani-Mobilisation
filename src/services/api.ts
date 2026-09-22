/**
 * Google Apps Script Web App API Service Layer
 * Endpoint: https://script.google.com/macros/s/AKfycbyqw63lvpb_5eIfHKvC7lgF0htYZ6w0SzALGnI3ISmLNlOXYTzHaPqdYgwxAxRJlFHNdw/exec
 */

export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyqw63lvpb_5eIfHKvC7lgF0htYZ6w0SzALGnI3ISmLNlOXYTzHaPqdYgwxAxRJlFHNdw/exec';

export const GOOGLE_DRIVE_PARENT_FOLDER_ID = '1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp';

export interface ApiResponse<T = any> {
  status?: string;
  success?: boolean;
  message?: string;
  data?: T;
  raw?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Reusable API function to send requests to Google Apps Script Web App backend.
 * Uses POST requests with JSON payload: { action: string, ...data }
 * 
 * Includes dev proxy fallback and friendly error handling to avoid raw browser CORS / Failed to fetch blocks.
 */
export async function apiRequest<T = any>(
  action: string,
  data: Record<string, any> = {}
): Promise<T> {
  // Read current active user context for backend state security enforcement
  let userRole = 'admin';
  let userState = 'All';
  let userId = '';

  if (typeof window !== 'undefined') {
    try {
      const storedUsersJson = localStorage.getItem('mms_users');
      const storedUserId = localStorage.getItem('mms_current_user_id');
      if (storedUsersJson && storedUserId) {
        const users = JSON.parse(storedUsersJson);
        const active = users.find((u: any) => u.id === storedUserId);
        if (active) {
          userRole = active.role || 'mobiliser';
          userState = active.state || 'Nagaland';
          userId = active.id;
        }
      }
    } catch {
      // ignore
    }
  }

  const isRestrictedUser = userRole !== 'admin' && userState && userState.toLowerCase() !== 'all';

  const payload: Record<string, any> = {
    action,
    userRole,
    userState,
    userId,
    ...data,
  };

  // Enforce state parameter for non-admin queries
  if (isRestrictedUser) {
    payload.state = userState;
  }

  const sanitizeResponse = (result: any): any => {
    if (!isRestrictedUser || !result) return result;
    const targetStateLower = userState.toLowerCase();
    const filterListByState = (items: any[]) => {
      return items.filter((item) => {
        if (!item || typeof item !== 'object') return true;
        const candState = (item.state || item.State || item['State Name'] || '').trim().toLowerCase();
        return !candState || candState === targetStateLower;
      });
    };

    if (Array.isArray(result)) return filterListByState(result);
    if (Array.isArray(result.candidates)) result.candidates = filterListByState(result.candidates);
    if (Array.isArray(result.data)) result.data = filterListByState(result.data);
    if (result.data && Array.isArray(result.data.candidates)) {
      result.data.candidates = filterListByState(result.data.candidates);
    }
    if (Array.isArray(result.rows)) result.rows = filterListByState(result.rows);
    return result;
  };

  // 1. In browser environments, try local proxy route first to avoid browser CORS blocks
  // caused when Google Apps Script returns an error page before setting CORS headers.
  if (typeof window !== 'undefined') {
    try {
      const proxyRes = await fetch('/api/apps-script-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: APPS_SCRIPT_URL,
          userRole,
          userState,
          payload,
        }),
      });
      if (proxyRes.ok) {
        const proxyJson = await proxyRes.json();
        return sanitizeResponse(proxyJson) as T;
      }
    } catch {
      // If dev proxy is unavailable, fall through to direct fetch
    }
  }

  // 2. Direct fetch to Google Apps Script Web App
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    try {
      const parsed = JSON.parse(responseText);
      return sanitizeResponse(parsed) as T;
    } catch {
      let cleanMessage = responseText;
      if (responseText.includes('doPost') || responseText.includes('找不到以下指令碼函式')) {
        cleanMessage =
          'Google Apps Script responded: "Script function not found: doPost". In your Apps Script editor, declare "function doPost(e) { ... }" and deploy a new version (Deploy > Manage deployments > Edit > New version).';
      }
      return {
        status: response.ok ? 'received' : 'error',
        message: cleanMessage,
        raw: responseText,
      } as unknown as T;
    }
  } catch (err: any) {
    // If direct POST fails (e.g. browser CORS block because doPost is missing),
    // perform a diagnostic GET check to verify if the Web App URL is alive:
    try {
      const getCheck = await fetch(`${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`, {
        method: 'GET',
      });
      if (getCheck.ok) {
        const getText = await getCheck.text();
        return {
          status: 'error',
          success: false,
          endpointReachable: true,
          message: `Apps Script endpoint is active and reachable via GET ("${getText.trim()}"), but POST requests failed because the "doPost(e)" handler is missing or not deployed. Please define function doPost(e) in your script and publish a new version.`,
          diagnostic: 'GET is working, doPost(e) is needed for POST requests',
        } as unknown as T;
      }
    } catch {
      // Diagnostic check also failed
    }

    return {
      status: 'error',
      success: false,
      message: err?.message || `Failed to communicate with Apps Script Web App for action "${action}".`,
      hint: 'Ensure your Google Apps Script Web App is deployed with "Execute as: Me" and "Who has access: Anyone".',
    } as unknown as T;
  }
}

/**
 * Type-safe API action wrappers for Google Apps Script Web App endpoints
 */
export const appsScriptApi = {
  /**
   * Test endpoint connectivity with { action: 'test' }
   */
  testConnection: async () => {
    return apiRequest('test');
  },

  /**
   * 1. login
   */
  login: async (credentials: { email?: string; password?: string; [key: string]: any }) => {
    return apiRequest('login', credentials);
  },

  /**
   * 2. getCandidates
   */
  getCandidates: async (filters: Record<string, any> = {}) => {
    return apiRequest('getCandidates', filters);
  },

  /**
   * 3. addCandidate
   */
  addCandidate: async (candidateData: Record<string, any>) => {
    return apiRequest('addCandidate', candidateData);
  },

  /**
   * 4. updateCandidate
   */
  updateCandidate: async (candidateData: Record<string, any>) => {
    return apiRequest('updateCandidate', candidateData);
  },

  /**
   * 4b. deleteCandidate
   */
  deleteCandidate: async (data: { candidateId: string; [key: string]: any }) => {
    return apiRequest('deleteCandidate', data);
  },

  /**
   * 5. getDashboard
   */
  getDashboard: async (params: Record<string, any> = {}) => {
    return apiRequest('getDashboard', params);
  },

  /**
   * 6. addActivity
   */
  addActivity: async (activityData: Record<string, any>) => {
    return apiRequest('addActivity', activityData);
  },

  /**
   * 6b. uploadActivityPhoto
   * Uploads an activity photo to Google Drive and records metadata in Google Sheets
   */
  uploadActivityPhoto: async (photoData: {
    activityId: string;
    photoName: string;
    photoBase64: string;
    mimeType?: string;
  }) => {
    return apiRequest('uploadActivityPhoto', photoData);
  },

  /**
   * 6c. getActivityPhotos
   */
  getActivityPhotos: async (activityId: string) => {
    return apiRequest('getActivityPhotos', { activityId });
  },

  /**
   * 7. addCallLog
   */
  addCallLog: async (callLogData: Record<string, any>) => {
    return apiRequest('addCallLog', callLogData);
  },

  /**
   * 8. addFollowUp
   */
  addFollowUp: async (followUpData: Record<string, any>) => {
    return apiRequest('addFollowUp', followUpData);
  },

  /**
   * 9. getFollowUps
   */
  getFollowUps: async (params: Record<string, any> = {}) => {
    return apiRequest('getFollowUps', params);
  },

  /**
   * 10. getActivities
   */
  getActivities: async (params: Record<string, any> = {}) => {
    return apiRequest('getActivities', params);
  },

  /**
   * 11. getCallLogs
   */
  getCallLogs: async (params: Record<string, any> = {}) => {
    return apiRequest('getCallLogs', params);
  },

  /**
   * 12. getDocuments
   */
  getDocuments: async (params: Record<string, any> = {}) => {
    return apiRequest('getDocuments', params);
  },

  /**
   * 13. updateDocument
   */
  updateDocument: async (documentData: Record<string, any>) => {
    return apiRequest('updateDocument', documentData);
  },

  /**
   * 14. getTargets
   */
  getTargets: async (params: Record<string, any> = {}) => {
    return apiRequest('getTargets', params);
  },

  /**
   * 15. getProjects - Fetches project / programme master data from Google Sheets Projects tab
   */
  getProjects: async () => {
    return apiRequest('getProjects');
  },

  /**
   * 16. uploadDocument / uploadCandidateDocument
   * Uploads a candidate KYC document (PDF, JPG, PNG) to restricted Google Drive folder:
   * Parent Folder ID: 1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp
   * Files remain private/restricted (no ANYONE_WITH_LINK).
   */
  uploadDocument: async (docData: {
    candidateId: string;
    candidateName: string;
    documentType: string;
    fileName: string;
    mimeType?: string;
    base64Content: string;
    parentFolderId?: string;
    uploadedBy?: string;
  }) => {
    return apiRequest('uploadDocument', {
      ...docData,
      parentFolderId: docData.parentFolderId || GOOGLE_DRIVE_PARENT_FOLDER_ID,
    });
  },

  uploadCandidateDocument: async (docData: {
    candidateId: string;
    candidateName: string;
    documentType: string;
    fileName: string;
    mimeType?: string;
    base64Content: string;
    parentFolderId?: string;
    uploadedBy?: string;
  }) => {
    return apiRequest('uploadDocument', {
      ...docData,
      parentFolderId: docData.parentFolderId || GOOGLE_DRIVE_PARENT_FOLDER_ID,
    });
  },
};
