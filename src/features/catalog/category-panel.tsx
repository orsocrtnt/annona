"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CategoryRow } from "@/features/catalog/api";
import { useCreateCategory, useReorderCategories, useUpdateCategory } from "@/features/catalog/hooks";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.catalog;

interface CategoryPanelProps {
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** ADM-02 / ADM-09 : catégories (créer, renommer, ordonner, désactiver). */
export function CategoryPanel({ categories, selectedId, onSelect }: CategoryPanelProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();

  const onError = (error: Error) => toast.error(error.message);

  const submitNew = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    create.mutate(
      { name: newName.trim() },
      { onSuccess: () => { setNewName(""); toast.success(t.categorySaved); }, onError }
    );
  };

  const submitRename = (id: string) => {
    if (!editName.trim()) return;
    update.mutate(
      { id, input: { name: editName.trim() } },
      { onSuccess: () => { setEditingId(null); toast.success(t.categorySaved); }, onError }
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = categories.map((category) => category.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids, { onError });
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t.categories}</CardTitle>
        <CardDescription>{t.categoriesHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submitNew} className="flex gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t.newCategory}
            aria-label={t.categoryName}
            maxLength={120}
          />
          <Button type="submit" variant="brand" size="icon" aria-label={t.newCategory} loading={create.isPending} disabled={!newName.trim()}>
            <Plus />
          </Button>
        </form>

        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">{t.noCategory}</p>
            <p className="mt-1 text-muted-foreground">{t.noCategoryHint}</p>
          </div>
        ) : (
          <ul className="space-y-1" aria-label={t.categories}>
            <li>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className={cn(
                  "flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-muted",
                  selectedId === null && "bg-muted font-medium"
                )}
                aria-pressed={selectedId === null}
              >
                {t.allCategories}
              </button>
            </li>
            {categories.map((category, index) => (
              <li
                key={category.id}
                data-testid={`category-row-${category.name}`}
                className={cn("group flex items-center gap-1 rounded-lg pr-1", selectedId === category.id && "bg-muted")}
              >
                {editingId === category.id ? (
                  <form
                    className="flex flex-1 items-center gap-1 py-1 pl-1"
                    onSubmit={(event) => { event.preventDefault(); submitRename(category.id); }}
                  >
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      aria-label={t.renameCategory}
                      className="h-9"
                      maxLength={120}
                    />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label={fr.common.save} loading={update.isPending}>
                      <Check />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={fr.common.cancel} onClick={() => setEditingId(null)}>
                      <X />
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(category.id)}
                      aria-pressed={selectedId === category.id}
                      className={cn(
                        "flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted",
                        selectedId === category.id && "font-medium",
                        !category.active && "text-muted-foreground"
                      )}
                    >
                      <span className="line-clamp-2 break-words">{category.name}</span>
                      <span className="text-xs text-muted-foreground">{category.productCount}</span>
                      {!category.active ? <Badge variant="secondary" className="ml-auto">{t.categoryInactive}</Badge> : null}
                    </button>
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label={`${t.renameCategory} ${category.name}`}
                      onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label={`${t.moveUp} ${category.name}`}
                      disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}
                      className={cn(index === 0 && "invisible")}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label={`${t.moveDown} ${category.name}`}
                      disabled={index === categories.length - 1 || reorder.isPending} onClick={() => move(index, 1)}
                      className={cn(index === categories.length - 1 && "invisible")}
                    >
                      <ArrowDown />
                    </Button>
                    <Switch
                      checked={category.active}
                      aria-label={`${category.active ? t.deactivate : t.activate} ${category.name}`}
                      onCheckedChange={(active) => update.mutate({ id: category.id, input: { active } }, { onError })}
                      className="ml-1"
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
