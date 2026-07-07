import DocumentsBrowser from '../../components/DocumentsBrowser';

// Employee Documents — a personal "My Documents" folder plus anything shared with
// them. Backed by the folder-based DocumentsBrowser (see that component for the
// full API contract). Uploads are private files the employee owns.
export default function EmployeeDocuments() {
  return (
    <DocumentsBrowser
      eyebrow="My Workspace"
      title="Documents"
      emptyTitle="No folders yet"
      emptySubtitle="Folders shared with you and your personal documents will appear here."
      groupFolders
      ensureMyDocuments
      uploadVisibility="employee"
    />
  );
}
