import { cn, initials } from '@/lib/utils';

/** Business logo with an initials fallback. */
export function LogoAvatar({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    sm: 'size-8 text-xs rounded-lg',
    md: 'size-10 text-sm rounded-xl',
    lg: 'size-14 text-lg rounded-xl',
    xl: 'size-20 text-2xl rounded-2xl',
  };
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary origin
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn('shrink-0 border border-line bg-surface object-cover', sizes[size], className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-brand-600 font-semibold text-white',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
