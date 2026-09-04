'use client'

/**
 * Kapcsoló, ami valódi checkbox — így az űrlap FormData-jában is megjelenik,
 * és a billentyűzetes kezelés magától működik.
 */
export function Toggle({
  name,
  defaultChecked,
  checked,
  onChange,
  label,
  description,
}: {
  name: string
  defaultChecked?: boolean
  checked?: boolean
  onChange?: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="hint block">{description}</span> : null}
      </span>

      <span className="relative inline-flex shrink-0 pt-0.5">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={(event) => onChange?.(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-line-strong transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        />
        <span
          aria-hidden
          className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-xs transition peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}
