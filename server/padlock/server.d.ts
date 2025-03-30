// padlock.d.ts
import type { ServerWebSocket } from "bun"
import type { ClientData } from "../server.ts"

export interface ChallengeModule {
	/**
	 * Initializes the challenge algorithm
	 * @param name Name of the algorithm to use
	 */
	useAlgo(name: string): Promise<void>;

	/**
	 * Generates and sends a new challenge to the client
	 * @param ws The WebSocket connection to challenge
	 * @returns Buffer containing the challenge packet
	 */
	requestChallenge(ws: ServerWebSocket<ClientData>): Buffer;

	/**
	 * Verifies a client's solution to the challenge
	 * @param ws The WebSocket connection to verify
	 * @param message The client's solution message
	 * @returns Promise resolving to:
	 *   - boolean (true if solution is valid)
	 *   - "badpacket" if message is malformed
	 *   - "nosolution" if no pending challenge exists
	 */
	verifySolution(
		ws: ServerWebSocket<ClientData>,
		message: Buffer
	): Promise<"badpacket" | "nosolution" | boolean>
}

declare const padlock: ChallengeModule
export default padlock