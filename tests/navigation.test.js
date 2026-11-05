import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../frontend/', import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith('.html'));
const pages = new Map(
  await Promise.all(
    files.map(async (file) => [file, await readFile(new URL(file, root), 'utf8')]),
  ),
);

test('local HTML links resolve to an existing page and fragment', async () => {
  const broken = [];
  for (const [sourceFile, html] of pages) {
    const hrefs = [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1],
    );
    for (const href of hrefs) {
      if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) continue;
      const [pathname, fragment] = href.split('#', 2);
      const targetFile = pathname
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(sourceFile), pathname),
          )
        : sourceFile;
      let targetExists = true;
      try {
        await access(new URL(targetFile, root));
      } catch {
        targetExists = false;
      }
      if (!targetExists) {
        broken.push(`${sourceFile} -> ${href} (missing ${targetFile})`);
        continue;
      }
      if (fragment) {
        const target = pages.get(targetFile) || '';
        if (!new RegExp(`\\bid=["']${fragment}["']`).test(target))
          broken.push(`${sourceFile} -> ${href} (missing #${fragment})`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test('simulation route contains the team builder and functioning simulator controls', () => {
  const page = pages.get('simulation.html');
  assert.ok(page);
  assert.match(page, /id="builder"/);
  assert.match(page, /id="simulator"/);
  assert.match(page, /id="simulate"/);
  assert.match(page, /src="\.\/app\.js"/);
});
