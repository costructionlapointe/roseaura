'use strict';
const cfg=window.ROSEAURA_CMS;
const $=s=>document.querySelector(s);
let token='',userId='',role='',revision=0,content=null,base=null,tab='texts',dirty=false,previewed=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(msg){$('#notice').textContent=msg;}
async function api(path,{method='GET',body,headers={}}={}) {
  const response=await fetch(cfg.url+path,{method,headers:{apikey:cfg.key,Authorization:`Bearer ${token||cfg.key}`,...(body && !(body instanceof File)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof File?body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>null);
  if(!response.ok) {
    if(response.status===401) logout();
    throw Error(data?.message||data?.msg||data?.error_description||'Cette action a échoué. Réessayez.');
  }
  return data;
}
async function run(work){document.body.classList.add('busy');try{await work();}catch(e){notify(e.message);}finally{document.body.classList.remove('busy');}}
function changed(){dirty=true;previewed=false;$('#publish').disabled=true;}
async function load(){
  const rows=await api('/rest/v1/ra_draft?id=eq.1&select=*');
  if(!rows.length && !base)throw Error('Le contenu initial est encore en chargement. Réessayez dans quelques secondes.');
  content=structuredClone(rows[0]?.content||base);revision=rows[0]?.revision||0;dirty=false;previewed=false;
  $('#publish').disabled=true;render();
}
$('#loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{
  if(!cfg?.url||!cfg?.key)throw Error('L’administration attend l’activation du service sécurisé par le propriétaire.');
  const form=new FormData(e.target);
  const session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:form.get('email'),password:form.get('password')}});
  token=session.access_token;userId=session.user.id; e.target.password.value='';
  const roles=await api(`/rest/v1/ra_roles?user_id=eq.${encodeURIComponent(userId)}&select=role`);role=roles[0]?.role;
  if(!['admin','content_manager'].includes(role)){logout();throw Error('Ce compte n’a pas accès à l’administration.');}
  await load();$('#login').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;
  $('#role').textContent=role==='admin'?'Administrateur':'Gestionnaire de contenu';$('#historyTab').hidden=role!=='admin';$('#accountsTab').hidden=role!=='admin';notify('Connexion réussie.');
});};
function logout(){token='';userId='';role='';content=null;dirty=false;$('#workspace').hidden=true;$('#login').hidden=false;$('#logout').hidden=true;$('#role').textContent='';$('#editor').replaceChildren();$('#previewDialog').close();$('#previewFrame').src='about:blank';}
$('#logout').onclick=()=>run(async()=>{try{await api('/auth/v1/logout',{method:'POST'});}finally{logout();notify('Déconnecté.');}});
$('#passwordChange').onclick=()=>$('#passwordDialog').showModal();
$('#closePassword').onclick=()=>$('#passwordDialog').close();
$('#passwordForm').onsubmit=e=>{e.preventDefault();run(async()=>{await api('/auth/v1/user',{method:'PUT',body:{password:new FormData(e.target).get('password')}});e.target.reset();$('#passwordDialog').close();notify('Votre mot de passe a été changé.');});};
$('#tabs').onclick=e=>{if(!e.target.dataset.tab)return;tab=e.target.dataset.tab;$('#search').value='';render();};
$('#search').oninput=render;
function field(item,key,label,type='text') {
  const id=`${tab}-${item.id}-${key}`;
  const value=item[key]??'';
  let control=type==='textarea'?`<textarea id="${id}" data-id="${esc(item.id)}" data-key="${key}">${esc(value)}</textarea>`:
    `<input id="${id}" data-id="${esc(item.id)}" data-key="${key}" type="${type}" ${type==='checkbox'?(value?'checked':''):`value="${esc(value)}"`} ${type==='number'?'min="0" max="1000000" step="0.01"':''}>`;
  return `<label for="${id}">${label}${control}</label>`;
}
function photo(item,key){return (item[key]?`<img src="${esc(item[key])}" alt="Aperçu">`:'')+field(item,key,'Adresse de la photo','url')+`<label>Choisir une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="${key}" data-id="${esc(item.id)}"></label><button data-remove-photo="${key}" data-id="${esc(item.id)}">Retirer la photo</button>`;}
function render(){
  if(!content)return;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===tab)));
  $('#add').hidden=!['images','products','categories','articles'].includes(tab);$('#search').hidden=['history','accounts'].includes(tab);
  if(tab==='history'){run(history);return;}
  if(tab==='accounts'){accounts();return;}
  const search=$('#search').value.toLowerCase();
  const rows=content[tab].filter(x=>JSON.stringify(x).toLowerCase().includes(search));
  $('#editor').innerHTML=rows.map(item=>{
    let fields='';
    if(tab==='texts')fields=`<p class="muted">${esc(item.label)} · Texte ${esc(item.id)}</p>`+field(item,'value','Texte','textarea');
    if(tab==='images')fields=photo(item,'src')+field(item,'alt','Description pour l’accessibilité');
    if(tab==='categories')fields=field(item,'nom','Nom');
    if(tab==='articles')fields=field(item,'title','Titre')+field(item,'body','Article','textarea')+photo(item,'photo')+field(item,'published','Visible après publication','checkbox');
    if(tab==='products')fields=field(item,'nom','Nom du produit')+field(item,'desc','Description','textarea')+field(item,'prix','Prix ($)','number')+field(item,'avant','Prix avant promotion ($, 0 sans promotion)','number')+
      `<label>Catégorie<select data-id="${esc(item.id)}" data-key="cat">${content.categories.filter(c=>c.id!=='tous').map(c=>`<option value="${esc(c.id)}" ${item.cat===c.id?'selected':''}>${esc(c.nom)}</option>`).join('')}</select></label>`+photo(item,'photo')+field(item,'emoji','Symbole en l’absence de photo')+field(item,'unavailable','Bientôt disponible','checkbox');
    return `<section class="card">${fields}${['products','categories','articles'].includes(tab)&&item.id!=='tous'?`<p><button class="danger" data-delete="${esc(item.id)}">Supprimer</button></p>`:''}</section>`;
  }).join('')||'<p>Aucun contenu dans cette section.</p>';
}
$('#editor').oninput=e=>{
  const {id,key}=e.target.dataset;if(!key)return;
  const item=content[tab]?.find(x=>x.id===id);if(!item)return;
  item[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Number(e.target.value):e.target.value;changed();
};
$('#editor').onchange=e=>{
  if(e.target.dataset.key && e.target.tagName==='SELECT')$('#editor').oninput(e);
  if(!e.target.dataset.upload)return;
  const file=e.target.files[0],key=e.target.dataset.upload,item=content[tab].find(x=>x.id===e.target.dataset.id);
  if(!file)return;
  run(async()=>{
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>5242880)throw Error('Choisissez une image JPG, PNG, WebP ou GIF de moins de 5 Mo.');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
    const path=`${userId}/${crypto.randomUUID()}.${ext}`;
    await api('/storage/v1/object/roseaura-media/'+path,{method:'POST',body:file,headers:{'Content-Type':file.type}});
    item[key]=cfg.url+'/storage/v1/object/public/roseaura-media/'+path;changed();render();notify('Photo ajoutée au brouillon.');
  });
};
$('#editor').onclick=e=>{
  const id=e.target.dataset.delete;
  if(id){
    if(tab==='categories' && content.products.some(p=>p.cat===id)){notify('Réaffectez les produits avant de supprimer cette catégorie.');return;}
    if(!confirm('Supprimer cet élément du brouillon? Le contenu publié reste visible jusqu’à la prochaine publication.'))return;
    content[tab]=content[tab].filter(x=>x.id!==id);changed();render();
  }
  const key=e.target.dataset.removePhoto;
  if(key && confirm('Retirer cette photo du brouillon?')){content[tab].find(x=>x.id===e.target.dataset.id)[key]='';changed();render();}
  if(e.target.dataset.restore && confirm('Revenir à cette version dans le brouillon? Une sauvegarde du brouillon actuel sera conservée.'))run(async()=>{
    await api('/rest/v1/rpc/ra_write',{method:'POST',body:{operation:'restore',expected_revision:revision,history_id:Number(e.target.dataset.restore)}});await load();notify('Version restaurée dans le brouillon. Vérifiez l’aperçu avant publication.');
  });
};
$('#add').onclick=()=>{
  const id=crypto.randomUUID();let item;
  if(tab==='articles')item={id,title:'Nouvel article',body:'',photo:'',published:false};
  if(tab==='images')item={id,src:'',alt:''};
  if(tab==='categories')item={id,nom:'Nouvelle catégorie'};
  if(tab==='products')item={id,nom:'Nouveau produit',desc:'',cat:content.categories.find(c=>c.id!=='tous')?.id||'ebooks',prix:0,avant:0,emoji:'🌸',couleur:'var(--rose-clair)',note:0,avis:0,badge:'',photo:'',unavailable:true};
  if(item){content[tab].unshift(item);changed();$('#search').value='';render();}
};
async function save(){revision=await api('/rest/v1/rpc/ra_write',{method:'POST',body:{operation:'save',payload:content,expected_revision:revision}});dirty=false;notify('Brouillon enregistré. Le site public n’a pas changé.');}
$('#save').onclick=()=>run(save);
$('#preview').onclick=()=>{run(async()=>{
  await save();$('#previewDialog').showModal();$('#previewFrame').src='../?cms-preview=1';
});};
$('#closePreview').onclick=()=>$('#previewDialog').close();
addEventListener('message',e=>{
  if(e.origin!==location.origin)return;
  if(e.source===$('#sourceFrame').contentWindow){
    if(e.data?.type==='roseaura-ready')e.source.postMessage({type:'roseaura-read'},location.origin);
    if(e.data?.type==='roseaura-base')base=e.data.data;
  }
  if(e.source===$('#previewFrame').contentWindow && e.data?.type==='roseaura-ready' && content && token){
    e.source.postMessage({type:'roseaura-preview',data:content},location.origin);previewed=true;$('#publish').disabled=false;
  }
});
$('#publish').onclick=()=>run(async()=>{
  if(dirty||!previewed)throw Error('Ouvrez l’aperçu du brouillon actuel avant de publier.');
  if(!confirm('Publier ce brouillon? Les visiteurs verront ces changements.'))return;
  revision=await api('/rest/v1/rpc/ra_write',{method:'POST',body:{operation:'publish',expected_revision:revision}});previewed=false;$('#publish').disabled=true;notify('Les changements sont publiés.');
});
async function history(){
  const rows=await api('/rest/v1/ra_history?select=id,created_at,actor,action,revision&order=id.desc&limit=100');
  if(tab!=='history')return;
  $('#editor').innerHTML=rows.map(r=>`<section class="card"><p>${esc(new Date(r.created_at).toLocaleString('fr-CA'))}</p><p>${esc(r.action)} · version ${r.revision}</p><p class="muted">Compte : ${esc(r.actor)}</p><button data-restore="${r.id}">Restaurer dans le brouillon</button></section>`).join('')||'<p>Aucune modification enregistrée.</p>';
}
function accounts(){
  $('#editor').innerHTML='<section class="card"><h2>Accorder un accès au contenu</h2><p>Le nouveau compte reçoit seulement le rôle Gestionnaire de contenu.</p><form id="inviteForm"><label>Courriel<input name="email" type="email" required></label><label>Mot de passe initial<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><button>Créer le compte</button></form></section>';
  $('#inviteForm').onsubmit=e=>{e.preventDefault();run(async()=>{const f=new FormData(e.target);await api('/functions/v1/ra-accounts',{method:'POST',body:{email:f.get('email'),password:f.get('password')}});e.target.password.value='';notify('Compte Gestionnaire de contenu créé. Communiquez son mot de passe de façon privée.');});};
}
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
