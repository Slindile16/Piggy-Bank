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
app.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => console.log('Piggy Bank API running'));
