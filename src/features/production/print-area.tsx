"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { PreparationSheet, ProductionDay } from "@/domains/production/production.types";
import { longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";

const t = fr.production;
export type PrintKind = "sheets" | "labels";

const subscribe = () => () => {};

/**
 * BOU-04 : zone d'impression A4 rendue directement dans <body> (voir `.print-root` dans globals.css).
 * Invisible à l'écran ; à l'impression, seule elle sort : bons de préparation ou étiquettes.
 */
export function PrintArea({ day, kind, packages }: { day: ProductionDay; kind: PrintKind; packages: Record<string, number> }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted || !day.closed || day.sheets.length === 0) return null;
  return createPortal(
    <div className="print-root" data-testid="print-root" data-kind={kind}>
      {kind === "sheets" ? <Sheets day={day} /> : <Labels day={day} packages={packages} />}
    </div>,
    document.body
  );
}

function place(sheet: PreparationSheet) {
  return sheet.round ? `${sheet.round.name} · ${t.stop(sheet.stopSequence ?? 0, sheet.stopCount ?? 0)}` : t.noRound;
}

function Sheets({ day }: { day: ProductionDay }) {
  return (
    <div>
      {day.sheets.map((sheet) => (
        <section key={sheet.orderId} className="print-sheet">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm", alignItems: "baseline" }}>
            <div>
              <p style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.sheetTitle} · {sheet.reference}</p>
              <p style={{ fontSize: "14pt", fontWeight: 700 }}>{sheet.merchant.name}</p>
              <p>{[sheet.merchant.address, [sheet.merchant.postalCode, sheet.merchant.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 600 }}>{longDeliveryDateLabel(day.date)}</p>
              <p>{sheet.slotLabel}</p>
              <p style={{ fontWeight: 600 }}>{place(sheet)}</p>
            </div>
          </div>
          <table style={{ marginTop: "3mm" }}>
            <thead>
              <tr>
                <th style={{ width: "8mm" }}>✓</th>
                <th>{t.product}</th>
                <th>{t.unit}</th>
                <th style={{ textAlign: "right" }}>{t.quantity}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((line) => (
                <tr key={line.lineId}>
                  <td>☐</td>
                  <td>{line.name}</td>
                  <td>{line.unit}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered
                      ? `${line.quantityDelivered} (${t.shortage.toLowerCase()} ${line.quantityOrdered - line.quantityDelivered})`
                      : line.quantityOrdered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: "2mm", textAlign: "right" }}>{t.itemCount(sheet.itemCount)}</p>
          {sheet.merchant.accessInstructions ? <p style={{ marginTop: "1mm" }}>{t.access} : {sheet.merchant.accessInstructions}</p> : null}
        </section>
      ))}
    </div>
  );
}

function Labels({ day, packages }: { day: ProductionDay; packages: Record<string, number> }) {
  const labels = day.sheets.flatMap((sheet) => {
    const total = Math.max(1, packages[sheet.orderId] ?? 1);
    return Array.from({ length: total }, (_, index) => ({ sheet, index: index + 1, total }));
  });
  return (
    <div className="print-labels">
      {labels.map(({ sheet, index, total }) => (
        <article key={`${sheet.orderId}-${index}`} className="print-label">
          <p style={{ fontSize: "16pt", fontWeight: 700, lineHeight: 1.15 }}>{sheet.merchant.name}</p>
          <p style={{ marginTop: "1mm" }}>{sheet.merchant.address}</p>
          <p>{[sheet.merchant.postalCode, sheet.merchant.city].filter(Boolean).join(" ")}</p>
          <p style={{ marginTop: "3mm", fontSize: "12pt", fontWeight: 600 }}>{sheet.slotLabel} · {longDeliveryDateLabel(day.date)}</p>
          <p style={{ fontSize: "12pt", fontWeight: 600 }}>{place(sheet)}</p>
          <p style={{ marginTop: "3mm", fontSize: "18pt", fontWeight: 800 }}>{t.labelPackage(index, total)}</p>
          <p style={{ fontSize: "9pt" }}>{sheet.reference}</p>
        </article>
      ))}
    </div>
  );
}
