import DocumentsBrowser from '../../components/DocumentsBrowser';

// Admin / manager document library. Backed by the folder-based DocumentsBrowser
// on the real /documentManagement API (the old flat /documents routes this page
// used to probe don't exist on the backend, so Documents always looked empty).
//
// The backend returns the correct folder set per role — admins/super-admins see
// every folder; managers see the folders they created or were granted — and the
// per-item canEdit/canDelete flags, so this page just renders what it's given.
// Uploads default to folder-wide ('all') visibility rather than a private file.
export default function Documents() {
  return (
    <DocumentsBrowser
      eyebrow="Reporting"
      title="Documents"
      emptyTitle="No folders yet"
      emptySubtitle="Folders you create or are granted access to will appear here."
      groupFolders={false}
      ensureMyDocuments={false}
      uploadVisibility="all"
    />
  );
}
