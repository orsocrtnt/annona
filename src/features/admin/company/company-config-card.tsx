"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CompanyConfig } from "@/domains/admin/company-admin.service";
import { fr } from "@/lib/i18n/fr";
import { COMPANY_TIMEZONES } from "@/lib/validations/company-admin";

const t = fr.platform;
const s = fr.companySettings;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

/** PLA-02 : configuration d'une entreprise par le super-administrateur. */
export function CompanyConfigCard({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "company-config", companyId];
  const config = useQuery({ queryKey: key, queryFn: () => call<CompanyConfig>(`/api/admin/companies/${companyId}/config`) });
  const [name, setName] = useState("");
  const [cutoffTime, setCutoffTime] = useState("17:00");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [lead, setLead] = useState("120");
  // Valeurs posées une seule fois au chargement : une saisie en cours n'est jamais écrasée.
  const loaded = useRef(false);
  useEffect(() => {
    if (!config.data || loaded.current) return;
    loaded.current = true;
    setName(config.data.name);
    setCutoffTime(config.data.cutoffTime);
    setTimezone(config.data.timezone);
    setLead(String(config.data.reminderLeadMinutes));
  }, [config.data]);
  const save = useMutation({
    mutationFn: () =>
      call<CompanyConfig>(`/api/admin/companies/${companyId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), cutoffTime, timezone, reminderLeadMinutes: Number.parseInt(lead, 10) }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      void qc.invalidateQueries({ queryKey: ["admin", "company", companyId] });
      void qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      toast.success(t.saved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.configure}</CardTitle>
        <CardDescription>{t.configureHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2 sm:items-end" data-testid="company-config" aria-busy={!config.data} onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <FormField label={t.companyName}>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
          </FormField>
          <FormField label={s.cutoffTime}>
            <Input type="time" value={cutoffTime} onChange={(event) => setCutoffTime(event.target.value)} required />
          </FormField>
          <FormField label={s.timezone}>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger aria-label={s.timezone}><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANY_TIMEZONES.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={s.reminderLead} hint={s.reminderLeadHint}>
            <Input type="number" min={0} max={1440} step={5} value={lead} onChange={(event) => setLead(event.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" loading={save.isPending} disabled={!config.data}>{fr.common.save}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
