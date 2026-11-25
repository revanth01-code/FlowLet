import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifySignature } from "../src/services/signature.service";

function sign(body: string, secret: string): string {
    return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature", () => {
    const secret = "test-secret";
    const body = '{"event":"order.created"}';

    test("accepts a correctly signed body", () => {
        expect(verifySignature(body, sign(body, secret), secret)).toBe(true);
    });

    test("rejects a wrong secret", () => {
        expect(verifySignature(body, sign(body, "wrong-secret"), secret)).toBe(false);
    });

    test("rejects a tampered body", () => {
        const sig = sign(body, secret);
        expect(verifySignature('{"event":"order.cancelled"}', sig, secret)).toBe(false);
    });

    test("rejects a missing header", () => {
        expect(verifySignature(body, undefined, secret)).toBe(false);
    });

    test("rejects a header missing the sha256= prefix", () => {
        const rawHex = createHmac("sha256", secret).update(body).digest("hex");
        expect(verifySignature(body, rawHex, secret)).toBe(false);
    });
});