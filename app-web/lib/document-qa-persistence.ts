export const QA_PERSISTENCE_UNAVAILABLE_ERROR = 'document_qa_persistence_unavailable';

export const QA_PERSISTENCE_UNAVAILABLE_MESSAGE =
  'Ask Document needs the latest database migration before chat history and section subchats can be saved.';

type ErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function asErrorLike(error: unknown): ErrorLike | null {
  if (!error || typeof error !== 'object') return null;
  return error as ErrorLike;
}

export function isMissingDocumentQaTableError(error: unknown): boolean {
  const err = asErrorLike(error);
  if (!err) return false;

  const text = [
    err.code,
    err.message,
    err.details,
    err.hint,
  ].filter(Boolean).join(' ').toLowerCase();

  const mentionsQaTable =
    text.includes('document_qa_subchats') || text.includes('document_qa_messages');
  const isSchemaCacheMiss =
    text.includes('schema cache') || text.includes('could not find the table');

  return mentionsQaTable && (err.code === 'PGRST205' || isSchemaCacheMiss);
}

export function isQaPersistenceUnavailableError(error: unknown): boolean {
  const err = asErrorLike(error);
  return err?.code === QA_PERSISTENCE_UNAVAILABLE_ERROR
    || err?.message === QA_PERSISTENCE_UNAVAILABLE_MESSAGE
    || isMissingDocumentQaTableError(error);
}

export function createQaPersistenceUnavailableError(): Error & { code: string } {
  const error = new Error(QA_PERSISTENCE_UNAVAILABLE_MESSAGE) as Error & { code: string };
  error.code = QA_PERSISTENCE_UNAVAILABLE_ERROR;
  return error;
}

export function qaPersistenceUnavailablePayload() {
  return {
    error: QA_PERSISTENCE_UNAVAILABLE_ERROR,
    message: QA_PERSISTENCE_UNAVAILABLE_MESSAGE,
  };
}
