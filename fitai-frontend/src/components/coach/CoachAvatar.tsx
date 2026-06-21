// src/components/coach/CoachAvatar.tsx
// Shows a coach's profile photo, or their first initial when there's no photo.

export function CoachAvatar({
  src,
  name,
  size = 56,
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`shrink-0 rounded-2xl object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand-purple/20 font-black text-brand-purple ${className}`}
    >
      {name?.[0] ?? "؟"}
    </div>
  );
}
