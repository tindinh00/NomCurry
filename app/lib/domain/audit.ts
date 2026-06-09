import { appendObjects, generateId, timestamp } from "@/app/lib/sheets/helpers";
import { SHEETS } from "./shared";

export type AuditLogInput = {
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  note?: string;
  source?: string;
};

export async function appendAuditLog(input: AuditLogInput): Promise<void> {
  await appendObjects(SHEETS.auditLog, [{
    "Mã Log": generateId("LOG"),
    "Thời gian": timestamp(),
    "Người thao tác": input.actorEmail,
    "Hành động": input.action,
    "Đối tượng": input.entity,
    "Mã đối tượng": input.entityId,
    "Trước": serializeAuditValue(input.before),
    "Sau": serializeAuditValue(input.after),
    "Ghi chú": input.note ?? "",
    "Nguồn": input.source ?? "web",
  }]);
}

function serializeAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
