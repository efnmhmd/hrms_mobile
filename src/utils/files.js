import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// Opening and saving downloaded blobs on device.
//
// The browser idioms this app started with silently do nothing inside a
// Capacitor WebView, which is why View showed a blank page and Download looked
// dead on Android:
//
//   - <iframe src={blobUrl}>: Android's WebView has no PDF renderer at all
//     (unlike iOS/WKWebView, which uses PDFKit), so a PDF blob just paints an
//     empty grey page. Images are fine; everything else is not.
//   - <a download> + link.click(): the `download` attribute is unimplemented in
//     Android's WebView, and blob: URLs never reach a DownloadListener, so the
//     tap is a no-op that raises no error to surface.
//
// So on a device we write the blob to disk and hand the file to the OS: the
// system PDF/Office viewer for View, and the shared Documents folder for
// Download. On the web the original DOM idioms work and are kept.

export const isNativePlatform = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';

// Folder created inside the device's shared Documents directory for saved files.
const SAVE_FOLDER = 'HRMS';
// App-private scratch space for files we only hand to another app to display.
const CACHE_FOLDER = 'hrms-open';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'svg'];

const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]+/g;
const HAS_EXTENSION = /\.[a-z0-9]{1,5}$/i;

function isImage(mime, ext) {
  return String(mime || '').toLowerCase().startsWith('image/')
    || IMAGE_EXTS.includes(String(ext || '').toLowerCase());
}

function isPdf(mime, ext) {
  return String(mime || '').toLowerCase().includes('pdf')
    || String(ext || '').toLowerCase() === 'pdf';
}

/**
 * Can we paint this file ourselves inside the in-app viewer overlay?
 * Anything else has to be handed to the OS (native) or downloaded (web).
 */
export function canPreviewInApp(mime, ext) {
  if (isImage(mime, ext)) return true;
  // Android's WebView cannot render a PDF; every other platform can.
  if (isPdf(mime, ext)) return !isAndroid();
  return false;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the downloaded file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * A filesystem-safe name that keeps a usable extension. Android picks the
 * handler app from the extension as much as from the MIME type, so a bare name
 * like "Contract" opens nothing.
 */
export function safeFileName(name, mime) {
  const base = String(name || '').replace(ILLEGAL_NAME_CHARS, '_').trim() || 'document';
  if (HAS_EXTENSION.test(base)) return base;
  const ext = EXT_BY_MIME[String(mime || '').toLowerCase().split(';')[0].trim()];
  return ext ? `${base}.${ext}` : base;
}

async function writeBlob(blob, path, directory) {
  const data = await blobToBase64(blob);
  await Filesystem.writeFile({ path, data, directory, recursive: true });
  const { uri } = await Filesystem.getUri({ path, directory });
  return uri;
}

/**
 * Hand a blob to the OS viewer (Android: system PDF/Office app; iOS: the
 * document interaction menu). Rejects if the write fails or no installed app
 * handles the type.
 */
export async function openBlobWithOsViewer(blob, name, mime) {
  const fileName = safeFileName(name, mime);
  const uri = await writeBlob(blob, `${CACHE_FOLDER}/${fileName}`, Directory.Cache);
  await FileOpener.open({ filePath: uri, contentType: mime || undefined });
}

/**
 * Save a blob where the user can find it again, and report where it landed.
 *
 * Preferred target is the device's shared Documents folder. That needs storage
 * permission on Android 10 and below (Android 11+ grants it implicitly); if the
 * user declines we still keep the file in app storage rather than failing, and
 * say so.
 *
 * @returns {Promise<{ location: string, shared: boolean }>}
 */
export async function saveBlobToDevice(blob, name, mime) {
  const fileName = safeFileName(name, mime);
  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      const asked = await Filesystem.requestPermissions();
      if (asked.publicStorage !== 'granted') throw new Error('Storage permission denied');
    }
    await writeBlob(blob, `${SAVE_FOLDER}/${fileName}`, Directory.Documents);
    return { location: `Documents/${SAVE_FOLDER}`, shared: true };
  } catch {
    // No permission or no shared storage: fall back to app-private storage so
    // the file still exists rather than the download failing outright.
    await writeBlob(blob, `${SAVE_FOLDER}/${fileName}`, Directory.Data);
    return { location: 'app storage', shared: false };
  }
}
