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
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  // Associe automatiquement le label au champ (clic sur le label + lecteurs d'écran).
  const field = !htmlFor && React.isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }>(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? fieldId,
        "aria-describedby": [
          children.props["aria-describedby"],
          error ? errorId : hint ? hintId : null,
        ].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-required": required ? true : children.props["aria-required"],
      })
    : children;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={fieldId}>
          {label}
          {required && <><span aria-hidden className="ml-1 text-destructive">*</span><span className="sr-only"> (obligatoire)</span></>}
        </Label>
      )}
      {field}
      {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
      {hint && !error && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
