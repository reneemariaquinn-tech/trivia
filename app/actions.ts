/**
 * @packageDocumentation
 * Shared server actions used across multiple admin pages.
 */
'use server';

/**
 * Searches for images from Pexels or Wikimedia Commons and returns a normalised result set.
 *
 * **Pexels:** Returns up to 6 landscape photos. Requires `PEXELS_API_KEY` environment variable.
 *
 * **Wikimedia Commons:** Returns up to 6 images from the File namespace. Portrait images are
 * capped at 1000px wide to avoid oversized downloads.
 *
 * Results from both providers are normalised to `{ url, photographer, source }` objects
 * so the UI can treat them identically.
 *
 * @param query - Search term (e.g. `"Sydney Opera House"`)
 * @param provider - Image source: `'pexels'` or `'wikimedia'`
 * @returns Array of image result objects, or an empty array if none are found.
 */
export async function searchImages(query: string, provider: 'pexels' | 'wikimedia') {
  try {
    if (provider === 'pexels') {
      if (!process.env.PEXELS_API_KEY) {
        console.warn('Pexels API Key missing');
        return [];
      }
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`, {
        headers: { Authorization: process.env.PEXELS_API_KEY }
      });
      const data = await res.json();
      console.log('Pexels status:', res.status, 'photos:', data.photos?.length ?? data);
      if (!data.photos) return [];
      
      return data.photos.map((p: any) => ({
        url: p.src.large2x || p.src.large,
        photographer: p.photographer,
        source: 'Pexels'
      }));
    } 
    
    if (provider === 'wikimedia') {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6', // File namespace
        gsrlimit: '12',
        gsrsearch: query,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|user|size',
        iiurlwidth: '1880',
        origin: '*'
      });
      
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      const data = await res.json();
      if (!data.query || !data.query.pages) return [];
      
      return Object.values(data.query.pages).map((p: any) => {
        const info = p.imageinfo?.[0];
        if (!info) return null;

        let imageUrl = info.thumburl || info.url;

        // Optimize for portrait: max 1000px wide
        if (info.height && info.width && info.height > info.width) {
          imageUrl = imageUrl.replace(/\/(\d+)px-/, (match: string, width: string) => {
            return parseInt(width) > 1000 ? '/1000px-' : match;
          });
        }

        return {
          url: imageUrl,
          photographer: info?.user || 'Wikimedia Commons',
          source: 'Wikimedia Commons'
        };
      }).filter((img: any) => img && img.url);
    }

    return [];
  } catch (e) {
    console.error('Image search failed:', e);
    return [];
  }
}