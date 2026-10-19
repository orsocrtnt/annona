import { mkdir, writeFile } from "node:fs/promises";
import { generateInvoicePdf } from "../../src/lib/pdf/invoice-pdf";

async function main() {
  await mkdir("outputs/bill01b", { recursive: true });
  const bytes = await generateInvoicePdf({ reference: "BILL01B-FICTIF-LONG", status: "PENDING", createdAt: new Date("2026-10-25T12:00:00Z"),
    amount: 48, company: { name: "Entreprise fictive BILL-01B", address: "1 rue du Test", city: "Paris" },
    customerName: "Client fictif",
    lineItems: Array.from({ length: 160 }, (_, index) => ({ label: `Ligne ${String(index + 1).padStart(3, "0")} — été ${"adresse longue ".repeat(8)}`, amount: 0.1, quantity: 3 })),
    notes: "Dernière note de recette.\n".repeat(15), footerNote: "Fin du document fictif BILL-01B" });
  await writeFile("outputs/bill01b/operational-long.pdf", bytes);
}
main().catch(() => { console.error("PDF_PREVIEW_FAILED"); process.exitCode = 1; });
