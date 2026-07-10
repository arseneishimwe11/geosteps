import { AdminApp } from '../../../ui/admin/AdminApp';

export default async function AdminPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <AdminApp venueId={venue} />;
}
