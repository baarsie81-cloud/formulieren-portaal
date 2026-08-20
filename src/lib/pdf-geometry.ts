export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageSize = {
  pageWidth: number;
  pageHeight: number;
};

export type CssBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Converts a PDF rectangle (origin bottom-left) to a CSS box (origin top-left)
 * within a displayed page of the given pixel size.
 */
export function pdfRectToCssBox(
  rect: PdfRect,
  page: PdfPageSize,
  display: { width: number; height: number },
): CssBox {
  if (page.pageWidth <= 0 || page.pageHeight <= 0) {
    throw new Error("pageWidth and pageHeight must be positive");
  }

  if (display.width <= 0 || display.height <= 0) {
    throw new Error("display width and height must be positive");
  }

  const scaleX = display.width / page.pageWidth;
  const scaleY = display.height / page.pageHeight;

  return {
    left: rect.x * scaleX,
    top: (page.pageHeight - rect.y - rect.height) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

export function hasCompleteGeometry(field: {
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  pageWidth: number | null;
  pageHeight: number | null;
}): field is {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
} {
  return (
    field.x != null &&
    field.y != null &&
    field.width != null &&
    field.height != null &&
    field.pageWidth != null &&
    field.pageHeight != null &&
    field.width > 0 &&
    field.height > 0 &&
    field.pageWidth > 0 &&
    field.pageHeight > 0
  );
}
