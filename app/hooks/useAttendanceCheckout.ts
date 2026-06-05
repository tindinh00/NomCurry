"use client";

import { useState } from "react";

import type { AppState } from "@/app/types/nomcurry";

export function useAttendanceCheckout(state: AppState) {
  const [checkoutId, setCheckoutId] = useState("");
  const [checkoutNote, setCheckoutNote] = useState("");
  const checkoutItem = state.attendanceItems.find((item) => item.registrationId === checkoutId);

  function close() {
    setCheckoutId("");
  }

  function resetNote() {
    setCheckoutNote("");
  }

  return {
    checkoutId,
    checkoutNote,
    checkoutItem,
    setCheckoutId,
    setCheckoutNote,
    close,
    resetNote,
  };
}

