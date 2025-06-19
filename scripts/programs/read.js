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
 * Tries to fetch a file by checking for multiple supported extensions.
 * @param {string} filename The base name of the file to fetch.
 * @returns {Promise<{content: string, ext: string}>} A promise that resolves with the file content and its extension.
 */
async function fetchFile(filename) {
    // Defines the search order for file extensions.
    const extensions = ['md', 'txt', 'json']; //html excluded for now
    for (const ext of extensions) {
        try {
            const path = `./data/${filename}.${ext}`;
            const response = await fetch(path);
            if (response.ok) {
                const content = await response.text(); // Get raw text content first.
                return { content, ext };
            }
        } catch (error) {
            // This catch is for network errors; fetch() rejects on those.
            // We can ignore it and let the loop continue to the next extension.
        }
    }
    // If the loop completes without finding any file, throw an error.
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
            htmlOutput = "Usage: read <filename>";
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
                    // For HTML files, we pass the content through directly.
                    htmlOutput = content;
                    break;
                case 'txt':
                    // For text files, we escape them and wrap in <pre> tags to preserve formatting.
                    htmlOutput = `<pre>${escapeHtml(content)}</pre>`;
                    break;
                case 'json':
                    // For JSON, we parse and format it based on its structure.
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