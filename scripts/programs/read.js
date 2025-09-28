import { BaseText } from './engines/base_text.js';
import { parseMarkdown } from './engines/markdown_parser.js';

/**
 * A helper function to escape HTML special characters.
 * Used for displaying .txt files safely.
 * @param {string} text The raw text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

/**
 * Tries to fetch a file by checking for multiple supported extensions across multiple directories.
 * It searches directories in a prioritized order.
 * @param {string} filename The base name of the file to fetch.
 * @returns {Promise<{content: string, ext: string}>} A promise that resolves with the file content and its extension.
 */
async function fetchFile(filename) {
    // Prioritized list of directories to search within.
    const basePaths = ['./data/sections/', './data/'];
    // Defines the search order for file extensions.
    const extensions = ['md', 'txt', 'json'];

    for (const basePath of basePaths) {
        for (const ext of extensions) {
            try {
                const path = `${basePath}${filename}.${ext}`;
                const response = await fetch(path);
                if (response.ok) {
                    const content = await response.text();
                    return { content, ext }; // File found, return immediately.
                }
            } catch (error) {
                // Ignore network errors and continue to the next attempt.
            }
        }
    }
    
    // If all loops complete, the file was not found in any specified location.
    throw new Error(`File not found with any supported extension.`);
}

// The public interface for the Console.
const Read = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        let htmlOutput = '';

        // Prioritize the 'file' named argument (from a URL), then fall back to positional.
        const filename = args.named.file || (args.positional.length > 0 ? args.positional[0] : null);

        // Check if a filename was provided.
        if (!filename) {
            htmlOutput = "Usage: read &lt;filename&gt;";
            this.engine.render(htmlOutput);
            return;
        }

        // Fetch the file and determine its type.
        try {
            const { content, ext } = await fetchFile(filename);

            // Route the content to the correct renderer based on its extension.
            switch (ext) {
                case 'md':
                    htmlOutput = parseMarkdown(content);
                    break;
                case 'html':
                    htmlOutput = content;
                    break;
                case 'txt':
                    htmlOutput = `<pre>${escapeHtml(content)}</pre>`;
                    break;
                case 'json':
                    const data = JSON.parse(content);
                    if (Array.isArray(data)) {
                        htmlOutput = data.join('<hr style="border-color: #444; margin: 1em 0;">');
                    } else {
                        htmlOutput = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
                    }
                    break;
                default:
                    htmlOutput = `Error: Unsupported file type '.${ext}'.`;
            }
        } catch (error) {
            console.error(`Error reading file '${filename}':`, error);
            htmlOutput = `Error: Could not read file '${filename}'.`;
        }
        
        // Render the final generated HTML to the screen.
        this.engine.render(htmlOutput);
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

export default Read;