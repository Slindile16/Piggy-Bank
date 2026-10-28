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
  firstName: z.string().trim().min(1).max(100),
  surname: z.string().trim().min(1).max(100),
  idNumber: z.string().regex(/^\d{13}$/),
  address: z.string().trim().min(5).max(500),
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
function publicUser(row) { return { id: row.id, firstName: row.first_name, surname: row.surname, email: row.email, gender: row.gender }; }
function token(user) { return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' }); }
app.post('/api/v1/auth/register', async (req,res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check your registration details.' });
  const data = parsed.data;
  const birthDate = saIdBirthDate(data.idNumber);
  if (!birthDate) return res.status(400).json({ error: 'Invalid South African ID number.' });
  try {
    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(`INSERT INTO users (id,first_name,surname,id_number,address,birth_date,gender,email,password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,first_name,surname,email,gender`,
      [randomUUID(),data.firstName,data.surname,data.idNumber,data.address,birthDate,data.gender,data.email,hash]);
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
    const result = await db.query('SELECT id,first_name,surname,email,gender FROM users WHERE id=$1',[payload.sub]);
    if (!result.rows[0]) return res.sendStatus(401);
    return res.json({user:publicUser(result.rows[0])});
  } catch { return res.sendStatus(401); }
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

app.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => console.log('Piggy Bank API running'));
