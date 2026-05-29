const domain = process.env.OPENBACKEND_DOMAIN ?? process.argv[2];
const expectedStatus = Number(process.env.OPENBACKEND_TLS_EXPECT_STATUS ?? "200");

if (!domain) {
  console.error("[error] Provide a real DNS-backed domain:");
  console.error("[error] OPENBACKEND_DOMAIN=backend.example.com npm run smoke:tls");
  process.exit(1);
}

const url = `https://${domain.replace(/^https?:\/\//, "")}/health`;
const response = await fetch(url);
const body = await response.text();

if (response.status !== expectedStatus) {
  console.error(`[error] ${url} returned ${response.status}, expected ${expectedStatus}`);
  console.error(body);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  console.error(`[error] ${url} did not return JSON`);
  console.error(body);
  process.exit(1);
}

if (!parsed.ok || parsed.name !== "openbackend") {
  console.error(`[error] ${url} did not return OpenBackend health JSON`);
  console.error(body);
  process.exit(1);
}

console.log(`[info] TLS smoke passed for ${url}`);

