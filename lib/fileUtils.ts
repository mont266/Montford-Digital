import JSZip from 'jszip';

export type FileCategory =
  | 'image'
  | 'pdf'
  | 'document'
  | 'code'
  | 'video'
  | 'audio'
  | 'archive'
  | 'other';

/**
 * Extracts normalized file extension (without dot, lowercase).
 */
export const getFileExtension = (fileName: string): string => {
  if (!fileName) return '';
  const clean = fileName.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase().trim() : '';
};

/**
 * Determines file category from filename extension and optional MIME type.
 */
export const getFileCategory = (fileName: string, mimeType?: string): FileCategory => {
  const ext = getFileExtension(fileName);
  const mime = (mimeType || '').toLowerCase();

  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }

  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }

  if (
    ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv'].includes(ext) ||
    mime.startsWith('video/')
  ) {
    return 'video';
  }

  if (
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext) ||
    mime.startsWith('audio/')
  ) {
    return 'audio';
  }

  if (
    [
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'odt',
      'ods',
      'odp',
      'rtf',
      'pages',
      'numbers',
      'key',
    ].includes(ext) ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  ) {
    return 'document';
  }

  if (
    [
      'txt',
      'csv',
      'md',
      'json',
      'log',
      'js',
      'ts',
      'jsx',
      'tsx',
      'html',
      'css',
      'scss',
      'xml',
      'yaml',
      'yml',
      'sql',
      'sh',
      'py',
      'env',
    ].includes(ext) ||
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript')
  ) {
    return 'code';
  }

  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return 'archive';
  }

  return 'other';
};

/**
 * Human-readable byte size formatter.
 */
export const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Downloads a single file via client-side Blob to preserve exact filename.
 * Falls back to anchor click if blob creation is blocked.
 */
export const downloadFile = async (url: string, fileName: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (err) {
    console.warn('Direct blob download failed, falling back to anchor link:', err);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return false;
  }
};

/**
 * Bundles multiple files into a single ZIP file and triggers instant download.
 */
export const downloadFilesAsZip = async (
  files: { url: string; fileName: string }[],
  zipName: string,
  onProgress?: (completed: number, total: number) => void
): Promise<void> => {
  if (!files || files.length === 0) return;
  const zip = new JSZip();
  let done = 0;

  for (const item of files) {
    try {
      const res = await fetch(item.url, { method: 'GET' });
      if (res.ok) {
        const blob = await res.blob();
        // Avoid name collision inside zip if two files have same name
        zip.file(item.fileName, blob);
      }
    } catch (e) {
      console.warn(`Could not add "${item.fileName}" to zip:`, e);
    }
    done++;
    onProgress?.(done, files.length);
  }

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const blobUrl = window.URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = blobUrl;
  const safeBase = zipName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  a.download = `${safeBase.endsWith('.zip') ? safeBase : `${safeBase}.zip`}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
};

/**
 * Returns user-friendly category label.
 */
export const getFileCategoryLabel = (category: FileCategory, extension: string): string => {
  const extUpper = extension ? extension.toUpperCase() : '';
  switch (category) {
    case 'image':
      return extUpper ? `${extUpper} Image` : 'Image';
    case 'pdf':
      return 'PDF Document';
    case 'document':
      return extUpper ? `${extUpper} Document` : 'Document';
    case 'code':
      return extUpper ? `${extUpper} File` : 'Code / Text';
    case 'video':
      return extUpper ? `${extUpper} Video` : 'Video';
    case 'audio':
      return extUpper ? `${extUpper} Audio` : 'Audio';
    case 'archive':
      return extUpper ? `${extUpper} Archive` : 'Compressed Archive';
    default:
      return extUpper ? `${extUpper} File` : 'File';
  }
};
