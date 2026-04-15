/**
 * AdSense placeholder. To activate:
 * 1. Replace XXXXXXXXXXXXXXXX with your AdSense publisher ID (ca-pub-XXXX)
 * 2. Replace XXXXXXXXXX with your ad slot ID
 * 3. Add the AdSense <script> to index.html
 * 4. Call (adsbygoogle = window.adsbygoogle || []).push({}) after mount
 */
const AD_ENABLED = false  // flip to true when AdSense is configured

export function AdSlot() {
  if (!AD_ENABLED) return null
  return (
    <div className="w-full min-h-[250px] rounded-xl overflow-hidden">
      <ins
        className="adsbygoogle block w-full min-h-[250px]"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
