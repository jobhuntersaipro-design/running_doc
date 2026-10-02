"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, FileText, Globe } from "lucide-react";
import type { RaceFile } from "@/lib/courses/types";
import type { LinkPreview } from "@/lib/server/link-preview";
import styles from "./planner.module.css";

/** Draws the first page of a PDF, so the route map shows on phones that cannot show PDFs inline. */
function PdfPreview({ href }: { href: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The legacy build carries polyfills; the modern one needs JS features many phones lack.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ url: href }).promise;
      const page = await doc.getPage(1);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const width = (canvas.parentElement?.clientWidth || 480) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      if (!cancelled) setState("ready");
      void doc.cleanup();
    })().catch((e) => {
      console.warn("Route map preview failed", e);
      if (!cancelled) setState("failed");
    });
    return () => {
      cancelled = true;
    };
  }, [href]);
  return (
    <span className={styles.resourceMedia} data-state={state}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {state !== "ready" ? <FileText size={28} strokeWidth={1.5} aria-hidden="true" /> : null}
    </span>
  );
}

/** The race's official website and route map as preview cards, plus the files to download. */
export function RaceResources({ officialUrl, files, preview }: { officialUrl: string; files: RaceFile[]; preview: LinkPreview | null }) {
  const host = new URL(officialUrl).hostname.replace(/^www\./, "");
  const map = files.find((f) => f.kind === "pdf");
  return (
    <div className={styles.resources}>
      <a href={officialUrl} target="_blank" rel="noreferrer" className={styles.resourceCard}>
        <span className={styles.resourceMedia}>
          {preview?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <Globe size={28} strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>
        <span className={styles.resourceBody}>
          <span className={styles.resourceLabel}>Official website, {host}</span>
          <span className={styles.resourceTitle}>{preview?.title ?? host}</span>
          {preview?.description ? <span className={styles.resourceDesc}>{preview.description}</span> : null}
        </span>
      </a>

      {map ? (
        <a href={map.href} target="_blank" rel="noreferrer" className={styles.resourceCard}>
          <PdfPreview href={map.href} />
          <span className={styles.resourceBody}>
            <span className={styles.resourceLabel}>Route map, PDF</span>
            <span className={styles.resourceTitle}>{map.label.replace(/ \(PDF\)$/, "")}</span>
            <span className={styles.resourceDesc}>Opens the full map in a new tab.</span>
          </span>
        </a>
      ) : null}

      <ul className={styles.raceLinks}>
        {files.map((f) => (
          <li key={f.href}>
            <a href={f.href} download className={styles.raceLink}>
              <FileDown size={16} strokeWidth={1.75} aria-hidden="true" />
              Download {f.label.replace(/^Course /, "course ").replace(/^Official /, "official ")}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
