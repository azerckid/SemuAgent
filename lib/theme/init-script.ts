/** Inline FOUC-prevention script for `storageKey=semuagent-theme` + class attribute. */
export const SEMUAGENT_THEME_STORAGE_KEY = 'semuagent-theme'

/**
 * Runs before paint from root layout.
 * Kept as a string so Server Components can inject it without next-themes
 * rendering a React `<script>` (React 19 / Next 16 rejects that pattern).
 */
export const SEMUAGENT_THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var k=${JSON.stringify(SEMUAGENT_THEME_STORAGE_KEY)};var e=localStorage.getItem(k);var t=(e==="dark"||e==="light")?e:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");d.classList.remove("light","dark");d.classList.add(t);d.style.colorScheme=t;}catch(e){}})();`
