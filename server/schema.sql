-- LiveChatMessages
CREATE TABLE IF NOT EXISTS LiveChatMessages (
	messageId INTEGER PRIMARY KEY,
	sendDate INTEGER,
	channel TEXT,
	message TEXT,
	senderIntId INTEGER,
	repliesTo INTEGER,
	deletionId INTEGER,
	FOREIGN KEY (repliesTo) REFERENCES LiveChatMessages(messageId),
	FOREIGN KEY (senderIntId) REFERENCES Users(intId),
	FOREIGN KEY (deletionId) REFERENCES LiveChatDeletions(deletionId)
);
-- Base indexes
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_channel_sendDate ON LiveChatMessages(channel, sendDate);
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_senderIntId ON LiveChatMessages(senderIntId);
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_repliesTo ON LiveChatMessages(repliesTo);
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_deletionId ON LiveChatMessages(deletionId);
-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_covering ON LiveChatMessages(channel, sendDate, senderIntId, message);
CREATE INDEX IF NOT EXISTS idx_LiveChatMessages_active ON LiveChatMessages(channel, sendDate) WHERE deletionId IS NULL;


-- LiveChatReactions
CREATE TABLE IF NOT EXISTS LiveChatReactions (
	messageId INTEGER,
	reaction TEXT,
	senderIntId INTEGER,
	FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId),
	FOREIGN KEY (senderIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_LiveChatReactions_messageId ON LiveChatReactions(messageId);
CREATE INDEX IF NOT EXISTS idx_LiveChatReactions_senderIntId ON LiveChatReactions(senderIntId);
CREATE INDEX IF NOT EXISTS idx_LiveChatReactions_messageId_reaction ON LiveChatReactions(messageId, reaction);

-- PlaceChatMessages
CREATE TABLE IF NOT EXISTS PlaceChatMessages (
	messageId INTEGER PRIMARY KEY,
	sendDate INTEGER,
	message TEXT,
	senderIntId INTEGER,
	x INTEGER,
	y INTEGER,
	FOREIGN KEY (senderIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_PlaceChatMessages_x_y ON PlaceChatMessages(x, y);
CREATE INDEX IF NOT EXISTS idx_PlaceChatMessages_senderIntId ON PlaceChatMessages(senderIntId);
CREATE INDEX IF NOT EXISTS idx_PlaceChatMessages_sendDate ON PlaceChatMessages(sendDate);

-- Bans
CREATE TABLE IF NOT EXISTS Bans (
	banId INTEGER PRIMARY KEY,
	userIntId INTEGER UNIQUE,
	startDate INTEGER,
	finishDate INTEGER,
	moderatorIntId INTEGER,
	reason TEXT,
	userAppeal TEXT,
	appealRejected INTEGER,
	FOREIGN KEY (userIntId) REFERENCES Users(intId),
	FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_Bans_userIntId ON Bans(userIntId);
CREATE INDEX IF NOT EXISTS idx_Bans_startDate_finishDate ON Bans(startDate, finishDate);
CREATE INDEX IF NOT EXISTS idx_Bans_moderatorIntId ON Bans(moderatorIntId);

-- Mutes
CREATE TABLE IF NOT EXISTS Mutes (
	muteId INTEGER PRIMARY KEY,
	startDate INTEGER,
	finishDate INTEGER,
	userIntId INTEGER UNIQUE,
	moderatorIntId INTEGER,
	reason TEXT,
	userAppeal TEXT,
	appealRejected INTEGER,
	FOREIGN KEY (userIntId) REFERENCES Users(intId),
	FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_Mutes_userIntId ON Mutes(userIntId);
CREATE INDEX IF NOT EXISTS idx_Mutes_startDate_finishDate ON Mutes(startDate, finishDate);
CREATE INDEX IF NOT EXISTS idx_Mutes_moderatorIntId ON Mutes(moderatorIntId);

-- Users
CREATE TABLE IF NOT EXISTS Users (
	intId INTEGER PRIMARY KEY,
	chatName TEXT,
	token TEXT NOT NULL,
	lastJoined INTEGER,
	pixelsPlaced INTEGER,
	playTimeSeconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_Users_token ON Users(token);
CREATE INDEX IF NOT EXISTS idx_Users_chatName ON Users(chatName);

-- KnownIps
CREATE TABLE IF NOT EXISTS KnownIps (
	userIntId INTEGER NOT NULL,
	ip TEXT NOT NULL,
	lastUsed INTEGER,
	userAgent TEXT,
	PRIMARY KEY (userIntId, ip, userAgent),
	FOREIGN KEY (userIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_KnownIps_userIntId ON KnownIps(userIntId);
CREATE INDEX IF NOT EXISTS idx_KnownIps_ip ON KnownIps(ip);
CREATE INDEX IF NOT EXISTS idx_KnownIps_userAgent ON KnownIps(userAgent);
-- UserVips
CREATE TABLE IF NOT EXISTS UserVips (
	userIntId INTEGER NOT NULL,
	keyHash TEXT NOT NULL,
	lastUsed INTEGER,
	FOREIGN KEY(userIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_UserVips_userIntId ON UserVips(userIntId);
CREATE INDEX IF NOT EXISTS idx_UserVips_keyHash ON UserVips(keyHash);

-- LiveChatDeletions
CREATE TABLE IF NOT EXISTS LiveChatDeletions (
	deletionId INTEGER PRIMARY KEY,
	moderatorIntId INTEGER NOT NULL,
	reason TEXT,
	deletionDate INTEGER,
	FOREIGN KEY (moderatorIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_LiveChatDeletions_moderatorIntId ON LiveChatDeletions(moderatorIntId);
CREATE INDEX IF NOT EXISTS idx_LiveChatDeletions_deletionDate ON LiveChatDeletions(deletionDate);

-- LiveChatReports
CREATE TABLE IF NOT EXISTS LiveChatReports (
	reportId INTEGER PRIMARY KEY,
	reporterId INTEGER NOT NULL,
	messageId INTEGER NOT NULL,
	reason TEXT,
	reportDate INTEGER,
	FOREIGN KEY (reporterId) REFERENCES Users(intId),
	FOREIGN KEY (messageId) REFERENCES LiveChatMessages(messageId)
);
CREATE INDEX IF NOT EXISTS idx_LiveChatReports_messageId ON LiveChatReports(messageId);
CREATE INDEX IF NOT EXISTS idx_LiveChatReports_reporterId ON LiveChatReports(reporterId);
CREATE INDEX IF NOT EXISTS idx_LiveChatReports_reportDate ON LiveChatReports(reportDate);

-- Linkages
CREATE TABLE IF NOT EXISTS Linkages (
	userIntId INTEGER UNIQUE,
	accountId INTEGER,
	linkDate INTEGER,
	FOREIGN KEY (userIntId) REFERENCES Users(intId)
);
CREATE INDEX IF NOT EXISTS idx_Linkages_accountId ON Linkages(accountId);
CREATE INDEX IF NOT EXISTS idx_Linkages_userIntId_accountId ON Linkages(userIntId, accountId);
