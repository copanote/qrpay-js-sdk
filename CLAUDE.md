# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
yarn install

# Build all targets (clean + local + dev + prod)
yarn build

# Build individual targets
yarn local   # development build → dist/local/
yarn dev     # development build with source maps → dist/dev/
yarn prod    # production build (minified) → dist/prod/

# Clean dist
yarn clean
```

There is no test runner configured. Formatting uses Prettier (`.prettierrc`): single quotes, 2-space indent, 180-char line width.

## Architecture

This is a **dependency-free browser SDK** for QR Pay authentication and API communication, bundled as UMD via Webpack + Babel.

### Entry Point & Public API

`src/index.js` exports two objects:
- `qrpaySdk` — authentication, token management, HTTP helpers
- `qrpayStorage` — localStorage abstraction

### Core Modules

**`src/qrpay_sdk.js`** — Main SDK logic
- `authenticate(username, password, deviceInfo)` — login, stores tokens
- `refresh()` — refreshes access token using stored refresh token
- `logout()` — clears tokens
- `verifyAccessToken()` — checks token expiration
- `getAccessToken()` / `getRefreshToken()` — token retrieval
- `fetchPostAsync` / `fetchGetAsync` — async/await HTTP with auto Bearer auth
- `fetchPostPromise` / `fetchGetPromise` — Promise-based HTTP variants
- `getBaseUrl()` — environment-aware URL resolution; maps `isrnd3.bccard.com` to a fallback IP (`130.1.56.154:20101/qrpay`)
- API constants: `AUTH_APIS`, `PAGES_APIS`, `REST_APIS`, `QRPAY_CODE`

**`src/qrpay_storage.js`** — LocalStorage wrapper
- Prefixes all keys with `QRPAY_` and JSON-serializes values
- Methods: `save(key, value)`, `find(key)`, `remove(key)`, `clearAll()`

**`src/context.js`** — Environment configuration
- Provides `baseUrl` and `loggable` flag per environment
- `PROFILE` constant injected at build time via `webpack.DefinePlugin`
- Profiles: `local` (localhost:9090, logging on), `development` (localhost:9090, logging on), `production` (empty baseUrl, logging off)

**`src/banner.js`** — Build banner generator
- Runs at build time; captures git commit hash, author, and timestamp for bundle comments

### Build Targets

Each webpack config builds two outputs (`qrpay_sdk.js` + `qrpay_sdk.min.js`) in UMD format:

| Script | Config | Output dir | Notes |
|--------|--------|------------|-------|
| `local` | `webpack.config.local.js` | `dist/local/` | Includes `mer.html` via HtmlWebpackPlugin |
| `dev` | `webpack.config.dev.js` | `dist/dev/` | Source maps enabled |
| `prod` | `webpack.config.prod.js` | `dist/prod/` | Minified with TerserJS |

The `PROFILE` value (`local`/`development`/`production`) is set in each config's `DefinePlugin` and controls which `context.js` environment profile is active.
