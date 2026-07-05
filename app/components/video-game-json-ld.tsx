import { JsonLd } from '@/app/components/json-ld'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { getVideoGameJsonLd } from '@/lib/seo'

export async function VideoGameJsonLd() {
  const metadataBase = await getRequestMetadataBase()
  return <JsonLd data={getVideoGameJsonLd(metadataBase, '/play')} />
}
