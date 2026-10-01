"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { login } from "@/app/admin/actions";
import type { FormState } from "@/app/admin/shared";
import styles from "./admin.module.css";

export function LoginForm() {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(login, {});

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <section className={styles.loginCard} aria-labelledby="login-heading">
      <div className={styles.headText}>
        <h1 id="login-heading" className={styles.title}>
          Sign in
        </h1>
        <p className={styles.lede}>Sign in to add races, upload their files and set the cover on the overview.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input label="Email" name="email" type="email" autoComplete="username" required inputMode="email" />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        {state.error ? (
          <Alert tone="danger" title="Could not sign in">
            {state.error}
          </Alert>
        ) : null}
        <Button type="submit" loading={pending}>
          Sign in
        </Button>
      </form>
    </section>
  );
}
