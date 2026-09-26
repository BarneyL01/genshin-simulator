import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(import.meta.dirname, '..', '..', '.cache', 'http');

/** Fetch a page as plain text, cached on disk. Returns undefined on any failure or non-200. */
export function pageText(url: string): string | undefined {
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, createHash('sha1').update(url).digest('hex') + '.txt');
  if (existsSync(file)) {
    const t = readFileSync(file, 'utf8');
    return t === '\u0000' ? undefined : t;
  }
  try {
    const out = execSync(`curl -sL -m 40 -A "Mozilla/5.0" -w "\\n%{http_code}" "${url}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const nl = out.lastIndexOf('\n');
    const code = out.slice(nl + 1).trim();
    const html = out.slice(0, nl);
    if (code !== '200') {
      writeFileSync(file, '\u0000');
      return undefined;
    }
    const text = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<\/(p|h\d|li|tr|div)>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#8203;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/[ \t]+/g, ' ');
    writeFileSync(file, text);
    return text;
  } catch {
    return undefined;
  }
}
