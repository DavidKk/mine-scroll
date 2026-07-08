import { getLlmsTxt } from '@/lib/llms'
import { getRequestMetadataBase } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const { origin } = await getRequestMetadataBase()

  return new Response(getLlmsTxt(origin), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
