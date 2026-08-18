import { PUBLIC_FORM_INVALID_MESSAGE } from "@/lib/constants";

export function InvalidFormLink() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Link ongeldig</h1>
      <p className="text-neutral-600">{PUBLIC_FORM_INVALID_MESSAGE}</p>
    </section>
  );
}
