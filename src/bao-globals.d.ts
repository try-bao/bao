export {};

declare global {
  interface Window {
    baoHighlightCodeElement?: (el: HTMLElement) => void;
    runLiveMarkdownTransforms?: (root: HTMLElement) => void;
  }
}
