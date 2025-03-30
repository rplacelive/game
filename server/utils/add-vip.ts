import fs from "fs"
import sha256 from "sha256"
import inquirer from "inquirer"

function generateRandomString(length: number): string {
	return Array.from({ length })
		.map(() => Math.random().toString(16).slice(2, 10))
		.join('')
}

function appendToVipFile(key: string, label?: string): void {
	const content = `\n# ${label || ''}\n${sha256(key)} { "cooldownMs": 500, "perms": "vip" }`
	fs.appendFileSync("./vip.txt", content)
}

async function addVip(): Promise<void> {
	let rand: string = generateRandomString(4)

	if (process.argv[2]) {
		rand = process.argv[2] + rand
	}
	else {
		const answers = await inquirer.prompt([
			{
				type: "input",
				name: "label",
				message: "Enter a label for the VIP key:",
				default: ""
			}
		])
		rand = answers.label + rand
	}

	appendToVipFile(rand, process.argv[2] || undefined)

	console.log("Key:", rand)
}

addVip()
