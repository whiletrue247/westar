# WESTAR Proposal Desk

Public UI: https://whiletrue247.github.io/westar/
Backend: https://westar-proposal-api.tomben49999999.workers.dev
Private source: `whiletrue247/westar-intel` (never deploy its contents to Pages).

## Data boundary

The Pages workflow uploads **only `web/`**. No proposal, contact, email body, allowlist or secret is present in that folder. No Supabase connection or mail API is used.

Formal assistant outputs are published through an explicit `WESTAR_PROPOSAL` envelope. Required provenance: `source.role=assistant`, `source.kind=final_proposal`, `source.action=publish`, conversation/message IDs and original text SHA-256. Required identity: proposal_id/account/title/created_at. Conversation exports, user messages, progress, tools and drafts are rejected. Existing proposals require their current `expected_version` and keep the same ID. This is an explicit publication tool, not a chat scraper or automatic classifier; the operator is responsible for selecting the formally delivered source message. The backend verifies marker, provenance, schema and original body hash again before returning a proposal.

The importer changes neither the body nor embedded original ChatGPT citation/entity tokens. Raw text is rendered using textContent, preserving exact content without executing HTML or inventing source URLs. Mail is a separate prepared artifact. `mailto:` encodes recipients, subject and CRLF body; opening it does not send or mark anything sent.

## Authentication

Google OpenID Connect verifies first-time identity through the backend's authorization-code flow. It requests **only `openid email`**, not Gmail or Drive access. PKCE, a one-time state, a verified nonce and an HttpOnly SameSite=Lax browser-binding cookie protect the login. The backend verifies Google's JWT signature, issuer, audience, expiry and email_verified, then checks the private repository's active-member allowlist. No Google access/refresh tokens are retained, and unconfigured auth fails closed.

After verification the Worker generates a random opaque 30-day session token. Only its SHA-256 is stored in the AuthStore Durable Object; the frontend retains the token in localStorage for persistent login, and keeps proposal data in memory only. The login popup posts the token to the exact Pages origin; the frontend accepts only its own popup and random state. Sessions are fixed 30-day expiry and deleted on logout. Membership is checked on every API call, so removing or deactivating a member revokes access.

Passkeys are created and verified at the backend hostname (its own relying party), with required user verification. Challenges expire after five minutes and are consumed transactionally once; credential counters update transactionally. Public keys, challenges and hashed sessions live in a single private Durable Object, not in the Proposal repository. A daily cleanup removes expired records. Unauthenticated passkey endpoints are rate-limited. Google login remains recovery when a Passkey is missing or a device changes.

Private responses use no-store, private and are not cached. CORS permits only the configured Pages origin; no wildcard, raw token, email API credential or private payload enters the public frontend source. The backend has no endpoint to publish proposals, edit their text, register arbitrary invited members or send mail. Owner/reviewer can only update status; viewer is read-only. Optimistic SHA/version checks prevent overwriting a concurrent update. The backend also verifies live membership for passkey login.

## Deployment

1. `pnpm install --frozen-lockfile` and `pnpm build:auth`.
2. Set backend `API_ORIGIN` and `FRONTEND_ORIGIN` in `wrangler.jsonc`.
3. Configure a repo-scoped GitHub token with Contents read/write on **westar-intel only**, then supply it with `wrangler secret put GITHUB_TOKEN`. Never put it in config, vars, web files or Git. The initial authorized deployment uses the existing GitHub CLI OAuth credential as a Worker secret; that credential has broader GitHub scopes. Replace it with a dedicated repository-scoped credential for long-term operation.
4. Create a Google OAuth **Web application** client named WESTAR Proposal Desk, with authorized redirect URI exactly:

```
https://westar-proposal-api.tomben49999999.workers.dev/auth/google/callback
```

No JavaScript origins are required for this server code flow. This flow requests only openid/email. Google exempts identity-only requests from its test-user list requirement, even in Testing; the private allowlist controls Proposal access. The existing console project may have an existing consent-screen brand; do not overwrite the branding or scopes of other applications. Use a dedicated project if separate branding is needed.

5. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with Wrangler secrets. The downloaded web-client JSON can be loaded with `node scripts/configure-google.js /absolute/path/to/web-client.json`; that helper validates the redirect and uploads secrets without logging them or adding them to Git. Client creation/credential entry remains with the account owner.
6. `pnpm deploy:backend`. AUTH_STORE is provisioned by the migration. Preview URLs are disabled. No Cloudflare Access or Zero Trust signup, credit-card activation or third-party cookie is required.
7. Confirm the Pages origin and backend URL in web/config.js and push main. GitHub Actions publishes only web to Pages.

Authentication-only Google OpenID scopes do not require enabling Gmail API or a billing account; see [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect). Google/client secrets and private GitHub credential stay backend-only. Auth configuration must be complete for first-time login.

## Publishing a proposal

In a clean private westar-intel checkout, prepare a JSON envelope from the exact **formal assistant final output** and its prepared mail. The marker belongs to the envelope; do not add it to or rewrite the original body. Run:

```
node scripts/publish-proposal.js /path/to/marked-deliverable.json /path/to/private/westar-intel
node scripts/validate-intel.js /path/to/private/westar-intel
```

Review the private diff, commit, and push. The site reads the main branch directly on refresh. No proposal rebuild or public redeploy is needed. Use the same ID and current expected_version for subsequent formal content revisions; retain created_at and existing status. Prior content remains in private Git history, with metadata history visible in the UI.

To invite the boss, add their own email, role reviewer and active true to private `auth/members.json`; no per-user Google Cloud client or test-user setup is required for these identity-only scopes. An inactive or removed member cannot use an existing session. Never share GitHub accounts.

## Validation

`pnpm test` checks publication rejection, content hashes, anonymous/forged-token denial, allowlist and revoked-member checks, roles, concurrent version protection, long-session hashing/expiry/logout, one-time passkey challenges, frontend data isolation and round-trip mailto Unicode encoding. CI also dry-runs the Worker bundle. Browser verification and live real-account login are separate from these isolated tests.
