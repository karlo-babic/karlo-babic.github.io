import { BaseText } from './engines/base_text.js';

/**
 * Bookmarklet Manager
 * Injects and executes raw JavaScript onto the host website.
 */
const Bml = {
    engine: null,

    bookmarklets: {
        'console': `
        function(){var id='karlo-console-wrapper';if(document.getElementById(id)){document.getElementById(id).remove();return;}var w=document.createElement('div');w.id=id;w.style.cssText='position:fixed;bottom:20px;right:20px;width:800px;height:500px;max-width:95vw;max-height:95vh;z-index:2147483647;box-shadow:0 10px 40px rgba(0,0,0,0.6);border-radius:8px;overflow:hidden;background:#000;border:1px%20solid%20#333;';var%20c=document.createElement('div');c.innerHTML='&times;';c.style.cssText='position:absolute;top:10px;right:15px;color:#fff;font-size:28px;font-family:sans-serif;cursor:pointer;z-index:10;line-height:26px;background:rgba(0,0,0,0.5);border-radius:50%;width:30px;height:30px;text-align:center;';c.onclick=function(){w.remove();};var%20i=document.createElement('iframe');i.src='https://karlo.observer/console.html';i.style.cssText='width:100%;height:100%;border:none;';w.appendChild(c);w.appendChild(i);document.body.appendChild(w);window.addEventListener('message',function(e){if(e.origin!=='https://karlo.observer')return;if(e.data&&e.data.action==='RUN_BML'&&e.data.code){var%20s=document.createElement('script');s.textContent=e.data.code;document.body.appendChild(s);s.remove();}});}
        `,

        // YouTube Play-All bookmarklet
        'playall': `
            var linksAll = document.getElementsByTagName("a"); var linksVideos = []; var linksOld = []; for (var i = 0; i < linksAll.length; i++) {     var link = linksAll[i].getAttribute("href");     if (link == null) continue;     if (link.indexOf("/watch?v=") > -1) linksVideos.push(link.slice(link.indexOf("/watch?v=")) + 1, );     else if (link.indexOf("youtu") > -1) linksVideos.push("/watch?v=" + link.slice(link.lastIndexOf("/") + 1, )); } var linksIFrame = document.getElementsByTagName("iframe"); for (var i = 0; i < linksIFrame.length; i++) {     var link = linksIFrame[i].getAttribute("src");     if (link == null) continue;     if (link.indexOf("youtu") > -1) linksVideos.push("/watch?v=" + link.slice(link.lastIndexOf("/") + 1, )); } var playlistLink = 'https://www.youtube.com/embed/?playlist='; for (var i = 0; i < linksVideos.length; i++) {     var link = linksVideos[i].slice(9, 20);     if (linksOld.indexOf(link) > -1 || link.length != 11 || link.indexOf('?') > -1 || link == "howyoutubew") continue;     playlistLink += link;     playlistLink += ',';     linksOld.push(link); } window.open(playlistLink, '_blank').focus();
        `

    },

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        const bmlName = args.positional[0];

        if (!bmlName) {
            this.renderList();
        } else {
            this.execute(bmlName);
        }
    },

    renderList: function() {
        let output = '<div style="padding: 10px; font-family: monospace;">';
        output += '<div style="color: #4da6ff; margin-bottom: 10px;">Available Bookmarklets:</div>';
        output += '<ul style="list-style-type: none; padding-left: 0; margin: 0;">';
        
        for (const key of Object.keys(this.bookmarklets)) {
            output += `<li style="margin-bottom: 5px; color: #ccc;">- <a href="#" class="bml-run-link" data-bml="${key}" style="color: #fff; font-weight: bold; text-decoration: underline; cursor: pointer;">${key}</a></li>`;
        }
        
        output += '</ul><br><span style="color: #888;">Usage: bml &lt;name&gt;</span></div>';
        this.engine.render(output);

        const links = this.engine.textContainer.querySelectorAll('.bml-run-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.execute(e.target.getAttribute('data-bml'));
            });
        });
    },

    execute: function(bmlName) {
        if (!this.bookmarklets[bmlName]) {
            this.engine.render(`<div style="padding: 10px; color: #ff5555;">Error: Bookmarklet '${bmlName}' not found. Type 'bml' to see available options.</div>`);
            return;
        }

        try {
            this.engine.render(`<div style="padding: 10px; color: #aaffaa;">Executing bookmarklet: ${bmlName}...</div>`);
            
            const code = this.bookmarklets[bmlName];

            if (window === window.parent) {
                const script = document.createElement('script');
                script.textContent = code;
                document.body.appendChild(script);
                script.remove();
            } else {
                window.parent.postMessage({
                    action: 'RUN_BML',
                    code: code
                }, '*');
            }
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