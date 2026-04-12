<p align="center">
  <!--TODO new logo
  <img width="100" src="https://raw.githubusercontent.com/spacebarchat/spacebarchat/master/branding/png/Spacebar__Icon-Rounded-Subtract.png" />
  -->
</p>
<h1 align="center">Harmony</h1>

<p align="center">
  <!--TODO new Matrix
  <a href="https://matrix.to/#/#spacebar:rory.gay">
    <img src="https://img.shields.io/matrix/spacebar%3Arory.gay?server_fqdn=matrix.rory.gay&fetchMode=summary&logo=matrix&logoColor=fffffff&label=Matrix" />
  </a>
  -->
  <!--TODO replace with new badge once its ready
  <a href="https://fermi.chat/invite/spacebar?instance=spacebar.chat">
    <img src="https://api.old.server.spacebar.chat/api/guilds/1006649183970562092/shield.svg" />
  </a>
  -->
  <a href="https://redir.fermi.chat/discord">
    <img src="https://img.shields.io/discord/1491113576792850573?color=7489d5&logo=discord&logoColor=ffffff&label=Discord" />
  </a>
  <img src="https://img.shields.io/static/v1?label=Status&message=Development&color=blue">
  <!--TODO new translation place
  <a title="Crowdin" target="_blank" href="https://translate.spacebar.chat/"><img src="https://badges.crowdin.net/fosscord/localized.svg"></a>
  -->
  <!--TODO new donation links (Likely a link to a page with donation methods)
   <a href="https://opencollective.com/spacebar">
    <img src="https://opencollective.com/spacebar/tiers/badge.svg">
  </a>
  -->
</p>

## About

Harmony is a Discord backend re-implementation and extension.
We aim to reverse engineer and add additional features to the Discord backend, while remaining completely backwards compatible with existing bots, applications, and clients.

This repository contains:

- [API Request/Response Types](./src/schemas)
- [Harmony HTTP API Server](./src/api)
- [WebSocket Gateway Server](./src/gateway)
- [HTTP CDN Server](./src/cdn)
- [WebRTC Server](./src/webrtc)
- [Utility and Database Models](./src/util)

## [Documentation](https://redir.fermi.chat/docs)

And with documentation on how to set up your own server [here](https://replaceme/setup/server), docs to set up either client [here](https://replaceme/setup/clients/), and docs about bots [here](https://replaceme/setup/bots/)

## [Contributing](CONTRIBUTING.MD)

## Clients

You _should_ be able to use any client designed for Discord.com to connect to Harmony.
However, some incompatibilities still exist between Harmony and Discord. For this reason, not every client will connect.  
We recommend using [Fermi](https://fermi.chat/login) as a solid starting point on your Harmony!
