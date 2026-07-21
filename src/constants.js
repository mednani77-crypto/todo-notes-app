export const APP_VERSION = '3.0.0';
export const SCHEMA_VERSION = 3;

export const STORAGE_KEYS = {
  notes: 'todo-notes-app:v1',
  schema: 'todo-notes-app:schema-version',
  folders: 'todo-notes-app:folders:v1',
  settings: 'todo-notes-app:settings:v1',
  legacyBackup: 'todo-notes-app:backup:pre-v3',
  recovery: 'todo-notes-app:recovery:v1',
  importBackup: 'todo-notes-app:backup:before-import',
  recentSearches: 'todo-notes-app:recent-searches:v1',
};

export const NOTE_COLORS = [
  { id: 'sand', label: 'رملي' },
  { id: 'rose', label: 'وردي' },
  { id: 'sage', label: 'أخضر هادئ' },
  { id: 'sky', label: 'سماوي' },
  { id: 'lavender', label: 'بنفسجي هادئ' },
  { id: 'plain', label: 'أبيض' },
];

export const DEFAULT_SETTINGS = {
  theme: 'system',
  defaultView: 'grid',
  sort: 'updated',
  fontSize: 'medium',
  editorDirection: 'auto',
  autoSaveDelay: 650,
  confirmPermanentDelete: true,
  includeDatesInPdf: true,
  includeTitleInPdf: true,
  includeAttachmentsInPdf: true,
  pdfPageSize: 'a4',
  pdfOrientation: 'portrait',
};

export const NAV_ITEMS = [
  { id: 'all', label: 'كل الملاحظات' },
  { id: 'pinned', label: 'المثبتة' },
  { id: 'favorites', label: 'المفضلة' },
  { id: 'folders', label: 'المجلدات' },
  { id: 'tags', label: 'الوسوم' },
  { id: 'archive', label: 'الأرشيف' },
  { id: 'trash', label: 'سلة المحذوفات' },
  { id: 'settings', label: 'الإعدادات' },
];

export const AUDIO_LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  maxSeconds: 5 * 60,
};

export const ACCEPTED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
];

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
