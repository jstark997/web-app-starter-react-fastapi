import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  hideOnMobile?: boolean;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: (item: T) => string;
}

function SortIndicator({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <span aria-hidden="true" className="ml-1">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
}

export function Table<T,>({
  columns,
  data,
  sortBy,
  sortOrder = 'asc',
  onSort,
  isLoading = false,
  emptyMessage = 'No results found.',
  rowKey,
}: TableProps<T>) {
  const skeletonRows = 5;

  function handleHeaderClick(column: TableColumn<T>) {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => {
              const cellClass = column.hideOnMobile ? 'hidden md:table-cell' : '';
              const isSorted = sortBy === column.key;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${cellClass} ${
                    column.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''
                  }`}
                  onClick={() => handleHeaderClick(column)}
                  aria-sort={
                    isSorted
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {column.header}
                  {isSorted && <SortIndicator direction={sortOrder} />}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {columns.map((column) => {
                  const cellClass = column.hideOnMobile ? 'hidden md:table-cell' : '';
                  return (
                    <td key={column.key} className={`px-4 py-3 ${cellClass}`}>
                      <Skeleton variant="text" height="1.25rem" />
                    </td>
                  );
                })}
              </tr>
            ))}
          {!isLoading && data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {!isLoading &&
            data.map((item) => (
              <tr key={rowKey(item)} className="hover:bg-gray-50">
                {columns.map((column) => {
                  const cellClass = column.hideOnMobile ? 'hidden md:table-cell' : '';
                  return (
                    <td key={column.key} className={`px-4 py-3 text-sm text-gray-900 ${cellClass}`}>
                      {column.render(item)}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export type { TableProps, TableColumn };
