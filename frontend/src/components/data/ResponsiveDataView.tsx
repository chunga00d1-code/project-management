import type { ReactNode } from "react";
import { useIsMobileLayout } from "../../hooks/useMediaQuery";

export type DataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  cardPriority?: "primary" | "secondary";
};

export type ResponsiveDataViewProps<T> = {
  rows: T[];
  rowKey: (row: T) => string;
  columns: DataColumn<T>[];
  empty: ReactNode;
  caption: string;
};

export function ResponsiveDataView<T>({ rows, rowKey, columns, empty, caption }: ResponsiveDataViewProps<T>) {
  const isMobile = useIsMobileLayout();

  if (rows.length === 0) return <>{empty}</>;

  if (isMobile) {
    return (
      <div className="data-card-list" aria-label={caption}>
        {rows.map((row) => (
          <article className="data-card" key={rowKey(row)}>
            <dl>
              {columns.map((column) => (
                <div className={`data-card__field${column.cardPriority ? ` data-card__field--${column.cardPriority}` : ""}`} key={column.key}>
                  <dt>{column.header}</dt>
                  <dd>{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
