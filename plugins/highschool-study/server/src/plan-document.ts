import { StudyError } from './errors';

export const PLAN_REQUIRED_SECTIONS = [
  'Goal',
  'Observable Capability Standard',
  'Test',
  'Planning Basis',
  'Lesson Index',
  'Current Position',
  'Next Lesson Candidate',
  'Plan Summary',
] as const;

type Heading = {
  level: number;
  text: string;
  line: number;
};

function planAnchor(heading: string): string {
  return heading.toLowerCase().replaceAll(' ', '-');
}

function structuralHeadings(body: string): { headings: Heading[]; lines: string[] } {
  const lines = body.split(/\r?\n/);
  const headings: Heading[] = [];
  let fence: { marker: '`' | '~'; length: number } | null = null;

  for (let line = 0; line < lines.length; line += 1) {
    const value = lines[line] ?? '';
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(value);
    if (fence !== null) {
      if (
        fenceMatch?.[1]?.startsWith(fence.marker)
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(fenceMatch[2] ?? '')
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = {
        marker: fenceMatch[1][0] as '`' | '~',
        length: fenceMatch[1].length,
      };
      continue;
    }
    const atx = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(value);
    if (!atx?.[1] || !atx[2]) continue;
    headings.push({
      level: atx[1].length,
      text: atx[2].replace(/[ \t]+#+[ \t]*$/, '').trim(),
      line,
    });
  }
  return { headings, lines };
}

export function validatePlanDocument(
  path: string,
  frontmatter: Record<string, unknown>,
  body: string,
): void {
  if (frontmatter.kind !== 'plan') {
    throw new StudyError('INVALID_PLAN_KIND', path);
  }
  if (!['ready', 'active', 'completed'].includes(String(frontmatter.status ?? ''))) {
    throw new StudyError('INVALID_PLAN_STATUS', path);
  }
  if (
    Object.hasOwn(frontmatter, 'coach_session')
    && frontmatter.coach_session !== null
    && typeof frontmatter.coach_session !== 'string'
  ) {
    throw new StudyError('INVALID_PLAN_COACH_SESSION', path);
  }

  const { headings, lines } = structuralHeadings(body);
  const titles = headings.filter((heading) => heading.level === 1);
  if (titles.length === 0 || titles[0]!.text === '') {
    throw new StudyError('PLAN_TITLE_REQUIRED', path);
  }
  if (titles.length > 1) {
    throw new StudyError('PLAN_TITLE_DUPLICATE', path);
  }

  for (const required of PLAN_REQUIRED_SECTIONS) {
    const matches = headings.filter(
      (heading) => heading.level === 2 && heading.text === required,
    );
    const detail = `${path}#${planAnchor(required)}`;
    if (matches.length > 1) {
      throw new StudyError('PLAN_SECTION_DUPLICATE', detail);
    }
    const match = matches[0];
    if (!match) throw new StudyError('PLAN_SECTION_REQUIRED', detail);
    const nextBoundary = headings.find(
      (heading) => heading.line > match.line && heading.level <= 2,
    );
    const bodyEnd = nextBoundary?.line ?? lines.length;
    if (lines.slice(match.line + 1, bodyEnd).join('\n').trim() === '') {
      throw new StudyError('PLAN_SECTION_REQUIRED', detail);
    }
  }
}
