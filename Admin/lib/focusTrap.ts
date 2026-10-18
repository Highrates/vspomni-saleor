const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Tab-cycle focus inside `root`. Call from a keydown listener. */
export function trapFocusKeydown(e: KeyboardEvent, root: HTMLElement) {
  if (e.key !== 'Tab') return;
  const nodes = focusablesIn(root);
  if (nodes.length === 0) {
    e.preventDefault();
    return;
  }
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  if (e.shiftKey) {
    if (document.activeElement === first || !root.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !root.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}
