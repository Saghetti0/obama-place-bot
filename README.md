# obama r/place bot

This repo contains both the client and server for the place bot for https://discord.gg/obama. I'm well aware that this codebase is a hot mess, but despite all the horrible design decisions and janky code, it works :)

## Setup

1. Download and install git: https://git-scm.com/downloads
1. Download and install node.js: https://nodejs.org/en/
2. Open a terminal
3. Clone this repository: `git clone https://github.com/Saghetti0/obama-place-bot.git`
4. Move into it: `cd obama-place-bot`
5. Run the following commands in order
   1. `npm i`
   2. `npm i -g typescript ts-node`
6. Copy `secret_example.json` to `secret.json`
7. Edit `secret.json` and fill out your Reddit username and password. Leave `client_id` and `client_secret` blank for now.
8. Go to https://www.reddit.com/prefs/apps
9. Scroll to the bottom and click "create app"
10. Set the name to be "obama place bot"
11. Choose the option "script: Script for personal use"
12. Set the redirect URI to be `http://localhost`
13. Click "create app"
14. Underneath the title "obama place bot", copy the random string of characters. Ex: `NIZpaud1-QOEHXOv846Jbw`
15. Replace the text in `secret.json` that says `client id here` with the text you copied.
16. Copy the secret for your app from the Reddit website. Ex: `PcJyJbbf0d179-iovgjGnGlYCebd-g`
17. Replace the text in `secret.json` that says `client secret here` with the text you copied.
18. To start the bot, run the command `ts-node index.ts client`

Any questions or problems? DM me on Discord: `Saghetti#9735` . Friend requests are closed, but DMs are open. 
