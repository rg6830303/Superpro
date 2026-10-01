import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="wrap max-w-md section">
      <ForgotPasswordForm />
    </div>
  );
}
