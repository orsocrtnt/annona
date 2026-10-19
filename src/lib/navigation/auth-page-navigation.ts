export interface AuthPageNavigationEvent {
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

interface AuthPageLocation {
  assign: (href: string) => void;
}

/**
 * Auth pages are public document boundaries. A full document navigation avoids
 * depending on a retained App Router/RSC cache while preserving modified clicks.
 */
export function navigateToAuthPage(
  event: AuthPageNavigationEvent,
  href: string,
  location: AuthPageLocation = window.location
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }

  event.preventDefault();
  location.assign(href);
  return true;
}
