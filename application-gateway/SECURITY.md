# Security & Privacy Guidelines

## Secrets
- Never commit real tokens or passkeys. Use environment variables (.env) and keep .env out of git.
- Example values live in .env.example.

## Logs
- Runtime logs live in ./data/*.log and are gitignored.
- Logs can contain phone numbers or farm IDs; sanitize before sharing externally.
- Provided sanitized examples are under ./docs/sample-run.

## PII
- Phone-to-farm mapping should be stored encrypted at rest when moving beyond demo.
- Obtain consent for data collection; provide opt-out and data deletion pathways.

## Payments (Daraja)
- For demos, mock mode is automatic if PASSKEY is absent or tokens are mocked.
- For production, enforce HTTPS, rotate tokens, and validate callbacks against whitelisted origins.

## Reporting Issues
- Please open a private issue or contact the maintainers to report any vulnerability.
