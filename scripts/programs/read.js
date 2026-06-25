import { BaseText } from './engines/base_text.js';
import { parseMarkdown } from './engines/markdown_parser.js';

const DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbxF-F0lXyzGHDFpziYabzSNpyEpZntcSlsFhNSu6XiSFKKG5CMEAsswHV2dYrI5bqEa/exec';

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

async function fetchDriveFile(name) {
    const response = await fetch(DRIVE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'read', name: name })
    });

    if (!response.ok) throw new Error('Network response failed');

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'File not found');

    return { content: result.content, ext: result.ext };
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
    const extensions = ['md', 'txt', 'json', 'html'];

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
            htmlOutput = '<span class="console-dim">Usage: read &lt;filename&gt;</span>';
            this.engine.render(htmlOutput);
            return;
        }

        // Fetch the file and determine its type.
        try {
            const isDrive = filename.startsWith('drive:');
            const fetchPromise = isDrive
                ? fetchDriveFile(filename.slice(6))
                : fetchFile(filename);
            const { content, ext } = await fetchPromise;

            // Route the content to the correct renderer based on its extension.
            switch (ext) {
                case 'md':
                    htmlOutput = parseMarkdown(content);
                    break;
                case 'html': {
                    const blob = new Blob([content], { type: 'text/html' });
                    const blobUrl = URL.createObjectURL(blob);
                    htmlOutput = `<iframe src="${blobUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"></iframe>`;
                    break;
                }
                case 'txt':
                    htmlOutput = `<pre>${escapeHtml(content)}</pre>`;
                    break;
                case 'json':
                    const data = JSON.parse(content);
                    if (Array.isArray(data)) {
                        htmlOutput = data.join('<hr>');
                    } else {
                        htmlOutput = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
                    }
                    break;
                default:
                    htmlOutput = `<span class="console-error">Error: Unsupported file type '.${ext}'.</span>`;
            }
        } catch (error) {
            console.error(`Error reading file '${filename}':`, error);
            htmlOutput = `<span class="console-error">Error: Could not read file '${filename}'.</span>`;
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

    onResize: function() {}
};

export default Read;