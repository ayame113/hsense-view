import * as hex from "https://deno.land/std@0.144.0/encoding/hex.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** SHA-256を使用して文字列をハッシュ化します。 */
export async function hash(message: string) {
  // 文字列をUint8Arrayに変換
  const encoded = encoder.encode(message);
  // SHA-256でハッシュ化
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  // 16進数文字列のUint8Arrayに変換
  const hashed = hex.encode(new Uint8Array(hashBuffer));
  // Uint8Arrayを文字列に変換
  return decoder.decode(hashed);
}

/** deno deployで実行されているかどうかを判定 */
export function isDeploy() {
  try {
    return !!Deno.env.get("DENO_DEPLOYMENT_ID");
  } catch {
    return false;
  }
}
