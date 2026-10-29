import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Configure DATABASE_URL and a JWT_SECRET of at least 32 characters');
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
const registration = z.object({
  termsAccepted:z.literal(true),
  termsVersion:z.literal('2026-10-28-demo-v2'),
  firstName: z.string().trim().min(1).max(100),
  surname: z.string().trim().min(1).max(100),
  idNumber: z.string().regex(/^\d{13}$/),
  address: z.string().trim().min(5).max(500),
  mobileNumber: z.string().trim().regex(/^(?:\+27|0)[6-8]\d{8}$/),
  gender: z.enum(['Female','Male','Non-binary','Prefer not to say','Other']),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12).max(128)
});
const loginSchema = z.object({ email: z.string().email().transform(v => v.toLowerCase()), password: z.string() });
function saIdBirthDate(id) {
  const yy = Number(id.slice(0,2));
  const mm = Number(id.slice(2,4));
  const dd = Number(id.slice(4,6));
  const currentYY = new Date().getUTCFullYear() % 100;
  const year = (yy <= currentYY ? 2000 : 1900) + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mm-1 || date.getUTCDate() !== dd || date > new Date()) return null;
  let sum = 0;
  for (let i=0;i<13;i++) {
    let n = Number(id[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  if (sum % 10 !== 0) return null;
  return `${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function publicUser(row) { return { id: row.id, firstName: row.first_name, surname: row.surname, email: row.email, gender: row.gender, mobileNumber: row.mobile_number || '', address: row.address || '' }; }
function token(user) { return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' }); }
app.post('/api/v1/auth/register', async (req,res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check your registration details.' });
  const data = parsed.data;
  const birthDate = saIdBirthDate(data.idNumber);
  if (!birthDate) return res.status(400).json({ error: 'Invalid South African ID number.' });
  try {
    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(`INSERT INTO users (id,first_name,surname,id_number,address,mobile_number,birth_date,gender,email,password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,first_name,surname,email,gender,mobile_number,address`,
      [randomUUID(),data.firstName,data.surname,data.idNumber,data.address,data.mobileNumber,birthDate,data.gender,data.email,hash]);
    const user = publicUser(result.rows[0]);
    return res.status(201).json({ user, token: token(user) });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with these details already exists.' });
    console.error(e); return res.status(500).json({ error: 'Registration failed.' });
  }
});
app.post('/api/v1/auth/login', async (req,res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password.' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1', [parsed.data.email]);
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(parsed.data.password,row.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const user = publicUser(row);
    return res.json({ user, token: token(user) });
  } catch(e) { console.error(e); return res.status(500).json({ error: 'Login failed.' }); }
});
app.get('/api/v1/auth/me', async (req,res) => {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/);
  if (!bearer) return res.sendStatus(401);
  try {
    const payload = jwt.verify(bearer[1],process.env.JWT_SECRET,{algorithms:['HS256']});
    const result = await db.query('SELECT id,first_name,surname,email,gender,mobile_number,address FROM users WHERE id=$1',[payload.sub]);
    if (!result.rows[0]) return res.sendStatus(401);
    return res.json({user:publicUser(result.rows[0])});
  } catch { return res.sendStatus(401); }
});

const profileUpdateSchema=z.object({
  firstName:z.string().trim().min(1).max(100),
  surname:z.string().trim().min(1).max(100),
  address:z.string().trim().min(5).max(500),
  mobileNumber:z.string().trim().regex(/^(?:\+27|0)[6-8]\d{8}$/),
  gender:z.enum(['Female','Male','Non-binary','Prefer not to say','Other'])
}).strict();
app.patch('/api/v1/auth/profile',async(req,res)=>{
  const bearer=req.headers.authorization?.match(/^Bearer (.+)$/);
  if(!bearer)return res.sendStatus(401);
  let userId;
  try{userId=jwt.verify(bearer[1],process.env.JWT_SECRET,{algorithms:['HS256']}).sub;}
  catch{return res.sendStatus(401);}
  const parsed=profileUpdateSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Check your name, address, gender and South African mobile number.'});
  const d=parsed.data;
  try{
    const result=await db.query('UPDATE users SET first_name=$1,surname=$2,address=$3,mobile_number=$4,gender=$5 WHERE id=$6 RETURNING id,first_name,surname,email,gender,mobile_number,address',[d.firstName,d.surname,d.address,d.mobileNumber,d.gender,userId]);
    if(!result.rows.length)return res.sendStatus(404);
    return res.json({user:publicUser(result.rows[0])});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to update profile. Run migration 005.'});}
});

const planSchema = z.object({
  name: z.string().trim().min(1).max(100),
  planType: z.enum(['starter','builder','visionary','custom']),
  durationMonths: z.number().int().min(1).max(60),
  targetAmount: z.number().finite().positive().max(100000000)
}).strict();
const fixedDurations = { starter: 6, builder: 12, visionary: 18 };
function authenticated(req,res,next) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/);
  if (!bearer) return res.sendStatus(401);
  try {
    const payload = jwt.verify(bearer[1],process.env.JWT_SECRET,{algorithms:['HS256']});
    req.userId = payload.sub;
    return next();
  } catch { return res.sendStatus(401); }
}
function addMonths(date,months) {
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), day = date.getUTCDate();
  const target = new Date(Date.UTC(year,month+months,1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(day,lastDay));
  return target.toISOString().slice(0,10);
}
function publicPlan(row) {
  return {
    id:row.id,name:row.name,planType:row.plan_type,durationMonths:row.duration_months,
    targetAmount:Number(row.target_cents)/100,savedAmount:Number(row.saved_cents)/100,
    startsOn:row.starts_on,maturesOn:row.matures_on,createdAt:row.created_at
  };
}
app.get('/api/v1/savings/plans',authenticated,async(req,res)=>{
  try {
    const result=await db.query(
      'SELECT id,name,plan_type,duration_months,target_cents,saved_cents,starts_on::text AS starts_on,matures_on::text AS matures_on,created_at FROM savings_plans WHERE user_id=$1 ORDER BY created_at DESC',
      [req.userId]);
    return res.json({plans:result.rows.map(publicPlan)});
  } catch(e) { console.error(e); return res.status(500).json({error:'Unable to load savings plans.'}); }
});
app.post('/api/v1/savings/plans',authenticated,async(req,res)=>{
  const parsed=planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Check the plan name, type, duration and target amount.'});
  const {name,planType,durationMonths,targetAmount}=parsed.data;
  if (fixedDurations[planType] && durationMonths!==fixedDurations[planType])
    return res.status(400).json({error:'The selected plan has a fixed duration.'});
  const cents=Math.round(targetAmount*100);
  if (!Number.isSafeInteger(cents) || cents<=0) return res.status(400).json({error:'Invalid target amount.'});
  const startsOn=new Date().toISOString().slice(0,10);
  const maturesOn=addMonths(new Date(startsOn+'T00:00:00Z'),durationMonths);
  try {
    const result=await db.query(
      'INSERT INTO savings_plans (id,user_id,name,plan_type,duration_months,target_cents,starts_on,matures_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,plan_type,duration_months,target_cents,saved_cents,starts_on::text AS starts_on,matures_on::text AS matures_on,created_at',
      [randomUUID(),req.userId,name,planType,durationMonths,cents,startsOn,maturesOn]);
    return res.status(201).json({plan:publicPlan(result.rows[0])});
  } catch(e) { console.error(e); return res.status(500).json({error:'Unable to create savings plan.'}); }
});

const planUpdateSchema=z.object({
  name:z.string().trim().min(1).max(100),
  targetAmount:z.number().finite().positive().max(100000000)
}).strict();
app.patch('/api/v1/savings/plans/:id',authenticated,async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({error:'Invalid plan ID.'});
  const parsed=planUpdateSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Enter a valid name and target amount.'});
  const cents=Math.round(parsed.data.targetAmount*100);
  if(!Number.isSafeInteger(cents)||cents<1||Math.abs(parsed.data.targetAmount*100-cents)>0.000001)
    return res.status(400).json({error:'Target must have at most two decimal places.'});
  const client=await db.connect().catch(()=>null);
  if(!client) return res.status(500).json({error:'Database unavailable.'});
  try{
    await client.query('BEGIN');
    const current=await client.query('SELECT * FROM savings_plans WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.userId]);
    if(!current.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Plan not found.'});}
    const old=current.rows[0];
    if(cents<Number(old.saved_cents)){await client.query('ROLLBACK');return res.status(400).json({error:'Target cannot be lower than the amount already saved.'});}
    if(old.name!==parsed.data.name||Number(old.target_cents)!==cents){
      await client.query('INSERT INTO savings_plan_changes(id,user_id,plan_id,old_name,new_name,old_target_cents,new_target_cents) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),req.userId,old.id,old.name,parsed.data.name,old.target_cents,cents]);
    }
    const updated=await client.query('UPDATE savings_plans SET name=$1,target_cents=$2 WHERE id=$3 AND user_id=$4 RETURNING id,name,plan_type,duration_months,target_cents,saved_cents,starts_on::text AS starts_on,matures_on::text AS matures_on,created_at',[parsed.data.name,cents,old.id,req.userId]);
    await client.query('COMMIT');
    return res.json({plan:publicPlan(updated.rows[0])});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);return res.status(500).json({error:'Unable to update plan. Check that migration 004 has been run.'});}
  finally{client.release();}
});
app.get('/api/v1/savings/plans/:id/changes',authenticated,async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({error:'Invalid plan ID.'});
  try{
    const owned=await db.query('SELECT id FROM savings_plans WHERE id=$1 AND user_id=$2',[req.params.id,req.userId]);
    if(!owned.rows.length) return res.status(404).json({error:'Plan not found.'});
    const result=await db.query('SELECT id,old_name,new_name,old_target_cents,new_target_cents,created_at FROM savings_plan_changes WHERE plan_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[req.params.id,req.userId]);
    return res.json({changes:result.rows.map(r=>({id:r.id,oldName:r.old_name,newName:r.new_name,oldTarget:Number(r.old_target_cents)/100,newTarget:Number(r.new_target_cents)/100,createdAt:r.created_at}))});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to load plan changes.'});}
});

const depositSchema=z.object({
  planId:z.string().uuid(),
  amount:z.number().finite().positive().max(100000000)
}).strict();
app.post('/api/v1/savings/deposits',authenticated,async(req,res)=>{
  const parsed=depositSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Enter a valid savings plan and positive deposit amount.'});
  const cents=Math.round(parsed.data.amount*100);
  if(!Number.isSafeInteger(cents)||cents<1||Math.abs(parsed.data.amount*100-cents)>0.000001)
    return res.status(400).json({error:'Deposit amount must have at most two decimal places.'});
  const client=await db.connect().catch(()=>null);
  if(!client) return res.status(500).json({error:'Database unavailable.'});
  try {
    await client.query('BEGIN');
    const owned=await client.query('SELECT id FROM savings_plans WHERE id=$1 AND user_id=$2 FOR UPDATE',[parsed.data.planId,req.userId]);
    if(!owned.rows.length) { await client.query('ROLLBACK');return res.status(404).json({error:'Savings plan not found.'}); }
    const depositId=randomUUID();
    const deposited=await client.query(
      'INSERT INTO savings_deposits(id,user_id,plan_id,amount_cents) VALUES($1,$2,$3,$4) RETURNING id,amount_cents,created_at',
      [depositId,req.userId,parsed.data.planId,cents]);
    await client.query('UPDATE savings_plans SET saved_cents=saved_cents+$1 WHERE id=$2 AND user_id=$3',[cents,parsed.data.planId,req.userId]);
    await client.query('COMMIT');
    return res.status(201).json({deposit:{id:depositId,planId:parsed.data.planId,amount:cents/100,createdAt:deposited.rows[0].created_at}});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);return res.status(500).json({error:'Unable to record simulated deposit.'});}
  finally{client.release();}
});
app.get('/api/v1/savings/deposits',authenticated,async(req,res)=>{
  try{
    const result=await db.query(
      'SELECT d.id,d.plan_id,d.amount_cents,d.created_at,p.name AS plan_name FROM savings_deposits d JOIN savings_plans p ON p.id=d.plan_id AND p.user_id=d.user_id WHERE d.user_id=$1 ORDER BY d.created_at DESC LIMIT 200',
      [req.userId]);
    return res.json({deposits:result.rows.map(r=>({id:r.id,planId:r.plan_id,planName:r.plan_name,amount:Number(r.amount_cents)/100,createdAt:r.created_at}))});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to load activity.'});}
});


const withdrawalSchema=z.object({planId:z.string().uuid(),amount:z.number().finite().positive().max(100000000),confirmDemo:z.literal(true)}).strict();
app.post('/api/v1/savings/withdrawals',authenticated,async(req,res)=>{
  const parsed=withdrawalSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid amount and confirm this is a simulated withdrawal.'});
  const cents=Math.round(parsed.data.amount*100);
  if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(parsed.data.amount*100-cents)>0.000001)return res.status(400).json({error:'Amount must have at most two decimal places.'});
  const client=await db.connect().catch(()=>null);
  if(!client)return res.status(500).json({error:'Database unavailable.'});
  try{
    await client.query('BEGIN');
    const found=await client.query('SELECT id,saved_cents,matures_on::text AS matures_on FROM savings_plans WHERE id=$1 AND user_id=$2 FOR UPDATE',[parsed.data.planId,req.userId]);
    if(!found.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Savings plan not found.'});}
    const plan=found.rows[0];
    if(cents>Number(plan.saved_cents)){await client.query('ROLLBACK');return res.status(400).json({error:'Withdrawal exceeds your simulated savings balance.'});}
    const early=new Date().toISOString().slice(0,10)<plan.matures_on;
    const penalty=early?Math.round(cents*2/100):0;
    const full=cents===Number(plan.saved_cents);
    const result=await client.query('INSERT INTO savings_withdrawals(id,user_id,plan_id,amount_cents,penalty_cents,payout_cents,early,full_withdrawal) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,created_at',[randomUUID(),req.userId,plan.id,cents,penalty,cents-penalty,early,full]);
    await client.query('UPDATE savings_plans SET saved_cents=saved_cents-$1 WHERE id=$2 AND user_id=$3',[cents,plan.id,req.userId]);
    await client.query('COMMIT');
    return res.status(201).json({withdrawal:{id:result.rows[0].id,planId:plan.id,amount:cents/100,penalty:penalty/100,payout:(cents-penalty)/100,early,fullWithdrawal:full,status:'demo_completed',createdAt:result.rows[0].created_at},message:'Demo only: no identity check or bank payout occurred.'});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);return res.status(500).json({error:'Unable to record demo withdrawal. Run migration 006.'});}
  finally{client.release();}
});
app.get('/api/v1/savings/withdrawals',authenticated,async(req,res)=>{
  try{
    const result=await db.query('SELECT w.id,w.plan_id,w.amount_cents,w.penalty_cents,w.payout_cents,w.early,w.full_withdrawal,w.created_at,p.name AS plan_name FROM savings_withdrawals w JOIN savings_plans p ON p.id=w.plan_id AND p.user_id=w.user_id WHERE w.user_id=$1 ORDER BY w.created_at DESC LIMIT 200',[req.userId]);
    return res.json({withdrawals:result.rows.map(r=>({id:r.id,planId:r.plan_id,planName:r.plan_name,amount:Number(r.amount_cents)/100,penalty:Number(r.penalty_cents)/100,payout:Number(r.payout_cents)/100,early:r.early,fullWithdrawal:r.full_withdrawal,createdAt:r.created_at}))});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to load demo withdrawals. Run migration 006.'});}
});


const demoBankingSchema=z.object({
  bank:z.enum(['FNB','Capitec','Standard Bank','Absa','Nedbank','Other']),
  accountType:z.enum(['Savings','Current','Cheque'])
}).strict();
app.get('/api/v1/auth/demo-banking',authenticated,async(req,res)=>{
  try{
    const r=await db.query('SELECT bank_name,account_type,updated_at FROM demo_banking_preferences WHERE user_id=$1',[req.userId]);
    return res.json({banking:r.rows.length?{bank:r.rows[0].bank_name,accountType:r.rows[0].account_type,updatedAt:r.rows[0].updated_at}:null});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to load demo banking preferences. Run migration 007.'});}
});
app.put('/api/v1/auth/demo-banking',authenticated,async(req,res)=>{
  const parsed=demoBankingSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose a valid bank and account type. Never submit real card or account details.'});
  try{
    const r=await db.query(`INSERT INTO demo_banking_preferences(user_id,bank_name,account_type) VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET bank_name=EXCLUDED.bank_name,account_type=EXCLUDED.account_type,updated_at=NOW()
    RETURNING bank_name,account_type,updated_at`,[req.userId,parsed.data.bank,parsed.data.accountType]);
    return res.json({banking:{bank:r.rows[0].bank_name,accountType:r.rows[0].account_type,updatedAt:r.rows[0].updated_at},verified:false,demo:true});
  }catch(e){console.error(e);return res.status(500).json({error:'Unable to update demo banking preferences. Run migration 007.'});}
});


const childSchema=z.object({
  firstName:z.string().trim().min(1).max(80),
  surname:z.string().trim().min(1).max(80),
  dateOfBirth:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relationship:z.enum(['Mother','Father','Legal Guardian']),
  avatarColor:z.enum(['emerald','gold','rose','sage']).default('emerald')
}).strict();
function validChildDate(value){
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value&&date<=new Date()&&date.getUTCFullYear()>=1900;
}
function publicChild(row){return {id:row.id,firstName:row.first_name,surname:row.surname,dateOfBirth:row.date_of_birth,relationship:row.relationship,avatarColor:row.avatar_color,createdAt:row.created_at};}
app.get('/api/v1/kids',authenticated,async(req,res)=>{
  try{const result=await db.query('SELECT id,first_name,surname,date_of_birth::text AS date_of_birth,relationship,avatar_color,created_at FROM child_profiles WHERE guardian_user_id=$1 ORDER BY created_at DESC',[req.userId]);return res.json({children:result.rows.map(publicChild)});}
  catch(e){console.error(e);return res.status(500).json({error:'Unable to load child profiles. Run migration 008.'});}
});
app.post('/api/v1/kids',authenticated,async(req,res)=>{
  const parsed=childSchema.safeParse(req.body);
  if(!parsed.success||!validChildDate(parsed.data?.dateOfBirth||''))return res.status(400).json({error:'Enter valid child details and a date of birth in YYYY-MM-DD format.'});
  const c=parsed.data;
  try{const result=await db.query('INSERT INTO child_profiles(id,guardian_user_id,first_name,surname,date_of_birth,relationship,avatar_color) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,first_name,surname,date_of_birth::text AS date_of_birth,relationship,avatar_color,created_at',[randomUUID(),req.userId,c.firstName,c.surname,c.dateOfBirth,c.relationship,c.avatarColor]);return res.status(201).json({child:publicChild(result.rows[0])});}
  catch(e){console.error(e);return res.status(500).json({error:'Unable to add child profile.'});}
});
app.patch('/api/v1/kids/:id',authenticated,async(req,res)=>{
  const parsed=childSchema.safeParse(req.body);
  if(!parsed.success||!validChildDate(parsed.data?.dateOfBirth||''))return res.status(400).json({error:'Enter valid child details.'});
  const c=parsed.data;
  try{const result=await db.query('UPDATE child_profiles SET first_name=$1,surname=$2,date_of_birth=$3,relationship=$4,avatar_color=$5,updated_at=NOW() WHERE id=$6 AND guardian_user_id=$7 RETURNING id,first_name,surname,date_of_birth::text AS date_of_birth,relationship,avatar_color,created_at',[c.firstName,c.surname,c.dateOfBirth,c.relationship,c.avatarColor,req.params.id,req.userId]);if(!result.rowCount)return res.status(404).json({error:'Child profile not found.'});return res.json({child:publicChild(result.rows[0])});}
  catch(e){console.error(e);return res.status(500).json({error:'Unable to update child profile.'});}
});
app.delete('/api/v1/kids/:id',authenticated,async(req,res)=>{
  try{const result=await db.query('DELETE FROM child_profiles WHERE id=$1 AND guardian_user_id=$2 RETURNING id',[req.params.id,req.userId]);if(!result.rowCount)return res.status(404).json({error:'Child profile not found.'});return res.json({deleted:true});}
  catch(e){console.error(e);return res.status(500).json({error:'Unable to remove child profile.'});}
});

app.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => console.log('Piggy Bank API running'));
