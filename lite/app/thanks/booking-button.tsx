"use client";
import { useEffect } from "react";
import { track } from "../track";

export function ThanksTracker() {
  useEffect(() => { track("thanks_view"); }, []);
  return null;
}

export function BookingButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      onClick={() => track("click_booking")}
      className="rounded-xl bg-[#2E8B57] px-4 py-3 text-center text-base font-bold text-white"
    >
      בחרו מועד לפגישה
    </a>
  );
}
