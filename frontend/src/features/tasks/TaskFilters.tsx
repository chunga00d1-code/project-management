import { Overlay } from "../../components/overlay/Overlay";
import { useIsMobileLayout } from "../../hooks/useMediaQuery";

export type TaskQuery = { q: string; priority: string; project: string };
export const emptyTaskQuery: TaskQuery = { q: "", priority: "", project: "" };

type Props = { value: TaskQuery; onChange: (query: TaskQuery) => void; mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void };

export function TaskFilters({ value, onChange, mobileOpen, onMobileOpenChange }: Props) {
  const mobile = useIsMobileLayout();
  const activeCount = Object.values(value).filter(Boolean).length;
  const controls = <div className="filter-bar">
    <label className="search-field"><span>Tìm kiếm</span><input placeholder="Tên hoặc mô tả nhiệm vụ…" value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} /></label>
    <label><span>Ưu tiên</span><select value={value.priority} onChange={(e) => onChange({ ...value, priority: e.target.value })}><option value="">Tất cả mức độ</option>{["low", "medium", "high", "urgent"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
    <label><span>Dự án</span><input placeholder="Tất cả dự án" value={value.project} onChange={(e) => onChange({ ...value, project: e.target.value })} /></label>
    <button type="button" className="btn-secondary clear-filter" disabled={!activeCount} onClick={() => onChange(emptyTaskQuery)}>Xóa lọc</button>
  </div>;
  if (!mobile) return controls;
  return <>
    <button type="button" className="btn-secondary filter-trigger" onClick={() => onMobileOpenChange(true)}>Bộ lọc{activeCount ? ` (${activeCount})` : ""}</button>
    <Overlay open={mobileOpen} title="Bộ lọc" onClose={() => onMobileOpenChange(false)} footer={<button type="button" className="btn-primary" onClick={() => onMobileOpenChange(false)}>Áp dụng</button>}>{controls}</Overlay>
  </>;
}
