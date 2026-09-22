/**
 * Utility functions for offline-first activity photo handling
 */

export interface ProcessedPhoto {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
}

/**
 * Resizes and compresses an image file to a lightweight data URL
 * Suitable for local storage persistence and low-bandwidth mobile syncing
 */
export async function processPhotoFile(file: File): Promise<ProcessedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const originalDataUrl = event.target?.result as string;
      const img = new Image();

      img.onload = () => {
        // Max dimension for mobile field photos (balances visual fidelity with storage footprint)
        const maxDimension = 1200;
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Draw smooth image
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG at 0.75 quality (typical size ~60KB-180KB)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name || `activity_photo_${Date.now()}.jpg`,
              dataUrl: compressedDataUrl,
              size: Math.round(compressedDataUrl.length * 0.75),
            });
          } else {
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              dataUrl: originalDataUrl,
              size: file.size,
            });
          }
        } catch {
          resolve({
            id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            dataUrl: originalDataUrl,
            size: file.size,
          });
        }
      };

      img.onerror = () => {
        resolve({
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          dataUrl: originalDataUrl,
          size: file.size,
        });
      };

      img.src = originalDataUrl;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes into human readable KB or MB
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}
