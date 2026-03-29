import type { BaoApi } from "../types";

export function getApi(): BaoApi {
  const api = window.bao;
  if (!api) {
    throw new Error("window.bao is not available (preload missing?)");
  }
  return api;
}
