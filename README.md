<p align="center">
  <img width="100" src="https://codeberg.org/MelodyChat/Harmony/raw/branch/main/assets/icon.png" />
</p>
<h1 align="center">Harmony</h1>

<p align="center">
  <a href="https://fermi.chat/invite/eG4bCj?instance=Harmony">
    <img src="https://api.harmony.melodychat.org/api/v9/guilds/1494080322868952857/shield.svg" />
  </a>
  <a href="https://redir.fermi.chat/discord">
    <img src="https://img.shields.io/discord/1491113576792850573?color=7489d5&logo=discord&logoColor=ffffff&label=Discord" />
  </a>
  <img src="https://img.shields.io/static/v1?label=Status&message=Development&color=blue">
  <!--TODO new translation place
  <a title="Crowdin" target="_blank" href="https://translate.spacebar.chat/"><img src="https://badges.crowdin.net/fosscord/localized.svg"></a>
  -->
  
   <a href="https://melodychat.org/donate/">
   <!--TODO badge?-->
    Donate
  </a>
  
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

And with documentation on how to set up your own server [here](https://docs.melodychat.org/setup/server), docs to set up either client [here](https://docs.melodychat.org/setup/clients/), and docs about bots [here](https://docs.melodychat.org/setup/bots/)

## [Contributing](CONTRIBUTING.MD)

## Clients

You _should_ be able to use any client designed for Discord.com to connect to Harmony.
However, some incompatibilities still exist between Harmony and Discord. For this reason, not every client will connect.  
We recommend using [Fermi](https://fermi.chat/login) as a solid starting point on your Harmony!
