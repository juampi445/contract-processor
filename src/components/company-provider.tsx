'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { CompanyMembership } from '@/lib/auth/types';

export const LAST_COMPANY_COOKIE = 'last_company';

const CompanyContext = createContext<CompanyMembership | null>(null);

export function CompanyProvider({
  company,
  children,
}: {
  company: CompanyMembership;
  children: ReactNode;
}) {
  // Remembered so "/" can reopen the last company for users with several.
  useEffect(() => {
    document.cookie = `${LAST_COMPANY_COOKIE}=${encodeURIComponent(company.slug)}; path=/; max-age=31536000; samesite=lax`;
  }, [company.slug]);

  return <CompanyContext.Provider value={company}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyMembership {
  const company = useContext(CompanyContext);
  if (!company) throw new Error('useCompany must be used inside a company route.');
  return company;
}
