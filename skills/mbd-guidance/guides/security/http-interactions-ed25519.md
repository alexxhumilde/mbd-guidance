---
id: http-interactions-ed25519
title: Serverless HTTP Interactions & Ed25519 Signature Verification
category: security
description: Implement Discord HTTP Interactions endpoints securely in Cloudflare Workers, Next.js App Router, or Node.js using Web Crypto Ed25519 signature verification, raw body bytes, PING handling, and waitUntil deferred responses.
tags: [http, interactions, serverless, cloudflare, workers, nextjs, ed25519, signature, crypto, waitUntil, ping]
apiVersion: v10
ecosystems: [Cloudflare Workers, Next.js App Router, Node.js 20+, Discord API v10]
---

When receiving Discord interactions via an **HTTP Endpoint** (instead of a WebSocket Gateway), Discord requires **Ed25519 cryptographic signature verification** on every incoming request. Unverified endpoints fail Discord's security checks and allow arbitrary forged command payloads.

## Critical Security Rules

1. **Verify against exact `rawBody` bytes**: **Never** run `JSON.parse(body)` and re-serialize with `JSON.stringify(...)` before verifying—any whitespace or key-ordering difference breaks the signature. Read `await request.text()` or `await request.arrayBuffer()` once.
2. **Required headers**: Extract `X-Signature-Ed25519` (64-byte hex) and `X-Signature-Timestamp`. Reject missing headers immediately with `401 Unauthorized`.
3. **Exact signed message concatenation**: Discord signs `UTF8(timestamp) + rawBodyBytes`.
4. **Mandatory `PING` (`type: 1`) handling**: Only after verification succeeds, if `interaction.type === 1`, return `200 OK` with `{ "type": 1 }`. Discord periodically sends invalid-signature pings to verify your endpoint rejects tampering with `401`.
5. **Async background work via `waitUntil()`**: In serverless runtimes (Cloudflare Workers, Vercel), return `{ type: 5 }` (*DeferredChannelMessageWithSource*) immediately and finish work inside `ctx.waitUntil(...)`, posting the follow-up via `PATCH /webhooks/{app_id}/{token}/messages/@original`.

## Zero-Dependency Web Crypto Implementation (Workers / Next.js / Node 20+)

```ts
const encoder = new TextEncoder();

function hexToUint8Array(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function verifyDiscordSignature(
  request: Request,
  publicKeyHex: string
): Promise<{ valid: boolean; rawBody: string }> {
  const signatureHex = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signatureHex || !timestamp) {
    return { valid: false, rawBody: '' };
  }

  const signature = hexToUint8Array(signatureHex);
  const publicKeyBytes = hexToUint8Array(publicKeyHex);
  if (!signature || !publicKeyBytes || signature.length !== 64 || publicKeyBytes.length !== 32) {
    return { valid: false, rawBody: '' };
  }

  const rawBody = await request.text();
  const message = encoder.encode(timestamp + rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify('Ed25519', cryptoKey, signature, message);
  return { valid, rawBody };
}
```

## Request Handler Pattern

```ts
export async function handleInteractionRequest(
  request: Request,
  env: { DISCORD_PUBLIC_KEY: string },
  waitUntil?: (promise: Promise<unknown>) => void
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { valid, rawBody } = await verifyDiscordSignature(request, env.DISCORD_PUBLIC_KEY);
  if (!valid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  if (interaction.type === 2 && interaction.data?.name === 'ping') {
    return Response.json({
      type: 4,
      data: {
        content: 'Pong from HTTP Interactions.',
        flags: 64, // MessageFlags.Ephemeral
        allowed_mentions: { parse: [] },
      },
    });
  }

  return new Response('Unhandled interaction', { status: 400 });
}
```
