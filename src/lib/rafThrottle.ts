/** At most one call per animation frame (coalesces selectionchange spam). */
export function rafThrottle(fn: () => void): () => void {
  let id: number | null = null;
  return () => {
    if (id !== null) {
      return;
    }
    id = requestAnimationFrame(() => {
      id = null;
      fn();
    });
  };
}
