// Prints an ADMIN_PASSWORD_HASH value for the admin login.
// Usage: node scripts/hash-password.mjs   (then type the password; it is not echoed to history)
//    or: printf '%s' 'the password' | node scripts/hash-password.mjs
import { randomBytes, scryptSync } from "node:crypto";

const N = 16384;
async function readPassword() {
  if (process.argv[2]) return process.argv[2];
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}
const password = await readPassword();
if (!password) {
  console.error("No password given.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r: 8, p: 1, maxmem: 256 * N * 8 });
console.log(`scrypt:${N}:${salt.toString("base64")}:${hash.toString("base64")}`);
