-- Cross-user isolation + constraint tests. Run after shim + migrations 001-003.
\set ON_ERROR_STOP off
\set QUIET on
create temp table results (name text, ok boolean);
grant all on results to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','{"full_name":"Alice"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','{"full_name":"Bob"}');

-- helper: run a statement as a user; record pass/fail
create or replace function pg_temp.expect(name text, sql text, want_err boolean) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute sql; exception when others then failed := true; end;
  insert into results values (name, failed = want_err);
end $$;
grant execute on function pg_temp.expect(text,text,boolean) to authenticated, anon;

insert into results select 'signup trigger created 2 profiles', (select count(*) from public.profiles)=2;
insert into results select 'profile name from metadata', (select full_name from public.profiles where email='a@x.com')='Alice';

-- ALICE data (via privileged role = test setup)
insert into public.wardrobe_items (id,user_id,item_name,category,suggested_occasions) values
 ('a1111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Tee','Tops','{College}'),
 ('a1111111-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Jeans','Bottoms','{College}');
insert into public.wardrobe_items (id,user_id,item_name,category) values
 ('b1111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Bob Shirt','Tops');
insert into public.outfits (id,user_id,outfit_name,occasion,combo_key) values
 ('a2222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Alice Look','College','k1');
insert into public.outfit_items (outfit_id,wardrobe_item_id) values
 ('a2222222-0000-0000-0000-000000000001','a1111111-0000-0000-0000-000000000001'),
 ('a2222222-0000-0000-0000-000000000001','a1111111-0000-0000-0000-000000000002');
insert into public.saved_outfits (user_id,outfit_id) values ('aaaaaaaa-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id,name) values ('wardrobe-original','aaaaaaaa-0000-0000-0000-000000000001/tee.jpg');

-- ===== act as BOB =====
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);

insert into results select 'bob sees only own profile', (select count(*) from public.profiles)=1;
insert into results select 'bob cannot read alice wardrobe', (select count(*) from public.wardrobe_items where user_id='aaaaaaaa-0000-0000-0000-000000000001')=0;
insert into results select 'bob sees only his wardrobe item', (select count(*) from public.wardrobe_items)=1;
insert into results select 'bob cannot read alice outfits', (select count(*) from public.outfits)=0;
insert into results select 'bob cannot read alice outfit_items', (select count(*) from public.outfit_items)=0;
insert into results select 'bob cannot read alice saved', (select count(*) from public.saved_outfits)=0;
insert into results select 'bob cannot read alice storage', (select count(*) from storage.objects)=0;
select pg_temp.expect('bob cannot insert wardrobe as alice',
  $q$insert into public.wardrobe_items (user_id,item_name,category) values ('aaaaaaaa-0000-0000-0000-000000000001','x','Tops')$q$, true);
select pg_temp.expect('bob cannot save alice outfit',
  $q$insert into public.saved_outfits (user_id,outfit_id) values ('bbbbbbbb-0000-0000-0000-000000000002','a2222222-0000-0000-0000-000000000001')$q$, true);
select pg_temp.expect('bob cannot add feedback to alice outfit',
  $q$insert into public.outfit_feedback (user_id,outfit_id,feedback_type) values ('bbbbbbbb-0000-0000-0000-000000000002','a2222222-0000-0000-0000-000000000001','NOT_FOR_ME')$q$, true);
select pg_temp.expect('bob cannot log wear of alice outfit',
  $q$insert into public.outfit_wear_history (user_id,outfit_id) values ('bbbbbbbb-0000-0000-0000-000000000002','a2222222-0000-0000-0000-000000000001')$q$, true);
select pg_temp.expect('bob cannot upload into alice storage folder',
  $q$insert into storage.objects (bucket_id,name) values ('wardrobe-original','aaaaaaaa-0000-0000-0000-000000000001/evil.jpg')$q$, true);
select pg_temp.expect('bob CAN upload into own folder',
  $q$insert into storage.objects (bucket_id,name) values ('wardrobe-original','bbbbbbbb-0000-0000-0000-000000000002/ok.jpg')$q$, false);
select pg_temp.expect('bob cannot link own outfit to alice item',
  $q$insert into public.outfits (id,user_id,outfit_name,combo_key) values ('b2222222-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Bob Look','kb');
     insert into public.outfit_items (outfit_id,wardrobe_item_id) values ('b2222222-0000-0000-0000-000000000001','a1111111-0000-0000-0000-000000000001')$q$, true);
-- (the failed multi-statement above ran as one implicit tx in plpgsql block => outfit insert rolled back too)
select pg_temp.expect('bob cannot use invalid category',
  $q$insert into public.wardrobe_items (user_id,item_name,category) values ('bbbbbbbb-0000-0000-0000-000000000002','x','Hats')$q$, true);
select pg_temp.expect('bob cannot use invalid occasion',
  $q$insert into public.wardrobe_items (user_id,item_name,category,suggested_occasions) values ('bbbbbbbb-0000-0000-0000-000000000002','x','Tops','{Gym}')$q$, true);
select pg_temp.expect('bob cannot use invalid feedback type',
  $q$insert into public.outfit_feedback (user_id,outfit_id,feedback_type) values ('bbbbbbbb-0000-0000-0000-000000000002',gen_random_uuid(),'LOVE')$q$, true);

-- Bob update/delete of Alice rows must affect 0 rows
update public.wardrobe_items set item_name='hacked' where user_id='aaaaaaaa-0000-0000-0000-000000000001';
delete from public.wardrobe_items where user_id='aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set full_name='hacked' where id='aaaaaaaa-0000-0000-0000-000000000001';

-- Bob's own happy path + duplicate guards
insert into public.outfits (id,user_id,outfit_name,occasion,combo_key) values ('b2222222-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','Bob Look','Casual','kb2');
insert into public.outfit_items (outfit_id,wardrobe_item_id) values ('b2222222-0000-0000-0000-000000000002','b1111111-0000-0000-0000-000000000001');
insert into public.saved_outfits (user_id,outfit_id) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002');
select pg_temp.expect('duplicate save blocked',
  $q$insert into public.saved_outfits (user_id,outfit_id) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002')$q$, true);
insert into public.outfit_wear_history (user_id,outfit_id,occasion) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002','Casual');
select pg_temp.expect('duplicate same-day wear blocked',
  $q$insert into public.outfit_wear_history (user_id,outfit_id,occasion) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002','Casual')$q$, true);
insert into public.outfit_feedback (user_id,outfit_id,feedback_type) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002','NOT_FOR_ME');
select pg_temp.expect('duplicate not-for-me blocked',
  $q$insert into public.outfit_feedback (user_id,outfit_id,feedback_type) values ('bbbbbbbb-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000002','NOT_FOR_ME')$q$, true);
select pg_temp.expect('duplicate combination blocked',
  $q$insert into public.outfits (user_id,outfit_name,combo_key) values ('bbbbbbbb-0000-0000-0000-000000000002','dup','kb2')$q$, true);
select pg_temp.expect('user cannot insert profile directly',
  $q$insert into public.profiles (id,full_name) values (gen_random_uuid(),'x')$q$, true);
-- not-for-me must NOT touch items / saved / history
insert into results select 'not-for-me left item untouched', (select count(*) from public.wardrobe_items where id='b1111111-0000-0000-0000-000000000001')=1;
insert into results select 'worn did not create a saved row', (select count(*) from public.saved_outfits)=1;
-- deleting an item removes the outfits containing it (+ saved/feedback/history via cascade)
delete from public.wardrobe_items where id='b1111111-0000-0000-0000-000000000001';
insert into results select 'item delete removes its outfits + dependants',
  (select count(*) from public.outfits)=0 and (select count(*) from public.saved_outfits)=0
  and (select count(*) from public.outfit_wear_history)=0 and (select count(*) from public.outfit_feedback)=0;

-- ===== act as ANON =====
select set_config('request.jwt.claim.sub','',false);
reset role; set role anon;
select pg_temp.expect('anon cannot read wardrobe', $q$select * from public.wardrobe_items$q$, true);
select pg_temp.expect('anon cannot read profiles', $q$select * from public.profiles$q$, true);

-- ===== ALICE still intact =====
reset role;
insert into results select 'alice data untouched by bob',
  (select count(*) from public.wardrobe_items where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_name in ('Tee','Jeans'))=2
  and (select full_name from public.profiles where email='a@x.com')='Alice';

\set QUIET off
select case when ok then 'PASS' else 'FAIL' end as result, name from results order by ok, name;
select count(*) filter (where not ok) as failures, count(*) as total from results;
