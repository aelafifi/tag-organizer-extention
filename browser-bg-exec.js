Runtime.onMessage(async (info) => {
	const win = MyWindow.createFromJSON(info.win);
	switch(info.cmd) {
		case "open":
			await win.open();
			return true;
	}
});

