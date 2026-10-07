# Nova OS hosting

Nova OS is a Node.js web server and can run anywhere that supports a long-running Node.js process.

## Start

```bash
npm start
```

The server uses `process.env.PORT` when provided by the hosting platform, otherwise port 8080. It listens on `0.0.0.0` by default so hosted platforms can expose it publicly.

All project file paths are resolved from `server.js` using `__dirname`; Nova does not require the terminal or hosting platform to start in the project directory.

## Railway / Render / Fly.io / VPS

Use the normal Node start command:

```bash
npm start
```

Do not hard-code a port. The platform supplies `PORT`.

## Static-only hosts

A static-only host cannot run Nova's Node server. It can serve the frontend files, but features requiring `/api/*`, accounts, developer controls, persistent catalogs, bans, sessions, or server-side storage require a Node-capable backend.


## Persistent player accounts
Player accounts are stored separately in `data/accounts.json`. Keep this file when deploying a new Nova OS version. You can replace the server code while reusing the same `data/accounts.json` and players will keep their accounts. Do not commit or publish this file if it contains real account credentials. Back it up securely.

## Railway update notices
The client polls `/api/version` and compares the running build identifier. When Railway deploys a new build, already-open Nova pages show a blocking refresh notice. New visitors load the new version normally.
