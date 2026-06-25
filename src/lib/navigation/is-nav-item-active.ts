/** Active si la route correspond exactement, ou si c'est un enfant sans match plus spécifique dans le menu. */
export function isNavItemActive(
  pathname: string,
  href: string,
  allHrefs: string[]
): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  const hasMoreSpecificMatch = allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );

  return !hasMoreSpecificMatch;
}
