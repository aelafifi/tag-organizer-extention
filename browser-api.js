function uniqid() {
    return Date.now().toString(36) +
           parseInt(Math.random() * 1e6).toString(36);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Storage {
    static get(key) {
        return new Promise(resolve => {
            chrome.storage.local.get([key], result => resolve(result[key]));
        });
    }

    static getAll() {
        return new Promise(resolve => {
            chrome.storage.local.get(result => resolve(result));
        });
    }

    static set(data) {
        return new Promise(resolve => {
            chrome.storage.local.set(data, resolve);
        });
    }

    static async update(key, updator, fallbackValue) {
        let value = await Storage.get(key);
        if (typeof value === "undefined") {
            value = fallbackValue;
        }
        let newValue = updator(value);
        
        if (typeof newValue === "undefined") {
            newValue = value;
        } else if (newValue.then) {
            newValue = await newValue;
        }

        await Storage.set({[key]: newValue});
    }

    static remove(key) {
        return new Promise(resolve => {
            chrome.storage.local.remove([key], resolve);
        });
    }
}

class Windows {
    static create(...args) {
        return new Promise(resolve => chrome.windows.create(...args, resolve));
    }

    static update(...args) {
        return new Promise(resolve => chrome.windows.update(...args, resolve));
    }
    
    static remove(...args) {
        return new Promise(resolve => chrome.windows.remove(...args, resolve));
    }
    
    static get(...args) {
        return new Promise(resolve => chrome.windows.get(...args, resolve));
    }

    static getCurrent(...args) {
        return new Promise(resolve => chrome.windows.getCurrent(...args, resolve));
    }

    static getAll(...args) {
        return new Promise(resolve => chrome.windows.getAll(...args, resolve));
    }
}

class Tabs {
    static create(...args) {
        return new Promise(resolve => chrome.tabs.create(...args, resolve));
    }

    static update(...args) {
        return new Promise(resolve => chrome.tabs.update(...args, resolve));
    }

    static remove(...args) {
        return new Promise(resolve => chrome.tabs.remove(...args, resolve));
    }

    static getAllInWindow(...args) {
        return new Promise(resolve => chrome.tabs.getAllInWindow(...args, resolve));
    }
}

class Runtime {
    static send(msg) {
        return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
    }

    static onMessage(callback) {
        chrome.runtime.onMessage.addListener((msg, sender, cb) => {
            cb = _.once(cb);
            const response = callback(msg, cb);
            if (typeof response !== "undefined") {
                cb(response);
            }
        });
    }
}

class Chrome {
    static Storage = Storage;
    static Windows = Windows;
    static Tabs = Tabs;
    static Runtime = Runtime;
}

class MyWindow {
    id;
    savedId;
    tabs = [];
    title;
    saved;
    opened;

    constructor(props) {
        _.each(props, (v, k) => this[k] = v);
    }

    get exists() {
        return this.opened || this.saved;
    }

    get openedOnly() {
        return this.opened && !this.saved;
    }

    get savedOnly() {
        return this.saved && !this.opened;
    }

    merge(win) {
        // TODO: condition should be optimized
        if (this.opened && !this.saved && win.saved && !win.opened) {
            this.savedId = win.savedId;
            this.title = win.title;
            this.saved = true;
            // TODO: Keep open tabs? or merge diff??
        }
    }

    static async getSaved() {
        const savedWindows = await Storage.get("savedWindows");
        return _.map(savedWindows, win => {
            return new MyWindow({
                savedId: win.savedId,
                tabs: win.tabs,
                title: win.title,
                saved: true,
            });
        });
    }

    static async getOpened() {
        const openedWindows = await Chrome.Windows.getAll({
            populate: true,
        });

        return _.map(openedWindows, win => {
            return new MyWindow({
                id: win.id,
                tabs: win.tabs,
                opened: true,
            });
        });
    }

    static async getAll() {
        const saved  = await MyWindow.getSaved();
        const opened = await MyWindow.getOpened();
        const binds = await Storage.get("bindedWindows");
        const savedClosed = [];

        Storage.update("bindedWindows", binded => {
            return _.pickBy(binded, (savedId, id) => {
                return !!_.find(opened, w => w.id == id);
            });
        });

        _.each(saved, win => {
            const bindedWith = _.findKey(binds, i => i == win.savedId);
            if (bindedWith) {
                const openedWin = _.find(opened, w => w.id == bindedWith);
                if (openedWin) {
                    openedWin.merge(win);
                } else {
                    savedClosed.push(win);
                    // TODO: should be an error
                }
            } else {
                savedClosed.push(win);
            }
        });

        return _.union(opened, savedClosed);
    }

    static createFromOpened(win) {
        return new MyWindow({
            id: win.id,
            tabs: win.tabs,
            opened: true,
        });
    }

    static createFromJSON(jsonObj) {
        return new MyWindow(jsonObj);
    }

    async bind(win) {
        if (!(this.opened && !this.saved && win.saved && !win.opened)) {
            // TODO: throw
            return;
        }

        this.merge(win);
        await this.bindTogether();
    }

    async bindTogether() {
        if (!(this.opened && this.saved)) {
            // TODO: throw
            return;
        }

        await Storage.update("bindedWindows", binded => {
            binded[this.id] = this.savedId;
        }, {});
    }

    async unbind() {
        if (!(this.opened && this.saved)) {
            // TODO: throw
            return;
        }

        await Storage.update("bindedWindows", binded => {
            delete binded[this.id];
        }, {});
    }

    async save(title) {
        // TODO: should warn if title is passed for already saved window!
        title = title || (this.saved ? this.title : "Saved Window");

        const savedId = this.saved ? this.savedId : uniqid();

        const toSave = new MyWindow({
            savedId,
            title,
            tabs: _.map(this.tabs, tab => ({
                tabId: uniqid(),
                url: tab.url,
                pinned: tab.pinned,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
            })),
        });

        await Storage.update("savedWindows", wins => {
            const foundWindow = _.find(wins, w => w.savedId == toSave.savedId);
            if (foundWindow) {
                _.assign(foundWindow, toSave);
            } else {
                wins.push(toSave);
            }
        }, []);

        toSave.saved = true;

        // TODO: is this condition really matters?!
        if (!this.saved) {
            await this.bind(toSave);
        }
    }

    async remove() {
        // Remove from saved list
        await Storage.update("savedWindows", wins => {
            _.remove(wins, w => w.savedId == this.savedId);
        }, []);

        // Remove binds
        await Storage.update("bindedWindows", binded => {
            if (this.opened) {
                delete binded[this.id];
            } else {
                // TODO: logically, shouldn't check this!
                const openedId = _.findKey(binded, v => v == this.savedId);
                delete binded[openedId];
            }
        }, {});

        // Update the object
        this.saved = false;
        this.title = undefined;
        this.savedId = undefined;
        if (!this.opened) {
            this.tabs = [];
        }
    }

    async close() {
        // Close the window physiclly
        await Windows.remove(this.id);

        await sleep(400);

        // Remove binds
        await Storage.update("bindedWindows", binded => {
            delete binded[this.id];
        });

        await sleep(400);

        // Update the object
        this.opened = false;
        this.id = undefined;
        if (!this.saved) {
            this.tabs = [];
        }
    }

    async open() {
        if (this.opened) {
            // TODO: should throw!
            return;
        }

        // Create the window
        const win = await Windows.create({
            url: _.map(this.tabs, t => t.url),
            focused: true,
            state: 'maximized',
        });

        // Update the object
        this.id = win.id;
        this.opened = true;

        // Bind
        await this.bindTogether();
    }

    async focus() {
        await Windows.update(this.id, {
            focused: true,
        });
    }
}

(async () => {
    const opened = await MyWindow.getOpened();
    Storage.update("bindedWindows", binded => {
        return _.pickBy(binded, (savedId, id) => {
            return !!_.find(opened, w => w.id == id);
        });
    });
})();
