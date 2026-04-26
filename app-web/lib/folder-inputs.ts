export interface FolderInputStorageRow {
  id?: string | null;
  folder_id?: string | null;
  storage_path?: string | null;
}

export interface FolderInputUploadPayload {
  storagePath?: string;
}

export function dedupeFolderInputsByStoragePath<T extends FolderInputStorageRow>(
  rows: T[] | null | undefined
): T[] {
  const seen = new Set<string>();

  return (rows ?? []).filter((row) => {
    const storagePath = row.storage_path?.trim();
    if (!storagePath) return true;

    const key = `${row.folder_id ?? ''}:${storagePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeUploadsByStoragePath<T extends FolderInputUploadPayload>(
  uploads: T[] | null | undefined
): T[] {
  const seen = new Set<string>();

  return (uploads ?? []).filter((upload) => {
    const storagePath = upload.storagePath?.trim();
    if (!storagePath) return true;

    if (seen.has(storagePath)) return false;
    seen.add(storagePath);
    return true;
  });
}
