(() => {
  const BUILD_STATS = [
    ['attackDamage', 'Dano de ataque', 'FlatPhysicalDamageMod', 'flat'],
    ['abilityPower', 'Poder de habilidade', 'FlatMagicDamageMod', 'flat'],
    ['health', 'Vida', 'FlatHPPoolMod', 'flat'],
    ['armor', 'Armadura', 'FlatArmorMod', 'flat'],
    ['magicResist', 'Resistência mágica', 'FlatSpellBlockMod', 'flat'],
    ['attackSpeed', 'Velocidade de ataque', 'PercentAttackSpeedMod', 'attackSpeed'],
    ['mana', 'Mana', 'FlatMPPoolMod', 'flat'],
    ['haste', 'Aceleração de habilidade', 'FlatHasteMod', 'flat'],
    ['critChance', 'Chance de crítico', 'FlatCritChanceMod', 'percent'],
    [
      'movementSpeedPercent',
      'Velocidade de movimento',
      'PercentMovementSpeedMod',
      'percent',
    ],
    ['movementSpeed', 'Velocidade de movimento', 'FlatMovementSpeedMod', 'flat'],
    ['lifeSteal', 'Roubo de vida', 'PercentLifeStealMod', 'percent'],
  ];

  const normalize = (value) =>
    String(value ?? '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao carregar dados (${response.status}).`);
    return response.json();
  }

  function isAvailableItem(item) {
    return Boolean(
      item.maps?.['11'] === true &&
      item.gold?.purchasable === true &&
      Number(item.gold.total) > 0 &&
      item.inStore !== false &&
      item.hideFromAll !== true &&
      !item.requiredAlly &&
      item.name &&
      item.image?.full,
    );
  }

  function normalizeItems(itemCatalog) {
    const entries = Object.entries(itemCatalog.data || {})
      .filter(([, item]) => isAvailableItem(item))
      .map(([id, item]) => ({ ...item, id: String(id) }));
    const groups = new Map(
      (itemCatalog.groups || []).map((group) => [
        group.id,
        Number(group.MaxGroupOwnable),
      ]),
    );
    const nameCounts = new Map();
    entries.forEach((item) => {
      const key = normalize(item.name);
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    });
    const items = entries
      .map((item) => {
        const restrictionGroups = [
          item.group,
          ...(item.tags || []).filter((tag) => groups.has(tag)),
          ...(groups.has(item.id) ? [item.id] : []),
        ].filter((group, index, all) => group && all.indexOf(group) === index);
        const limits = restrictionGroups.map((group) => groups.get(group));
        const positiveLimits = limits.filter(
          (limit) => Number.isFinite(limit) && limit > 0,
        );
        const rawStackLimit = Number(item.stacks);
        const stackLimit =
          Number.isFinite(rawStackLimit) && rawStackLimit > 1 ? rawStackLimit : 1;
        const repeatLimit = positiveLimits.length
          ? Math.min(stackLimit, ...positiveLimits)
          : limits.some((limit) => limit === -1)
            ? stackLimit > 1
              ? stackLimit
              : 6
            : stackLimit;
        return {
          ...item,
          restrictionGroups,
          groupLimits: Object.fromEntries(
            restrictionGroups.map((group) => [group, groups.get(group)]),
          ),
          repeatLimit,
          displayName:
            nameCounts.get(normalize(item.name)) > 1
              ? `${item.name} · ID ${item.id}`
              : item.name,
        };
      })
      .sort(
        (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
      );
    return {
      items,
      itemById: new Map(items.map((item) => [item.id, item])),
      groups: Object.fromEntries(groups),
    };
  }

  async function loadStaticData() {
    const versions = await fetchJson(
      'https://ddragon.leagueoflegends.com/api/versions.json',
    );
    const patch = versions[0];
    const base = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/pt_BR`;
    const [championCatalog, itemCatalog, runes] = await Promise.all([
      fetchJson(`${base}/champion.json`),
      fetchJson(`${base}/item.json`),
      fetchJson(`${base}/runesReforged.json`),
    ]);
    const { items, itemById, groups } = normalizeItems(itemCatalog);
    return {
      patch,
      champions: Object.values(championCatalog.data).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
      items,
      itemById,
      groups,
      runes,
      championCatalog,
    };
  }

  function canAddItem(item, selectedItems, championId = '') {
    if (!item) return { allowed: false, reason: 'Este item não está disponível.' };
    if (selectedItems.length >= 6)
      return {
        allowed: false,
        reason: 'Inventário completo: o limite é de seis espaços.',
      };
    if (item.requiredChampion && item.requiredChampion !== championId)
      return {
        allowed: false,
        reason: `Este item exige o campeão ${item.requiredChampion}.`,
      };

    const sameId = selectedItems.filter((current) => current.id === item.id).length;
    const repeatLimit = Number(item.repeatLimit || 1);
    if (sameId >= repeatLimit)
      return {
        allowed: false,
        reason:
          repeatLimit > 1
            ? `O limite oficial para este item é ${repeatLimit} unidade(s).`
            : 'Este item não pode ser repetido nesta build.',
      };

    for (const [groupId, rawLimit] of Object.entries(item.groupLimits || {})) {
      const groupLimit = Number(rawLimit);
      if (groupLimit > 0) {
        const sameGroup = selectedItems.filter((current) =>
          current.restrictionGroups?.includes(groupId),
        ).length;
        if (sameGroup >= groupLimit)
          return {
            allowed: false,
            reason: 'A restrição oficial deste grupo impede outra unidade na build.',
          };
      }
    }
    return { allowed: true, reason: '' };
  }

  function sanitizeBuildIds(itemIds, itemById, championId = '') {
    const selected = [];
    const warnings = [];
    for (const id of Array.isArray(itemIds) ? itemIds : []) {
      if (!id) {
        selected.push(null);
        continue;
      }
      const item = itemById.get(String(id));
      if (!item) {
        warnings.push(`ID ${id} indisponível no catálogo atual`);
        selected.push(null);
        continue;
      }
      const validation = canAddItem(item, selected.filter(Boolean), championId);
      if (!validation.allowed) {
        warnings.push(`${item.name}: ${validation.reason}`);
        selected.push(null);
        continue;
      }
      selected.push(item);
    }
    return {
      slots: Array.from({ length: 6 }, (_, index) => selected[index] || null),
      warnings,
    };
  }

  function calculateBuild(championDetail, items) {
    const stats = championDetail?.stats || {};
    const bonuses = {};
    let cost = 0;
    for (const item of items.filter(Boolean)) {
      cost += Number(item.gold?.total || 0);
      for (const [, , statKey] of BUILD_STATS)
        bonuses[statKey] = (bonuses[statKey] || 0) + Number(item.stats?.[statKey] || 0);
    }
    const base = {
      attackDamage: Number(stats.attackdamage || 0),
      abilityPower: 0,
      health: Number(stats.hp || 0),
      armor: Number(stats.armor || 0),
      magicResist: Number(stats.spellblock || 0),
      attackSpeed: Number(stats.attackspeed || 0),
      mana: Number(stats.mp || 0),
      haste: 0,
      critChance: 0,
      movementSpeed: Number(stats.movespeed || 0),
      lifeSteal: 0,
    };
    const total = {
      attackDamage: base.attackDamage + (bonuses.FlatPhysicalDamageMod || 0),
      abilityPower: bonuses.FlatMagicDamageMod || 0,
      health: base.health + (bonuses.FlatHPPoolMod || 0),
      armor: base.armor + (bonuses.FlatArmorMod || 0),
      magicResist: base.magicResist + (bonuses.FlatSpellBlockMod || 0),
      attackSpeed: base.attackSpeed * (1 + (bonuses.PercentAttackSpeedMod || 0)),
      mana: base.mana + (bonuses.FlatMPPoolMod || 0),
      haste: bonuses.FlatHasteMod || 0,
      critChance: bonuses.FlatCritChanceMod || 0,
      movementSpeed:
        base.movementSpeed * (1 + (bonuses.PercentMovementSpeedMod || 0)) +
        (bonuses.FlatMovementSpeedMod || 0),
      lifeSteal: bonuses.PercentLifeStealMod || 0,
    };
    return { base, bonuses, total, cost };
  }

  window.RiftBuildCore = {
    BUILD_STATS,
    normalize,
    fetchJson,
    isAvailableItem,
    normalizeItems,
    loadStaticData,
    canAddItem,
    sanitizeBuildIds,
    calculateBuild,
  };
})();
