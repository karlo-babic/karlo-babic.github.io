import { BaseText } from './engines/base_text.js';

/**
 * Bookmarklet Manager
 * Injects and executes raw JavaScript onto the host website.
 */
const Bml = {
    engine: null,

    bookmarklets: {
        
        // YouTube Play-All bookmarklet
        'playall': `
            var linksAll = document.getElementsByTagName("a"); var linksVideos = []; var linksOld = []; for (var i = 0; i < linksAll.length; i++) {     var link = linksAll[i].getAttribute("href");     if (link == null) continue;     if (link.indexOf("/watch?v=") > -1) linksVideos.push(link.slice(link.indexOf("/watch?v=")) + 1, );     else if (link.indexOf("youtu") > -1) linksVideos.push("/watch?v=" + link.slice(link.lastIndexOf("/") + 1, )); } var linksIFrame = document.getElementsByTagName("iframe"); for (var i = 0; i < linksIFrame.length; i++) {     var link = linksIFrame[i].getAttribute("src");     if (link == null) continue;     if (link.indexOf("youtu") > -1) linksVideos.push("/watch?v=" + link.slice(link.lastIndexOf("/") + 1, )); } var playlistLink = 'https://www.youtube.com/embed/?playlist='; for (var i = 0; i < linksVideos.length; i++) {     var link = linksVideos[i].slice(9, 20);     if (linksOld.indexOf(link) > -1 || link.length != 11 || link.indexOf('?') > -1 || link == "howyoutubew") continue;     playlistLink += link;     playlistLink += ',';     linksOld.push(link); } window.open(playlistLink, '_blank').focus();
        `,

        // A simple example
        'alert': `
            alert("Hello from the Karlo Console! This is running on: " + window.location.hostname);
        `
    },

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        
        // If the console is opened in a normal tab (not via the bookmarklet)
        if (window === window.parent) {
            this.engine.render(`<div style="padding: 10px; color: #ff5555;">Error: 'bml' programs can only be run when the console is opened as a bookmarklet on a host website.</div>`);
            return;
        }

        const bmlName = args.positional[0];

        // If no argument is provided, list available bookmarklets
        if (!bmlName) {
            let output = '<div style="padding: 10px; font-family: monospace;">';
            output += '<div style="color: #4da6ff; margin-bottom: 10px;">Available Bookmarklets:</div>';
            output += '<ul style="list-style-type: none; padding-left: 0; margin: 0;">';
            
            for (const key of Object.keys(this.bookmarklets)) {
                output += `<li style="margin-bottom: 5px; color: #ccc;">- <span style="color: #fff; font-weight: bold;">${key}</span></li>`;
            }
            
            output += '</ul><br><span style="color: #888;">Usage: bml &lt;name&gt;</span></div>';
            this.engine.render(output);
            return;
        }

        // If the requested bookmarklet doesn't exist
        if (!this.bookmarklets[bmlName]) {
            this.engine.render(`<div style="padding: 10px; color: #ff5555;">Error: Bookmarklet '${bmlName}' not found. Type 'bml' to see available options.</div>`);
            return;
        }

        // Execute the bookmarklet
        try {
            this.engine.render(`<div style="padding: 10px; color: #aaffaa;">Executing bookmarklet: ${bmlName}...</div>`);
            
            // Send the raw JavaScript text to the host website's listener
            window.parent.postMessage({
                action: 'RUN_BML',
                code: this.bookmarklets[bmlName]
            }, '*');
            
        } catch (error) {
            this.engine.render(`<div style="padding: 10px; color: #ff5555;">Error executing: ${error.message}</div>`);
        }
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Bml;