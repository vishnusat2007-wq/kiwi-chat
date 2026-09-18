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
      <circle cx="16" cy="16" r="7.6" fill="#E7F8A4" />
      <ellipse cx="16" cy="16" rx="3.4" ry="3.8" fill="#F8F3D2" />
      <circle cx="16" cy="12.4" r="0.7" fill="#16140C" />
      <circle cx="19.2" cy="13.6" r="0.7" fill="#16140C" />
      <circle cx="20" cy="16.6" r="0.7" fill="#16140C" />
      <circle cx="18.4" cy="19.2" r="0.7" fill="#16140C" />
      <circle cx="15.2" cy="19.6" r="0.7" fill="#16140C" />
      <circle cx="12.6" cy="17.6" r="0.7" fill="#16140C" />
      <circle cx="12.4" cy="14.6" r="0.7" fill="#16140C" />
      <circle cx="14.2" cy="12.8" r="0.7" fill="#16140C" />
    </svg>
  );
}
