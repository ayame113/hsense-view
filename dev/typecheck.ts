// deno-lint-ignore-file
import type {} from "https://deno.land/x/deploy@0.5.0/types/deploy.ns.d.ts";
import type {} from "https://deno.land/x/deploy@0.5.0/types/deploy.window.d.ts";
import type {} from "https://deno.land/x/deploy@0.5.0/types/deploy.fetchevent.d.ts";
import "../serve.ts";

//copy from denokand/deno
declare global {
  namespace Deno {
    /** A set of error constructors that are raised by Deno APIs. */
    export namespace errors {
      export class NotFound extends Error {}
      export class PermissionDenied extends Error {}
      export class ConnectionRefused extends Error {}
      export class ConnectionReset extends Error {}
      export class ConnectionAborted extends Error {}
      export class NotConnected extends Error {}
      export class AddrInUse extends Error {}
      export class AddrNotAvailable extends Error {}
      export class BrokenPipe extends Error {}
      export class AlreadyExists extends Error {}
      export class InvalidData extends Error {}
      export class TimedOut extends Error {}
      export class Interrupted extends Error {}
      export class WriteZero extends Error {}
      export class UnexpectedEof extends Error {}
      export class BadResource extends Error {}
      export class Http extends Error {}
      export class Busy extends Error {}
    }
  }

  var crypto: Crypto;

  interface Algorithm {
    name: string;
  }

  interface KeyAlgorithm {
    name: string;
  }

  type AlgorithmIdentifier = string | Algorithm;
  type HashAlgorithmIdentifier = AlgorithmIdentifier;
  type KeyType = "private" | "public" | "secret";
  type KeyUsage =
    | "decrypt"
    | "deriveBits"
    | "deriveKey"
    | "encrypt"
    | "sign"
    | "unwrapKey"
    | "verify"
    | "wrapKey";
  type KeyFormat = "jwk" | "pkcs8" | "raw" | "spki";
  type NamedCurve = string;

  interface RsaOtherPrimesInfo {
    d?: string;
    r?: string;
    t?: string;
  }

  interface JsonWebKey {
    alg?: string;
    crv?: string;
    d?: string;
    dp?: string;
    dq?: string;
    e?: string;
    ext?: boolean;
    k?: string;
    // deno-lint-ignore camelcase
    key_ops?: string[];
    kty?: string;
    n?: string;
    oth?: RsaOtherPrimesInfo[];
    p?: string;
    q?: string;
    qi?: string;
    use?: string;
    x?: string;
    y?: string;
  }

  interface AesCbcParams extends Algorithm {
    iv: BufferSource;
  }

  interface HmacKeyGenParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    length?: number;
  }

  interface EcKeyGenParams extends Algorithm {
    namedCurve: NamedCurve;
  }

  interface EcdsaParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
  }

  interface RsaHashedImportParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
  }

  interface RsaHashedKeyGenParams extends RsaKeyGenParams {
    hash: HashAlgorithmIdentifier;
  }

  interface RsaKeyGenParams extends Algorithm {
    modulusLength: number;
    publicExponent: Uint8Array;
  }

  interface RsaPssParams extends Algorithm {
    saltLength: number;
  }

  interface RsaOaepParams extends Algorithm {
    label?: Uint8Array;
  }

  interface HmacImportParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    length?: number;
  }

  interface EcKeyAlgorithm extends KeyAlgorithm {
    namedCurve: NamedCurve;
  }

  interface HmacKeyAlgorithm extends KeyAlgorithm {
    hash: KeyAlgorithm;
    length: number;
  }

  interface RsaHashedKeyAlgorithm extends RsaKeyAlgorithm {
    hash: KeyAlgorithm;
  }

  interface RsaKeyAlgorithm extends KeyAlgorithm {
    modulusLength: number;
    publicExponent: Uint8Array;
  }

  interface HkdfParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    info: BufferSource;
    salt: BufferSource;
  }

  interface Pbkdf2Params extends Algorithm {
    hash: HashAlgorithmIdentifier;
    iterations: number;
    salt: BufferSource;
  }

  interface AesDerivedKeyParams extends Algorithm {
    length: number;
  }

  interface EcdhKeyDeriveParams extends Algorithm {
    public: CryptoKey;
  }

  interface AesKeyGenParams extends Algorithm {
    length: number;
  }

  interface AesKeyAlgorithm extends KeyAlgorithm {
    length: number;
  }

  /** The CryptoKey dictionary of the Web Crypto API represents a cryptographic key. */
  interface CryptoKey {
    readonly algorithm: KeyAlgorithm;
    readonly extractable: boolean;
    readonly type: KeyType;
    readonly usages: KeyUsage[];
  }

  var CryptoKey: {
    prototype: CryptoKey;
    new (): CryptoKey;
  };

  /** The CryptoKeyPair dictionary of the Web Crypto API represents a key pair for an asymmetric cryptography algorithm, also known as a public-key algorithm. */
  interface CryptoKeyPair {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
  }

  var CryptoKeyPair: {
    prototype: CryptoKeyPair;
    new (): CryptoKeyPair;
  };

  /** This Web Crypto API interface provides a number of low-level cryptographic functions. It is accessed via the Crypto.subtle properties available in a window context (via Window.crypto). */
  interface SubtleCrypto {
    generateKey(
      algorithm: RsaHashedKeyGenParams | EcKeyGenParams,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKeyPair>;
    generateKey(
      algorithm: AesKeyGenParams | HmacKeyGenParams,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey>;
    generateKey(
      algorithm: AlgorithmIdentifier,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKeyPair | CryptoKey>;
    importKey(
      format: "jwk",
      keyData: JsonWebKey,
      algorithm: AlgorithmIdentifier | HmacImportParams,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey>;
    importKey(
      format: Exclude<KeyFormat, "jwk">,
      keyData: BufferSource,
      algorithm: AlgorithmIdentifier | HmacImportParams | RsaHashedImportParams,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey>;
    exportKey(format: "jwk", key: CryptoKey): Promise<JsonWebKey>;
    exportKey(
      format: Exclude<KeyFormat, "jwk">,
      key: CryptoKey,
    ): Promise<ArrayBuffer>;
    sign(
      algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer>;
    verify(
      algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
      key: CryptoKey,
      signature: BufferSource,
      data: BufferSource,
    ): Promise<boolean>;
    digest(
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer>;
    encrypt(
      algorithm: AlgorithmIdentifier | RsaOaepParams | AesCbcParams,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer>;
    decrypt(
      algorithm: AlgorithmIdentifier | RsaOaepParams | AesCbcParams,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer>;
    deriveBits(
      algorithm:
        | AlgorithmIdentifier
        | HkdfParams
        | Pbkdf2Params
        | EcdhKeyDeriveParams,
      baseKey: CryptoKey,
      length: number,
    ): Promise<ArrayBuffer>;
    deriveKey(
      algorithm: AlgorithmIdentifier | HkdfParams | Pbkdf2Params,
      baseKey: CryptoKey,
      derivedKeyType:
        | AlgorithmIdentifier
        | AesDerivedKeyParams
        | HmacImportParams
        | HkdfParams
        | Pbkdf2Params,
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey>;
    wrapKey(
      format: KeyFormat,
      key: CryptoKey,
      wrappingKey: CryptoKey,
      wrapAlgorithm: AlgorithmIdentifier | RsaOaepParams,
    ): Promise<ArrayBuffer>;
  }

  interface Crypto {
    // @ts-ignore
    readonly subtle: SubtleCrypto;
    getRandomValues<
      T extends
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint16Array
        | Uint32Array
        | Uint8ClampedArray
        | Float32Array
        | Float64Array
        | DataView
        | null,
    >(
      array: T,
    ): T;
    randomUUID(): string;
  }

  var SubtleCrypto: {
    prototype: SubtleCrypto;
    new (): SubtleCrypto;
  };

  interface BroadcastChannelEventMap {
    "message": MessageEvent;
    "messageerror": MessageEvent;
  }

  interface BroadcastChannel extends EventTarget {
    /**
     * Returns the channel name (as passed to the constructor).
     */
    readonly name: string;
    onmessage: ((this: BroadcastChannel, ev: MessageEvent) => any) | null;
    onmessageerror: ((this: BroadcastChannel, ev: MessageEvent) => any) | null;
    /**
     * Closes the BroadcastChannel object, opening it up to garbage collection.
     */
    close(): void;
    /**
     * Sends the given message to other BroadcastChannel objects set up for
     * this channel. Messages can be structured objects, e.g. nested objects
     * and arrays.
     */
    postMessage(message: any): void;
    addEventListener<K extends keyof BroadcastChannelEventMap>(
      type: K,
      listener: (
        this: BroadcastChannel,
        ev: BroadcastChannelEventMap[K],
      ) => any,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof BroadcastChannelEventMap>(
      type: K,
      listener: (
        this: BroadcastChannel,
        ev: BroadcastChannelEventMap[K],
      ) => any,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  var BroadcastChannel: {
    prototype: BroadcastChannel;
    new (name: string): BroadcastChannel;
  };

  interface URLPatternInit {
    protocol?: string;
    username?: string;
    password?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
    baseURL?: string;
  }

  type URLPatternInput = string | URLPatternInit;

  interface URLPatternComponentResult {
    input: string;
    groups: Record<string, string>;
  }

  /** `URLPatternResult` is the object returned from `URLPattern.exec`. */
  interface URLPatternResult {
    /** The inputs provided when matching. */
    inputs: [URLPatternInit] | [URLPatternInit, string];

    /** The matched result for the `protocol` matcher. */
    protocol: URLPatternComponentResult;
    /** The matched result for the `username` matcher. */
    username: URLPatternComponentResult;
    /** The matched result for the `password` matcher. */
    password: URLPatternComponentResult;
    /** The matched result for the `hostname` matcher. */
    hostname: URLPatternComponentResult;
    /** The matched result for the `port` matcher. */
    port: URLPatternComponentResult;
    /** The matched result for the `pathname` matcher. */
    pathname: URLPatternComponentResult;
    /** The matched result for the `search` matcher. */
    search: URLPatternComponentResult;
    /** The matched result for the `hash` matcher. */
    hash: URLPatternComponentResult;
  }

  /**
   * The URLPattern API provides a web platform primitive for matching URLs based
   * on a convenient pattern syntax.
   *
   * The syntax is based on path-to-regexp. Wildcards, named capture groups,
   * regular groups, and group modifiers are all supported.
   *
   * ```ts
   * // Specify the pattern as structured data.
   * const pattern = new URLPattern({ pathname: "/users/:user" });
   * const match = pattern.exec("/users/joe");
   * console.log(match.pathname.groups.user); // joe
   * ```
   *
   * ```ts
   * // Specify a fully qualified string pattern.
   * const pattern = new URLPattern("https://example.com/books/:id");
   * console.log(pattern.test("https://example.com/books/123")); // true
   * console.log(pattern.test("https://deno.land/books/123")); // false
   * ```
   *
   * ```ts
   * // Specify a relative string pattern with a base URL.
   * const pattern = new URLPattern("/:article", "https://blog.example.com");
   * console.log(pattern.test("https://blog.example.com/article")); // true
   * console.log(pattern.test("https://blog.example.com/article/123")); // false
   * ```
   */
  class URLPattern {
    constructor(input: URLPatternInput, baseURL?: string);

    /**
     * Test if the given input matches the stored pattern.
     *
     * The input can either be provided as a url string (with an optional base),
     * or as individual components in the form of an object.
     *
     * ```ts
     * const pattern = new URLPattern("https://example.com/books/:id");
     *
     * // Test a url string.
     * console.log(pattern.test("https://example.com/books/123")); // true
     *
     * // Test a relative url with a base.
     * console.log(pattern.test("/books/123", "https://example.com")); // true
     *
     * // Test an object of url components.
     * console.log(pattern.test({ pathname: "/books/123" })); // true
     * ```
     */
    test(input: URLPatternInput, baseURL?: string): boolean;

    /**
     * Match the given input against the stored pattern.
     *
     * The input can either be provided as a url string (with an optional base),
     * or as individual components in the form of an object.
     *
     * ```ts
     * const pattern = new URLPattern("https://example.com/books/:id");
     *
     * // Match a url string.
     * let match = pattern.exec("https://example.com/books/123");
     * console.log(match.pathname.groups.id); // 123
     *
     * // Match a relative url with a base.
     * match = pattern.exec("/books/123", "https://example.com");
     * console.log(match.pathname.groups.id); // 123
     *
     * // Match an object of url components.
     * match = pattern.exec({ pathname: "/books/123" });
     * console.log(match.pathname.groups.id); // 123
     * ```
     */
    exec(input: URLPatternInput, baseURL?: string): URLPatternResult | null;

    /** The pattern string for the `protocol`. */
    readonly protocol: string;
    /** The pattern string for the `username`. */
    readonly username: string;
    /** The pattern string for the `password`. */
    readonly password: string;
    /** The pattern string for the `hostname`. */
    readonly hostname: string;
    /** The pattern string for the `port`. */
    readonly port: string;
    /** The pattern string for the `pathname`. */
    readonly pathname: string;
    /** The pattern string for the `search`. */
    readonly search: string;
    /** The pattern string for the `hash`. */
    readonly hash: string;
  }
}
