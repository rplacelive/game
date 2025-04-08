/** Promise with resolve and reject exposed - Like C# TaskCompletionSource */
export class PublicPromise<T> {
	promise: Promise<T>
	resolve!: (value: T | PromiseLike<T>) => void
	reject!: (reason?: string) => void
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}