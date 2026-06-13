import { BaseText } from './engines/base_text.js';

/**
 * NASA Astronomy Picture of the Day (APOD) program.
 * Fetches the daily feature and explanation from NASA's API.
 */
const Nasa = {
    engine: null,

    init: async function(screenEl) {
        this.engine = new BaseText(screenEl);
        
        try {
            const response = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
            const data = await response.json();

            let mediaContent = '';
            if (data.media_type === 'video') {
                // Handle video cases (e.g., YouTube)
                mediaContent = `<iframe src="${data.url}" 
                            style="width: 100%; height: 100%; border: none;" 
                            allowfullscreen></iframe>`;
            } else {
                // Handle image cases with link to HD version
                mediaContent = `<a href="${data.hdurl || data.url}" target="_blank" title="View High Definition">
                        <img src="${data.url}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">
                    </a>`;
            }

            this.engine.render(`<div style="width:100%;display:flex;justify-content:center;align-items:center;overflow:hidden;background:#000;">
                    ${mediaContent}
                </div>
                <div style="padding:12px 0;line-height:1.6;">
                    <h2 class="console-accent" style="margin-top:0;">${data.title}</h2>
                    <p style="font-size:0.7rem;">${data.explanation}</p>
                    <div class="console-dim" style="font-size:0.7rem;margin-top:12px;">Date: ${data.date} ${data.copyright ? `| © ${data.copyright}` : ''}</div>
                </div>`);
        } catch (error) {
            this.engine.render(`<span class="console-error">Error fetching NASA data: ${error.message}</span>`);
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

export default Nasa;