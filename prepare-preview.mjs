// Build a double-clickable local copy from the editable source files.
// No package installation or web server is required for preview.html.
import { readFile, writeFile } from 'node:fs/promises';
const files = ['config.js', 'form-rules.js', 'dropdown.js', 'data.js', 'animations.js', 'monitor.js', 'main.js'];
let html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
let css = await readFile(new URL('./css/styles.css', import.meta.url), 'utf8');
const font = await readFile(new URL('./assets/fonts/ModernDOS8x16.ttf', import.meta.url));
css = css.replace('../assets/fonts/ModernDOS8x16.ttf', 'data:font/ttf;base64,' + font.toString('base64'));
const arrow = await readFile(new URL('./assets/icons/expand-indicator.svg', import.meta.url), 'utf8');
let code = '';
for (const file of files) {
  let source = await readFile(new URL(`./js/${file}`, import.meta.url), 'utf8');
  source = source.replace(/^import .+ from .+;\r?\n/gm, '').replace(/^export /gm, '');
  code += '\n' + source;
}
code = code.replace("'./assets/icons/expand-indicator.svg'", JSON.stringify('data:image/svg+xml,' + encodeURIComponent(arrow)));
html = html.replace('<link rel="stylesheet" href="./css/styles.css">', `<style>\n${css}\n</style>`)
  .replace(/  <script type="module" src="\.\/js\/main\.js"><\/script>\r?\n/, '')
  .replace('</body>', `<script>\n(() => {\n${code}\n})();\n</script>\n</body>`);
await writeFile(new URL('./preview.html', import.meta.url), html);
console.log('Ready: open preview.html in your browser.');


