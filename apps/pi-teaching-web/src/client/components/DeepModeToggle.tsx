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
      {enabled ? '已允许深入查找' : '允许深入查找'}
    </button>
  );
}
