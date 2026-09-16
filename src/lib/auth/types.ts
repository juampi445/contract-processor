import type { MemberRole } from '@/lib/supabase/database.types';

export type { MemberRole };

/** A company the signed-in user belongs to, with their role in it. */
export interface CompanyMembership {
  id: string;
  slug: string;
  name: string;
  /** Object path inside the company-logos bucket, or null while unset. */
  logoPath: string | null;
  role: MemberRole;
}

export interface CurrentProfile {
  id: string;
  email: string;
  fullName: string | null;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Dueño',
  member: 'Miembro',
};
