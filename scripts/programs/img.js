import { BaseText } from './engines/base_text.js';

/**
 * Image utility program.
 * Fetches and displays a random image based on a provided topic using LoremFlickr.
 */
const Img = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        this.engine.textContainer.style.height = '100%';
        
        // Get the actual available space in the console
        const rect = screenEl.getBoundingClientRect();
        const width = Math.floor(rect.width) || 640;
        const height = Math.floor(rect.height) || 480;
        
        const topic = args.positional.join(',') || 'nature';
        const lock = Math.floor(Math.random() * 1000000);
    
        // Request an image matching the exact dimensions of the console
        const imageUrl = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(topic)}?lock=${lock}`;
            
        this.engine.render(`<div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden;">
        <img src="${imageUrl}" 
        alt="${topic}" 
        style="width: 100%; height: 100%; object-fit: cover; display: block;">
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

export default Img;