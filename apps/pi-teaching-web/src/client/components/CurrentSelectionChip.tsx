export type CurrentSelectionChipProps = {
  label: string;
  onClick(): void;
};

export function CurrentSelectionChip({
  label,
  onClick,
}: CurrentSelectionChipProps) {
  return (
    <button
      className="current-selection-chip"
      type="button"
      onClick={onClick}
      title="回到当前课程位置"
    >
      {label}
    </button>
  );
}

export default CurrentSelectionChip;
