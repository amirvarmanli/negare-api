const RESERVED_WINDOWS_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'application/json': 'json',
  'application/octet-stream': 'bin',
};

function isReservedWindowsFilename(name: string): boolean {
  return RESERVED_WINDOWS_NAMES.has(name.toUpperCase());
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function sanitizeFilename(value: string): string {
  if (!value) return 'download';
  let sanitized = value
    .replace(/[\r\n\t]/gu, ' ')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, '_')
    .replace(/[\u007F]/gu, '_');

  sanitized = normalizeWhitespace(sanitized);
  sanitized = sanitized.replace(/[.\s]+$/gu, '');
  sanitized = sanitized.replace(/^[.\s]+/gu, '');

  sanitized = sanitized.replace(/[^\x20-\x7E]/gu, '_');

  if (!sanitized) return 'download';

  const lastDot = sanitized.lastIndexOf('.');
  const base = lastDot > 0 ? sanitized.slice(0, lastDot) : sanitized;
  if (isReservedWindowsFilename(base)) {
    sanitized = `_${sanitized}`;
  }

  return sanitized || 'download';
}

export function inferExtensionFromMime(mimeType?: string | null): string | null {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase().trim();
  if (MIME_EXTENSION_MAP[normalized]) return MIME_EXTENSION_MAP[normalized];

  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) return null;
  const subtype = normalized.slice(slashIndex + 1).split(';')[0]?.trim();
  if (!subtype) return null;
  const cleaned = subtype.replace(/[^a-z0-9.+-]/g, '');
  return cleaned || null;
}

export function resolveDownloadFilename(params: {
  originalName?: string | null;
  fileId: string;
  mimeType?: string | null;
}): string {
  const rawName = params.originalName?.trim() || '';
  const extension = inferExtensionFromMime(params.mimeType) ?? 'bin';

  if (rawName) {
    const sanitized = sanitizeFilename(rawName);
    if (!sanitized) {
      return `${params.fileId}.${extension}`;
    }

    const hasExtension = sanitized.includes('.') && !sanitized.endsWith('.');
    if (!hasExtension && extension) {
      return `${sanitized}.${extension}`;
    }

    return sanitized;
  }

  return `${params.fileId}.${extension}`;
}

export function buildContentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}
