import type { ReactElement } from "react";

interface ReservationCardProps {
  value: number;
  selected: boolean;
  onSelect: (value: number) => void;
}

/** Renders one touch-sized, code-native reservation card. */
export function ReservationCard({
  value,
  selected,
  onSelect,
}: ReservationCardProps): ReactElement {
  return (
    <button
      aria-pressed={selected}
      className={`reservation-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(value)}
      type="button"
    >
      <span className="sr-only">予約札 </span>
      {value}
    </button>
  );
}

