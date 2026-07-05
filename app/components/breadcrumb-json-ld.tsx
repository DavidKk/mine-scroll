import { JsonLd } from '@/app/components/json-ld'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { getBreadcrumbJsonLd } from '@/lib/seo'

type BreadcrumbJsonLdProps = {
  items: { name: string; path: string }[]
}

export async function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const metadataBase = await getRequestMetadataBase()
  return <JsonLd data={getBreadcrumbJsonLd(metadataBase, items)} />
}
