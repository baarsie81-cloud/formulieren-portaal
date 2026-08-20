"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import { pdfRectToCssBox } from "@/lib/pdf-geometry";
import {
  pickOverlayInputFields,
  type OverlayInputField,
} from "@/lib/pdf-overlay-fields";
import type { FieldValueMap } from "@/server/pdf/fill";

export { pickOverlayInputFields, pickOverlayInputFields as pickOverlayTextFields };
export type { OverlayInputField, OverlayInputField as OverlayTextField };

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PublicPdfPageOverlay(props: {
  pdfUrl: string;
  fields: OverlayInputField[];
  values: FieldValueMap;
  onError?: () => void;
}) {
  // Remount on URL change so load state resets without sync setState-in-effect.
  return <PublicPdfPageOverlayInner key={props.pdfUrl} {...props} />;
}

function PublicPdfPageOverlayInner({
  pdfUrl,
  fields,
  values,
  onError,
}: {
  pdfUrl: string;
  fields: OverlayInputField[];
  values: FieldValueMap;
  onError?: () => void;
}) {
  const stackRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [paintedPages, setPaintedPages] = useState<ReadonlySet<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const fieldsByPage = new Map<number, OverlayInputField[]>();

  for (const field of fields) {
    const list = fieldsByPage.get(field.pageNumber);

    if (list) {
      list.push(field);
    } else {
      fieldsByPage.set(field.pageNumber, [field]);
    }
  }

  const loading = error == null && (pdf == null || paintedPages.size < pageCount);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    let loadedPdf: PDFDocumentProxy | null = null;

    async function load() {
      try {
        loadingTask = getDocument({ url: pdfUrl, withCredentials: true });
        const nextPdf = await loadingTask.promise;

        if (cancelled) {
          void nextPdf.cleanup();
          return;
        }

        loadedPdf = nextPdf;
        setPdf(nextPdf);
        setPageCount(nextPdf.numPages);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "PDF kon niet worden geladen");
          onErrorRef.current?.();
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      void loadedPdf?.cleanup();
      void loadingTask?.destroy();
    };
  }, [pdfUrl]);

  useEffect(() => {
    const container = stackRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    let frame = 0;

    const applyWidth = (width: number) => {
      const nextWidth = Math.round(width);

      if (nextWidth <= 0) {
        return;
      }

      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    applyWidth(container.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyWidth(entry.contentRect.width);
      });
    });

    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const pdfReady = pdf != null;

  return (
    <div className="overflow-auto rounded-md border border-neutral-200 bg-neutral-100">
      {loading ? (
        <p className="px-3 py-2 text-sm text-neutral-600">PDF laden…</p>
      ) : null}
      {error ? (
        <p className="px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div ref={stackRef} className="flex w-full flex-col gap-4 bg-neutral-100 p-2">
        {pdfReady && containerWidth > 0
          ? pageNumbers.map((pageNumber) => (
              <PdfOverlayPage
                key={pageNumber}
                pdf={pdf}
                pageNumber={pageNumber}
                containerWidth={containerWidth}
                fields={fieldsByPage.get(pageNumber) ?? []}
                values={values}
                onPainted={() => {
                  setPaintedPages((current) => {
                    if (current.has(pageNumber)) {
                      return current;
                    }

                    const next = new Set(current);
                    next.add(pageNumber);
                    return next;
                  });
                }}
                onError={(message) => {
                  setError(message);
                  onErrorRef.current?.();
                }}
              />
            ))
          : null}
      </div>
    </div>
  );
}

function PdfOverlayPage({
  pdf,
  pageNumber,
  containerWidth,
  fields,
  values,
  onPainted,
  onError,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  containerWidth: number;
  fields: OverlayInputField[];
  values: FieldValueMap;
  onPainted: () => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onPaintedRef = useRef(onPainted);
  const onErrorRef = useRef(onError);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    onPaintedRef.current = onPainted;
  }, [onPainted]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!pdf || containerWidth <= 0) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const width = containerWidth;
    const doc: PDFDocumentProxy = pdf;
    const target: HTMLCanvasElement = canvas;

    async function paint() {
      try {
        const page = await doc.getPage(pageNumber);

        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const context = target.getContext("2d");

        if (!context) {
          throw new Error("Canvas niet beschikbaar");
        }

        target.width = viewport.width;
        target.height = viewport.height;
        target.style.width = `${width}px`;
        target.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvas: target,
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;

        if (!cancelled) {
          setDisplaySize({ width, height: viewport.height });
          onPaintedRef.current();
        }
      } catch (renderError) {
        if (cancelled) {
          return;
        }

        const message =
          renderError instanceof Error ? renderError.message : "PDF kon niet worden geladen";

        if (/cancel/i.test(message)) {
          return;
        }

        onErrorRef.current(message);
      }
    }

    void paint();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, containerWidth]);

  return (
    <div className="relative mx-auto w-full bg-white shadow-sm">
      <canvas ref={canvasRef} className="block" />
      {displaySize
        ? fields.map((field) => (
            <OverlayFieldInput
              key={field.valueKey}
              field={field}
              values={values}
              displaySize={displaySize}
            />
          ))
        : null}
    </div>
  );
}

function OverlayFieldInput({
  field,
  values,
  displaySize,
}: {
  field: OverlayInputField;
  values: FieldValueMap;
  displaySize: { width: number; height: number };
}) {
  const box = pdfRectToCssBox(
    {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    },
    { pageWidth: field.pageWidth, pageHeight: field.pageHeight },
    displaySize,
  );
  const defaultValue = values[field.valueKey];
  const style = {
    left: box.left,
    top: box.top,
    width: Math.max(box.width, 24),
    height: Math.max(box.height, 18),
  };
  const className =
    "absolute box-border border border-sky-500 bg-white/90 px-1 text-sm outline-none focus:border-neutral-900";
  const stringValue = typeof defaultValue === "string" ? defaultValue : "";

  if (field.fieldType === "checkbox") {
    const size = Math.max(Math.min(box.width, box.height), 16);

    return (
      <input
        id={`overlay-${field.valueKey}`}
        name={field.valueKey}
        type="checkbox"
        required={field.isRequired}
        defaultChecked={defaultValue === true || defaultValue === "true"}
        aria-label={field.valueKey}
        className="absolute m-0 accent-neutral-900"
        style={{
          left: box.left + (box.width - size) / 2,
          top: box.top + (box.height - size) / 2,
          width: size,
          height: size,
        }}
      />
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <textarea
        id={`overlay-${field.valueKey}`}
        name={field.valueKey}
        required={field.isRequired}
        defaultValue={stringValue}
        aria-label={field.valueKey}
        className={className}
        style={style}
      />
    );
  }

  if (field.fieldType === "date") {
    return (
      <input
        id={`overlay-${field.valueKey}`}
        name={field.valueKey}
        type="date"
        required={field.isRequired}
        defaultValue={stringValue}
        aria-label={field.valueKey}
        className={className}
        style={style}
      />
    );
  }

  if (field.fieldType === "number") {
    return (
      <input
        id={`overlay-${field.valueKey}`}
        name={field.valueKey}
        type="text"
        inputMode="decimal"
        required={field.isRequired}
        defaultValue={stringValue}
        aria-label={field.valueKey}
        className={className}
        style={style}
      />
    );
  }

  return (
    <input
      id={`overlay-${field.valueKey}`}
      name={field.valueKey}
      type="text"
      required={field.isRequired}
      defaultValue={stringValue}
      aria-label={field.valueKey}
      className={className}
      style={style}
    />
  );
}
