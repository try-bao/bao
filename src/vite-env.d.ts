/// <reference types="vite/client" />

import type { BaoApi } from "./types";

declare global {
  interface Window {
    bao: BaoApi;
    parseMarkdownToHtml?: (md: string) => string;
    htmlToMarkdown?: (root: HTMLElement) => string;
    wireLiveMarkdown?: (
      el: HTMLElement,
      onChange: () => void
    ) => void;
    runLiveMarkdownTransforms?: (root: HTMLElement) => void;
  }
}

export {};
