import * as hex from "https://deno.land/std@0.115.1/encoding/hex.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** SHA-256を使用して文字列をハッシュ化します。 */
export async function hash(message: string) {
  const encoded = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return decoder.decode(hex.encode(new Uint8Array(hashBuffer)));
}
