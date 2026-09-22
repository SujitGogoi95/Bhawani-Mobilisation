/**
 * Utility functions for candidate KYC document uploads & Google Drive integration
 */

export interface StagedDocumentFile {
  documentType: string;
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Content: string;
  previewUrl?: string;
}

/**
 * Reads a browser File object as a base64 Data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes into human readable KB / MB
 */
export function formatDocumentSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Validates document file type & size
 * Google Apps Script POST payloads work best under 15MB
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format (.${ext}). Allowed: PDF, JPG, JPEG, PNG, WEBP`,
    };
  }

  // 15MB limit
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds 15MB limit (${formatDocumentSize(file.size)}). Please compress or choose a smaller file.`,
    };
  }

  return { valid: true };
}
