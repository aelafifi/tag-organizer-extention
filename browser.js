const app = new Vue({
	el: "#app",
	mounted() {
		this.reload(true);
	},
	data: {
		windows: [],
		searchText: "",
		currentWindow: null,
		chromeStorage: {},
		ui: {
			showOpened: true,
			showSaved: true,
			expanded: {},
		},
	},
	computed: {
		openedWindows() {
			return _.filter(this.windows, win => win.opened);
		}
	},
	methods: {
		async reload(firstReload) {
			this.windows = _.map(await MyWindow.getAll(), win => {
				win.ui_id = uniqid();
				if (firstReload) {
					this.ui.expanded[win.ui_id] = win.opened;
				}
				return win;
			});

			this.currentWindow = await Windows.getCurrent();

			chrome.storage.local.get(data => this.chromeStorage = data);
		},

		hasSearch() {
			return this.searchText.trim() != "";
		},

		matchSearch(tab) {
			if (!this.hasSearch()) {
				return true;
			}
			const text = this.searchText.toLowerCase();
			return ~tab.title.toLowerCase().indexOf(text) ||
				~tab.url.toLowerCase().indexOf(text);
		},

		filteredBySearch(tabs) {
			return _.filter(tabs, tab => this.matchSearch(tab));
		},

		allTabs(windows) {
			return _.flatMap(windows || this.windows, win => win.tabs);
		},

		toggleExpand(ui_id) {
			this.$set(this.ui.expanded, ui_id, !this.ui.expanded[ui_id]);
			this.$forceUpdate();
		},

		expandAll() {
			_.each(this.windows, win => {
				this.ui.expanded[win.ui_id] = true;
			});
			this.$forceUpdate();
		},

		collapseAll() {
			_.each(this.windows, win => {
				this.ui.expanded[win.ui_id] = false;
			});
			this.$forceUpdate();
		},

		expandAllVisible() {
			/* TODO: Implement */
			return this.expandAll();
		},

		collapseAllVisible() {
			/* TODO: Implement */
			return this.collapseAll();
		},

		async save(win) {
			// TODO: save and close option ???
			const title = prompt("Window's Title", win.title || "");
			if (!title) {
				// TODO: should alert!
				return;
			}
			await win.save(title);
			await this.reload();
		},

		async remove(win) {
			if (!confirm("Sure?")) {
				return;
			}
			await win.remove();
			await this.reload();
		},

		async close(win) {
			// TODO: should confirm??!
			await win.close();
			await this.reload();
		},

		async open(win) {
			// TODO: open unbinded option ???
			// TODO: replace current window (if current window saved)

			// TODO: should others execute operations also using messages?!!
			await Runtime.send({ cmd: "open", win });
			// await win.open();
			await this.reload();
		},

		async unbind(win) {
			await win.unbind();
			await this.reload();
		},

		async bind(win) {
			const savedNonOpenedWindows = _.filter(_.map(this.windows, w => {
				if (w.saved && !w.opened) {
					return w;
				}
			}));

			if (savedNonOpenedWindows.length == 0) {
				// TODO: should alert, or be disabled firstly!
				return;
			}

			const msg = _.map(savedNonOpenedWindows, (w, index) => {
				return `${index + 1}: ${w.title}`;
			}).join("\n");

			const index = parseInt(prompt(msg)) - 1;

			if (!isNaN(index) && index >= 0 && index < savedNonOpenedWindows.length) {
				// TODO: should check similarity!!!
				win.merge(savedNonOpenedWindows[index]);
				await win.bindTogether();
				await this.reload();
			} else {
				// TODO: throw ??!
			}
		},
		// TODO: add auto bind

		async goTo(win) {
			await Windows.update(win.id, { focused: true });
		},


		/* TODO: tabs operations should be moved to the API */
		async goToTab(tab, win) {
			await Tabs.update(tab.id, { active: true });
			await Windows.update(win.id, { focused: true });
		},

		async openTab(tab, newWin) {
			if (newWin) {
				await Windows.create({
					url: tab.url,
				});
			} else {
				await Tabs.create({
					url: tab.url,
				});
			}
		},

		async removeTab(tab, win) {
			// TODO: should confirm??!
			if (tab.id) {
				// Remove physically
				await Tabs.remove(tab.id);

				// Remove from object
				_.remove(win.tabs, t => t.id == tab.id);

				// Update saved
				if (win.saved) {
					await win.save();
				}
			} else {
				_.remove(win.tabs, t => t.tabId == tab.tabId);
				await win.save();
			}

			await this.reload();
		},

		async exportData() {
			const data = await Storage.get('savedWindows');
			var blob = new Blob([JSON.stringify(data)], {
				type: "application/json",
			});
			var url = URL.createObjectURL(blob);
			chrome.downloads.download({
				url: url,
			});
		},

		async importData() {
			var fileChooser = document.createElement("input");
			fileChooser.type = 'file';
			fileChooser.accept = "application/json";

			fileChooser.addEventListener('change', function (evt) {
				var f = evt.target.files[0];
				if (f) {
					var reader = new FileReader();
					reader.onload = function (e) {
						var contents = e.target.result;
						const json_contents = JSON.parse(contents);
						Storage.set({
							'savedWindows': json_contents,
						});
						document.body.removeChild(fileChooser);
					}
					reader.readAsText(f);
				}
			});

			document.body.appendChild(fileChooser);
			fileChooser.click();
		}
	},
});


// const x = /^chrome-extension:\/\/\w+\/suspended\.html#ttl=.*?&uri=(.*)$/;
