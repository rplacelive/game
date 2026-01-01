science.checked = localStorage.science != "0"
indicator.textContent = science.checked ? "ENABLED" : "DISABLED"
indicator.style.color = science.checked ? "green" : "red"
science.onchange = () => {
	localStorage.science = science.checked ? "" : "0"
	indicator.textContent = science.checked ? "ENABLED" : "DISABLED"
	indicator.style.color = science.checked ? "green" : "red"
}
