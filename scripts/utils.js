// A simple event bus for decoupled communication
const EventBus = {
    events: {},
    on(eventName, fn) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(fn);
    },
    off(eventName, fn) {
        if (this.events[eventName]) {
            for (let i = 0; i < this.events[eventName].length; i++) {
                if (this.events[eventName][i] === fn) {
                    this.events[eventName].splice(i, 1);
                    break;
                }
            }
        }
    },
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(fn => {
                fn(data);
            });
        }
    }
};

// Export the objects and functions so other modules can import them.
export const Mouse = {
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
        document.addEventListener('mousedown', () => { this.isClicked = true; });
        document.addEventListener('mouseup', () => { this.isClicked = false; });
    },

    update: function() { this.isMoving = false; }
};

export const Keyboard = {
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

export const AppEvents = EventBus;

export function getScreenSize() {
    return {
        width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
        height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height + 25)
    };
}

export function normalizeRadians(rad) {
    rad = rad % (2 * Math.PI);
    if (rad > Math.PI) { rad -= 2 * Math.PI; }
    else if (rad <= -Math.PI) { rad += 2 * Math.PI; }
    return rad;
}

export function toggleDisplay(id) {
    const e = document.getElementById(id);
    if (e) {
        e.style.display = (e.style.display === 'block') ? 'none' : 'block';
    }
}