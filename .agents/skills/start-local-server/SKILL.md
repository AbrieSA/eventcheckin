---
name: start-local-server
description: Start and verify the EventMe Vite development server before making or testing local app changes.
---

# Start local server

Use this skill when a local EventMe development server is needed for app changes or browser verification.

1. Work from the repository root and check whether `http://127.0.0.1:5000` is already responding. Reuse a healthy server instead of starting another one.
2. If no server is running, start it with `npm.cmd start -- --host 127.0.0.1 --port 5000` in a background process. Use `npm.cmd` to avoid the PowerShell execution-policy shim.
3. Confirm the server with an HTTP request to `http://127.0.0.1:5000`; report the URL and any startup failure clearly.
4. Keep development logs local and do not stage generated logs or `build/` output.

Use `npm.cmd run build` only when the requested app change also calls for a production-build check; this skill is for the development server, not deployment.
