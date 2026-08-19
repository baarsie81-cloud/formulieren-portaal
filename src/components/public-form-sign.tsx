"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SIGNATURE_DECLARATION_TEXT } from "@/lib/constants";
import {
  signPublicFormAction,
  type PublicFormState,
} from "@/server/forms/public-actions";

const initialState: PublicFormState = { error: null, saved: false };

export function PublicFormSign({
  token,
  organizationName,
  recipientName,
}: {
  token: string;
  organizationName: string;
  recipientName: string;
}) {
  const [state, formAction, pending] = useActionState(signPublicFormAction, initialState);
  const [method, setMethod] = useState<"drawn" | "typed">("drawn");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [typedName, setTypedName] = useState(recipientName);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || method !== "drawn") {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111111";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, [method]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">{organizationName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ondertekenen</h1>
        <p className="mt-2 text-neutral-600">
          Hallo {recipientName}. Controleer je gegevens en zet je handtekening om het formulier
          definitief af te ronden.
        </p>
      </div>

      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="signatureDataUrl" value="" id="signature-data-url" readOnly />

        <div className="flex flex-col gap-1">
          <label htmlFor="signerName" className="text-sm font-medium text-neutral-800">
            Naam voor ondertekening
          </label>
          <input
            id="signerName"
            name="signerName"
            type="text"
            required
            defaultValue={recipientName}
            maxLength={200}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-800">Handtekening</p>
          <div className="flex flex-wrap gap-2">
            <MethodButton
              active={method === "drawn"}
              onClick={() => setMethod("drawn")}
              label="Tekenen"
            />
            <MethodButton
              active={method === "typed"}
              onClick={() => setMethod("typed")}
              label="Typen"
            />
          </div>

          {method === "drawn" ? (
            <div className="flex flex-col gap-2">
              <canvas
                ref={canvasRef}
                width={640}
                height={180}
                className="w-full max-w-full touch-none rounded-md border border-neutral-300 bg-white"
                onPointerDown={(event) => startDrawing(event, canvasRef, setDrawing, setHasStroke)}
                onPointerMove={(event) => drawStroke(event, canvasRef, drawing)}
                onPointerUp={() => setDrawing(false)}
                onPointerLeave={() => setDrawing(false)}
              />
              <button
                type="button"
                onClick={() => clearCanvas(canvasRef, setHasStroke)}
                className="self-start text-sm text-neutral-600 underline"
              >
                Handtekening wissen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="typedSignature" className="text-sm text-neutral-700">
                Typ je naam zoals die op het document moet verschijnen
              </label>
              <input
                id="typedSignature"
                type="text"
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                maxLength={200}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
              <TypedSignaturePreview name={typedName} />
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input name="acceptedDeclaration" type="checkbox" required className="mt-0.5" />
          <span>{SIGNATURE_DECLARATION_TEXT}</span>
        </label>

        <button
          type="submit"
          disabled={pending}
          onClick={(event) => {
            const input = document.getElementById("signature-data-url") as HTMLInputElement | null;

            if (!input) {
              return;
            }

            try {
              input.value =
                method === "drawn"
                  ? exportDrawnSignature(canvasRef, hasStroke)
                  : exportTypedSignature(typedName);
            } catch (error) {
              event.preventDefault();
              alert(error instanceof Error ? error.message : "Handtekening ontbreekt");
            }
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Afronden…" : "Definitief ondertekenen"}
        </button>
      </form>
    </section>
  );
}

function MethodButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800"
      }
    >
      {label}
    </button>
  );
}

function TypedSignaturePreview({ name }: { name: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-3xl text-neutral-900 italic">
      {name.trim() || "Jouw naam"}
    </div>
  );
}

function startDrawing(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setDrawing: (value: boolean) => void,
  setHasStroke: (value: boolean) => void,
) {
  const canvas = canvasRef.current;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  setDrawing(true);
  setHasStroke(true);

  const point = pointerPoint(event, canvas);
  context.beginPath();
  context.moveTo(point.x, point.y);
}

function drawStroke(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  drawing: boolean,
) {
  if (!drawing) {
    return;
  }

  const canvas = canvasRef.current;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return;
  }

  const point = pointerPoint(event, canvas);
  context.lineTo(point.x, point.y);
  context.stroke();
}

function pointerPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function clearCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setHasStroke: (value: boolean) => void,
) {
  const canvas = canvasRef.current;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  setHasStroke(false);
}

function exportDrawnSignature(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hasStroke: boolean,
): string {
  if (!hasStroke) {
    throw new Error("Teken eerst je handtekening");
  }

  const canvas = canvasRef.current;

  if (!canvas) {
    throw new Error("Handtekening ontbreekt");
  }

  return canvas.toDataURL("image/png");
}

function exportTypedSignature(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    throw new Error("Vul je naam in voor de getypte handtekening");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Handtekening kon niet worden gemaakt");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111111";
  context.font = "italic 48px Georgia, 'Times New Roman', serif";
  context.textBaseline = "middle";
  context.fillText(trimmed, 24, canvas.height / 2);

  return canvas.toDataURL("image/png");
}
