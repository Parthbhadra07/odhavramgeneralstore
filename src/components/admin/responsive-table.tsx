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
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found.",
  loading,
  actions,
  actionsHeader = "Actions",
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
      <div className="hidden overflow-hidden rounded-xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 dark:bg-gray-800">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200", col.className)}
                  >
                    {col.header}
                  </th>
                ))}
                {actions && (
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">
                    {actionsHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="border-t transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
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
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3 dark:border-gray-700">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
