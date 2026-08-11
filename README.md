# Statix WhatsApp Bot

A lightweight WhatsApp bot built on top of a Baileys-based WhatsApp Web library. It connects via pairing code, listens for incoming messages, and responds to a small set of prefix-based commands.

## Features

- **Pairing code login** — connects to WhatsApp without scanning a QR code; you enter your phone number in the terminal and confirm the pairing code on your device.
- **Auto-reconnect** — automatically restarts the connection when it drops, unless the session was logged out (HTTP 401).
- **In-memory message store** — keeps recent messages in memory to support features like fetching a quoted message.
- **Command handler** (`commands.js`) with support for:
  - `ping` — replies with the bot's response latency.
  - `s` / `stc` / `sticker` — converts a quoted image or video into a public sticker.
  - `s2` / `stc2` / `sticker2` — same as above, but sends the sticker as private/personal.
  - `rvo` — reveals a quoted "view once" image, video, or audio message.
  - `menu` — sends a rich formatted response message.

## Requirements

- Node.js (LTS version recommended)
- A WhatsApp account for pairing

## Installation

```bash
npm install
```

## Usage

Start the bot:

```bash
npm start
```

On first run, you'll be prompted to enter your WhatsApp number (digits only, no `+` or spaces). A pairing code will be printed to the terminal — enter it on your phone under **Linked Devices > Link with phone number** to complete authentication. Session credentials are then stored locally in the `sessions` folder for future runs.

## Project Structure

```
statix-bot/
├── index.js               # Bot entry point: connection setup, event handlers
├── commands.js             # Incoming message parsing and command logic
├── libraries/
│   └── constants.js        # Shared module imports and helpers
├── package.json
└── package-lock.json
```

## Dependencies

- `@qwerty-xcv/baileys` — WhatsApp Web protocol library
- `axios` — HTTP client
- `pino` — logger

## Notes

- The `sessions` folder contains sensitive authentication credentials once generated; do not share or commit it.
- This project interacts with WhatsApp through an unofficial library, so functionality may break if WhatsApp changes its protocol.
