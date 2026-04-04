const ipcPrefix = /^Error invoking remote method '[^']*':\s*/;

function cleanDetail(raw: string): string {
  const stripped = raw.replace(ipcPrefix, "");
  // Remove a leading "Error: " so we don't show "Error: File already exists"
  return stripped.replace(/^Error:\s*/, "");
}

export function formatErr(label: string, err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string" && err
        ? err
        : "";
  const detail = raw ? cleanDetail(raw) : "";
  return detail ? `${label}\n\n${detail}` : label;
}
