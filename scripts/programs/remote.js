import { BaseText } from './engines/base_text.js';
import { parseMarkdown } from './engines/markdown_parser.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getDatabase, ref, onValue, off } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAdrCEDbg9jDw2ebGkyrxXCYDoJsCVjaNs",
    databaseURL: "https://remote-viewer-6e71e-default-rtdb.europe-west1.firebasedatabase.app/"
};
const FIREBASE_EMAIL = "karlosystem@karlo.observer";

let app, auth, db;
try {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getDatabase(app);
} catch (e) {
    console.error("Firebase init error:", e);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

const Remote = {
    engine: null,
    dbRef: null,
    sessionId: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);

        this.sessionId = args.named.session || (args.positional.length > 0 ? args.positional[0] : null);

        if (!this.sessionId) {
            this.sessionId = "public";
            this._connectPublic();
            return;
        }

        this._renderLoginUI();
    },

    _connectPublic: function() {
        this.dbRef = ref(db, `sessions/${this.sessionId}`);
        onValue(this.dbRef, (snapshot) => {
            this._renderData(snapshot.val());
        });
    },

    _renderLoginUI: function() {
        const html = `<p>Connecting to session: <strong>${this.sessionId}</strong></p>
<label style="color: #888;">Enter Password: </label>
<br><input type="password" id="remote-pwd" style="background: #222; color: #fff; border: 1px solid #444; padding: 2px 5px;" autofocus>
<button id="remote-submit" style="background: #333; color: #fff; border: 1px solid #555; padding: 2px 10px; cursor: pointer;">Connect</button>
<div id="remote-status" style="color: #ff5555; margin-top: 10px;"></div>`;
        this.engine.render(html);

        setTimeout(() => {
            const pwdInput = document.getElementById('remote-pwd');
            const submitBtn = document.getElementById('remote-submit');

            if (!pwdInput || !submitBtn) return;

            const triggerLogin = () => this._authenticateAndListen(pwdInput.value);

            submitBtn.addEventListener('click', triggerLogin);
            pwdInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') triggerLogin();
            });
            pwdInput.focus();
        }, 50);
    },

    _authenticateAndListen: async function(password) {
        const statusEl = document.getElementById('remote-status');
        if (statusEl) statusEl.innerText = "Authenticating...";

        try {
            await signInWithEmailAndPassword(auth, FIREBASE_EMAIL, password);

            this.dbRef = ref(db, `sessions/${this.sessionId}`);
            onValue(this.dbRef, (snapshot) => {
                this._renderData(snapshot.val());
            });
        } catch (error) {
            console.error("Auth error:", error);
            if (statusEl) statusEl.innerText = "Access Denied: Invalid password.";
        }
    },

    _renderData: function(data) {
        if (!data) {
            this.engine.render(`<span style="color: #888;">[Waiting for data in session '${this.sessionId}'...]</span>`);
            return;
        }

        const { text, filename, last_updated } = data;
        let htmlOutput = "";

        const secondsSinceUpdate = Math.floor(Date.now() / 1000) - last_updated;
        if (secondsSinceUpdate > 300) {
            htmlOutput += `<div style="color: #ffaa00; font-size: 0.9em; margin-bottom: 10px;">[Last updated ${Math.floor(secondsSinceUpdate/60)} mins ago]</div>`;
        }

        htmlOutput += `<div style="color: #66ccff; font-size: 0.9em; margin-bottom: 15px;">Live view: ${escapeHtml(filename)}</div>`;

        const ext = filename.split('.').pop().toLowerCase();
        if (['md', 'markdown', 'mdown'].includes(ext)) {
            htmlOutput += parseMarkdown(text);
        } else {
            htmlOutput += `<pre>${escapeHtml(text)}</pre>`;
        }

        this.engine.render(htmlOutput);
    },

    unload: function() {
        if (this.dbRef) {
            off(this.dbRef);
            this.dbRef = null;
        }
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Remote;
