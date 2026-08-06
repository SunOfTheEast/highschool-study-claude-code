export function ProgressLine({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const percentage = safeMax === 0 ? 0 : (safeValue / safeMax) * 100;

  return (
    <span className="progress-line" aria-label={`${label} ${safeValue}/${safeMax}`}>
      <span className="progress-track" aria-hidden="true">
        <span className="progress-fill" style={{ width: `${percentage}%` }} />
      </span>
      <span className="progress-count">{safeValue} / {safeMax}</span>
    </span>
  );
}

export default ProgressLine;
