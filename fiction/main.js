/**
 * main.js - Logic for the Story Viewer Webpage
 *
 * This script fetches a list of markdown stories, populates a navigation menu,
 * and renders the selected story's content and metadata onto the page.
 * It uses a modular markdown parser to convert story text to HTML.
 */

// Import the markdown parser from its specified location.
import { parseMarkdown } from '../../scripts/programs/engines/markdown_parser.js';

// --- CONFIGURATION ---

/**
 * A list of markdown filenames located in the `/fiction/stories/` directory.
 * This list acts as a manifest for the stories available to the reader.
 * Add new story filenames here to make them appear on the webpage.
 */
const STORY_FILES = [
    'hypersol-caves.md',
    'hypersol-spilje.md', // Example of a translated file
    'dream-job.md',
    'testing.md',
];

const FONT_SIZE_CONFIG = {
    min: 12,        // Minimum font size in pixels
    max: 24,        // Maximum font size in pixels
    step: 1,        // How many pixels to change on each click
    default: 16,    // Default font size in pixels
};

// --- STATE ---

/**
 * Holds a structured collection of all stories, grouped by translationId.
 * Populated by buildStoryCollection() on startup.
 * @type {Object.<string, Object.<string, object>>}
 * @example
 * {
 *   "hypersol-caves": {
 *     "en": { title: "...", language: "en", fileName: "...", slug: "..." },
 *     "hr": { title: "...", language: "hr", fileName: "...", slug: "..." }
 *   }
 * }
 */
let storyCollection = {};


// --- DOM ELEMENT REFERENCES ---

const storyListEl = document.getElementById('story-list');
const storyTitleEl = document.getElementById('story-title');
const storyMetaEl = document.getElementById('story-meta');
const storyContentEl = document.getElementById('story-content');
const storyNavEl = document.getElementById('story-navigation');
const langSwitcherEl = document.getElementById('language-switcher');


// --- CORE FUNCTIONS ---

/**
 * Parses the text content of a story file, separating the front matter
 * (properties) from the main markdown content.
 * @param {string} fileContent - The full raw text from the markdown file.
 * @param {string} fileName - The name of the file, used for fallbacks.
 * @returns {{properties: object, content: string}|null} An object with parsed
 *   properties and the story content, or null if parsing fails.
 */
function parseStoryFile(fileContent, fileName) {
    const slug = fileName.replace('.md', '');
    const parts = fileContent.split('---');
    if (parts.length < 3) {
        console.error(`Invalid story format in ${fileName}: Missing front matter delimiters (---).`);
        return null;
    }

    const frontMatter = parts[1];
    const content = parts.slice(2).join('---').trim();
    const properties = {};

    frontMatter.trim().split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            properties[key.trim().toLowerCase()] = value;
        }
    });
    
    // Add fallback properties if they are missing
    properties.slug = slug;
    properties.filename = fileName;
    if (!properties.translationid) {
        properties.translationid = slug.replace(/-\w{2}$/, ''); // Guess ID by removing language suffix like '-hr'
    }
    if (!properties.language) {
        properties.language = 'en'; // Default language is English
    }

    return { properties, content };
}

/**
 * Calculates word count and estimated reading time for a given text.
 * @param {string} text - The text content to analyze.
 * @returns {{wordCount: number, minutesToRead: number}} An object containing the word count and read time in minutes.
 */
function calculateReadingInfo(text) {
    // Use a simple regex to split text into words, handling various whitespace.
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    
    // Average reading speed for adults is around 225 words per minute.
    const wordsPerMinute = 225;
    
    // Calculate minutes and round to the nearest whole number.
    // Ensure the result is at least 1 minute for very short texts.
    const minutesToRead = Math.max(1, Math.round(wordCount / wordsPerMinute));
    
    return { wordCount, minutesToRead };
}

/**
 * Renders the language switcher UI for a story, if translations are available.
 * @param {object} storyProperties - The properties object of the current story.
 */
function renderLanguageSwitcher(storyProperties) {
    langSwitcherEl.innerHTML = ''; // Clear previous switcher
    const { translationid: translationId, language: currentLang } = storyProperties;

    if (!translationId || !storyCollection[translationId]) return;

    const storyGroup = storyCollection[translationId];
    const availableLanguages = Object.values(storyGroup);

    if (availableLanguages.length > 1) {
        const switcherContent = availableLanguages
            .map(langVersion => {
                const langName = langVersion.languagename || langVersion.language.toUpperCase();
                if (langVersion.language === currentLang) {
                    return `<span class="active-lang">${langName}</span>`;
                } else {
                    return `<a href="#${langVersion.slug}">${langName}</a>`;
                }
            })
            .join('');
        langSwitcherEl.innerHTML = switcherContent;
    }
}


/**
 * Renders a parsed story object into the DOM.
 * @param {{properties: object, content: string}} story - The story object.
 */
function renderStory(story) {
    // Clean up previous genre classes from the body and apply new ones
    document.body.classList.remove('genre-fantasy', 'genre-scifi');
    if (story.properties.genres) {
        const lowerGenres = story.properties.genres.toLowerCase();
        if (lowerGenres.includes('fantasy')) {
            document.body.classList.add('genre-fantasy');
        } else if (lowerGenres.includes('science fiction') || lowerGenres.includes('sci-fi') || lowerGenres.includes('znanstvena fantastika')) {
            document.body.classList.add('genre-scifi');
        }
    }

    // Render properties
    const { title = 'Untitled Story', date, genres } = story.properties;
    storyTitleEl.textContent = title;
    document.title = title;

    // Calculate reading info from the story's content.
    const { wordCount, minutesToRead } = calculateReadingInfo(story.content);

    let metaHtml = '';

    // Build the primary stats line (date, word count, reading time)
    const stats = [];
    if (date) {
        stats.push(new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    }
    stats.push(`${wordCount.toLocaleString()} words`);
    stats.push(`${minutesToRead} min read`);
    
    metaHtml += `<div class="story-stats">${stats.map(s => `<span>${s}</span>`).join('')}</div>`;

    // Build the genres line
    if (genres) {
        const genreList = genres.split(',').map(g => g.trim());
        metaHtml += `<div class="story-genres">${genreList.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`;
    }
    
    storyMetaEl.innerHTML = metaHtml;

    // Render the language switcher if applicable
    renderLanguageSwitcher(story.properties);

    // Render story content using the imported markdown parser
    storyContentEl.innerHTML = parseMarkdown(story.content);
}

/**
 * Fetches and displays a story based on its filename.
 * @param {string} fileName - The filename of the story to load (e.g., 'story1.md').
 */
async function loadStory(fileName) {
    if (!fileName) return;
    
    // Update the URL hash without triggering a hashchange event to keep URL clean
    const slug = fileName.replace('.md', '');
    history.replaceState(null, '', `#${slug}`);
    
    storyContentEl.innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch(`stories/${fileName}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdownText = await response.text();
        const story = parseStoryFile(markdownText, fileName);

        if (story) {
            renderStory(story);
            updateActiveNavLink(fileName);
        } else {
            storyContentEl.innerHTML = `<p>Error: Could not parse the story file.</p>`;
        }
    } catch (error) {
        console.error('Error loading story:', error);
        storyContentEl.innerHTML = `<p>Sorry, the selected story could not be loaded. Please try another.</p>`;
        storyTitleEl.textContent = 'Error';
    }
}

/**
 * Populates the navigation list with links to story groups.
 */
function populateNav() {
    storyListEl.innerHTML = ''; // Clear "Loading..." text
    Object.keys(storyCollection).forEach(translationId => {
        const storyGroup = storyCollection[translationId];
        // Prefer the English version for the nav link, or fall back to the first available.
        const mainVersion = storyGroup['en'] || Object.values(storyGroup)[0];

        if (!mainVersion) return;

        const listItem = document.createElement('li');
        const link = document.createElement('a');

        link.href = `#${mainVersion.slug}`;
        link.textContent = mainVersion.title || 'Untitled Story';
        link.dataset.translationId = translationId;

        listItem.appendChild(link);
        storyListEl.appendChild(listItem);
    });
}

/**
 * Updates the active class on the current story's navigation link.
 * @param {string} activeFileName - The filename of the currently displayed story.
 */
function updateActiveNavLink(activeFileName) {
    const slug = activeFileName.replace('.md', '');
    let activeTranslationId = null;

    // Find the translationId for the active file
    for (const id in storyCollection) {
        const group = storyCollection[id];
        if (Object.values(group).some(v => v.slug === slug)) {
            activeTranslationId = id;
            break;
        }
    }
    
    // Update the nav links
    const links = storyNavEl.querySelectorAll('a');
    links.forEach(link => {
        if (link.dataset.translationId === activeTranslationId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Handles routing based on the URL hash.
 */
function handleRouting() {
    const slug = window.location.hash.substring(1);
    const fileName = slug ? `${slug}.md` : STORY_FILES[0];
    
    // Verify that the requested story file exists in our manifest
    if (STORY_FILES.includes(fileName)) {
        loadStory(fileName);
    } else if (STORY_FILES.length > 0) {
        // Fallback to the first story if the hash is invalid
        loadStory(STORY_FILES[0]);
    } else {
        // No stories configured
        storyContentEl.innerHTML = `<p>No stories have been configured. Please add story files to the manifest in <code>main.js</code>.</p>`;
        storyTitleEl.textContent = 'No Stories Found';
    }
}

/**
 * Fetches all story files and parses their front matter to build the storyCollection.
 */
async function buildStoryCollection() {
    const storyPromises = STORY_FILES.map(async (fileName) => {
        try {
            const response = await fetch(`stories/${fileName}`);
            if (!response.ok) return null;
            const text = await response.text();
            const story = parseStoryFile(text, fileName);
            return story ? story.properties : null;
        } catch (error) {
            console.error(`Failed to fetch properties for ${fileName}:`, error);
            return null;
        }
    });

    const allProperties = await Promise.all(storyPromises);

    allProperties.forEach(props => {
        if (!props) return;
        const { translationid: id, language } = props;
        if (!storyCollection[id]) {
            storyCollection[id] = {};
        }
        storyCollection[id][language] = props;
    });
}

/**
 * Handles theme switching and persistence in localStorage.
 */
function setupThemeSwitcher() {
    const themeSwitcher = document.getElementById('theme-switcher');
    if (!themeSwitcher) return;

    /**
     * Applies a theme by setting the appropriate class on the body element.
     * @param {string} themeName - The name of the theme (e.g., 'dark', 'sepia').
     */
    const applyTheme = (themeName) => {
        document.body.classList.remove('dark-theme', 'sepia-theme');
        if (themeName !== 'light') {
            document.body.classList.add(`${themeName}-theme`);
        }
        localStorage.setItem('story-theme', themeName);
    };

    themeSwitcher.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            const themeName = event.target.dataset.theme;
            applyTheme(themeName);
        }
    });

    const savedTheme = localStorage.getItem('story-theme') || 'sepia';
    applyTheme(savedTheme);
}

/**
 * Manages the font size controller, allowing users to adjust the text size.
 */
function setupFontSizeSwitcher() {
    const switcherEl = document.getElementById('font-size-switcher');
    if (!switcherEl) return;

    const { min, max, step, default: defaultSize } = FONT_SIZE_CONFIG;

    /**
     * Applies a new font size to the document root and saves it.
     * @param {number} newSize The new font size in pixels.
     */
    const applyFontSize = (newSize) => {
        // Clamp the size within the defined min/max bounds.
        const clampedSize = Math.max(min, Math.min(max, newSize));
        
        document.documentElement.style.setProperty('--base-font-size', `${clampedSize}px`);
        localStorage.setItem('story-font-size', clampedSize);
    };
    
    switcherEl.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const currentSize = parseFloat(localStorage.getItem('story-font-size')) || defaultSize;
        
        let newSize;
        switch (action) {
            case 'increase':
                newSize = currentSize + step;
                break;
            case 'decrease':
                newSize = currentSize - step;
                break;
            case 'reset':
                newSize = defaultSize;
                break;
            default:
                return;
        }
        applyFontSize(newSize);
    });

    // Load and apply the saved font size on initial page load.
    const savedSize = parseFloat(localStorage.getItem('story-font-size')) || defaultSize;
    applyFontSize(savedSize);
}


/**
 * Initializes the application.
 */
async function init() {
    if (!storyListEl || !storyTitleEl || !storyMetaEl || !storyContentEl) {
        console.error("Initialization failed: One or more required DOM elements are missing.");
        return;
    }

    // First, fetch all story data to build our internal collection
    await buildStoryCollection();
    
    // Now that we have the data, we can build the UI and handle routing
    populateNav();
    handleRouting();
    setupThemeSwitcher();
    setupFontSizeSwitcher();

    // Listen for hash changes to load different stories/languages
    window.addEventListener('hashchange', handleRouting);
}

// Run the app once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', init);