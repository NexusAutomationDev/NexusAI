# NexusAI Code Signing Guide

This document covers the complete code signing setup for NexusAI distribution on macOS and Windows, plus the updater keypair configuration.

## Current Status

- [ ] macOS signing: Apple Developer ID certificate not yet acquired
- [ ] Windows signing: Azure Trusted Signing not yet configured
- [x] Updater keypair: Generated and public key committed to `src-tauri/tauri.conf.json`

## Updater Keypair

The updater keypair was generated with `pnpm tauri signer generate -w ~/.tauri/nexusai.key`.

### Key Locations

- **Private key:** `~/.tauri/nexusai.key` — NEVER commit this file; it is listed in `.gitignore`
- **Public key:** `~/.tauri/nexusai.key.pub` — safe to share; content is committed to `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`

### Backup Procedure

Back up the private key immediately after generation. If the private key is lost, existing installations cannot receive updates.

1. Open a password manager (1Password, Bitwarden, etc.) and create a new secure note named "NexusAI Updater Private Key"
2. Export the key content: `cat ~/.tauri/nexusai.key`
3. Paste the full output into the secure note
4. Store a second copy on a hardware-encrypted drive (e.g., an encrypted USB or external SSD with FileVault/BitLocker)
5. Verify the backup is readable before deleting the key from any machine

### GitHub Secrets Setup

Add the following secrets to the GitHub repository before any build runs:

**Navigation:** GitHub repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full content of `~/.tauri/nexusai.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used during key generation (empty string if none was set) |

## macOS Code Signing and Notarization

### Requirements

- Active Apple Developer Program membership ($99/year) at developer.apple.com
- A **Developer ID Application** certificate (NOT a Mac App Store certificate)

### Steps to Obtain and Configure

1. Sign in to the Apple Developer Portal at developer.apple.com/account
2. Navigate to Certificates, IDs and Profiles → Certificates → + (Add)
3. Select **Developer ID Application** and follow the CSR generation steps
4. Download the `.cer` file and double-click to install it in Keychain Access
5. In Keychain Access, right-click the certificate → Export → save as a `.p12` file with a strong password
6. Base64-encode the `.p12` for use as a GitHub Secret:
   ```bash
   base64 -i Developer_ID_Application.p12 | pbcopy
   ```
7. Generate an app-specific password at appleid.apple.com → Security → App-Specific Passwords
8. Find your Team ID at developer.apple.com/account → Membership Details

### GitHub Secrets to Add

| Secret Name | Value |
|-------------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded content of the `.p12` file |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_PASSWORD` | App-specific password (NOT your Apple ID password) |
| `APPLE_TEAM_ID` | 10-character Team ID from Membership Details |

### Activate in Workflows

After adding all five secrets, remove the `# ` prefix from the five `APPLE_*` lines in both workflow files:

- `.github/workflows/build.yml`
- `.github/workflows/release.yml`

### Entitlements

The `src-tauri/entitlements.plist` file already includes the required JIT entitlements:

- `com.apple.security.cs.allow-jit` — required for WKWebView JavaScript execution
- `com.apple.security.cs.allow-unsigned-executable-memory` — required for the Tauri WebView renderer

These entitlements are referenced in `src-tauri/tauri.conf.json` under `bundle.macOS.entitlements`.

## Windows Code Signing via Azure Trusted Signing

### Why Azure Trusted Signing

Since June 2023, certificate authorities no longer issue exportable OV code signing certificates as `.pfx` files. All new Windows code signing certificates require a hardware security module (HSM). Azure Trusted Signing provides a cloud HSM accessible from CI via environment variables — no physical dongle required.

### Steps to Configure

1. Create or sign in to an Azure account at portal.azure.com
2. Create a new **Trusted Signing** resource in the **East US** region (required for PublicTrust profiles)
3. Inside the Trusted Signing resource, create a **Certificate Profile** with the **PublicTrust** type
4. Create a Service Principal for CI access:
   ```bash
   az ad sp create-for-rbac --name "nexusai-ci" --role "Trusted Signing Certificate Profile Signer" \
     --scopes /subscriptions/{subscription-id}/resourceGroups/{rg}/providers/Microsoft.CodeSigning/codeSigningAccounts/{account-name}
   ```
   This outputs `appId` (client ID), `tenant`, and `password` (client secret)
5. Add the `trusted-signing-cli` tool to the Windows runner (see Tauri docs for the exact `signCommand` syntax)

### GitHub Secrets to Add

| Secret Name | Value |
|-------------|-------|
| `AZURE_CLIENT_ID` | `appId` from the Service Principal output |
| `AZURE_TENANT_ID` | `tenant` from the Service Principal output |
| `AZURE_CLIENT_SECRET` | `password` from the Service Principal output |

### Activate in Workflows

After adding all three secrets, remove the `# ` prefix from the three `AZURE_*` lines in both workflow files:

- `.github/workflows/build.yml`
- `.github/workflows/release.yml`

## References

- https://v2.tauri.app/distribute/sign/macos/
- https://v2.tauri.app/distribute/sign/windows/
- https://learn.microsoft.com/en-us/azure/trusted-signing/
- https://v2.tauri.app/plugin/updater/
