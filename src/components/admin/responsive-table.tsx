"use client";

import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Hide on mobile card secondary line */
  hideOnMobile?: boolean;
  /** Primary field shown bold on mobile card */
  mobilePrimary?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  actions?: (row: T) => ReactNode;
  actionsHeader?: string;
  onRowClick?: (row: T) => void;
  maxHeight?: string | false;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found.",
  loading,
  actions,
  actionsHeader = "Actions",
  onRowClick,
  maxHeight = "max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[280px]",
}: ResponsiveTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
        {emptyMessage}
      </div>
    );
  }

  const primaryCol = columns.find((c) => c.mobilePrimary) ?? columns[0];

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 md:flex md:flex-col">
        <div
          className={cn(
            "overflow-x-auto overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400",
            maxHeight !== false && maxHeight
          )}
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs text-gray-700 shadow-2xs dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50/95 dark:bg-gray-800/95 dark:text-gray-200",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                {actions && (
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-gray-50/95 dark:bg-gray-800/95 dark:text-gray-200">
                    {actionsHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    "transition-colors hover:bg-gray-50/80 dark:border-gray-700 dark:hover:bg-gray-800/50",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Record count footer & scroll tip */}
        <div className="flex items-center justify-between border-t border-gray-200/80 bg-gray-50/90 px-4 py-2 text-[11px] text-gray-500 font-medium shrink-0 dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-400">
          <span>Showing <strong>{data.length}</strong> record(s)</span>
          <span className="text-gray-400">Scroll inside table to view all items</span>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              {primaryCol.cell(row)}
            </div>
            <dl className="space-y-1.5 text-sm">
              {columns
                .filter((c) => c.key !== primaryCol.key && !c.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">{col.header}</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                      {col.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
            {actions && (
              <div
                className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
