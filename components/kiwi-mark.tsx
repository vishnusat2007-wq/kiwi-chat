export function KiwiMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="10" fill="#141C15" />
      <circle cx="16" cy="16" r="11" fill="#C6F155" />
      <circle cx="16" cy="16" r="7.4" fill="#E7F8A4" />
      <ellipse cx="16" cy="16" rx="3.1" ry="3.5" fill="#F8F3D2" />
      <circle cx="14.2" cy="14.5" r="0.9" fill="#16140C" />
      <circle cx="17.8" cy="14.7" r="0.9" fill="#16140C" />
      <circle cx="16" cy="17.6" r="0.9" fill="#16140C" />
      <circle cx="13.7" cy="17.2" r="0.7" fill="#16140C" />
      <circle cx="18.3" cy="17.1" r="0.7" fill="#16140C" />
    </svg>
  );
}
