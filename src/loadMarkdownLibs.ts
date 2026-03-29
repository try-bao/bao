/** Load legacy globals before React (Vite injects the bundle before body scripts). */
export function loadMarkdownLibs(): Promise<void> {
  const base = window.location.href;
  const names = ["markdown-parse.js", "live-md.js"] as const;
  let chain: Promise<void> = Promise.resolve();
  for (const name of names) {
    chain = chain.then(
      () =>
        new Promise<void>((resolve, reject) => {
          const el = document.createElement("script");
          el.src = new URL(name, base).toString();
          el.async = false;
          el.onload = () => resolve();
          el.onerror = () => reject(new Error(`Failed to load ${name}`));
          document.head.appendChild(el);
        })
    );
  }
  return chain;
}
