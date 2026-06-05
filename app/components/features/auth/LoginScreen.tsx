"use client";

import { useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { signIn } from "next-auth/react";

import type { AppState } from "@/app/types/nomcurry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type LoginScreenProps = {
  state: AppState;
  onSubmit: (name: string, email: string) => void;
};

/**
 * First-run employee profile screen for users not present in NhanVien.
 */
export function LoginScreen({ state, onSubmit }: LoginScreenProps) {
  const [name, setName] = useState("");
  const hasDefaultEmail = Boolean(state.email);

  return (
    <main className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex flex-col justify-center gap-3">
        <Badge variant="secondary" className="w-fit">
          {hasDefaultEmail ? "Đăng ký thành viên" : "Hệ thống quản lý ca làm"}
        </Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-normal sm:text-5xl">
          {hasDefaultEmail 
            ? "Một bước cuối để bắt đầu công việc của bạn."
            : "Đăng nhập bằng tài khoản Google để tiếp tục."}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {hasDefaultEmail
            ? "Vui lòng nhập Họ tên chính xác để quản lý ghi nhận lịch làm việc và tính lương cho bạn."
            : "Hệ thống sử dụng tài khoản Google để điểm danh và đăng ký lịch làm trực tiếp qua Google Sheets."}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{hasDefaultEmail ? "Hoàn tất đăng ký" : "Đăng nhập"}</CardTitle>
          <CardDescription>
            {hasDefaultEmail 
              ? "Bổ sung thông tin cá nhân của bạn." 
              : "Xác thực danh tính của bạn qua dịch vụ Google."}
          </CardDescription>
          <CardAction>
            <Badge variant="outline">{hasDefaultEmail ? "Bước 2/2" : "Bước 1/2"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasDefaultEmail ? (
            // BƯỚC 1: Chỉ hiện nút đăng nhập Google
            <div className="py-4">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 h-12 border-muted-foreground/20 hover:bg-muted text-base font-semibold cursor-pointer"
                onClick={() => signIn("google")}
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Đăng nhập bằng Google
              </Button>
            </div>
          ) : (
            // BƯỚC 2: Chỉ hiện form nhập họ tên
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit(name, state.email);
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="signup-name">Họ tên của bạn</FieldLabel>
                  <Input
                    id="signup-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn Đạt"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="signup-email">Email Google</FieldLabel>
                  <Input 
                    id="signup-email" 
                    value={state.email} 
                    disabled 
                  />
                </Field>
                <Button type="submit" className="w-full h-11 text-base font-semibold mt-2 cursor-pointer">
                  <UserPlusIcon data-icon="inline-start" />
                  Hoàn tất đăng ký
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

