import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/panels';
import { ProductForm } from './_components/product-form';
import { requireUser } from '@/server/auth/rbac';
import { db } from '@/server/db/client';

export const metadata: Metadata = {
  title: 'Novo produto',
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  const user = await requireUser();

  if (!user.roles.includes('CREATOR') && !user.roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  const categories = await db.category.findMany({
    where: { parentId: null },
    select: { id: true, name: true },
    orderBy: { position: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Publicar um produto"
        description="Descreva o que a solução resolve, o que ela exige e quanto custa. A revisão da equipe leva até 3 dias úteis."
      />

      <div className="mt-8 max-w-[760px]">
        <ProductForm categories={categories} />
      </div>
    </>
  );
}
