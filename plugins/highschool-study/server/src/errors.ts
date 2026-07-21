export type StudyErrorCode = 'OUTSIDE_LEARNING_SET' | 'INVALID_DOCUMENT_ID';

export class StudyError extends Error {
  readonly code: StudyErrorCode;

  constructor(code: StudyErrorCode) {
    super(code);
    this.name = 'StudyError';
    this.code = code;
  }
}

export function isStudyError(error: unknown): error is StudyError {
  return error instanceof StudyError;
}
