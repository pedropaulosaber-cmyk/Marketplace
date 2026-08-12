import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container, SectionHeading } from '@/components/ui/primitives';
import { DemandForm } from './_components/demand-form';
import { getSession } from '@/server/auth/session';

export const metadata: Metadata = {
  title: 'Publicar demanda',
  description:
    'Descreva o que sua empresa precisa automatizar e receba propostas de ' +
    'profissionais especializados.',
  // A form page has nothing to index and should never rank above the listing.
  robots: { index: false, follow: true },
};

export default async function NewDemandPage() {
  const session = await getSession();

  // Publishing requires an account. Sending them to login with a return path
  // means they land back on this form, not on a generic home page.
  if (!session) {
    redirect(`/login?next=${encodeURIComponent('/demands/new')}`);
  }

  return (
    <Container className="py-14 max-sm:py-8">
      <div className="mx-auto max-w-[720px]">
        <SectionHeading
          eyebrow="Nova demanda"
          title="Descreva o que você precisa automatizar."
          description="Quanto mais claro o problema e o resultado esperado, melhores as propostas que você recebe."
        />

        <DemandForm />
      </div>
    </Container>
  );
}
