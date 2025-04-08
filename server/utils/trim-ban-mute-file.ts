import fs from 'fs'
import process from 'process'

let removed = 0

async function trimFile(filePath: string): Promise<void> {
	try {
		const data = await fs.promises.readFile(filePath, 'utf-8')
		const lines = data.split("\n")
		const currentTime = Date.now()

		const filteredLines = lines.filter((line) => {
			const [, timestamp] = line.split(" ")
			const lineTimestamp = parseInt(timestamp)
			if (lineTimestamp <= currentTime) {
				removed++
				return true
			} else {
				return false
			}
		})

		const trimmedData = filteredLines.join("\n")
		await fs.promises.writeFile(filePath, trimmedData, 'utf-8')
		console.log(`File successfully trimmed! Sorted through ${lines.length} lines. Removed ${removed} entries.`)
	} catch (error) {
		console.error("Error occurred:", error)
	}
}

// Get the file path from the command-line argument
if (process.argv.length !== 3) {
	console.error('Usage: node trim-ban-mute-file.js <file_path>')
} else {
	const filePath = process.argv[2]
	trimFile(filePath)
}
