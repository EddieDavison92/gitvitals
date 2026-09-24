export const THEME_KEY = "gao:theme";

/** Inline in <head> so the saved theme applies before first paint. */
export const THEME_SCRIPT = `(()=>{try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
