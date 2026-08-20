import { describe, expect, it } from "vitest";
import { hasCompleteGeometry, pdfRectToCssBox } from "@/lib/pdf-geometry";

describe("pdfRectToCssBox", () => {
  it("flips the Y axis from PDF bottom-left to CSS top-left", () => {
    const box = pdfRectToCssBox(
      { x: 50, y: 700, width: 200, height: 20 },
      { pageWidth: 595, pageHeight: 842 },
      { width: 595, height: 842 },
    );

    expect(box.left).toBe(50);
    expect(box.width).toBe(200);
    expect(box.height).toBe(20);
    expect(box.top).toBe(842 - 700 - 20);
  });

  it("scales proportionally to the displayed page size", () => {
    const box = pdfRectToCssBox(
      { x: 100, y: 100, width: 50, height: 10 },
      { pageWidth: 200, pageHeight: 400 },
      { width: 400, height: 800 },
    );

    expect(box).toEqual({
      left: 200,
      top: (400 - 100 - 10) * 2,
      width: 100,
      height: 20,
    });
  });
});

describe("hasCompleteGeometry", () => {
  it("requires all geometry values to be present and positive", () => {
    expect(
      hasCompleteGeometry({
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        pageWidth: 595,
        pageHeight: 842,
      }),
    ).toBe(true);

    expect(
      hasCompleteGeometry({
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        pageWidth: null,
        pageHeight: 842,
      }),
    ).toBe(false);
  });
});
