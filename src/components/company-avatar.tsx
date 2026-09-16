import { companyLogoUrl } from '@/lib/company-logo';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';

/**
 * A company's logo, falling back to its initials. Square rather than round:
 * logos are usually drawn on a square canvas and a circle crops their corners.
 */
const SIZES = {
  sm: 'size-6 rounded-md text-[0.625rem]',
  md: 'size-8 rounded-lg text-xs',
  lg: 'size-10 rounded-lg text-xs',
  xl: 'size-16 rounded-xl text-lg',
} as const;

const TONES = {
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
} as const;

export function CompanyAvatar({
  name,
  logoPath,
  size = 'md',
  tone = 'accent',
  className,
}: {
  name: string;
  logoPath?: string | null;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const url = companyLogoUrl(logoPath);

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-semibold',
        SIZES[size],
        // The tinted background only shows through for the initials fallback;
        // a logo covers it completely.
        url ? 'border border-border bg-card' : TONES[tone],
        className,
      )}
    >
      {url ? (
        /* Plain img on purpose: these are tiny, already sized by the container,
           and next/image would need the Supabase host in remotePatterns. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
