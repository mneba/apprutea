import RegistroClient from './RegistroClient';

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const params = await searchParams;
  return <RegistroClient tokenConvite={params?.convite} />;
}