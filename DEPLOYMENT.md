# Deployment checklist

- [x] Public `whiletrue247/westar` created without conflict.
- [x] Private `whiletrue247/westar-intel` created without conflict.
- [x] Two explicitly selected formal assistant bodies imported without text changes, original source IDs and SHA-256 preserved.
- [x] Previously sent mail artifacts verified in Gmail Sent and retained as prepared mail, with waiting status.
- [x] Worker deployed and secret kept backend-only.
- [x] Anonymous proposal API returns 401; unauthenticated private GitHub content returns 404.
- [x] Thirteen security/publication tests pass locally and in GitHub Actions, including real signed WebAuthn registration and authentication.
- [x] GitHub Pages deployed and URL verified in the browser.
- [x] Switched to Google OpenID Connect; Cloudflare Access is not required.
- [x] Dedicated Google Web OAuth client created with explicit owner approval; ID/secret stored in Worker secrets. Health confirms auth is configured.
- [x] Local browser integration verified against real private repo: list, original detail and status write. Local login is synthetic and is not proof of live Google login.
- [ ] Real invited Google login and Passkey verified online.
- [x] Local mailto opened macOS Mail with the intended recipient, subject and full body; no message sent.
- [ ] Boss email supplied and invited.

Live Google identity consent completed for the invited owner, but Brave blocked the callback with ERR_BLOCKED_BY_CLIENT. The browser remains at this handoff; end-to-end production session verification is pending user handling of the browser block. Private API remains protected.
