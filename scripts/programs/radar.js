import { BaseText } from './engines/base_text.js';

/**
 * Image utility program.
 * Fetches and displays a radar image.
 */
const Radar = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        this.engine.textContainer.style.height = '100%';
    
        const imageRadarUrl = `https://vrijeme.hr/kompozit-stat.png`;
        const imageWeatherUrl = 'https://www.yr.no/en/content/2-3191648/meteogram.svg';
            
        this.engine.render(`<div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden;">
        <img src="${imageRadarUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
        </div>
        <div style="width: 100%; display: flex; justify-content: center; align-items: center;">
        <img src="${imageWeatherUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
        </div>`);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Radar;