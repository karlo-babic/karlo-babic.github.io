import { BaseText } from './engines/base_text.js';

/**
 * Solar Observatory program.
 * Displays live imagery from NASA's Solar Dynamics Observatory (SDO).
 * Hovering over the image toggles between the Photosphere (HMI) and Corona (171Å).
 */
const Sun = {
    engine: null,

    init: async function(screenEl) {
        this.engine = new BaseText(screenEl);
        this.engine.textContainer.style.height = '100%';
    
        const t = Date.now();
        const imgPhotosphere = `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg?t=${t}`;
        const imgCorona = `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg?t=${t}`;
    
        const htmlOutput = `<div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #000; overflow: hidden;">
                <div style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
                    <img src="${imgPhotosphere}" 
                         style="position: absolute; max-width: 100%; max-height: 100%; object-fit: contain; z-index: 1;"
                         alt="Solar Photosphere">
                    <img src="${imgCorona}" 
                         style="position: absolute; max-width: 100%; max-height: 100%; object-fit: contain; z-index: 2; opacity: 0; transition: opacity 0.2s ease-in-out; cursor: crosshair;"
                         alt="Solar Corona"
                         onmouseenter="this.style.opacity='1'"
                         onmouseleave="this.style.opacity='0'">
                </div>
            </div>`;
    
        this.engine.render(htmlOutput);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Sun;