import { DEFAULT_COOLDOWN, DEFAULT_HEIGHT, DEFAULT_PALETTE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_WIDTH } from "./defaults.js"

// WS & State variables
/**@type {Map<number, number>}*/export const intIdPositions = new Map() // position : intId
/**@type {Map<number, string>}*/export const intIdNames = new Map() // intId : name
/**@type {any|null}*/export let account = null
/**@type {number|null}*/export let intId = null
/**@type {string|null}*/export let chatName = null
/**@type {boolean}*/export let canvasLocked = false // Server will tell us this
/**@type {boolean}*/export let includesPlacer = false // Server will tell us this
/**@type {boolean}*/export let initialConnect = false;
/**@type {number|null}*/export let cooldownEndDate = null;
/**@type {number}*/export let online = 1;

// Readonly WS & State variables
export let PALETTE_USABLE_REGION = DEFAULT_PALETTE_USABLE_REGION;
export let PALETTE = DEFAULT_PALETTE;
export let WIDTH = DEFAULT_WIDTH;
export let HEIGHT = DEFAULT_HEIGHT;
export let COOLDOWN = DEFAULT_COOLDOWN;