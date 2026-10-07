# Deployment checklist

- [x] Public `whiletrue247/westar` created without conflict.
- [x] Private `whiletrue247/westar-intel` created without conflict.
- [x] Two explicitly selected formal assistant bodies imported without text changes, original source IDs and SHA-256 preserved.
- [x] Previously sent mail artifacts verified in Gmail Sent and retained as prepared mail, with waiting status.
- [x] Worker deployed and secret kept backend-only.
- [x] Anonymous proposal API returns 401; unauthenticated private GitHub content returns 404.
- [x] Twelve security/publication tests pass locally.
- [x] GitHub Pages deployed and URL verified in the browser.
- [x] Switched to Google OpenID Connect; Cloudflare Access is not required.
- [ ] Google Web OAuth client created by the account owner; ID/secret stored in Worker secrets.
- [x] Local browser integration verified against real private repo: list, original detail and status write. Local login is synthetic and is not proof of live Google login.
- [ ] Real invited Google login and Passkey verified online.
- [ ] Boss email supplied and invited.

Pending items do not imply access is open: unconfigured auth denies login and private API remains protected.
