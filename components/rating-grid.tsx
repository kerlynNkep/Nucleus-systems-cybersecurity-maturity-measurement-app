"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import { saveRating } from "@/lib/actions/rating";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RatingRow = {
  cycleControlId: string;
  code: string;
  name: string;
  category: string;
  inScope: boolean;
  maturityLevel: number | null;
  targetLevel: number | null;
  gap: number | null;
  levelDescription: string | null;
  recommendationText: string | null;
};

function statusBadge(row: RatingRow) {
  if (!row.inScope) return <Badge variant="outline">Not applicable</Badge>;
  if (row.maturityLevel == null) return <Badge variant="secondary">Not rated</Badge>;
  if (row.maturityLevel === 1) return <Badge variant="destructive">Critical</Badge>;
  if (row.maturityLevel === 2) return <Badge className="bg-orange-500 text-white">Developing</Badge>;
  if (row.maturityLevel === 3) return <Badge className="bg-yellow-500 text-white">Defined</Badge>;
  return <Badge className="bg-green-600 text-white">Managed</Badge>;
}

export function RatingGrid({ scaleLevels, rows }: { scaleLevels: number[]; rows: RatingRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ratedBy, setRatedBy] = useState("Assessor");

  function update(cycleControlId: string, maturityLevel: number | null, targetLevel: number | null) {
    startTransition(async () => {
      await saveRating({ cycleControlId, maturityLevel, targetLevel, ratedBy });
      router.refresh();
    });
  }

  const columns: ColumnDef<RatingRow>[] = [
    { accessorKey: "code", header: "Code", cell: (info) => <span className="font-mono text-xs">{info.getValue<string>()}</span> },
    { accessorKey: "name", header: "Control" },
    { accessorKey: "category", header: "Category" },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => statusBadge(row.original),
    },
    {
      id: "maturityLevel",
      header: "Rating",
      cell: ({ row }) => (
        <LevelSelect
          disabled={!row.original.inScope || isPending}
          value={row.original.maturityLevel}
          levels={scaleLevels}
          onChange={(v) => update(row.original.cycleControlId, v, row.original.targetLevel)}
        />
      ),
    },
    {
      id: "targetLevel",
      header: "Target",
      cell: ({ row }) => (
        <LevelSelect
          disabled={!row.original.inScope || isPending}
          value={row.original.targetLevel}
          levels={scaleLevels}
          onChange={(v) => update(row.original.cycleControlId, row.original.maturityLevel, v)}
        />
      ),
    },
    {
      accessorKey: "gap",
      header: "Gap",
      cell: (info) => info.getValue<number | null>() ?? "—",
    },
    {
      id: "recommendation",
      header: "Recommendation",
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground" title={row.original.recommendationText ?? ""}>
          {row.original.recommendationText ?? "—"}
        </span>
      ),
    },
  ];

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="ratedBy" className="text-muted-foreground">
          Rated by:
        </label>
        <input
          id="ratedBy"
          value={ratedBy}
          onChange={(e) => setRatedBy(e.target.value)}
          className="rounded-md border px-2 py-1 text-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LevelSelect({
  value,
  levels,
  disabled,
  onChange,
}: {
  value: number | null;
  levels: number[];
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <Select disabled={disabled} value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 w-20">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {levels.map((l) => (
          <SelectItem key={l} value={String(l)}>
            L{l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
