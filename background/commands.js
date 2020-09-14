chrome.commands.onCommand.addListener(function(command) {
	switch (command) {
	case "cmd01":
		chrome.tabs.create({
			url: "/browser.html",
		});
		break;
	}
});
