"use client";

import { TAG_CATEGORIES } from "@/lib/music/tags";

export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(value);

  function toggle(tag: string, multi: boolean, categoryTags: string[]) {
    const next = new Set(selected);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      if (!multi) {
        for (const t of categoryTags) next.delete(t);
      }
      next.add(tag);
    }
    // Preserve catalog order.
    onChange(
      TAG_CATEGORIES.flatMap((c) => c.tags).filter((t) => next.has(t)),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-neutral-300">
          Style tags{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Clear
          </button>
        )}
      </div>

      {TAG_CATEGORIES.map((category) => (
        <div key={category.key}>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-500">
            {category.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {category.tags.map((tag) => {
              const isSelected = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    toggle(tag, category.multi, category.tags)
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-neutral-700 bg-neutral-950 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
