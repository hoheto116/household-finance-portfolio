export const MAX_LINE_IMAGE_BYTES = 10 * 1024 * 1024
export function tokyoMonth(timestamp = Date.now()) {
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
}
export function parseYen(text: string): number | null {
  const cleaned = text.trim().replace(/円$/, '').replace(/^[¥￥]/, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(cleaned)) return null
  const amount = Number(cleaned.replaceAll(',', ''))
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
}
export function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) return 'image/png'
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp'
  return null
}
export async function verifyLineSignature(raw: Uint8Array, signature: string | undefined, secret: string) {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  const decoded = Uint8Array.from(atob(signature), char=>char.charCodeAt(0))
  return crypto.subtle.verify('HMAC',key,decoded,new Uint8Array(raw))
}
