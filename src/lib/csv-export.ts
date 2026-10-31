/**
 * RFC 4180 compliant CSV export engine.
 * Compiles strings purely on client-side from live in-memory data
 * and triggers immediate native file download without a round-trip to the server.
 */

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If value contains comma, quotes, or newlines, quote and double-escape quotes per RFC 4180
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportApplicationsToCSV(
  applications: Array<Record<string, any>>,
  filenamePrefix: string = "autojob_applications"
) {
  if (!applications || applications.length === 0) {
    alert("No application records available to export.");
    return;
  }

  const headers = [
    "ID",
    "Timestamp",
    "Platform",
    "Company",
    "Position",
    "Status",
    "Job URL",
    "Tailored Cover Letter",
    "Notes",
  ];

  const rows = applications.map((app) => [
    escapeCsvField(app.id),
    escapeCsvField(app.timestamp),
    escapeCsvField(app.platform),
    escapeCsvField(app.company),
    escapeCsvField(app.position),
    escapeCsvField(app.status),
    escapeCsvField(app.job_url),
    escapeCsvField(app.tailored_letter),
    escapeCsvField(app.notes),
  ]);

  // CRLF line endings per RFC 4180 specification
  const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split("T")[0];

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
