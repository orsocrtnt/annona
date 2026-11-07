"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PreparationLine } from "@/domains/production/production.types";
import { useReportShortage } from "@/features/production/hooks";
import { fr } from "@/lib/i18n/fr";

const t = fr.production;

/** BOU-06 : quantité réellement livrée d'une ligne, entre 0 et la quantité commandée. */
export function ShortageDialog({ date, line, onClose }: { date: string; line: PreparationLine | null; onClose: () => void }) {
  return (
    <Dialog open={line !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {line ? <ShortageForm key={line.lineId} date={date} line={line} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ShortageForm({ date, line, onClose }: { date: string; line: PreparationLine; onClose: () => void }) {
  const report = useReportShortage(date);
  const [value, setValue] = useState(String(line.quantityDelivered ?? line.quantityOrdered));
  const quantity = Number(value);
  const valid = value !== "" && Number.isInteger(quantity) && quantity >= 0 && quantity <= line.quantityOrdered;

  const save = (quantityDelivered: number) =>
    report.mutate(
      { lineId: line.lineId, quantityDelivered },
      {
        onSuccess: () => {
          toast.success(t.shortageDone);
          onClose();
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.shortageTitle}</DialogTitle>
        <DialogDescription>
          {line.name} · {t.shortageHint(line.quantityOrdered)}
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="lg" className="w-14 px-0 text-2xl" aria-label="−1" onClick={() => setValue(String(Math.max(0, (Number(value) || 0) - 1)))}>
          −
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={line.quantityOrdered}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={t.delivered}
          aria-invalid={!valid}
          className="h-14 flex-1 text-center text-2xl font-semibold tabular-nums"
        />
        <Button type="button" variant="outline" size="lg" className="w-14 px-0 text-2xl" aria-label="+1" onClick={() => setValue(String(Math.min(line.quantityOrdered, (Number(value) || 0) + 1)))}>
          +
        </Button>
      </div>
      <p className="text-center text-sm text-muted-foreground tabular-nums">
        {t.ordered} : {line.quantityOrdered} {line.unit}
      </p>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" size="lg" onClick={() => save(line.quantityOrdered)} disabled={report.isPending}>
          {t.shortageFull}
        </Button>
        <Button type="button" variant="brand" size="lg" onClick={() => save(quantity)} disabled={!valid} loading={report.isPending}>
          {t.shortageSave}
        </Button>
      </DialogFooter>
    </>
  );
}
