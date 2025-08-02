window.addEventListener("undefineglobals", () => {
	delete WebSocket;
	delete Worker;
	Object.defineProperty(window, "eval", {
		value: function() { throw new Error() },
		writable: false,
		configurable: false
	});
});
