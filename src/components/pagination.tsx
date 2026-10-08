"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PAGE_SIZES = [10, 25, 50, 100];

/** Paginação no cliente para listas já carregadas. */
export function usePagination<T>(items: T[], initialSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Se a lista encolher (filtro, exclusão), não deixa a página atual fora do intervalo.
  const current = Math.min(page, pageCount);
  return {
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    pagination: {
      page: current,
      pageSize,
      total: items.length,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {first}–{last} de {total}
      </span>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="hidden tabular-nums sm:inline">
          Página {page} de {pageCount}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-10 md:size-8" aria-label="Primeira página" disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-10 md:size-8" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-10 md:size-8" aria-label="Próxima página" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" className="size-10 md:size-8" aria-label="Última página" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
