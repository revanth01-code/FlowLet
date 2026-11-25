// Working on: HMAC-SHA256 signature verification for incoming webhooks.
// Spec: header is "sha256=<hex HMAC of the RAW request body>", keyed
// with the flow's webhook secret. We use timingSafeEqual to avoid a
// timing side-channel on the comparison.

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

export function verifySignature(
    rawBody: string,
    signatureHeader: string | undefined | null,
    secret: string,
): boolean {
    if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
        return false;
    }

    const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");

    // Hex strings of different lengths would throw in timingSafeEqual,
    // so guard that first rather than letting a malformed header crash the route.
    if (providedHex.length !== expectedHex.length) return false;

    return timingSafeEqual(Buffer.from(providedHex, "hex"), Buffer.from(expectedHex, "hex"));
}