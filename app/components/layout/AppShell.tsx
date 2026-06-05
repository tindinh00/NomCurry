"use client";

import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { LogOut, Shield, User } from "lucide-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAvatarFallback } from "@/app/lib/nomcurry/selectors";
import type { AppRoute, AppState } from "@/app/types/nomcurry";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  children: React.ReactNode;
  state: AppState | null;
  route: AppRoute;
  onRoute: (route: AppRoute) => void;
};

const NAV_ITEMS = [
  { key: "dashboard" as const, label: "Tổng quan", managerOnly: true },
  { key: "approve" as const, label: "Duyệt ca", managerOnly: true },
  { key: "shifts" as const, label: "Đăng ký ca", managerOnly: false },
  { key: "attendance" as const, label: "Điểm danh", managerOnly: false },
  { key: "payroll" as const, label: "Lương", managerOnly: true },
];

export function AppShell({ children, state, route, onRoute }: AppShellProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    document.cookie = "nomcurry_actor_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "nomcurry_logged_out=true; path=/; max-age=31536000";
    try {
      await signOut({ redirect: false });
    } catch (e) {
      console.error("NextAuth signOut error", e);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("actorEmail");
    window.location.href = url.origin + url.pathname;
  };

  const visibleNav = state?.employee
    ? NAV_ITEMS.filter((item) => item.managerOnly === state.isManager || (!item.managerOnly && !state.isManager))
    : [];
  const activeMobileIndex = Math.max(0, visibleNav.findIndex((item) => item.key === route));
  const mobileIndicatorStyle = {
    "--active-index": activeMobileIndex,
    "--tab-count": visibleNav.length,
  } as CSSProperties;

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 pb-24 sm:px-6 lg:px-8">
        <header className="grid grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[auto_1fr_auto]">
          <Button variant="ghost" className="h-auto justify-start gap-3 px-0" onClick={() => onRoute("dashboard")}>
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              NC
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="font-semibold">NOM CURRY</span>
              <span className="text-xs text-muted-foreground">Quản lý ca làm</span>
            </span>
          </Button>

          {visibleNav.length ? (
            <nav className="hidden justify-self-center rounded-lg border bg-card p-1 lg:flex">
              {visibleNav.map((item) => (
                <Button
                  key={item.key}
                  variant={route === item.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onRoute(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          ) : <span className="hidden lg:block" />}

          <div className="flex items-center justify-end gap-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-primary transition-all text-left cursor-pointer"
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{state?.employee?.["Tên NV"] || "Chưa đăng ký"}</p>
                  <p className="text-xs text-muted-foreground">{state?.email || "Đang tải"}</p>
                </div>
                <Avatar className="ring-2 ring-border hover:ring-primary/50 transition-all">
                  <AvatarFallback>{getAvatarFallback(state)}</AvatarFallback>
                </Avatar>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border bg-popover p-4 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                  <div className="flex flex-col items-center gap-3 text-center pb-3">
                    <Avatar className="size-16 ring-4 ring-primary/10">
                      <AvatarFallback className="text-xl">{getAvatarFallback(state)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-foreground text-base">{state?.employee?.["Tên NV"] || "Chưa đăng ký"}</h4>
                      <p className="text-xs text-muted-foreground">{state?.email}</p>
                    </div>
                    {state?.employee && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs",
                        state.isManager 
                          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" 
                          : "bg-primary/10 text-primary"
                      )}>
                        {state.isManager ? <Shield className="size-3" /> : <User className="size-3" />}
                        {state.isManager ? "Quản lý" : (state?.employee?.["Vai trò"] || "Nhân viên")}
                      </span>
                    )}
                  </div>
                  
                  <div className="border-t my-2" />
                  
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </div>

      {visibleNav.length ? (
        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 grid gap-2 border-t bg-background/95 p-2 backdrop-blur lg:hidden",
            visibleNav.length === 2 ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-5"
          )}
          style={mobileIndicatorStyle}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 top-2 rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: "calc((100% - 1rem - (var(--tab-count) - 1) * 0.5rem) / var(--tab-count))",
              transform: "translateX(calc(var(--active-index) * (100% + 0.5rem)))",
            }}
          />
          {visibleNav.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              size="lg"
              className={cn(
                "relative h-12 text-sm font-semibold transition-colors duration-200",
                route === item.key
                  ? "text-primary-foreground hover:bg-transparent hover:text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
              onClick={() => onRoute(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      ) : null}
    </>
  );
}
