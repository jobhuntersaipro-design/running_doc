"use client";

import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/arc/drawer/drawer";
import inputStyles from "@/components/arc/input/input.module.css";
import { Select } from "@/components/arc/select/select";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { setTheme, useTheme } from "./theme";
import styles from "./site.module.css";

type Me = { name: string; admin: boolean } | null;

const SUGGESTION_EMAIL = "jobhunters.ai.pro@gmail.com";
const SUGGESTION_TYPES = [
  { value: "Feature request", label: "Feature request", hint: "What were you trying to do, what got in the way, and how would the change help you plan or run your race?" },
  { value: "Bug", label: "Bug", hint: "What you did, what you expected, what happened instead, and which race, browser and device you were on." },
  { value: "Other", label: "Other", hint: "A race to add, a question, or anything else. A few sentences of context go a long way." },
];

/** Fills in an email to the team with the runner's suggestion, ready to send from their own mail app. */
function SuggestionBox() {
  const [type, setType] = useState(SUGGESTION_TYPES[0].value);
  return (
    <Drawer>
      <DrawerTrigger className={styles.navLink}>
        <Lightbulb size={16} strokeWidth={1.8} aria-hidden="true" />
        <span className={styles.suggestLabel}>Suggest</span>
      </DrawerTrigger>
      <DrawerContent
        title="Suggestion box"
        description="Help make Running Doc better. Specific suggestions are the easiest to act on: say what you were doing, what happened or what you wanted, and why it matters to you."
      >
        <form
          className={styles.suggestion}
          onSubmit={(event) => {
            event.preventDefault();
            const text = new FormData(event.currentTarget).get("text");
            // ponytail: mailto needs a mail app on the device; send from a server action through an email API (e.g. Resend) if runners report it doing nothing.
            location.href = `mailto:${SUGGESTION_EMAIL}?subject=${encodeURIComponent(`Running Doc: ${type}`)}&body=${encodeURIComponent(`${text}\n\nPage: ${location.href}`)}`;
          }}
        >
          <Select label="Type" options={SUGGESTION_TYPES} value={type} onValueChange={setType} />
          <div className={inputStyles.field}>
            <label className={inputStyles.label} htmlFor="suggestion-text">Your suggestion</label>
            <textarea id="suggestion-text" name="text" className={inputStyles.input} rows={6} required minLength={20} aria-describedby="suggestion-hint" />
            <span id="suggestion-hint" className={inputStyles.description}>{SUGGESTION_TYPES.find((t) => t.value === type)?.hint}</span>
          </div>
          <Button type="submit">Send suggestion</Button>
          <p className={styles.suggestionNote}>
            This opens your email app with your suggestion filled in. No email app? Write to <a href={`mailto:${SUGGESTION_EMAIL}`}>{SUGGESTION_EMAIL}</a>.
          </p>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

export function SiteHeader() {
  const theme = useTheme();
  // undefined while loading, so the link does not flash "Sign in" for signed-in runners.
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<Me>)
      .then(setMe, () => setMe(null));
  }, []);
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the tiny app icon needs no optimizing */}
        <img src="/icon.svg" alt="" width={28} height={28} className={styles.brandIcon} />
        Running Doc
      </Link>
      <div className={styles.actions}>
        <SuggestionBox />
        {me === undefined ? null : (
          <Link href={me ? (me.admin ? "/admin" : "/my") : "/signin"} className={styles.navLink}>
            {me ? (me.admin ? "Admin" : "My races") : "Sign in"}
          </Link>
        )}
        <ThemeSwitch theme={theme} onThemeChange={setTheme} iconOnly label="Switch theme" />
      </div>
    </header>
  );
}
