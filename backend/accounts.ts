// Deploy as Supabase Edge Function `ra-accounts`, with gateway JWT verification enabled.
// Service credentials exist only in the Edge Function environment, never in frontend files.
const allowedOrigin = 'https://roseauras.ca';
Deno.serve(async request => {
  const headers = {'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store'};
  const reply=(status:number,message:string)=>new Response(JSON.stringify({message}),{status,headers});
  if(request.headers.get('Origin')!==allowedOrigin) return reply(403,'Origine refusée');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,'Méthode refusée');
  const url=Deno.env.get('SUPABASE_URL')!, publishable=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization=request.headers.get('Authorization')||'';
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:publishable,Authorization:authorization}});
  if(!userResponse.ok)return reply(401,'Connexion requise');
  const user=await userResponse.json();
  const roleResponse=await fetch(url+`/rest/v1/ra_roles?user_id=eq.${encodeURIComponent(user.id)}&select=role`,{headers:{apikey:publishable,Authorization:authorization}});
  const roles=roleResponse.ok?await roleResponse.json():[];
  if(roles[0]?.role!=='admin')return reply(403,'Administrateur requis');
  let body;try{body=await request.json();}catch{return reply(400,'Demande invalide');}
  if(Object.keys(body).some(k=>!['email','password','action'].includes(k))||typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email))return reply(400,'Courriel valide requis');
  const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
  if(body.action==='recovery') {
    const lookup=await fetch(url+'/auth/v1/admin/users?page=1&per_page=1000',{headers:adminHeaders});
    const list=lookup.ok?await lookup.json():{users:[]};
    const target=list.users?.find((u:{email:string})=>u.email.toLowerCase()===body.email.toLowerCase());
    if(!target)return reply(404,'Compte introuvable');
    const targetResponse=await fetch(url+`/rest/v1/ra_roles?user_id=eq.${encodeURIComponent(target.id)}&select=role`,{headers:adminHeaders});
    const targetRoles=targetResponse.ok?await targetResponse.json():[];
    if(target.id!==user.id && targetRoles[0]?.role!=='content_manager')return reply(403,'Action refusée');
    const generated=await fetch(url+'/auth/v1/admin/generate_link',{method:'POST',headers:adminHeaders,body:JSON.stringify({type:'recovery',email:body.email})});
    const data=await generated.json();
    if(!generated.ok)return reply(400,'Impossible de générer le lien');
    return new Response(JSON.stringify({url:`https://roseauras.ca/admin/#token_hash=${encodeURIComponent(data.hashed_token)}&type=recovery`}),{status:200,headers});
  }
  if(body.action==='invite') {
    const generated=await fetch(url+'/auth/v1/admin/generate_link',{method:'POST',headers:adminHeaders,body:JSON.stringify({type:'invite',email:body.email.trim()})});
    const data=await generated.json();
    if(!generated.ok)return reply(400,'Impossible de créer cette invitation. Vérifiez si le compte existe déjà.');
    const assigned=await fetch(url+'/rest/v1/ra_roles',{method:'POST',headers:adminHeaders,body:JSON.stringify({user_id:data.id,role:'content_manager'})});
    if(!assigned.ok)return reply(500,'Invitation interrompue. Aucun accès accordé.');
    return new Response(JSON.stringify({url:`https://roseauras.ca/admin/#token_hash=${encodeURIComponent(data.hashed_token)}&type=invite`,id:data.id}),{status:201,headers});
  }
  if(body.action && body.action!=='create')return reply(400,'Action invalide');
  if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)return reply(400,'Mot de passe de 12 à 128 caractères requis');
  const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:adminHeaders,body:JSON.stringify({email:body.email.trim(),password:body.password,email_confirm:true})});
  if(!created.ok)return reply(400,'Impossible de créer ce compte. Vérifiez si cette adresse possède déjà un compte.');
  const account=await created.json();
  const assigned=await fetch(url+'/rest/v1/ra_roles',{method:'POST',headers:adminHeaders,body:JSON.stringify({user_id:account.id,role:'content_manager'})});
  if(!assigned.ok){
    await fetch(url+'/auth/v1/admin/users/'+account.id,{method:'DELETE',headers:adminHeaders});
    return reply(500,'Création interrompue. Aucun accès accordé.');
  }
  return reply(201,'Gestionnaire de contenu créé');
});
