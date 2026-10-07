# WESTAR Proposal Desk

Public UI: https://whiletrue247.github.io/westar/
Backend: https://westar-proposal-api.tomben49999999.workers.dev
Private source: `whiletrue247/westar-intel` (never deploy its contents to Pages).

## Data boundary

The Pages workflow uploads **only `web/`**. No proposal, contact, email body, allowlist or secret is present in that folder. No Supabase connection or mail API is used.

Formal assistant outputs are published through an explicit `WESTAR_PROPOSAL` envelope. Required provenance: `source.role=assistant`, `source.kind=final_proposal`, `source.action=publish`, conversation/message IDs and original text SHA-256. Required identity: proposal_id/account/title/created_at. Conversation exports, user messages, progress, tools and drafts are rejected. Existing proposals require their current `expected_version` and keep the same ID. This is an explicit publication tool, not a chat scraper or automatic classifier; the operator is responsible for selecting the formally delivered source message. The backend verifies marker, provenance, schema and original body hash again before returning a proposal.

The importer changes neither the body nor embedded original ChatGPT citation/entity tokens. Raw text is rendered using textContent, preserving exact content without executing HTML or inventing source URLs. Mail is a separate prepared artifact. `mailto:` encodes recipients, subject and CRLF body; opening it does not send or mark anything sent.

## Authentication

Cloudflare Access protects **only `/auth/start`** on the backend hostname. Its email OTP verifies first-time identity; a signed Access JWT is verified for issuer, audience and RS256, followed by the private repository's active-member allowlist. An unconfigured auth service fails closed.

After verification the Worker generates a random opaque 30-day session token. Only its SHA-256 is stored in the AuthStore Durable Object; the frontend retains the token in localStorage for persistent login, and keeps proposal data in memory only. The login popup posts the token to the exact Pages origin; the frontend accepts only its own popup and random state. Sessions are fixed 30-day expiry and deleted on logout. Membership is checked on every API call, so removing or deactivating a member revokes access.

Passkeys are created and verified at the backend hostname (its own relying party), with required user verification. Challenges expire after five minutes and are consumed transactionally once; credential counters update transactionally. Public keys, challenges and hashed sessions live in a single private Durable Object, not in the Proposal repository. A daily cleanup removes expired records. Unauthenticated passkey endpoints are rate-limited. Email OTP remains recovery; Google/Microsoft identities may be enabled in Access with their own provider configuration, without mail-send scopes.

Private responses use no-store, private and are not cached. CORS permits only the configured Pages origin; no wildcard, raw token, email API credential or private payload enters the public frontend source. The backend has no endpoint to publish proposals, edit their text, register arbitrary invited members or send mail. Owner/reviewer can only update status; viewer is read-only. Optimistic SHA/version checks prevent overwriting a concurrent update. The backend also verifies live membership for passkey login.

## Deployment

1. `pnpm install --frozen-lockfile` and `pnpm build:auth`.
2. Set backend `API_ORIGIN`, `ACCESS_TEAM`, `ACCESS_AUD` in `wrangler.jsonc`. `ACCESS_AUD` is the audience of the Access application that protects `/auth/start`; `ACCESS_TEAM` is its cloudflareaccess.com team prefix.
3. Configure a repo-scoped GitHub token with Contents read/write on **westar-intel only**, then supply it with `wrangler secret put GITHUB_TOKEN`. Never put it in config, vars, web files or Git. The initial authorized deployment uses the existing GitHub CLI OAuth credential as a Worker secret; that credential has broader GitHub scopes. Replace it with a dedicated repository-scoped credential for long-term operation.
4. `pnpm deploy:backend`. `AUTH_STORE` is automatically provisioned by the migration. Preview URLs are disabled.
5. Create a Cloudflare Access self-hosted application for `westar-proposal-api.tomben49999999.workers.dev/auth/start`, an email allowlist Allow policy, and enable One-time PIN. Do not protect `/api/*` with Access cookies: the API independently checks opaque backend sessions, which avoids third-party cookie failures from GitHub Pages. Enable Google/Microsoft as optional IdPs when configured.
6. Confirm the Pages origin, update `web/config.js` with the backend URL, and push main. GitHub Actions publishes web to Pages. Auth configuration must be complete for first-time login.

Cloudflare Zero Trust Free requires the account owner to personally activate its terms/billing authorization before Access can be configured. No change to existing other Workers, domains, or Supabase is needed.

## Publishing a proposal

In a clean private westar-intel checkout, prepare a JSON envelope from the exact **formal assistant final output** and its prepared mail. The marker belongs to the envelope; do not add it to or rewrite the original body. Run:

```
node scripts/publish-proposal.js /path/to/marked-deliverable.json /path/to/private/westar-intel
node scripts/validate-intel.js /path/to/private/westar-intel
```

Review the private diff, commit, and push. The site reads the main branch directly on refresh. No proposal rebuild or public redeploy is needed. Use the same ID and current expected_version for subsequent formal content revisions; retain created_at and existing status. Prior content remains in private Git history, with metadata history visible in the UI.

To invite the boss, add their own email, role reviewer and active true to private `auth/members.json`; add the same email to Access's Allow policy. An inactive or removed member cannot use an existing session. Never share GitHub accounts.

## Validation

`pnpm test` checks publication rejection, content hashes, anonymous/forged-token denial, allowlist and revoked-member checks, roles, concurrent version protection, long-session hashing/expiry/logout, one-time passkey challenges, frontend data isolation and round-trip mailto Unicode encoding. CI also dry-runs the Worker bundle. Browser verification and live real-account login are separate from these isolated tests.
