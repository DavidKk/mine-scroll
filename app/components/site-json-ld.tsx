import { JsonLd } from '@/app/components/json-ld'
import { BRAND_LOGO_PATH } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { getOrganizationJsonLd, getWebSiteJsonLd } from '@/lib/seo'
import { preferWebpAssetPath } from '@/lib/server-raster-url'

export async function SiteJsonLd() {
  const metadataBase = await getRequestMetadataBase()
  const logoPath = preferWebpAssetPath(BRAND_LOGO_PATH)

  return (
    <>
      <JsonLd data={getWebSiteJsonLd(metadataBase)} />
      <JsonLd data={getOrganizationJsonLd(metadataBase, logoPath)} />
    </>
  )
}
