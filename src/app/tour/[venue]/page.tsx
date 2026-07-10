import { TourApp } from '../../../ui/tour/TourApp';

export default async function TourPage({ params }: { params: Promise<{ venue: string }> }) {
  const { venue } = await params;
  return <TourApp venueId={venue} />;
}
