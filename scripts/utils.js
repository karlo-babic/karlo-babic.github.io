const Mouse = {
    x: 0,
    y: 0,
    isMoving: false,
    isClicked: false,

    init: function () {
        document.addEventListener('mousemove', (event) => {
            this.x = event.clientX;
            this.y = event.clientY;
            this.isMoving = true;
        });

        document.addEventListener('mousedown', () => {
            this.isClicked = true;
        });

        document.addEventListener('mouseup', () => {
            this.isClicked = false;
        });
    },

    // This function is called at the end of each frame in the main loop
    update: function() {
        this.isMoving = false;
    }
};

Mouse.init();


const Keyboard = {
    keys: [],
    pressedKey: false,

    init: function () {
        window.addEventListener('keydown', (e) => {
            this.keys = this.keys || [];
            this.keys[e.code] = true;
            this.pressedKey = e.code;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.pressedKey = false;
        });
    }
};

Keyboard.init();


// screenSize is a function to get the current size on demand,
// ensuring it's always up-to-date.
function getScreenSize() {
    return {
        width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
        height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height + 25)
    };
}


function normalizeRadians(rad) {
    rad = rad % (2 * Math.PI)
    if (rad > Math.PI) { rad -= 2 * Math.PI; }
    else if (rad <= -Math.PI) { rad += 2 * Math.PI; }
    return rad;
}

/**
 * Toggles the display style of an element between 'block' and 'none'.
 * @param {string} id The ID of the element to toggle.
 */
function toggleDisplay(id) {
    const e = document.getElementById(id);
    if (e) {
        e.style.display = (e.style.display === 'block') ? 'none' : 'block';
    }
}