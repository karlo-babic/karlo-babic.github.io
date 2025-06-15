import { BaseText } from './engines/base_text.js';

// Data store for help topics. This could be moved to a separate JSON file later.
const helpData = {
    _general: `Karlo's Observatory Console - v1.0
Type 'help [command]' for more information on a specific command.
<br>`,
    help: {
        description: 'Provides help information for console commands.',
        usage: 'help [command]',
        details: 'Displays a list of all available commands. If a command is specified, it shows detailed information for that command.'
    },
    boids: {
        description: 'A flocking simulation based on Craig Reynolds\' Boids algorithm.',
        usage: 'boids [-s|--separation N] [-a|--alignment N] [-c|--cohesion N]',
        details: 'Simulates the collective motion of a group of boids. The simulation can be customized with the following options:\n\n' +
                 '  -s, --separation  [float]  Strength of the force to avoid crowding (Default: 2.0)\n' +
                 '  -a, --alignment   [float]  Strength of the force to steer towards the average flock direction (Default: 0.05)\n' +
                 '  -c, --cohesion    [float]  Strength of the force to steer towards the center of the flock (Default: 0.08)\n\n' +
                 'Use your mouse to apply a repulsive force to the boids.'
    },
    gameoflife: {
        description: 'Conway\'s Game of Life, a cellular automaton.',
        usage: 'gameoflife',
        details: 'A zero-player game where the evolution of the system is determined by its initial state. Click or drag on the grid to draw living cells.'
    },
    evoltree: {
        description: 'A simulation of evolutionary branching.',
        usage: 'evoltree',
        details: 'Visualizes how species can diverge over time through reproduction and mutation. Organisms that are too similar or too far apart die out.'
    },
    mandelbrot: {
        description: 'An interactive visualization of the Mandelbrot set.',
        usage: 'mandelbrot',
        details: 'A fractal viewer. Use the mouse wheel or pinch-to-zoom to explore. Click and drag to pan.'
    },
    gravitysim: {
        description: 'A particle-based N-body gravity simulation.',
        usage: 'gravitysim',
        details: 'Simulates a galaxy of particles interacting under a simplified gravity model. The mouse acts as a massive "sun" that attracts particles.'
    }
};

/**
 * Generates the main help screen listing all commands.
 */
function getMainHelp() {
    let content = helpData._general;
    for (const cmd in helpData) {
        if (cmd.startsWith('_')) continue;
        const description = helpData[cmd].description;
        // Adjusted formatting slightly to look better with the bolding
        content += `\n<b>${cmd}</b>\n  ${description}\n`; 
    }
    return content;
}

/**
 * Generates the detailed help for a specific topic.
 */
function getTopicHelp(topic) {
    if (!helpData[topic] || topic.startsWith('_')) {
        return `Error: No help topic for '${topic}'.`;
    }
    const data = helpData[topic];
    let content = `<b>COMMAND</b>\n  ${topic}\n\n`;
    content += `<b>DESCRIPTION</b>\n  ${data.description}\n\n`;
    content += `<b>USAGE</b>\n  ${data.usage}\n\n`;
    content += `<b>DETAILS</b>\n  ${data.details}`;
    return content;
}


// The public interface for the Console.
const Help = {
    engine: null,

    // --- MODIFIED init function signature and logic ---
    init: function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        let content = '';

        // Check the length of the POSITIONAL arguments array
        if (args.positional.length === 0) {
            content = getMainHelp();
        } else {
            // Get the topic from the POSITIONAL arguments array
            content = getTopicHelp(args.positional[0]);
        }
        
        this.engine.render(content);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {
        // Not needed for this program.
    }
};

export default Help;