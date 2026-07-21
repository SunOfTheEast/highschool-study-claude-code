export function DeepModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange(enabled: boolean): Promise<void>;
}) {
  return (
    <button
      type="button"
      className="deep-toggle"
      aria-pressed={enabled}
      onClick={() => void onChange(!enabled)}
    >
      <span aria-hidden="true" />
      {enabled ? '深度模式已允许' : '启用深度模式'}
    </button>
  );
}
