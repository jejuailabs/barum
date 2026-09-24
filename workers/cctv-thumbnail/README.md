# CCTV thumbnail worker

Every ten minutes, the production Cloud Run Job reads authorized and enabled HLS records, captures one distant-view frame, converts it to 640×360 WebP, stores it in Firebase Storage, and updates `thumbnailUrl` and `thumbnailUpdatedAt`.

The worker must skip records where `rightsVerified` is false. Stream credentials and provider URLs are operational configuration and are never committed. Capture failures feed the same three-strike health state used by `functions/src/cctvHealth.ts`.
