import { redirect } from 'next/navigation';

export default async function CompanyHome({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  // The company home is the overview; the tools hang off the sidebar.
  redirect(`/${company}/dashboard`);
}
