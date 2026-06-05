"use client";

import { useRef, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, SendHorizontalIcon } from "lucide-react";

import { RegistrationPanel } from "@/app/components/common/RegistrationPanel";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { useShiftRegistration } from "@/app/hooks/useShiftRegistration";
import { getDayLabel, getWeekLabel } from "@/app/lib/nomcurry/date";
import type { AppState, MutateAppState } from "@/app/types/nomcurry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export type ShiftRegistrationScreenProps = {
  state: AppState;
  mutate: MutateAppState;
};

export function ShiftRegistrationScreen({ state, mutate }: ShiftRegistrationScreenProps) {
  const shiftRegistration = useShiftRegistration(state);
  const [btnPhase, setBtnPhase] = useState<"idle" | "flying" | "loading">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitLabel = getSubmitLabel(
    shiftRegistration.slots.length,
    shiftRegistration.initialCount,
    shiftRegistration.hasChanges
  );
  const canSubmit =
    (shiftRegistration.slots.length > 0 || shiftRegistration.initialCount > 0) &&
    shiftRegistration.hasChanges;


  function handleFloatingClick() {
    if (!canSubmit || btnPhase !== "idle") return;
    setBtnPhase("flying");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBtnPhase("loading");
      void mutate("/api/registrations", {
        monday: shiftRegistration.monday,
        slots: shiftRegistration.slots,
        note: "",
      }, "Gút chóp!!! Chờ anh chị duyệt nhé").finally(() => {
        setBtnPhase("idle");
      });
    }, 420);
  }

  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow="Đăng ký ca"
        title="Chọn ca làm theo tuần"
        subtitle="Mấy đứa đăng ký vừa vừa thui, anh chị không có xiền trả đâu!!! 💸"
      />

      <Card>
        <CardHeader>
          <CardTitle>Chọn ca làm</CardTitle>
          <CardAction>
            <Badge variant="secondary">Chờ duyệt</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-col items-center justify-center gap-2.5">
            <p className="text-sm text-muted-foreground">{getWeekLabel(shiftRegistration.monday)}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={shiftRegistration.previousWeek} aria-label="Tuần trước">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" className="min-w-24" onClick={shiftRegistration.currentWeek}>
                Tuần này
              </Button>
              <Button variant="outline" size="icon" onClick={shiftRegistration.nextWeek} aria-label="Tuần sau">
                <ChevronRightIcon />
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {shiftRegistration.days.map((date) => (
              <Card key={date} size="sm">
                <CardHeader className="md:grid-cols-[8rem_1fr]">
                  <div>
                    <CardTitle>{getDayLabel(date)}</CardTitle>
                    <CardDescription>{date}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {state.shifts.map((shift) => {
                    const key = `${date}|${shift["Mã Ca"]}`;
                    const disabled = shiftRegistration.occupied.has(key);
                    const checked = Boolean(shiftRegistration.selected[key]);
                    const persisted = shiftRegistration.isInitiallySelected(key);

                    return (
                      <div
                        key={key}
                        className={cn(
                          "grid min-w-0 gap-2 rounded-lg border p-3",
                          checked && "border-primary/45 bg-secondary/45",
                          disabled && "opacity-50"
                        )}
                      >
                        <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(value) => shiftRegistration.toggle(date, shift["Mã Ca"], value === true)}
                          />
                          <span className={cn("min-w-0 leading-snug", (persisted || disabled) && "line-through decoration-2")}>
                            {shift["Tên Ca"]}
                          </span>
                        </label>
                        {checked && !persisted && !disabled ? (
                          <Textarea
                            value={shiftRegistration.selected[key].note}
                            onChange={(event) => shiftRegistration.updateSlotNote(key, event.target.value)}
                            placeholder="Ghi chú riêng cho ca này"
                            className="min-h-16"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <form className="hidden lg:block" onSubmit={(event) => { event.preventDefault(); void mutate("/api/registrations", { monday: shiftRegistration.monday, slots: shiftRegistration.slots, note: "" }, "Gút chóp!!! Chờ anh chị duyệt nhé"); }}>
            <FieldGroup>
              <Button disabled={!canSubmit} type="submit" className="w-full sm:w-auto">
                {submitLabel}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <RegistrationPanel
        title="Lịch của tôi"
        description="Các ca đã đăng ký bằng email hiện tại."
        state={state}
        rows={state.registrations}
        mutate={mutate}
      />

      {/* Floating submit bar — visible on mobile when shifts are selected */}
      <div
        className={cn(
          "fixed inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-out lg:hidden",
          "bottom-[84px]",
          canSubmit
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <button
          type="button"
          disabled={!canSubmit || btnPhase !== "idle"}
          onClick={handleFloatingClick}
          className={cn(
            "relative flex h-14 items-center justify-center overflow-hidden rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-xl transition-all duration-300 disabled:opacity-70",
            btnPhase === "loading" ? "w-14 min-w-14 px-0" : "min-w-48 px-8 gap-3"
          )}
        >
          {/* Loading spinner */}
          {btnPhase === "loading" && (
            <Loader2Icon className="size-5 animate-spin" />
          )}

          {/* Icon + label (hidden during loading) */}
          {btnPhase !== "loading" && (
            <span className="flex items-center gap-3">
              <SendHorizontalIcon
                className="size-5 shrink-0"
                style={btnPhase === "flying"
                  ? { animation: "icon-fly 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards" }
                  : undefined
                }
              />
              <span
                style={btnPhase === "flying"
                  ? { animation: "text-fade-out 0.3s ease-in forwards" }
                  : undefined
                }
              >
                {submitLabel}
              </span>
            </span>
          )}
        </button>
      </div>
    </section>
  );
}

function getSubmitLabel(slotCount: number, initialCount: number, hasChanges: boolean) {
  if (!slotCount && !initialCount) return "Chọn ca để đăng ký";
  if (!hasChanges && initialCount) return `Đã gửi ${initialCount} ca chờ duyệt`;
  if (initialCount) return slotCount ? `Cập nhật thành ${slotCount} ca` : "Hủy các ca chờ duyệt";
  return `Gửi ${slotCount} ca đã chọn`;
}
