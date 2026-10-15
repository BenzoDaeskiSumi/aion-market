/* Aion 2 Market — Start-up: settings, icons, servers, names, recipes, then the chosen server. Classic script: shares globals with the others, loaded in order by index.html. */
Promise.all([get('data/settings.json'), get('data/icons.json').catch(() => ({})), get('data/servers.json').catch(() => [{id: 12305, name: 'Marchutan'}]),
  LANG === 'fr' ? get('data/names_fr.json').catch(() => ({})) : {}, get('data/recipes.json').catch(() => null)])
  .then(([settings, icons, servers, names, recipes]) => {
    S = settings[0] || settings; ICONS = icons; NAMES = names || {}; Object.assign(DICT, NAMES); RECIPES = recipes;
    if (LANG === 'fr') {      // credit for the French item names (followed link, as MetaBot.GG asks)
      const a = Object.assign(document.createElement('a'), {href: 'https://metabot.gg/fr_FR/aion-2/items', target: '_blank', textContent: 'MetaBot.GG'});
      document.querySelector('footer').append(' Noms des objets en français : ', a, '.');
    }
    const qs = new URLSearchParams(location.search);              // deep link from the Discord bot: ?s=<server>&item=<name>
    if (servers.some((x) => x.id === +qs.get('s'))) SERVER = +qs.get('s');
    if (!servers.some((x) => x.id === SERVER)) SERVER = 12305;
    srvSel.replaceChildren(...servers.map((x) => Object.assign(document.createElement('option'), {value: x.id, textContent: x.name, selected: x.id === SERVER})));
    return loadServer().then(() => {
      const it = qs.get('item'); if (!it || !ITEMS.some((r) => r.item === it)) return;
      picked = it; drawTable(); drawChart();
      const row = document.querySelector('#rows tr.sel'), sc = document.querySelector('.scroll');
      if (row && sc) sc.scrollTo({top: row.offsetTop - sc.clientHeight / 2});
    });
  })
  .catch(() => { const t = document.getElementById('takeaway'); t.textContent = 'Non riesco a caricare i dati. Ricarica la pagina tra qualche secondo.'; t.classList.add('err'); });
