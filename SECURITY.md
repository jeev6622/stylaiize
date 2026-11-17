# StylAIze security and GitHub upload guide

## Secret handling rules

- Never commit `.env`, `.env.local`, `.env.*.local`, `apps/api/.env`, or `inference-service/.env`.
- Only `*.env.example` files belong in Git. They must contain placeholders, never real values.
- Keep API keys, JWT secrets, database credentials, SMTP passwords, Cloudinary secrets, payment keys, and inference-service tokens in environment variables or a secret manager.
- Never paste credentials into issues, pull requests, logs, screenshots, or chat.
- Private keys and certificates (`*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `*.p12`, `*.pfx`) must stay out of the repository.

## Rotate credentials found on local disk

`apps/api/.env` currently contains credential-shaped values for a Gemini API key and an SMTP password. Ignore rules prevent them from being committed, but they do not undo prior exposure.

1. Revoke and reissue the Gemini key in Google AI Studio.
2. Revoke and reissue the SMTP password (use a fresh app password).
3. Replace the values in `apps/api/.env` locally only. Do not commit the file.
4. Generate strong JWT secrets with `openssl rand -base64 48` and set them in the deployment platform's secret store.
5. If the MongoDB URI contains credentials in any environment, rotate that password too.

## Enable GitHub secret scanning and push protection

For a personal repository:

1. Create the GitHub repository.
2. Open **Settings → Code security and analysis**.
3. Enable **Secret scanning**.
4. Enable **Push protection**.
5. Under **Secret scanning → Protected lists**, add any organisation-specific token prefixes used by StylAIze.

For an organisation, ask an org owner to enable the same settings at the organisation level so all forks and new repositories inherit them.

Reference: https://docs.github.com/en/code-security/secret-scanning

## Local secret scanning

The repository includes `.gitleaks.toml` and a GitHub Actions workflow that runs Gitleaks on every push and pull request.

Install Gitleaks locally and run it before the first commit:

```bash
gitleaks detect --source . --config .gitleaks.toml --redact
gitleaks protect --staged --config .gitleaks.toml --redact
```

If Gitleaks flags a real secret, rotate the credential first, then replace it with an environment variable reference. Only add an allowlist entry for confirmed false positives such as example files and test fixtures.

## Safe commit practices

1. Check what would be committed before adding anything:
   ```bash
   git status --short
   git check-ignore -v apps/api/.env
   ```
2. Stage specific files instead of using `git add .`:
   ```bash
   git add .gitignore .gitleaks.toml SECURITY.md
   git add .github/
   ```
3. Review the staged diff and run the staged secret scan:
   ```bash
   git diff --cached --stat
   gitleaks protect --staged --config .gitleaks.toml --redact
   ```
4. Commit with a descriptive message and never add secrets to the message.

Never use `git reset --hard`, force-push, or history rewriting unless an incident responder explicitly requires it.

## Safe first upload to GitHub

```bash
cd E:\mainproject

git status --short
git check-ignore -v apps/api/.env apps/web/node_modules inference-service/.env

git add .gitignore .gitleaks.toml SECURITY.md .github/
git diff --cached --stat
gitleaks protect --staged --config .gitleaks.toml --redact

git commit -m "Add repository security hardening and secret scanning"
git remote add origin https://github.com/<owner>/<repository>.git
git branch -M main
git push -u origin main
```

After the first push, confirm that `.env`, `node_modules`, uploads, and model weights are absent from the remote repository.

## Deployment secrets

Set these through the hosting platform's secret store, not through committed files:

- API: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_PASS`, `VTON_SERVICE_API_KEY`.
- Web: `NEXT_PUBLIC_API_URL` (public by design — never place secrets in `NEXT_PUBLIC_*` variables).
- Inference service: `IDM_VTON_SERVICE_API_KEY`, model paths, and result directories.

Restrict the inference service to HTTPS with a strong API key and firewall rules; do not expose it publicly without authentication.
