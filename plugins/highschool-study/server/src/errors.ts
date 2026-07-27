export type StudyErrorCode =
  | 'OUTSIDE_LEARNING_SET'
  | 'INVALID_DOCUMENT_ID'
  | 'INVALID_PLAN_KIND'
  | 'INVALID_PLAN_STATUS'
  | 'INVALID_PLAN_COACH_SESSION'
  | 'PLAN_TITLE_REQUIRED'
  | 'PLAN_TITLE_DUPLICATE'
  | 'PLAN_SECTION_REQUIRED'
  | 'PLAN_SECTION_DUPLICATE';

export class StudyError extends Error {
  readonly code: StudyErrorCode;

  constructor(code: StudyErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'StudyError';
    this.code = code;
  }
}

export function isStudyError(error: unknown): error is StudyError {
  return error instanceof StudyError;
}
