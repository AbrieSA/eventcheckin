import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Synthetic PostgreSQL integration environment: execute the real migration,
// preserving its trigger definitions and role grants. Never contacts Supabase.
const db = new PGlite();
const migration = fs.readFileSync(new URL('../supabase/migrations/20260904090000_add_participant_import_updates.sql', import.meta.url), 'utf8');
const textFields = ['participant_id','first_name','last_name','email','phone','role','allergies_details','medical_condition_details','medicare','emergency_contact_name','emergency_contact_surname','emergency_contact_email','emergency_contact_phone','emergency_contact_relationship_to_minor','person_to_go_home_with','notes'];
const boolFields = ['is_18_or_over','has_allergies','has_medical_conditions','form_received','media_consent_given','emergency_treatment_consent_given','future_contact_permission_given','self_sign_out_permission'];
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
CREATE TABLE public.user_profiles(id uuid,user_role text,is_active boolean);
INSERT INTO public.user_profiles VALUES(auth.uid(),'admin',true);
CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT user_role FROM public.user_profiles WHERE id=auth.uid() AND is_active=true LIMIT 1 $$;
CREATE TABLE public.participants(id uuid PRIMARY KEY, ${textFields.map(f=>f+' text').join(',')}, ${boolFields.map(f=>f+' boolean DEFAULT false').join(',')}, date_of_birth date, age integer,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY,table_name text,record_id uuid,action_type text,old_values jsonb,new_values jsonb,changed_by uuid,change_description text,changed_fields text,record_name text);
CREATE FUNCTION public.calculate_age(d date) RETURNS integer LANGUAGE sql AS $$ SELECT date_part('year',age(current_date,d))::integer $$;`);
await db.exec(migration);
await db.exec(`ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,UPDATE ON public.participants TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
CREATE POLICY participants_read_test_fixture ON public.participants FOR SELECT TO authenticated USING (public.current_user_role() IS NOT NULL);`);
await db.exec(`CREATE TRIGGER trigger_update_participant_age BEFORE INSERT OR UPDATE OF date_of_birth ON public.participants FOR EACH ROW EXECUTE FUNCTION public.update_participant_age();
CREATE TRIGGER audit_participants AFTER INSERT OR UPDATE OR DELETE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
INSERT INTO public.participants(id,participant_id,first_name,last_name,email,phone) VALUES
('11111111-1111-4111-8111-111111111111','P1','Test','One','one@example.com','old'),
('22222222-2222-4222-8222-222222222222','P2','Test','Two','two@example.com','old'),
('33333333-3333-4333-8333-333333333333','P3','Same','Name','same@example.com','old'),
('44444444-4444-4444-8444-444444444444','P4','Same','Name','same@example.com','old');`);
const id='11111111-1111-4111-8111-111111111111';
const row=(updates,match={id},row_number=2)=>({row_number,match,updates});
const rpc=async(rows,dry=true)=>(await db.query('SELECT public.process_participant_import($1::jsonb,$2::boolean) AS result',[JSON.stringify(rows),dry])).rows[0].result;
const previewApply=async rows=>{const p=await rpc(rows);assert.equal(p.ok,true,JSON.stringify(p));return rpc(rows.map((r,i)=>({...r,expected_version:p.rows[i].expected_version})),false)};
let failed=0,passed=0;
async function test(name,fn){await db.exec('BEGIN');try{await fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}finally{await db.exec('ROLLBACK')}}
await test('preview is read only and apply updates with private audit',async()=>{const rows=[row({phone:'new',medicare:'PRIVATE_MEDICARE',allergies_details:'PRIVATE_MEDICAL'})];let p=await rpc(rows);assert.equal(p.changed_rows,1);assert.equal((await db.query('SELECT phone FROM participants WHERE id=$1',[id])).rows[0].phone,'old');let a=await previewApply(rows);assert.equal(a.updated_rows,1);const audit=(await db.query("SELECT * FROM audit_logs WHERE action_type='UPDATE'")).rows;assert.equal(audit.length,1);assert(!JSON.stringify(audit).includes('PRIVATE_'));assert.equal((await db.query('SELECT has_allergies FROM participants WHERE id=$1',[id])).rows[0].has_allergies,true)});
for(const [name,updates,match] of [
['unknown ID',{phone:'new'},{id:'55555555-5555-4555-8555-555555555555'}],['bad UUID',{phone:'new'},{id:'bad'}],['unknown participant ID',{phone:'new'},{participant_id:'none'}],['ambiguous email',{phone:'new'},{email:'same@example.com'}],['ambiguous name',{phone:'new'},{first_name:'Same',last_name:'Name'}],['partial name',{phone:'new'},{first_name:'Test'}],['conflicting identifiers',{phone:'new'},{id,email:'two@example.com'}],['no identifiers',{phone:'new'},{}],['bad email',{email:'bad'}],['bad emergency email',{emergency_contact_email:'bad'}],['bad boolean',{has_allergies:'maybe'}],['bad role',{role:'super_admin'}],['invalid date',{date_of_birth:'31/02/2020'}],['future DOB',{date_of_birth:'2999-01-01'}],['bad age',{age:'old'}],['out of range age',{age:'121'}],['conflicting age adult',{age:'12',is_18_or_over:'true'}],['conflicting allergy flag',{has_allergies:'false',allergies_details:'nuts'}],['conflicting medical flag',{has_medical_conditions:'false',medical_condition_details:'detail'}],['unsupported field',{created_at:'2020-01-01'}]]){
await test(name,async()=>assert.equal((await rpc([row(updates,match)])).ok,false));}
await test('duplicate target blocked',async()=>assert.equal((await rpc([row({phone:'a'}),row({phone:'b'},{participant_id:'P1'},3)])).ok,false));
for (const [name,rows] of [['nonobject row',[5]],['invalid row number',[{...row({phone:'new'}),row_number:'bad'}]],['nonobject match',[row({phone:'new'},5)]],['nonobject updates',[row(5)]]]) await test(name,async()=>assert.equal((await rpc(rows)).ok,false));
for (const [name,rows] of [['null input',null],['nonarray input',{}],['empty input',[]],['over row limit',Array.from({length:5001},()=>row({phone:'new'}))]]) await test(name,async()=>await assert.rejects(()=>rpc(rows),e=>e.code==='22023'));
await test('apply without preview version blocked',async()=>assert.equal((await rpc([row({phone:'new'})],false)).ok,false));
await test('invalid row prevents entire batch',async()=>{const rows=[row({phone:'new'}),row({age:'bad'},{participant_id:'P2'},3)];const a=await rpc(rows,false);assert.equal(a.ok,false);assert.equal((await db.query('SELECT phone FROM participants WHERE id=$1',[id])).rows[0].phone,'old')});
await test('stale preview blocks write',async()=>{const r=row({phone:'new'});const p=await rpc([r]);await db.query('UPDATE participants SET phone=$1 WHERE id=$2',['changed',id]);assert.equal((await rpc([{...r,expected_version:p.rows[0].expected_version}],false)).ok,false)});
await test('blank values preserve existing values',async()=>{const p=await rpc([row({phone:' '})]);assert.equal(p.unchanged_rows,1)});
await test('numeric adult field accepted',async()=>assert.equal((await previewApply([row({is_18_or_over:'yes'})])).ok,true));
await test('null mode rejected',async()=>await assert.rejects(()=>rpc([row({phone:'new'})],null),e=>e.code==='22023'));
for(const value of ['12abc','12.5','-1','999999999999999999999999','1e2']) await test('malformed numeric age '+value,async()=>{const p=await rpc([row({age:value})]);assert.equal(p.ok,false);assert(p.rows[0].errors.some(e=>e.includes('Age')))});
await test('no DOB age applies and derives adult',async()=>{assert.equal((await previewApply([row({age:'21'})])).updated_rows,1);const p=(await db.query('SELECT age,is_18_or_over,date_of_birth FROM participants WHERE id=$1',[id])).rows[0];assert.equal(p.age,21);assert.equal(p.is_18_or_over,true);assert.equal(p.date_of_birth,null)});
await test('DOB derives age and adult flag',async()=>{await previewApply([row({date_of_birth:'01/01/2015'})]);const t=(await db.query('SELECT age,is_18_or_over FROM participants WHERE id=$1',[id])).rows[0];assert.equal(t.is_18_or_over,false);assert(t.age>=10&&t.age<20)});
await test('existing DOB overrides supplied age',async()=>{await db.query("UPDATE participants SET date_of_birth='2015-01-01' WHERE id=$1",[id]);const p=await rpc([row({age:'99'})]);assert.equal(p.unchanged_rows,1);assert(p.rows[0].warnings.length>0)});
for(const [name,sql] of [['regular user',"UPDATE user_profiles SET user_role='user'"],['inactive admin','UPDATE user_profiles SET is_active=false'],['missing profile','DELETE FROM user_profiles'],['null role','UPDATE user_profiles SET user_role=NULL']]){
await test('authorization rejects '+name,async()=>{await db.exec(sql);await db.exec('SET LOCAL ROLE authenticated');await assert.rejects(()=>rpc([row({phone:'new'})]),e=>e.code==='42501')});}
await test('authenticated active admin can apply',async()=>{await db.exec('SET LOCAL ROLE authenticated');assert.equal((await previewApply([row({phone:'new'})])).ok,true)});
await test('authenticated superadmin can apply',async()=>{await db.exec("UPDATE user_profiles SET user_role='super_admin'; SET LOCAL ROLE authenticated");assert.equal((await previewApply([row({phone:'new'})])).ok,true)});
await test('regular user direct update denied by RLS',async()=>{await db.exec("UPDATE user_profiles SET user_role='user'; SET LOCAL ROLE authenticated");const r=await db.query('UPDATE participants SET phone=$1 WHERE id=$2 RETURNING id',['new',id]);assert.equal(r.rows.length,0);assert.equal((await db.query('SELECT phone FROM participants WHERE id=$1',[id])).rows[0].phone,'old')});
await test('admin direct update allowed by RLS',async()=>{await db.exec('SET LOCAL ROLE authenticated');const r=await db.query('UPDATE participants SET phone=$1 WHERE id=$2 RETURNING phone',['new',id]);assert.equal(r.rows.length,1);assert.equal(r.rows[0].phone,'new')});
await test('anonymous has no execution privilege',async()=>{await db.exec('SET LOCAL ROLE anon');await assert.rejects(()=>rpc([row({phone:'new'})]),e=>e.code==='42501')});
await test('unexpected SQL error rolls back earlier rows',async()=>{await db.exec("ALTER TABLE participants ADD CONSTRAINT reject_sentinel CHECK(phone <> 'REJECT')");const rows=[row({phone:'new'}),row({phone:'REJECT'},{participant_id:'P2'},3)];const p=await rpc(rows);await db.exec('SAVEPOINT before_apply');await assert.rejects(()=>rpc(rows.map((r,i)=>({...r,expected_version:p.rows[i].expected_version})),false));await db.exec('ROLLBACK TO SAVEPOINT before_apply');assert.equal((await db.query('SELECT phone FROM participants WHERE id=$1',[id])).rows[0].phone,'old')});
await test('51 rows are all previewed and applied',async()=>{const rows=Array.from({length:51},(_,i)=>row({phone:'new'},{participant_id:`B${i}`},i+2));await db.exec("INSERT INTO participants(id,participant_id,first_name,last_name,phone) SELECT md5('batch'||i)::uuid,'B'||i,'Batch',i::text,'old' FROM generate_series(0,50) i");const p=await rpc(rows);assert.equal(p.rows.length,51);assert.equal(p.changed_rows,51);const a=await previewApply(rows);assert.equal(a.updated_rows,51);assert.equal(Number((await db.query("SELECT count(*) AS count FROM participants WHERE participant_id LIKE 'B%' AND phone='new'")).rows[0].count),51)});
await test('exactly 5000 rows accepted',async()=>{await db.exec("INSERT INTO participants(id,participant_id,first_name,last_name,phone) SELECT md5('limit'||i)::uuid,'L'||i,'Limit',i::text,'old' FROM generate_series(0,4999) i");const p=await rpc(Array.from({length:5000},(_,i)=>row({phone:'old'},{participant_id:`L${i}`},i+2)));assert.equal(p.ok,true);assert.equal(p.rows.length,5000);assert.equal(p.unchanged_rows,5000)});
// Load the actual pure helpers without JSX/React or a live Supabase client.
// Delimiters intentionally fail loudly if helpers move, rather than copying implementation.
const modalSource=fs.readFileSync(new URL('../src/pages/database-participants/components/ImportUpdateModal.jsx',import.meta.url),'utf8');
const serviceSource=fs.readFileSync(new URL('../src/services/attendanceService.js',import.meta.url),'utf8');
const helperBody=modalSource.slice(modalSource.indexOf('const normalize ='),modalSource.indexOf('const ImportUpdateModal ='));
const {parseCsv,autoMapHeaders,buildImportRows}=Function(helperBody+';return {parseCsv,autoMapHeaders,buildImportRows};')();
const conversionBody=serviceSource.slice(serviceSource.indexOf('const toCamelCase ='),serviceSource.indexOf('const DATABASE_PAGE_SIZE'));
const {toSnakeCase,toCamelCase}=Function(conversionBody+';return {toSnakeCase,toCamelCase};')();
await test('CSV quoting CRLF BOM and blank preservation',async()=>{const parsed=parseCsv('\ufeffParticipant ID,Notes,Phone\r\nP1,"Line one\nLine two, ""quoted""",\r\n');assert.equal(parsed.length,2);assert.equal(parsed[1][1],'Line one\nLine two, "quoted"');assert.equal(parsed[1][2],'');assert.throws(()=>parseCsv('a,b\n"unclosed,b'));assert.equal(autoMapHeaders(parsed[0])[0],'participantId')});
await test('payload preserves all supplied identifiers to reject conflicting rows',async()=>{const rows=buildImportRows([['11111111-1111-4111-8111-111111111111','P2','two@example.com','Test','Two','new']],autoMapHeaders(['EventMe ID','Participant ID','Email','First name','Last name','Phone']));assert.equal(Object.keys(rows[0].match).length,5);assert.equal((await rpc(toSnakeCase(rows))).ok,false)});
await test('CSV numeric adult mapping reaches real RPC',async()=>{const parsed=parseCsv('Participant ID,18 or over,Phone\nP1,yes,');const rows=toSnakeCase(buildImportRows(parsed.slice(1),autoMapHeaders(parsed[0])));assert.equal(rows[0].updates.is_18_or_over,'yes');assert(!('phone' in rows[0].updates));assert.equal((await previewApply(rows)).updated_rows,1);assert.equal(toCamelCase({is_18_or_over:true}).is18OrOver,true)});
console.log(`RESULT ${passed} passed, ${failed} failed`);
await db.close();process.exitCode=failed?1:0;
