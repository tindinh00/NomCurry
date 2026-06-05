import type { sheets_v4 } from "googleapis";
import { getSheetsClient, getSpreadsheetId } from "./client";

export type SheetRow = Record<string, string>;

// ─────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────

export async function readObjects(sheetName: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0].map(String);
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      return headers.reduce<SheetRow>((obj, header, i) => {
        obj[header] = String(row[i] ?? "");
        return obj;
      }, {});
    });
}

// ─────────────────────────────────────────────
// Write helpers
// ─────────────────────────────────────────────

export async function appendObjects(sheetName: string, objects: SheetRow[]): Promise<void> {
  if (!objects.length) return;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Get headers from first row
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const headers = (headersRes.data.values?.[0] || []).map(String);

  const values = objects.map((obj) =>
    headers.map((h) => (Object.prototype.hasOwnProperty.call(obj, h) ? String(obj[h] ?? "") : ""))
  );

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function updateCells(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function updateByKey(
  sheetName: string,
  keyName: string,
  keyValue: string,
  updates: Partial<SheetRow>
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) throw new Error(`Không tìm thấy dữ liệu trong sheet: ${sheetName}`);

  const headers = rows[0].map(String);
  const keyIndex = headers.indexOf(keyName);
  if (keyIndex === -1) throw new Error(`Không tìm thấy cột khóa: ${keyName}`);

  const rowIndex = rows.findIndex((row, i) => i > 0 && String(row[keyIndex] ?? "") === keyValue);
  if (rowIndex === -1) throw new Error(`Không tìm thấy dòng với ${keyName} = ${keyValue}`);

  // Update each field individually
  const batchUpdates: sheets_v4.Schema$ValueRange[] = [];
  for (const [field, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(field);
    if (colIndex === -1) throw new Error(`Không tìm thấy cột: ${field}`);
    const colLetter = colIndexToLetter(colIndex);
    batchUpdates.push({
      range: `${sheetName}!${colLetter}${rowIndex + 1}`,
      values: [[value ?? ""]],
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: batchUpdates,
    },
  });
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

export function normalizeDateKey(value: unknown): string {
  if (!value) return "";
  const date = String(value).trim();
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const slash = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  return date;
}

export function generateId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 12).toUpperCase();
  return `${prefix.toUpperCase()}-${token}`;
}

function colIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

export function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isDeleted(row: SheetRow): boolean {
  return String(row["IsDelete"] ?? "").toUpperCase() === "TRUE";
}

export function parseHours(value: unknown): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

export function parseMoney(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}

export function timestamp(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace("T", " ");
}

export function calculateWorkedHours(start: string, end: string): number {
  const parseTs = (s: string) => {
    const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  };
  const s = parseTs(start);
  const e = parseTs(end);
  if (!s || !e || e <= s) return 0;
  return Math.round(((e.getTime() - s.getTime()) / 3_600_000) * 100) / 100;
}
