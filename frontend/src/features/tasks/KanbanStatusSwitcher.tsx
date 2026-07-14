import { useRef } from "react";

export type KanbanStatus = { id: string; label: string; count: number };
export type KanbanStatusSwitcherProps = {
  statuses: KanbanStatus[];
  activeStatus: string;
  onChange: (status: string) => void;
  compact: boolean;
};

export function KanbanStatusSwitcher({ statuses, activeStatus, onChange, compact }: KanbanStatusSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (compact) {
    return (
      <label className="kanban-status-select">
        <span>Trạng thái</span>
        <select value={activeStatus} onChange={(event) => onChange(event.target.value)}>
          {statuses.map((status) => <option key={status.id} value={status.id}>{status.label} ({status.count})</option>)}
        </select>
      </label>
    );
  }

  const moveTo = (index: number) => {
    const next = statuses[index];
    if (!next) return;
    onChange(next.id);
    const tab = tabRefs.current[index];
    tab?.focus();
    requestAnimationFrame(() => tab?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" }));
  };

  return (
    <div className="kanban-status-tabs" role="tablist" aria-label="Trạng thái nhiệm vụ">
      {statuses.map((status, index) => (
        <button
          key={status.id}
          ref={(node) => { tabRefs.current[index] = node; }}
          type="button"
          role="tab"
          id={`kanban-tab-${status.id}`}
          aria-controls={`kanban-panel-${status.id}`}
          aria-selected={activeStatus === status.id}
          tabIndex={activeStatus === status.id ? 0 : -1}
          onClick={() => onChange(status.id)}
          onKeyDown={(event) => {
            let nextIndex: number | undefined;
            if (event.key === "ArrowRight") nextIndex = (index + 1) % statuses.length;
            if (event.key === "ArrowLeft") nextIndex = (index - 1 + statuses.length) % statuses.length;
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = statuses.length - 1;
            if (nextIndex !== undefined) {
              event.preventDefault();
              moveTo(nextIndex);
            }
          }}
        >
          <span>{status.label}</span><span className="counter">{status.count}</span>
        </button>
      ))}
    </div>
  );
}
