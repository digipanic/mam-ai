const escapeCsvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Plain client-side CSV blob download — no dependency, no server round-trip.
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
