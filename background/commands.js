chrome.commands.onCommand.addListener(function(command) {
	switch (command) {
	case "open_background_page_cmd":
		chrome.tabs.create({
			url: "/browser.html",
		});
		break;
	}
});
