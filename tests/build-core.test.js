import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  new URL('../frontend/build-core.js', import.meta.url),
  'utf8',
);
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const { normalizeItems } = sandbox.window.RiftBuildCore;

function item(name, image, stats, overrides = {}) {
  return {
    name,
    description: '<mainText>Unique effect</mainText>',
    image: { full: image },
    stats,
    gold: { total: 3000, purchasable: true },
    tags: ['Damage'],
    maps: { 11: true },
    inStore: true,
    hideFromAll: false,
    from: ['1001'],
    into: [],
    depth: 3,
    ...overrides,
  };
}

test('keeps one canonical SR entry for exact duplicate item records', () => {
  const collector = item('A Coletora', '6676.png', { FlatPhysicalDamageMod: 50 });
  const catalog = {
    groups: [],
    data: {
      6676: collector,
      667666: { ...collector },
      3001: item('Artefato', '3001.png', { FlatHPPoolMod: 200 }),
      3002: item('Artefato', '3001.png', { FlatHPPoolMod: 200 }),
      3003: item('Artefato', '3001.png', { FlatHPPoolMod: 250 }),
      4000: item('Outro mapa', '4000.png', {}, { maps: { 11: false, 12: true } }),
    },
  };

  const result = normalizeItems(catalog);
  const ids = result.items.map(({ id }) => id);

  assert.ok(ids.includes('6676'));
  assert.ok(!ids.includes('667666'));
  assert.equal(result.itemById.get('667666').id, '6676');
  assert.ok(ids.includes('3001'));
  assert.ok(!ids.includes('3002'));
  assert.ok(ids.includes('3003'), 'different stats remain a separate item');
  assert.ok(!ids.includes('4000'), 'items outside Summoner’s Rift are excluded');
  assert.ok(result.duplicateAudit.some((row) => row.variantId === '667666'));
});
