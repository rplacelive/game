/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-inner-declarations */
import { parentPort } from "worker_threads"
import { Database } from "bun:sqlite"
import { Queue } from "@datastructures-js/queue"

const defaultDbOptions = { strict: true }
let db = new Database("server.db", defaultDbOptions)
let dbClosed = false

export type LiveChatMessage = {
	messageId: number,
	sendDate: number,
	channel: string,
	message: string,
	senderIntId: number,
	repliesTo: number|null,
	deletionId: number|null
}
export type LiveChatReaction = {
	messageId: number,
	reaction: string,
	senderIntId: number
}
export type PlaceChatMessage = {
	messageId: number,
	sendDate: number,
	message: string,
	senderIntId: number,
	x: number,
	y: number
}
export type Ban = {
	banId: number,
	userIntId: number,
	startDate: number,
	finishDate: number,
	moderatorIntId: number,
	reason: string,
	userAppeal: string,
	appealRejected: number
}
export type Mute = {
	muteId: number,
	startDate: number,
	finishDate: number,
	userIntId: number,
	moderatorIntId: number,
	reason: string,
	userAppeal: string,
	appealRejected: number
}
export type User = {
	intId: number,
	chatName: string,
	token: string,
	lastJoined: number,
	pixelsPlaced: number,
	playTimeSeconds: number
}
export type KnownIp = {
	userIntId: number,
	ip: string,
	userAgent: string,
	lastUsed: number
}
export type UserVip = {
	userIntId: number,
	keyHash: string,
	lastUsed: number
}
export type DeletionMessageInfo =  {
	messageId: number,
	reason: string,
	moderatorIntId: number
}
export type DeletionInsert = {
	moderatorIntId: number,
	reason: string,
	deletionDate: number
}
export type LiveChatDeletion = {
	deletionId: number,
	moderatorIntId: number,
	reason: string,
	deletionDate: number
}
export type LiveChatReport = {
	reportId: number,
	reporterId: number,
	messageId: number,
	reason: string,
	reportDate: number
}
export type Linkage = {
	userIntId: number,
	accountId: number,
	linkDate: number
}
type LiveChatUpdateDeletion = { deletionId: number, messageId: number }
export type AuthenticateUser = { token: string, ip: string, userAgent: string }
export type DbInternals = {
	setUserChatName: (data: { newName: string, intId: number }) => void,
	getUserChatName: (intId: number) => string|null,
	authenticateUser: (data: AuthenticateUser) => number|null,
	getLiveChatHistory: (data: { messageId: number, count: number, before: boolean, channel: string, includeDeleted?: boolean }) => LiveChatMessage[],
	updatePixelPlace: (intId: number) => void,
	getMaxLiveChatId: () => number,
	getMaxPlaceChatId: () => number,
	commitShutdown: () => boolean,
	insertLiveChat: (data: LiveChatMessage) => void,
	addLiveChatReaction: (data: { messageId: number, reaction: string, senderIntId: number }) => void
	deleteLiveChat: (data: DeletionMessageInfo) => void,
	insertPlaceChat: (data: PlaceChatMessage) => void,
	updateUserVip: (data: { intId: number, codeHash: string}) => void,
	insertLiveChatReport: (data: { reporterId: number, messageId: number, reason: string }) => void,
	getLiveChatMessage: (intId: number) => LiveChatMessage|null,
	exec: (data: { stmt: string, params: any }) => any[]|null,
	reInitialise: () => void
}

// Invoke schema script to create tables & indexes
const schemaFile = Bun.file("schema.sql")
const schema = await schemaFile.text()
db.exec(schema)

// Set DB pragmas
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA synchronous=NORMAL;")
db.exec("PRAGMA cache_size=-10000;")

export type LiveChatHistoryMessage = LiveChatMessage & {
	chatName: string,
	reactions: Map<string, number[]>
}
export type LiveChatHistoryParams = {
	channel: string|null,
	count: number|null,
	messageId: number|null,
}

const insertLiveChat = db.query<void, LiveChatMessage>(`
	INSERT INTO LiveChatMessages (messageId, message, sendDate, channel, senderIntId, repliesTo, deletionId)
	VALUES ($messageId, $message, $sendDate, $channel, $senderIntId, $repliesTo, $deletionId)`)
const insertPlaceChat = db.query<void, PlaceChatMessage>(`
	INSERT INTO PlaceChatMessages (messageId, message, sendDate, senderIntId, x, y)
	VALUES ($messageId, $message, $sendDate, $senderIntId, $x, $y)`)
const updatePixelPlaces = db.query<void, [number, number]>(`
	UPDATE Users SET pixelsPlaced = pixelsPlaced + ?1 WHERE intId = ?2`)

interface PublicQueue<T> extends Queue<T> {
	_elements: T[],
	isEmpty(): boolean,
	dequeue(): T|undefined,
	push(item:T): any
}
const pixelPlaces = new Map<number, number>() // intId, count
// Some chicanery to bypass them hiding _elements from the definition
const liveChatInserts:PublicQueue<LiveChatMessage> = new Queue<LiveChatMessage>()
const placeChatInserts = new Queue<PlaceChatMessage>()
/**
 * Bulk insert live chat messages, pixel places and place chats on an interval loop
 */
function performBulkInsertions() {
	// insert all new pixel places
	db.transaction(() => {
		for (const placePair of pixelPlaces) {
			updatePixelPlaces.run(placePair[1], placePair[0])
			pixelPlaces.delete(placePair[0])
		}
	})()

	// insert all new chats
	db.transaction(() => {
		while (!liveChatInserts.isEmpty()) {
			const data = liveChatInserts.dequeue()
			if (data) {
				insertLiveChat.run(data)
			}
		}
		while (!placeChatInserts.isEmpty()) {
			const data = placeChatInserts.dequeue()
			if (data) {
				insertPlaceChat.run(data)
			}
		}
	})()
}
setInterval(performBulkInsertions, 10000)

const internal: DbInternals = {
	setUserChatName: function({ newName, intId }) {
		const updateQuery = db.query("UPDATE Users SET chatName = ?1 WHERE intId = ?2")
		updateQuery.run(newName, intId)
	},
	getUserChatName: function(intId) {
		const getNameQuery = db.query<User, number>("SELECT chatName FROM Users WHERE intId = ?1")
		const result = getNameQuery.get(intId)
		return result ? result.chatName : null
	},
	authenticateUser: function({ token, ip, userAgent }) {
		const selectUser = db.query<User, string>("SELECT * FROM Users WHERE token = ?1")
		const epochMs = Date.now()
		
		let user = selectUser.get(token)
		if (!user)  { // Create new user
			const insertUser = db.query<User, [string, number, number, number]>(
				"INSERT INTO Users (token, lastJoined, pixelsPlaced, playTimeSeconds) VALUES (?1, ?2, ?3, ?4) RETURNING *")
			user = insertUser.get(token, epochMs, 0, 0)
			if (user == null) return null
		}
		else { // Update last joined
			const updateUser = db.query("UPDATE Users SET lastJoined = ?1 WHERE intId = ?2")
			updateUser.run(epochMs, user.intId)
		}

		// Add known IP if not already there
		const getIpsQuery = db.query<KnownIp, [number, string, string]>("SELECT * FROM KnownIps WHERE userIntId = ?1 AND ip = ?2 AND userAgent = ?3")
		const ipExists = getIpsQuery.get(user.intId, ip, userAgent)
		if (ipExists) { // Update last used
			const updateIp = db.query<void, [number, number, string, string]>("UPDATE KnownIps SET lastUsed = ?1 WHERE userIntId = ?2 AND ip = ?3 AND userAgent = ?4")
			updateIp.run(epochMs, user.intId, ip, userAgent)
		}
		else { // Create new
			const createIp = db.query<void, [number, string, string, number]>("INSERT INTO KnownIps (userIntId, ip, userAgent, lastUsed) VALUES (?1, ?2, ?3, ?4)")
			createIp.run(user.intId, ip, userAgent, epochMs)
		}
		
		return user.intId
	},
	getLiveChatHistory: function({ channel, includeDeleted, before, messageId, count }) {
		const liveChatMessageId = internal.getMaxLiveChatId()
		const params:LiveChatHistoryParams = { channel: null, count: null, messageId: null }
		let query = `
			SELECT LiveChatMessages.*, Users.chatName AS chatName
			FROM LiveChatMessages
			INNER JOIN Users ON LiveChatMessages.senderIntId = Users.intId
		`
		const conditions = []
	
		if (channel) {
			conditions.push("channel = $channel")
			params.channel = channel
		}
		if (!includeDeleted) {
			conditions.push("deletionId IS NULL")
		}
	
		if (before) {
			messageId = Math.min(liveChatMessageId, messageId)
			count = Math.min(liveChatMessageId, count)
			if (messageId === 0) {
				query += conditions.length ? "WHERE " + conditions.join(" AND ") + " " : ""
				query += "ORDER BY messageId DESC LIMIT $count"
				params.count = count
			} else {
				conditions.push("messageId < $messageId")
				query += "WHERE " + conditions.join(" AND ") + " ORDER BY messageId DESC LIMIT $count"
				params.messageId = messageId
				params.count = count
			}
		} else {
			count = Math.min(liveChatMessageId - messageId, count)
			conditions.push("messageId > $messageId")
			query += "WHERE " + conditions.join(" AND ") + " ORDER BY messageId ASC LIMIT $count"
			params.messageId = messageId
			params.count = count
		}
	
		const history = []
		const messagesStmt = db.query<LiveChatHistoryMessage, LiveChatHistoryParams>(query)
		for (const message of messagesStmt.iterate(params)) {
			message.reactions = new Map<string, number[]>()
			const reactionsQuery = db.query<LiveChatReaction, [number]>("SELECT * FROM LiveChatReactions WHERE messageId = ?1")
			for (const reaction of reactionsQuery.iterate(message.messageId)) {
				if (!message.reactions.has(reaction.reaction)) {
					message.reactions.set(reaction.reaction, [])
				}
				message.reactions.get(reaction.reaction)?.push(reaction.senderIntId)
			}
			history.push(message)
		}
		return history
	},
	updatePixelPlace: function(intId) {
		pixelPlaces.set(intId, (pixelPlaces.get(intId)||0) + 1)
	},
	getMaxLiveChatId: function() {
		const getMaxMessageId = db.query<{ maxMessageId: number }, any>("SELECT MAX(messageId) AS maxMessageId FROM LiveChatMessages")
		const maxMessageId = getMaxMessageId.get()?.maxMessageId || 0
		return maxMessageId      
	},
	getMaxPlaceChatId: function() {
		const getMaxMessageId = db.query<{ maxMessageId: number }, any>("SELECT MAX(messageId) AS maxMessageId FROM PlaceChatMessages")
		const maxMessageId = getMaxMessageId.get()?.maxMessageId || 0
		return maxMessageId
	},
	commitShutdown: function() {
		if (!dbClosed) {
			dbClosed = true
			performBulkInsertions()
			db.close()
			return true
		}
		return false
	},
	/* Send date is seconds unix epoch offset */
	insertLiveChat: function(data) {
		data.repliesTo = null
		data.deletionId = null
		liveChatInserts.push(data)
	},
	// Messages may or may not be in the DB by the time they are being asked to be deleted due to periodic transactions
	deleteLiveChat: function({ moderatorIntId, reason, messageId }) {
		const deletionQuery = db.query<LiveChatDeletion, DeletionInsert>(
			"INSERT INTO LiveChatDeletions (moderatorIntId, reason, deletionDate) VALUES ($moderatorIntId, $reason, $deletionDate) RETURNING *")             
		const deletion = deletionQuery.get({ moderatorIntId, reason, deletionDate: Date.now() })
		if (deletion == null) {
			return
		}

		// If pending to be inserted into DB we can update the record in preflight
		for (const messageData of liveChatInserts._elements) {
			if (messageData.messageId === messageId) {
				messageData.deletionId = deletion.deletionId
				return
			}
		}

		const query = db.query<void, LiveChatUpdateDeletion>("UPDATE LiveChatMessages SET deletionId = $deletionId WHERE messageId = $messageId")
		const deletionUpdate:LiveChatUpdateDeletion = { deletionId: deletion.deletionId, messageId }
		query.run(deletionUpdate)
	},
	insertPlaceChat: function(data) {
		placeChatInserts.push(data)
	},
	updateUserVip: function({ intId, codeHash }) {
		const epochMs = Date.now()
		const getKeysQuery = db.query("SELECT * FROM UserVips WHERE userIntId = ?1 AND keyHash = ?2")
		const keyExists = getKeysQuery.get(intId, codeHash)
		
		if (keyExists) {
			const updateKeysQuery = db.query("UPDATE UserVips SET lastUsed = ?1 WHERE userIntId = ?2 AND keyHash = ?3")
			updateKeysQuery.run(epochMs, intId, codeHash)
		}
		else {
			const createVipQuery = db.query("INSERT INTO UserVips (userIntId, keyHash, lastUsed) VALUES (?1, ?2, ?3)")
			createVipQuery.run(intId, codeHash, epochMs)
		}
	},
	insertLiveChatReport: function({ reporterId, messageId, reason }) {
		const insertReportQuery = db.query("INSERT INTO LiveChatReports (reporterId, messageId, reason, reportDate) VALUES (?1, ?2, ?3, ?4)")
		insertReportQuery.run(reporterId, messageId, reason, Date.now())
	},
	addLiveChatReaction: function({ messageId, reaction, senderIntId }) {
		// Message does not directly reference reaction so it is OK if message has not been inserted into DB yet (due to message bulk transactions)
		const insertReactionQuery = db.query("INSERT INTO LiveChatReactions (messageId, reaction, senderIntId) VALUES (?1, ?2, ?3)")
		insertReactionQuery.run(messageId, reaction, senderIntId)
	},
	getLiveChatMessage: function(intId) {
		// Message may not be in the DB yet if recently sent so getting a message requires some logic
		const getMessageQuery = db.query<LiveChatMessage, number>("SELECT * FROM LiveChatMessages WHERE messageId = ?1")
		const message = getMessageQuery.get(intId)
		if (message != null) {
			return message
		}
		for (const pendingMessage of liveChatInserts._elements) {
			if (pendingMessage.messageId == intId) {
				return pendingMessage
			}
		}
		return null
	},
	exec: function({ stmt, params }) {
		try {
			const query = db.query(stmt)
			return (typeof params[Symbol.iterator] === "function"
				? query.all(...params)
				: query.all(params))
		}
		catch(err) {
			console.log("Could not exec DB query: ", err)
			return null
		}
	},
	reInitialise: function() { //  Re-create the DB 
		internal.commitShutdown()
		db = new Database("server.db", defaultDbOptions)
		dbClosed = false
	}
}

parentPort?.on("message", (message) => {
	const result = internal[message.call] && internal[message.call](message.data)
	parentPort?.postMessage({ handle: message.handle, data: result })
})
self.addEventListener("error", event => {
	console.error("Uncaught exception in DB worker:", event.error)
})