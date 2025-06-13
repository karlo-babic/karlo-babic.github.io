const Mouse = {
    x: 0,
    y: 0,
    isMoving: false,
    isClicked: false,

    updateCoordinates: function (event) {
        this.x = event.clientX;
        this.y = event.clientY;
    },

    setMovingState: function (isMoving) {
        this.isMoving = isMoving;
    },

    setClickState: function (isClicked) {
        this.isClicked = isClicked;
    },


    init: function () {
        document.addEventListener('mousemove', function (event) {
            Mouse.updateCoordinates(event);
            Mouse.setMovingState(true);
        });

        document.addEventListener('mousedown', function () {
            Mouse.setClickState(true);
        });

        document.addEventListener('mouseup', function () {
            Mouse.setClickState(false);
        });
    },

    startMouseMovementCheck: function () {
        const movementCheckInterval = 500;
        setInterval(() => {
            if (this.isMoving) {
                this.setMovingState(false);
            }
        }, movementCheckInterval);
    }
};

Mouse.init();
Mouse.startMouseMovementCheck();



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



let screenSize = {};
setInterval(() => {
    screenSize = {
        width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
        height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height + 25)
    };
}, 1);



function normalizeRadians(rad) {
    rad = rad % (2*Math.PI)
    if (rad > Math.PI)        { rad -= 2 * Math.PI; }
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