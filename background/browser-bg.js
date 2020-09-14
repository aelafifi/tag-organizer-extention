// TODO: move this to API's file
const resave = _.debounce(async (winId) => {
	const binded = await Storage.get("bindedWindows");
	if (!binded[winId]) {
		return;
	}

	const all = await MyWindow.getAll();
	const _window = _.find(all, w => w.id == winId);
	_window && await _window.save();
}, 250, {
	maxWait: 1500,
});

chrome.tabs.onCreated.addListener(async (tab) => {
	/*await*/ resave(tab.windowId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	// console.log("changeInfo", changeInfo, tab);
	if (changeInfo.status == "complete") {
		/*await*/ resave(tab.windowId);
	}
});

chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
	/*await*/ resave(moveInfo.windowId);
});

chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
	/*await*/ resave(detachInfo.oldWindowId);
});

chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
	/*await*/ resave(attachInfo.newWindowId);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
	// If window is closing, it's OK
	if (removeInfo.isWindowClosing) {
		return;
	}
	
	/*await*/ resave(removeInfo.windowId);
});

chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
	console.log("@onReplaced", addedTabId, removedTabId);
	// TODO: What is this???
});

chrome.windows.onCreated.addListener(async (win) => {
	await sleep(1000);

	const myWin = MyWindow.createFromOpened(win);

	const binded = await Storage.get("bindedWindows");
	if (binded[myWin.id]) {
		return;
	}

	const all = await MyWindow.getAll();
	const saveNonOpenedWindows = _.filter(all, w => w.saved && !w.opened);

	const tabs = await Tabs.getAllInWindow(myWin.id);
	const winUrls = _.map(tabs, t => md5(t.url));

	_.map(saveNonOpenedWindows, w => {
		if (myWin.saved) {
			return;
		}
		const savedUrls = _.map(w.tabs, t => md5(t.url));
		const diffs = diff(winUrls, savedUrls);
		const counts = _.countBy(diffs, d => d[0]);
		if (counts[0] == w.tabs.length) {
			myWin.bind(w);
		}
	});
});

chrome.windows.onRemoved.addListener(winId => {
	// TODO: issue: if window just loaded and urls still pending,
	//		 closing window sets urls for these tabs to nknown value
	//		 because there is still no url yet!!
	// /*await*/ resave(winId);
});

async function checkSimilarities() {
	const windows = await MyWindow.getAll();
	const openedOnly = _.filter(windows, w => w.openedOnly);
	const savedOnly = _.filter(windows, w => w.savedOnly);

	return _.flatMap(openedOnly, oWindow => {
		return _.filter(_.map(savedOnly, sWindow => {
			const oUrls = _.map(oWindow.tabs, t => t.url);
			const sUrls = _.map(sWindow.tabs, t => t.url);
			const diffs = diff(oUrls, sUrls);
			const counts = _.countBy(diffs, d => d[0]);
			if (counts == oUrls.length) {
				return [oWindow.id, sWindow.savedId];
			}
		}));
	});
}
