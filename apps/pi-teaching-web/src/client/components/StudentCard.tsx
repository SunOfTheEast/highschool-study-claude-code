import type { StudentProblemCard } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function StudentCard({ alias, card }: { alias: string; card: StudentProblemCard }) {
  return (
    <article className="problem-card">
      <p>{alias}</p>
      <MarkdownView>{card.stem}</MarkdownView>
      {card.choices.length > 0 && (
        <ol>
          {card.choices.map((choice) => (
            <li key={choice.label}>
              <b>{choice.label}.</b> <MarkdownView>{choice.text}</MarkdownView>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
