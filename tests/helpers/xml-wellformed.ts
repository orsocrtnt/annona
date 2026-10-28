/**
 * Contrôle hors ligne minimal du caractère « bien formé » d'un document XML :
 * prologue, balises équilibrées, attributs entre guillemets, entités connues,
 * aucun caractère interdit. Ce n'est PAS une validation XSD ni Schematron.
 * Retourne la liste des erreurs (vide si le document est bien formé).
 */
export function xmlWellFormednessErrors(xml: string): string[] {
  const errors: string[] = [];
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) errors.push("caractère de contrôle interdit");
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) errors.push("prologue XML absent");

  const stack: string[] = [];
  let roots = 0;
  const body = xml.replace(/^<\?xml[^?]*\?>/, "");
  const tokenRe = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[^>]*>|[^<]+/g;
  for (const match of body.matchAll(tokenRe)) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (!token.startsWith("<")) {
      if (stack.length === 0 && token.trim()) errors.push(`texte hors de l'élément racine : ${token.trim().slice(0, 30)}`);
      for (const entity of token.matchAll(/&([^;\s]*);?/g)) {
        if (!/^(amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+)$/.test(entity[1] ?? "") || !entity[0].endsWith(";")) {
          errors.push(`entité invalide : ${entity[0]}`);
        }
      }
      if (token.includes(">")) errors.push("chevron « > » non échappé dans le texte");
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      const open = stack.pop();
      if (open !== name) errors.push(`fermeture </${name}> inattendue (ouvert : ${open ?? "aucun"})`);
      continue;
    }
    const selfClosing = token.endsWith("/>");
    const inner = token.slice(1, selfClosing ? -2 : -1);
    const nameMatch = inner.match(/^([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)/);
    if (!nameMatch) {
      errors.push(`nom d'élément invalide : ${token.slice(0, 30)}`);
      continue;
    }
    const attrs = inner.slice(nameMatch[1]!.length);
    const attrRe = /\s+([A-Za-z_][\w.:-]*)="([^"<]*)"/y;
    let index = 0;
    const seen = new Set<string>();
    while (index < attrs.length) {
      attrRe.lastIndex = index;
      const attr = attrRe.exec(attrs);
      if (!attr) {
        if (attrs.slice(index).trim()) errors.push(`attribut mal formé dans ${token.slice(0, 40)}`);
        break;
      }
      if (seen.has(attr[1]!)) errors.push(`attribut dupliqué ${attr[1]}`);
      seen.add(attr[1]!);
      for (const entity of (attr[2] ?? "").matchAll(/&([^;\s]*);?/g)) {
        if (!/^(amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+)$/.test(entity[1] ?? "") || !entity[0].endsWith(";")) {
          errors.push(`entité invalide dans un attribut : ${entity[0]}`);
        }
      }
      index = attrRe.lastIndex;
    }
    if (stack.length === 0) roots += 1;
    if (!selfClosing) stack.push(nameMatch[1]!);
  }
  if (stack.length) errors.push(`éléments non fermés : ${stack.join(", ")}`);
  if (roots !== 1) errors.push(`le document doit avoir exactement un élément racine (trouvé : ${roots})`);
  return errors;
}

/** Contenus texte (désechappés) de toutes les occurrences d'un élément, dans l'ordre. */
export function xmlTexts(xml: string, element: string): string[] {
  const re = new RegExp(`<${element}(?:\\s[^>]*)?>([^<]*)</${element}>`, "g");
  return [...xml.matchAll(re)].map((m) =>
    (m[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
  );
}

/** Ordre d'apparition des balises ouvrantes listées (pour vérifier la séquence imposée par le XSD CII). */
export function xmlElementOrder(xml: string, elements: string[]): string[] {
  const re = new RegExp(`<(${elements.map((e) => e.replace(/[.:]/g, "\\$&")).join("|")})[\\s>/]`, "g");
  return [...xml.matchAll(re)].map((m) => m[1]!);
}
