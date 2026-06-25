"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  error,
  hint,
  required,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  const generatedId = React.useId();
  const fieldId = htmlFor ?? generatedId;

  // Associe automatiquement le label au champ (clic sur le label + lecteurs d'écran).
  const field = React.isValidElement<{ id?: string }>(children)
    ? React.cloneElement(children, { id: children.props.id ?? fieldId })
    : children;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={fieldId}>
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      {field}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
