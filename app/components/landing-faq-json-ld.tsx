import { JsonLd } from '@/app/components/json-ld'
import { getFaqPageJsonLd } from '@/lib/seo'

export function LandingFaqJsonLd() {
  return <JsonLd data={getFaqPageJsonLd()} />
}
