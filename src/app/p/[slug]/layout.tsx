import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('groups')
    .select('name, description')
    .eq('public_slug', slug)
    .single()

  if (!group) {
    return {
      title: 'Grupo não encontrado | PeladeiroPro',
    }
  }

  const title = `${group.name} | PeladeiroPro`
  const description =
    group.description ||
    `Acompanhe a prestação de contas do grupo ${group.name} no PeladeiroPro`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'PeladeiroPro',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function SlugLayout({ children }: Props) {
  return children
}
