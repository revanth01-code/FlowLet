import { createHmac } from "node:crypto";

const secret = process.argv[2];
const body = process.argv[3];

console.log("sha256=" + createHmac("sha256", secret).update(body).digest("hex"));