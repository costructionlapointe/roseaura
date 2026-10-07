-- Apply only to a dedicated RoseAura project. Initial owner must be assigned out of band.
begin;
create schema if not exists ra_private;
revoke all on schema ra_private from public, anon, authenticated;
grant usage on schema ra_private to authenticated;
create table public.ra_roles (user_id uuid primary key references auth.users(id), role text not null check(role in ('admin','content_manager')));
create table public.ra_draft (id integer primary key check(id=1), content jsonb not null, revision bigint not null default 1);
create table public.ra_live (id integer primary key check(id=1), content jsonb not null);
create table public.ra_history (id bigint generated always as identity primary key, created_at timestamptz not null default now(), actor uuid references auth.users(id), action text not null, content jsonb not null, revision bigint not null);
alter table public.ra_roles enable row level security;
alter table public.ra_draft enable row level security;
alter table public.ra_live enable row level security;
alter table public.ra_history enable row level security;
revoke all on public.ra_roles,public.ra_draft,public.ra_live,public.ra_history from anon,authenticated;
grant select on public.ra_roles,public.ra_draft,public.ra_live,public.ra_history to authenticated;
grant select on public.ra_live to anon;
create policy own_role on public.ra_roles for select to authenticated using(user_id=(select auth.uid()));
create policy public_live on public.ra_live for select to anon,authenticated using(true);
create function ra_private.role() returns text language sql stable security definer set search_path='' as $$
  select role from public.ra_roles where user_id=auth.uid() and auth.uid() is not null
$$;
revoke all on function ra_private.role() from public,anon;
grant execute on function ra_private.role() to authenticated;
create policy manager_draft on public.ra_draft for select to authenticated using((select ra_private.role()) in ('admin','content_manager'));
create policy admin_history on public.ra_history for select to authenticated using((select ra_private.role())='admin');

-- Reject executable fields, technical settings and unsafe IDs, even for direct API calls.
create function ra_private.validate(c jsonb) returns void language plpgsql set search_path='' as $$
declare k text; item jsonb; group_name text; allowed text[];
begin
  if jsonb_typeof(c)<>'object' or octet_length(c::text)>2000000 then raise exception 'Contenu invalide'; end if;
  if not c ?& array['texts','images','products','categories','articles'] then raise exception 'Contenu incomplet';end if;
  for k in select jsonb_object_keys(c) loop
    if k not in ('texts','images','products','categories','articles') then raise exception 'Champ interdit';end if;
  end loop;
  foreach group_name in array array['texts','images','products','categories','articles'] loop
    if jsonb_typeof(c->group_name)<>'array' or jsonb_array_length(c->group_name)>2000 then raise exception 'Liste invalide';end if;
    allowed := case group_name
      when 'texts' then array['id','label','value']
      when 'images' then array['id','src','alt']
      when 'products' then array['id','nom','cat','prix','avant','emoji','couleur','note','avis','badge','desc','photo','unavailable']
      when 'categories' then array['id','nom']
      else array['id','title','body','photo','published'] end;
    for item in select value from jsonb_array_elements(c->group_name) loop
      if jsonb_typeof(item)<>'object' or (item->>'id') is null or (item->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$' then raise exception 'Identifiant invalide';end if;
      for k in select jsonb_object_keys(item) loop
        if not k=any(allowed) then raise exception 'Champ interdit';end if;
        if jsonb_typeof(item->k) not in ('string','number','boolean','null') or length(item->>k)>100000 then raise exception 'Valeur invalide';end if;
      end loop;
      if group_name='texts' and jsonb_typeof(item->'value') is distinct from 'string' then raise exception 'Texte invalide';end if;
      if group_name='products' then
        if jsonb_typeof(item->'prix') is distinct from 'number' or (item->>'prix')::numeric<0 or (item->>'prix')::numeric>1000000 or (item->>'cat') !~ '^[a-zA-Z0-9_-]{1,80}$' then raise exception 'Produit invalide';end if;
        if item ? 'avant' and (jsonb_typeof(item->'avant') is distinct from 'number' or (item->>'avant')::numeric<0) then raise exception 'Promotion invalide';end if;
      end if;
      if group_name='articles' and jsonb_typeof(item->'published') is distinct from 'boolean' then raise exception 'Article invalide';end if;
      foreach k in array array['src','photo'] loop
        if coalesce(item->>k,'')<>'' and (item->>k) !~ '^https://' then raise exception 'Image HTTPS requise';end if;
      end loop;
    end loop;
    if (select count(*) from jsonb_array_elements(c->group_name))<>(select count(distinct value->>'id') from jsonb_array_elements(c->group_name)) then raise exception 'Identifiants en double';end if;
  end loop;
end $$;
revoke all on function ra_private.validate(jsonb) from public,anon,authenticated;

-- All writes go through this transaction. No client has direct table write privileges.
create function ra_private.write_content(operation text, payload jsonb, expected_revision bigint, history_id bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare current_row public.ra_draft; next_content jsonb; actor_role text;
begin
  actor_role:=ra_private.role();
  if auth.uid() is null or actor_role is null or actor_role not in ('admin','content_manager') then raise exception 'Accès refusé' using errcode='42501';end if;
  perform pg_advisory_xact_lock(721946);
  select * into current_row from public.ra_draft where id=1 for update;
  if coalesce(current_row.revision,0)<>expected_revision then raise exception 'Une autre personne a modifié le contenu. Rechargez avant de continuer.' using errcode='40001';end if;
  if operation='restore' then
    if actor_role<>'admin' then raise exception 'Administrateur requis' using errcode='42501';end if;
    select content into next_content from public.ra_history where id=history_id;
    if next_content is null then raise exception 'Version introuvable';end if;
  elsif operation='save' then next_content:=payload;
  elsif operation='publish' then
    if current_row.content is null then raise exception 'Aucun brouillon';end if;
    next_content:=current_row.content;
  else raise exception 'Action interdite';end if;
  perform ra_private.validate(next_content);
  if current_row.content is not null then
    insert into public.ra_history(actor,action,content,revision) values(auth.uid(),operation||': avant',current_row.content,current_row.revision);
  end if;
  if operation='publish' then
    -- Separate live snapshot preserves exactly what visitors saw before publication.
    insert into public.ra_history(actor,action,content,revision)
      select auth.uid(),'public: avant',content,current_row.revision from public.ra_live where id=1;
    insert into public.ra_live(id,content) values(1,next_content) on conflict(id) do update set content=excluded.content;
  end if;
  insert into public.ra_draft(id,content,revision) values(1,next_content,expected_revision+1)
    on conflict(id) do update set content=excluded.content,revision=excluded.revision;
  insert into public.ra_history(actor,action,content,revision) values(auth.uid(),operation||': après',next_content,expected_revision+1);
  return expected_revision+1;
end $$;
revoke all on function ra_private.write_content(text,jsonb,bigint,bigint) from public,anon;
grant execute on function ra_private.write_content(text,jsonb,bigint,bigint) to authenticated;
create function public.ra_write(operation text, payload jsonb default null, expected_revision bigint default 0, history_id bigint default null)
returns bigint language sql security invoker set search_path='' as $$
  select ra_private.write_content(operation,payload,expected_revision,history_id)
$$;
revoke all on function public.ra_write(text,jsonb,bigint,bigint) from public,anon;
grant execute on function public.ra_write(text,jsonb,bigint,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('roseaura-media','roseaura-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy media_read on storage.objects for select to anon,authenticated using(bucket_id='roseaura-media');
create policy media_insert on storage.objects for insert to authenticated with check(bucket_id='roseaura-media' and (select ra_private.role()) in ('admin','content_manager'));
-- Media is immutable: removing a photo from content does not destroy previous snapshots.
commit;
