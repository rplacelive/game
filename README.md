# rplace.live - An open source faithful recreation of r/place

This site aims to be as similar to the april fools r/place event, where users were given a 2000x2000px canvas, allowing anyone to place a single pixel on it at a time. 

"Alone you can create something, but together, you can create something bigger" (or something like that)

**Site link: https://rplace.live/**

![https://rplace.live running on firefox as of 18/4/2022](site_demo.png)

*Feel free to contribute!*

# Development

Forks of this project should either:
- Connect to the same server, that is, wss://server.rplace.live
- Or use the same frontend, that is, https://rplace.live

This project is licensed under the [GNU LGPL v3](./LICENSE), out of goodwill we request forks are
not run commercially (That is, they should not generate more than the cost of server upkeep).

### For example,
- My app (`fork-of-rplace.live`) connecting to `wss://server.rplace.live` [✅ Cool, non-commercially]
- Making `https://rplace.live` connect to `wss://server.fork-of-a-place.live` [✅ Cool, non-commercially]
- My app (`fork-of-rplace.live`) connecting to `wss://server.fork-of-a-place.live` [❌ Not cool: Uses both different app and different server]

### Testing:
 - Use `bun install` to install all required vite dependencies.
 - You can use the bun dev configuration to run a local vite development server with `bun run dev`.
 
For more information on the game's protocol, look to the [protocol documentation](PROTOCOL.md).

### Also see:
 - [bun vscode extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode)
