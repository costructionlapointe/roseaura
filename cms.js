/* Content-only rendering: no HTML, CSS, executable attributes or technical settings. */
(() => {
  const cfg = window.ROSEAURA_CMS;
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      return n.textContent.trim() && !n.parentElement.closest('script,style,#grille,#cats,#tiroir,#quizZone,#quizScore,#modal,#cms-articles')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const imageNodes = [...document.querySelectorAll('img')];
  const extraTexts = new Map();
  for(const [kind,collection,titleIndex,bodyIndex] of [['subject',SUJETS,1,2],['guide',GUIDES,0,1]]) {
    for(const [id,item] of Object.entries(collection)) {
      for(const [name,index] of [['title',titleIndex],['body',bodyIndex]]) {
        const temp=document.createElement('div'); temp.innerHTML=item[index];
        extraTexts.set(`${kind}-${id.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}-${name}`,{item,index,initial:temp.textContent,label:`${kind==='guide'?'Guide':'Sujet'} : ${item[titleIndex]}`});
      }
    }
  }
  const base = {
    schemaVersion: "aura-2026-10",
    texts: [...textNodes.map((n,i) => ({id: String(i), label: n.parentElement.closest('section')?.id || 'Page', value:n.textContent})),...Array.from(extraTexts,([id,t])=>({id,label:t.label,value:t.initial}))],
    images: imageNodes.map((n,i) => ({id:String(i),src:new URL(n.getAttribute('src')||'', 'https://roseauras.ca/').href,alt:n.alt})),
    products: PRODUITS.map(({cout,fournisseur,stripe,...p}) => ({...p, photo:'', unavailable:BIENTOT.has(p.id)})),
    categories: CATEGORIES.map(c=>({...c})), articles: []
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => {try {const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  function render(data) {
    // Numeric content IDs from the former layout cannot be applied to this edition.
    if(data.schemaVersion !== base.schemaVersion) return;
    for(const t of data.texts || []) {
      if(textNodes[Number(t.id)]) textNodes[Number(t.id)].textContent=t.value;
      const extra=extraTexts.get(t.id);
      if(extra && extra.initial!==t.value) extra.item[extra.index]=escape(t.value).replace(/\n/g,'<br>');
    }
    for(const t of data.images || []) if(imageNodes[Number(t.id)]) {
      const node=imageNodes[Number(t.id)]; node.alt=t.alt||'';
      if(t.src && safeUrl(t.src)){node.src=safeUrl(t.src);node.hidden=false;}else node.hidden=true;
    }
    let gallery=document.getElementById('cms-gallery');
    const addedImages=(data.images||[]).filter(t=>!/^\d+$/.test(t.id)&&t.src&&safeUrl(t.src));
    if(!gallery && addedImages.length){gallery=document.createElement('section');gallery.id='cms-gallery';gallery.className='wrap';document.querySelector('footer')?.before(gallery);}
    if(gallery)gallery.innerHTML=addedImages.map(t=>`<img src="${escape(safeUrl(t.src))}" alt="${escape(t.alt)}" style="max-width:100%;max-height:360px;margin:12px">`).join('');
    if(Array.isArray(data.categories)) {
      CATEGORIES.splice(0,CATEGORIES.length,...data.categories.map(c=>({id:c.id,nom:escape(c.nom)})));
      const originalLabels={securite:'Sécurité',deco:'Déco',papeterie:'Papeterie',ebooks:'Ebook',formations:'Formation',gourmandises:'Gourmandise'};
      window.ROSEAURA_CATEGORY_LABELS=Object.fromEntries(CATEGORIES.map(c=>[c.id,base.categories.find(b=>b.id===c.id)?.nom===c.nom ? (originalLabels[c.id]||c.nom) : c.nom]));
    }
    if(Array.isArray(data.products)) {
      const originals=new Map(PRODUITS.map(p=>[p.id,p])); BIENTOT.clear();
      PRODUITS.splice(0,PRODUITS.length,...data.products.map(p=>{
        if(p.unavailable) BIENTOT.add(p.id);
        const original=originals.get(p.id)||{};
        return {...original,id:p.id,cat:p.cat,nom:escape(p.nom),desc:escape(p.desc),prix:Number(p.prix),avant:Number(p.avant)||0,
          note:Number(p.note)||0,avis:Number(p.avis)||0,badge:['vente','coup'].includes(p.badge)?p.badge:'',
          couleur:/^var\(--[a-z-]+\)$/.test(p.couleur)?p.couleur:'var(--rose-clair)',
          emoji:p.photo && safeUrl(p.photo)?`<img src="${escape(safeUrl(p.photo))}" alt="${escape(p.nom)}" style="width:100%;height:100%;object-fit:cover">`:escape(p.emoji||'🌸')};
      }));
      if(typeof rendreCats === "function") rendreCats();
      if(typeof rendreGrille === "function") rendreGrille();
      if(typeof majCompteur === "function") majCompteur();
    }
    let articles=document.getElementById('cms-articles');
    if(!articles && data.articles?.some(a=>a.published)) {
      articles=document.createElement('section');articles.id='cms-articles';articles.className='wrap';
      document.querySelector('footer')?.before(articles);
    }
    if(articles) articles.innerHTML=data.articles.filter(a=>a.published).map(a=>`<article style="margin:24px 0"><h2>${escape(a.title)}</h2>${a.photo&&safeUrl(a.photo)?`<img src="${escape(safeUrl(a.photo))}" alt="${escape(a.title)}" style="max-width:100%;max-height:360px">`:''}<p style="white-space:pre-wrap">${escape(a.body)}</p></article>`).join('');
  }
  // Preview is restricted to the same-origin admin frame and never saved on the public site.
  if(window.parent!==window && new URLSearchParams(location.search).has('cms-preview')) {
    addEventListener('message',e=>{
      if(e.origin!==location.origin || e.source!==parent) return;
      if(e.data?.type==='roseaura-read') parent.postMessage({type:'roseaura-base',data:base},location.origin);
      if(e.data?.type==='roseaura-preview') render(e.data.data);
    });
    parent.postMessage({type:'roseaura-ready'},location.origin);
  } else if(cfg?.url && cfg?.key) {
    fetch(`${cfg.url}/rest/v1/ra_live?id=eq.1&select=content`,{headers:{apikey:cfg.key},cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{if(rows[0])render(rows[0].content);}).catch(()=>{});
  }
})();
