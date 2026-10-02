import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { SuggestionForm } from "@/components/site/suggestion-form";

export const metadata: Metadata = { title: "Suggestion box" };

export default function SuggestionPage() {
  return (
    <AdminShell>
      <SuggestionForm />
    </AdminShell>
  );
}
