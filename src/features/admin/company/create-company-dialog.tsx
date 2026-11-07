"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { fr } from "@/lib/i18n/fr";

const t = fr.platform;

async function createCompany(input: { name: string; admin: { firstName: string; lastName: string; email: string } }) {
  const res = await fetch("/api/admin/companies/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Création impossible.");
  return json.data as { companyId: string; adminUserId: string; invited: boolean };
}

/** PLA-02 : créer une entreprise et inviter son premier administrateur. */
export function CreateCompanyDialog() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: createCompany,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(data.invited ? t.created : t.createdPending);
      setOpen(false);
      router.push(`/companies/${data.companyId}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand"><Building2 /> {t.newCompany}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.createTitle}</DialogTitle>
          <DialogDescription>{t.createHint}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ name: name.trim(), admin: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() } });
          }}
        >
          <FormField label={t.companyName} required>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t.adminFirstName} required>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </FormField>
            <FormField label={t.adminLastName} required>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            </FormField>
          </div>
          <FormField label={t.adminEmail} required>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{fr.common.cancel}</Button>
            <Button type="submit" variant="brand" loading={mutation.isPending}>{t.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
