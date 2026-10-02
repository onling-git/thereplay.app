export default function htmlToPlainText(value) {
  if (!value) return '';

  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  parsed.querySelectorAll('script, style, template').forEach(element => element.remove());
  parsed.body.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6, blockquote').forEach(element => {
    element.before(parsed.createTextNode(' '));
    element.after(parsed.createTextNode(' '));
  });

  return parsed.body.textContent.replace(/\s+/g, ' ').trim();
}