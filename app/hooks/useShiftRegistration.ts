"use client";

import { useEffect, useMemo, useState } from "react";

import { REGISTRATION_STATUS } from "@/app/lib/nomcurry/constants";
import { getWeekDays, getWeekMonday, normalizeDateKey, shiftWeek, todayKey } from "@/app/lib/nomcurry/date";
import type { AppState } from "@/app/types/nomcurry";

type SelectedSlot = { date: string; shiftId: string; note: string };

function selectionSignature(selected: Record<string, SelectedSlot>) {
  return Object.values(selected)
    .map((slot) => `${slot.date}|${slot.shiftId}|${slot.note}`)
    .sort()
    .join(";");
}

/**
 * Encapsulates weekly matrix selection so ShiftRegistration stays render-focused.
 */
export function useShiftRegistration(state: AppState) {
  const [monday, setMonday] = useState(getWeekMonday(todayKey()));
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, SelectedSlot>>({});
  const [initialSelected, setInitialSelected] = useState<Record<string, SelectedSlot>>({});
  const days = useMemo(() => getWeekDays(monday), [monday]);
  const occupied = new Set(state.occupiedSlots.map((slot) => `${slot.dateKey}|${slot.shiftId}`));
  const slots = Object.values(selected);
  const initialCount = Object.keys(initialSelected).length;
  const hasChanges = selectionSignature(selected) !== selectionSignature(initialSelected) || Boolean(note.trim());

  useEffect(() => {
    const employeeId = state.employee?.["Mã NV"];
    const weekDays = new Set(days);
    const nextSelected = state.registrations.reduce<Record<string, SelectedSlot>>((next, row) => {
      const date = normalizeDateKey(row["Ngày"]);
      const shiftId = String(row["Ca Làm"] ?? "").trim();

      if (!employeeId || row["Nhân Viên"] !== employeeId) return next;
      if (row["Tình Trạng"] !== REGISTRATION_STATUS.pending) return next;
      if (!weekDays.has(date) || !shiftId) return next;

      next[`${date}|${shiftId}`] = {
        date,
        shiftId,
        note: row["Ghi chú"] || "",
      };
      return next;
    }, {});

    setSelected(nextSelected);
    setInitialSelected(nextSelected);
  }, [days, monday, state.employee, state.registrations]);

  function toggle(date: string, shiftId: string, checked: boolean) {
    const key = `${date}|${shiftId}`;
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[key] = { date, shiftId, note: "" };
      else delete next[key];
      return next;
    });
  }

  function updateSlotNote(key: string, value: string) {
    setSelected((current) => ({
      ...current,
      [key]: { ...current[key], note: value },
    }));
  }

  function isInitiallySelected(key: string) {
    return Boolean(initialSelected[key]);
  }

  return {
    monday,
    note,
    selected,
    days,
    occupied,
    slots,
    initialCount,
    hasChanges,
    setNote,
    previousWeek: () => setMonday((current) => shiftWeek(current, -1)),
    currentWeek: () => setMonday(getWeekMonday(todayKey())),
    nextWeek: () => setMonday((current) => shiftWeek(current, 1)),
    toggle,
    updateSlotNote,
    isInitiallySelected,
  };
}
