# Rplace.live protocol documentation

## Preramble:
rplace.live started as a weekend hack. BlobKat cranked out the first version in a day, and the "real" version only took three. You can still see those early decisions haunting the codebase like ghosts of "it worked at the time" past.

The biggest oops-turned-feature? Using git as a canvas sync system. We literally `git commit`'d pixel changes. It was weird, it was janky, but damn did it save bandwidth. Then along came [RplaceServer](https://github.com/Zekiah-A/RplaceServer) like a fancy new roommate who replaces all your duct-tape furniture with actual IKEA stuff.

Now we've got this awkward hybrid teenager of a protocol - WebSocket for the fast stuff, HTTP endpoints creeping their way over the nonsensical things that should *not* have been packets, a completely separate Auth & Posts server software, and enough legacy code to make archaeologists excited.

> Remember: This isn't a bug, it's ~~a feature~~ technical debt we'll fix later.

## Table of Contents
1. [Protocol Notes](#protocol-notes)
1. [WebSocket Protocol](#websocket-protocol)
   - [Packet Structure](#packet-structure)
   - [Pixel Packet](#pixel-packet)
   - [Chat History Packet](#chat-history-packet)
2. [HTTP REST API](#http-rest-api)
   - [User Endpoints](#user-endpoints)
   - [Chat Endpoints](#chat-endpoints)
   - [GIF Service](#gif-service)
   - [Instance Info](#instance-info)

3. [Authentication](#authentication)
4. [Error Handling](#error-handling)

---

## Protocol Notes
The rplace.live instance (game) server backend uses a hybrid communication model combining WebSocket for real-time interactions and HTTP REST API for stateless requests. This documentation covers both protocols in detail.

## WebSocket Protocol

### Packet Structure

All WebSocket packets follow this basic format:
- First byte: Packet type code (u8)
- Remaining bytes: Packet-specific data (big-endian)

### Pixel Packet

**code:** 4 (u8)

**Format:**
```
0      1          5        6
+------+----------+--------+
| code | Position | colour |
+------+----------+--------+
```
- **position** (u32): Pixel index on canvas
  - Calculate coordinates:
    - `x = index % canvas_width`
    - `y = Math.floor(index / canvas_width)`
- **colour** (u8): Palette colour index

> Pro tip: Position is just `y * width + x`. We could've sent coordinates but nah, maths is fun!

### Chat History Packet
> When you scroll up in chat and wonder "how does this work?" - surprise, it's this packet:

**code:** 13 (u8)

**Format:**
```
0       1           5                           6               7         N
+-------+-----------+---------------------------+---------------+---------+
| code  | messageId | flags(before|after,count) | channelLength | channel |
+-------+-----------+---------------------------+---------------+---------+
```
- **messageId** (u32): Anchor message ID
- **flags** (u8):
  - Bit 7 (MSB): Direction (0=after, 1=before)
  - Bits 0-6: Message count (1-127)
- **channelLength** (u8): UTF-8 channel name length
- **channel** (string): UTF-8 encoded channel name

**Behaviour:**
- When messageId==0 and direction==before, returns most recent messages
- messageIDs ascend chronologically (higher = newer)

---

## HTTP REST API
All endpoints support CORS and return JSON unless noted.

### User Endpoints

#### Get User Information
`GET /users/{intId}`
> Returns everything we ~~will admit we~~ know about a user, including whether they're currently online (because stalkers gonna stalk):

**Response:**
```ts
{
    "intId": number,
    "chatName": string,
    "lastJoined": string,
    "pixelsPlaced": number,
    "playTimeSeconds": number,
    "online": boolean
}
```
**Errors:**
- 400: Invalid user ID format
- 404: User not found

### Chat Endpoints

#### Get Chat History
`GET /live-chat/messages?messageId={id}&count={n}&before={bool}&channel={name}`
> The HTTP version of the WebSocket chat history - same data, more bloat, less binary:

**Parameters:**
- `messageId`: Anchor message ID (required)
- `count`: Number of messages (1-127, default 50)
- `before`: Direction (true=older messages)
- `channel`: Channel name (default "global")

**Response:**
```ts
{
    "messages": [
        {
            "id": number,
            "senderIntId": number,
            "channel": string,
            "date": number,
            "message": string,
            "repliesTo": number|null
        }
    ],
    "users": {
        "[intId]": "chatName"
    }
}
```

**Errors:**
- 400: Invalid parameters
- 500: Server error

### GIF Service
> We proxy Tenor because apparently nobody wants to type URLs anymore:

#### Search GIFs
`GET /gifs/search?q={query}&limit={n}&pos={cursor}&source=tenor`
> Returns GIFs in three formats because someone's still on IE11:

**Parameters:**
- `q`: Search query (i.e `ts+pmo`)
- `limit`: Results per page (default 16)
- `pos`: Pagination cursor (basically the result of `next`)
- `source`: Must be "tenor"

**Response:**
```ts
{
    "source": "tenor",
    "next": string|null,
    "results": [
        {
            "id": string, // Tenor GIF Id
            "source": string, // .webm (just use this)
            "sourceFallback": string, // .mp4 (bruh)
            "preview": string, // .webp (lowkey useless)
            "width": number,
            "height": number,
            "description": string // (AI generated slop)
        }
    ]
}
```

#### Get GIF by ID
`GET /gifs/{id}`

**Response:**
Same format as search result items

### Instance

#### Instance Info:
`GET /`

**Response:**
```ts
{
    "version": "legacy",
    "instance": {
        "id": string,
        "name": string,
        "icon": string
    },
    "canvas": {
        "width": number,
        "height": number,
        "cooldown": number
    }
}
```

## Authentication

### WebSocket
- Uses cookie-based authentication
- On first connection, server sets persistent cookie:
  - Name: uidToken
  - HttpOnly: true
  - Secure: true (in production)
  - SameSite: Lax/None (configurable)

### HTTP API
- Read-only endpoints require no authentication
- Modifying endpoints use same cookie as WebSocket

## Error Handling
### HTTP Status Codes
- 200: Success
- 400: Invalid request
- 404: Not found
- 426: WebSocket upgrade required
- 500: Server error

### WebSocket Errors
- Connection closed with appropriate WebSocket close code
- Error messages in relevant packets
