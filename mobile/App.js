import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

const C = { dark:'#101714', forest:'#163D30', green:'#087F5B', gold:'#D4B77A', ivory:'#F8F9F6', muted:'#75837B', border:'#E8ECE9', white:'#FFFFFF' };
const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? 'http://localhost:4000' : 'http://10.0.2.2:4000');
const sessionStore = {
  get: () => Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.getItem('piggy_bank_session')) : SecureStore.getItemAsync('session'),
  set: token => Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.setItem('piggy_bank_session',token)) : SecureStore.setItemAsync('session',token),
  remove: () => Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.removeItem('piggy_bank_session')) : SecureStore.deleteItemAsync('session')
};
const notify = (title,message) => Platform.OS === 'web' ? window.alert(title+'\n'+message) : Alert.alert(title,message);
const fields = [['firstName','First name'],['surname','Surname'],['idNumber','South African ID number'],['address','Residential address'],['gender','Gender'],['email','Email address'],['password','Password (12+ characters)'],['confirmPassword','Confirm password']];
const plans = [{type:'starter',months:6,title:'The Starter',detail:'Short-term focus'},{type:'builder',months:12,title:'The Builder',detail:'Build lasting habits'},{type:'visionary',months:18,title:'The Visionary',detail:'Your long-term goal'},{type:'custom',months:null,title:'Custom Plan',detail:'Choose 1–60 months'}];
const daysUntil = date => Math.max(0,Math.ceil((new Date(date+'T00:00:00Z').getTime()-Date.now())/86400000));
const money = amount => 'R'+Number(amount||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
const demoMessage = () => notify('Demo feature','Savings and withdrawals are not yet connected to the backend. No money is being moved.');
const Button = ({label,onPress,outline=false,disabled=false}) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,outline&&s.outline,disabled&&{opacity:.55}]}><Text style={[s.buttonText,outline&&{color:C.forest}]}>{label}</Text></TouchableOpacity>;
export default function App() {
  const [screen,setScreen] = useState('loading');
  const [tab,setTab] = useState('Home');
  const [user,setUser] = useState(null);
  const [values,setValues] = useState({});
  const [busy,setBusy] = useState(false);
  const [savedPlans,setSavedPlans] = useState([]);
  const [plansLoading,setPlansLoading] = useState(false);
  const [deposits,setDeposits] = useState([]);
  const [depositOpen,setDepositOpen] = useState(false);
  const [detailPlanId,setDetailPlanId] = useState(null);
  const [depositPlanId,setDepositPlanId] = useState('');
  const [depositAmount,setDepositAmount] = useState('');
  const loadDeposits = async () => {
    try {
      const saved=await sessionStore.get();
      if(!saved) return;
      const response=await fetch(API_URL+'/api/v1/savings/deposits',{headers:{Authorization:'Bearer '+saved}});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Unable to load activity.');
      setDeposits(data.deposits||[]);
    }catch(e){notify('Activity',e.message);}
  };
  const openPlanDetails = planId => { setSelectedPlan(null);setDepositOpen(false);setDetailPlanId(planId);setTab('Savings');loadDeposits(); };
  const beginDeposit = planId => {
    if(savedPlans.length===0) return notify('Create a plan first','You need a savings plan before adding a simulated deposit.');
    setDepositPlanId(planId||savedPlans[0].id);
    setDepositAmount('');
    setDepositOpen(true);
    setDetailPlanId(null);
    setTab('Savings');
    setSelectedPlan(null);
  };
  const submitDeposit = async () => {
    const amount=Number(depositAmount);
    if(!/^\d+(\.\d{1,2})?$/.test(depositAmount.trim())||!Number.isFinite(amount)||amount<=0||amount>100000000)
      return notify('Check amount','Enter an amount greater than R0, with at most two decimal places.');
    if(!depositPlanId) return notify('Choose a plan','Select the savings plan to receive this deposit.');
    setBusy(true);
    try{
      const saved=await sessionStore.get();
      const response=await fetch(API_URL+'/api/v1/savings/deposits',{method:'POST',headers:{Authorization:'Bearer '+saved,'Content-Type':'application/json'},body:JSON.stringify({planId:depositPlanId,amount})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Unable to add savings.');
      setDepositOpen(false);
      await Promise.all([loadPlans(),loadDeposits()]);
      setTab('Home');
      notify('Savings added',money(amount)+' was added to your plan in demo mode. No real money moved.');
    }catch(e){notify('Unable to add savings',e.message);}
    finally{setBusy(false);}
  };
  const [selectedPlan,setSelectedPlan] = useState(null);
  const [planForm,setPlanForm] = useState({name:'',targetAmount:'',durationMonths:'6'});
  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const saved=await sessionStore.get();
      if (!saved) return;
      const response=await fetch(API_URL+'/api/v1/savings/plans',{headers:{Authorization:'Bearer '+saved}});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error||'Unable to load plans.');
      setSavedPlans(data.plans||[]);
    } catch(e) { notify('Savings plans',e.message); }
    finally { setPlansLoading(false); }
  };
  const beginPlan = plan => {
    setDepositOpen(false);setDetailPlanId(null);setSelectedPlan(plan);
    setPlanForm({name:'',targetAmount:'',durationMonths:String(plan.months||6)});
    setTab('Savings');
  };
  const createPlan = async () => {
    const duration=Number(planForm.durationMonths);
    const amount=Number(planForm.targetAmount);
    if (!planForm.name.trim() || !Number.isInteger(duration) || duration<1 || duration>60 || !Number.isFinite(amount) || amount<=0 || amount>100000000 || !/^\d+(\.\d{1,2})?$/.test(planForm.targetAmount.trim())) {
      return notify('Check your plan','Enter a name, a valid duration (1–60 months), and a target amount greater than R0 with at most two decimal places.');
    }
    setBusy(true);
    try {
      const saved=await sessionStore.get();
      const response=await fetch(API_URL+'/api/v1/savings/plans',{method:'POST',headers:{Authorization:'Bearer '+saved,'Content-Type':'application/json'},body:JSON.stringify({name:planForm.name.trim(),planType:selectedPlan.type,durationMonths:duration,targetAmount:amount})});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error||'Unable to create plan.');
      setSelectedPlan(null);
      await loadPlans();
      setTab('Home');
      notify('Plan created','Your locked savings plan was saved successfully. No money has been deposited.');
    } catch(e) { notify('Unable to create plan',e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { (async () => {
    try {
      const saved = await sessionStore.get();
      if (saved) {
        const response = await fetch(API_URL+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+saved}});
        if (response.ok) { setUser((await response.json()).user);setScreen('home');loadPlans();loadDeposits();return; }
        await sessionStore.remove();
      }
    } catch {}
    setScreen('register');
  })(); }, []);
  const submit = async () => {
    if (screen==='register' && values.password!==values.confirmPassword) return notify('Check password','Passwords do not match.');
    setBusy(true);
    try {
      const endpoint=screen==='register'?'register':'login';
      const body=screen==='register'?(({confirmPassword,...data})=>data)(values):{email:values.email,password:values.password};
      const response=await fetch(API_URL+'/api/v1/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error||'Please try again.');
      await sessionStore.set(data.token);
      setUser(data.user);setValues({});setTab('Home');setScreen('home');loadPlans();
    } catch(e) { notify('Unable to continue',e.message); }
    finally { setBusy(false); }
  };
  const logout=async()=>{await sessionStore.remove();setUser(null);setValues({});setSavedPlans([]);setDeposits([]);setDepositOpen(false);setDetailPlanId(null);setSelectedPlan(null);setScreen('login');};
  const nav=target=>{setSelectedPlan(null);setDepositOpen(false);setDetailPlanId(null);setTab(target);if(target==='Savings'||target==='Home')loadPlans();if(target==='Activity')loadDeposits();};
  if(screen==='loading') return <View style={s.center}><ActivityIndicator size="large" color={C.green}/></View>;
  const loggedIn=screen==='home';
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
    <StatusBar style="dark"/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View style={s.shell}>
        <View style={s.header}><Text style={s.brand}>🐷  Piggy Bank</Text><View style={s.brandPill}><Text style={s.brandPillText}>EMERALD LUXE</Text></View></View>
        {!loggedIn ? <View style={s.auth}>
          <Text style={s.eyebrow}>YOUR FUTURE, SECURED</Text>
          <Text style={s.title}>{screen==='register'?'Start saving beautifully.':'Welcome back.'}</Text>
          <Text style={s.subtitle}>{screen==='register'?'Create your account to begin your savings journey.':'Sign in to your Piggy Bank account.'}</Text>
          <View style={s.panel}>{(screen==='register'?fields:[['email','Email address'],['password','Password']]).map(([key,label])=><View key={key}>
            <Text style={s.label}>{label}</Text>
            {key==='gender'?<View style={s.chips}>{['Female','Male','Non-binary','Other'].map(g=><TouchableOpacity key={g} onPress={()=>setValues(v=>({...v,gender:g}))} style={[s.chip,values.gender===g&&s.chipSelected]}><Text style={[s.chipText,values.gender===g&&{color:C.white}]}>{g}</Text></TouchableOpacity>)}</View>:
            <TextInput style={s.input} placeholder={label} placeholderTextColor="#96A39A" value={values[key]||''} onChangeText={v=>setValues(prev=>({...prev,[key]:v}))} autoCapitalize={key==='email'?'none':'sentences'} autoCorrect={false} secureTextEntry={key.toLowerCase().includes('password')} keyboardType={key==='email'?'email-address':key==='idNumber'?'number-pad':'default'}/>}
          </View>)}
          <Button label={busy?'Please wait...':screen==='register'?'Create account':'Sign in'} disabled={busy} onPress={submit}/>
          <TouchableOpacity onPress={()=>{setValues({});setScreen(screen==='register'?'login':'register');}}><Text style={s.link}>{screen==='register'?'Already have an account? Sign in':'New to Piggy Bank? Create an account'}</Text></TouchableOpacity>
          </View>
        </View> : <>
          {tab==='Home'&&<>
            <Text style={s.eyebrow}>GOOD TO HAVE YOU HERE</Text><Text style={s.title}>Hello, {user?.firstName||'Saver'} 👋</Text>
            <Text style={s.subtitle}>Your future is worth saving for.</Text>
            <View style={s.balance}><Text style={s.balanceLabel}>TOTAL SAVINGS  ·  DEMO</Text><Text style={s.balanceAmount}>{money(savedPlans.reduce((sum,p)=>sum+Number(p.savedAmount||0),0))}</Text><View style={s.goldLine}/><Text style={s.balanceFoot}>{savedPlans.length} active plans    •    {deposits.length} demo deposits</Text>{savedPlans.length>0&&<View style={s.balanceBreakdown}><Text style={s.balanceBreakdownTitle}>SAVINGS BY PLAN</Text>{savedPlans.map(p=><View key={p.id} style={s.balanceBreakdownRow}><Text style={s.balancePlanName} numberOfLines={1}>{p.name}</Text><Text style={s.balancePlanAmount}>{money(p.savedAmount)}</Text></View>)}</View>}</View>
            <Text style={s.sectionTitle}>Quick actions</Text>
            <View style={s.actions}><TouchableOpacity style={s.action} onPress={()=>beginPlan(plans[0])}><Text style={s.actionIcon}>＋</Text><Text style={s.actionText}>New savings plan</Text></TouchableOpacity><TouchableOpacity style={s.action} onPress={()=>beginDeposit()}><Text style={s.actionIcon}>↗</Text><Text style={s.actionText}>Add savings</Text></TouchableOpacity></View>
            <View style={s.sectionRow}><Text style={s.sectionTitle}>My savings plans</Text><TouchableOpacity onPress={()=>nav('Savings')}><Text style={s.greenLink}>Explore →</Text></TouchableOpacity></View>
            {savedPlans.length===0?<View style={s.empty}><Text style={s.emptyIcon}>🐷</Text><Text style={s.emptyTitle}>Your journey starts here</Text><Text style={s.emptyText}>Choose a savings plan to start building your future.</Text><Button label="Explore savings plans" onPress={()=>nav('Savings')}/></View>:savedPlans.map(p=><TouchableOpacity key={p.id} style={s.plan} onPress={()=>openPlanDetails(p.id)} accessibilityRole="button" accessibilityLabel={'View details for '+p.name}><Text style={s.planTitle}>{p.name}  ›</Text><Text style={s.planDetail}>{p.durationMonths} months · Locked until {p.maturesOn}</Text><Text style={s.planDetail}>{money(p.savedAmount)} of {money(p.targetAmount)} saved</Text><View style={s.progressTrack}><View style={[s.progressFill,{width:Math.min(100,Math.max(0,100*p.savedAmount/p.targetAmount))+'%'}]}/></View><Text style={s.planDetail}>{Math.round(100*p.savedAmount/p.targetAmount)}% complete · Suggested {money(p.targetAmount/p.durationMonths)}/month</Text></TouchableOpacity>)}
          </>}
          {tab==='Savings'&&<>
            {depositOpen&&<View style={s.panel}>
              <TouchableOpacity onPress={()=>setDepositOpen(false)}><Text style={s.greenLink}>← Back to savings</Text></TouchableOpacity>
              <Text style={[s.sectionTitle,{marginTop:20}]}>Add savings · Demo</Text>
              <Text style={s.emptyText}>Choose a plan and enter any contribution amount. No real money will move.</Text>
              <Text style={s.label}>Choose a savings plan</Text>
              {savedPlans.map(p=><TouchableOpacity key={p.id} onPress={()=>setDepositPlanId(p.id)} style={[s.planChoice,depositPlanId===p.id&&s.planChoiceSelected]}><Text style={s.planTitle}>{depositPlanId===p.id?'◉ ':'○ '}{p.name}</Text><Text style={s.planDetail}>Saved {money(p.savedAmount)} · Target {money(p.targetAmount)}</Text></TouchableOpacity>)}
              <Text style={s.label}>Deposit amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} placeholder="500" keyboardType="decimal-pad" value={depositAmount} onChangeText={setDepositAmount}/></View>
              <View style={s.notice}><Text style={s.noticeText}>This is a simulated contribution. Deposits remain locked until the selected plan matures. No bank account or payment method is charged.</Text></View>
              <Button label={busy?'Adding savings...':'Confirm simulated deposit'} disabled={busy} onPress={submitDeposit}/>
            </View>}

            <Text style={s.eyebrow}>SAVE WITH PURPOSE</Text><Text style={s.title}>Savings plans</Text><Text style={s.subtitle}>Create as many locked savings plans as you need. All amounts are simulated.</Text>
            {detailPlanId && !depositOpen && (() => {
              const p=savedPlans.find(item=>item.id===detailPlanId);
              if(!p) return <View style={s.empty}><Text style={s.emptyText}>This plan is no longer available.</Text><Button label="Back to savings" onPress={()=>setDetailPlanId(null)}/></View>;
              const planDeposits=deposits.filter(d=>d.planId===p.id);
              const progress=Math.round(100*Number(p.savedAmount)/Number(p.targetAmount));
              return <View>
                <TouchableOpacity onPress={()=>setDetailPlanId(null)}><Text style={s.greenLink}>← All savings plans</Text></TouchableOpacity>
                <View style={[s.balance,{marginTop:18}]}>
                  <Text style={s.balanceLabel}>LOCKED SAVINGS · DEMO</Text>
                  <Text style={[s.balanceAmount,{fontSize:34}]}>{money(p.savedAmount)}</Text>
                  <View style={s.goldLine}/>
                  <Text style={s.balanceFoot}>{p.name} · {p.durationMonths} months</Text>
                </View>
                <View style={s.plan}>
                  <Text style={s.sectionTitle}>Goal progress</Text>
                  <View style={s.ringWrap}>
                    <View style={s.ring}>
                      {Array.from({length:40},(_,i)=>{
                        const angle=(i/40)*Math.PI*2-Math.PI/2;
                        return <View key={i} style={[s.ringDot,{left:100+82*Math.cos(angle)-5,top:100+82*Math.sin(angle)-5,backgroundColor:i<Math.min(40,Math.round(Math.max(0,progress)*40/100))?C.green:C.border}]}/>;
                      })}
                      <Text style={s.ringPercent}>{progress}%</Text>
                      <Text style={s.ringCaption}>OF YOUR GOAL</Text>
                    </View>
                  </View>
                  <Text style={[s.planDetail,{textAlign:'center'}]}>{money(p.savedAmount)} saved of {money(p.targetAmount)}</Text>
                  <View style={s.progressTrack}><View style={[s.progressFill,{width:Math.min(100,Math.max(0,100*Number(p.savedAmount)/Number(p.targetAmount)))+'%'}]}/></View>
                  <View style={s.countdown}><Text style={s.countdownTitle}>MATURITY COUNTDOWN</Text><Text style={s.countdownDays}>{daysUntil(p.maturesOn)===0?'Matured':daysUntil(p.maturesOn)+' days left'}</Text><Text style={s.countdownSub}>Savings unlock date: {p.maturesOn}</Text></View>
                  <View style={s.planLine}/>
                  <Text style={s.planDetail}>Plan: {p.planType==='custom'?'Custom':p.planType.charAt(0).toUpperCase()+p.planType.slice(1)}</Text>
                  <Text style={s.planDetail}>Started: {p.startsOn}</Text>
                  <Text style={s.planDetail}>Locked until: {p.maturesOn}</Text>
                  <Text style={s.planDetail}>Suggested monthly savings: {money(Number(p.targetAmount)/p.durationMonths)}</Text>
                  <Button label="Add savings" onPress={()=>beginDeposit(p.id)}/>
                </View>
                <Text style={s.sectionTitle}>Deposit history</Text>
                {planDeposits.length===0?<View style={s.empty}><Text style={s.emptyText}>No deposits recorded for this plan yet.</Text></View>:planDeposits.map(d=><View key={d.id} style={s.activityRow}><View style={{flex:1}}><Text style={s.planTitle}>Simulated deposit</Text><Text style={s.planDetail}>{new Date(d.createdAt).toLocaleString('en-ZA')}</Text></View><Text style={s.activityAmount}>+{money(d.amount)}</Text></View>)}
                <View style={s.notice}><Text style={s.noticeText}>🔒 Cash-out remains disabled. This plan uses simulated funds only; facial verification and withdrawal checks are not implemented yet.</Text></View>
              </View>;
            })()}
            {depositOpen || detailPlanId ? null : selectedPlan ? <View style={s.panel}>
              <TouchableOpacity onPress={()=>setSelectedPlan(null)}><Text style={s.greenLink}>← Back to plans</Text></TouchableOpacity>
              <Text style={[s.sectionTitle,{marginTop:20}]}>{selectedPlan.title}</Text>
              <Text style={s.planDetail}>Your savings will be locked for {selectedPlan.type==='custom'?'your chosen duration':selectedPlan.months+' months'}.</Text>
              <Text style={[s.label,{marginTop:20}]}>Savings goal name</Text><TextInput style={s.input} placeholder="e.g. My First Car" value={planForm.name} onChangeText={name=>setPlanForm(v=>({...v,name}))}/>
              <Text style={s.label}>Target amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} placeholder="5000" keyboardType="decimal-pad" value={planForm.targetAmount} onChangeText={targetAmount=>setPlanForm(v=>({...v,targetAmount}))}/></View>
              {selectedPlan.type==='custom'&&<><Text style={s.label}>Duration in months (1–60)</Text><TextInput style={s.input} keyboardType="number-pad" value={planForm.durationMonths} onChangeText={durationMonths=>setPlanForm(v=>({...v,durationMonths}))}/></>}
              <View style={s.notice}><Text style={s.noticeText}>🔒 Locked for {planForm.durationMonths||'?'} months. Suggested monthly savings: {Number(planForm.targetAmount)>0&&Number(planForm.durationMonths)>0?money(Number(planForm.targetAmount)/Number(planForm.durationMonths)):'—'}. Cash-out is not available in this demo.</Text></View>
              <Button label={busy?'Creating plan...':'Create locked savings plan'} disabled={busy} onPress={createPlan}/>
            </View> : <>
              {plans.map(p=><View key={p.type} style={s.plan}><View style={s.planTop}><Text style={s.planTitle}>{p.title}</Text><Text style={s.term}>{p.months?p.months+' MONTHS':'1–60 MONTHS'}</Text></View><Text style={s.planDetail}>{p.detail}</Text><View style={s.planLine}/><Text style={s.planDetail}>Locked savings plan</Text><Button label="Choose plan" onPress={()=>beginPlan(p)} outline/></View>)}
              <Text style={s.sectionTitle}>Your saved plans ({savedPlans.length})</Text>
              {plansLoading&&<ActivityIndicator color={C.green}/>}
              {savedPlans.map(p=><View key={p.id} style={s.plan}><TouchableOpacity onPress={()=>openPlanDetails(p.id)} accessibilityRole="button"><Text style={s.planTitle}>{p.name}  ›</Text><Text style={s.planDetail}>{p.durationMonths} months · Matures {p.maturesOn}</Text><Text style={s.planDetail}>Target: {money(p.targetAmount)} · Saved: {money(p.savedAmount)}</Text><Text style={[s.greenLink,{marginTop:12}]}>View plan details →</Text></TouchableOpacity><Button label="Add savings" onPress={()=>beginDeposit(p.id)} outline/></View>)}
            </>}
          </>}
          {tab==='Activity'&&<>
            <Text style={s.eyebrow}>YOUR MONEY STORY</Text><Text style={s.title}>Activity</Text><Text style={s.subtitle}>Track your savings journey in one place.</Text>
            {deposits.length===0?<View style={s.empty}><Text style={s.emptyIcon}>◷</Text><Text style={s.emptyTitle}>No activity yet</Text><Text style={s.emptyText}>Your simulated deposits will appear here.</Text></View>:deposits.map(d=><View key={d.id} style={s.activityRow}><View><Text style={s.planTitle}>{d.planName}</Text><Text style={s.planDetail}>{new Date(d.createdAt).toLocaleString('en-ZA')} · Demo deposit</Text></View><Text style={s.activityAmount}>+{money(d.amount)}</Text></View>)}
          </>}
          {tab==='Profile'&&<>
            <Text style={s.eyebrow}>ACCOUNT & SECURITY</Text><Text style={s.title}>Your profile</Text><Text style={s.subtitle}>Manage your personal information and security settings.</Text>
            <View style={s.profileCard}><View style={s.avatar}><Text style={s.avatarText}>{(user?.firstName||'P').charAt(0).toUpperCase()}</Text></View><View><Text style={s.profileName}>{[user?.firstName,user?.surname].filter(Boolean).join(' ')||'Piggy Bank Saver'}</Text><Text style={s.profileEmail}>{user?.email||'Account holder'}</Text></View></View>
            <Text style={s.sectionTitle}>Identity & security</Text>
            <View style={s.security}><View style={s.securityBadge}><Text style={s.securityBadgeText}>NOT ENROLLED</Text></View><Text style={s.securityTitle}>Face verification</Text><Text style={s.emptyText}>Required before your first cash-out. Secure biometric enrollment and matching are not available in this demo.</Text>
            <View style={s.faceCircle}><Text style={s.faceIcon}>◉</Text><Text style={s.faceText}>Face scan preview</Text></View>
            <Button label="Set up face verification · Coming soon" onPress={()=>notify('Security feature coming soon','A secure identity check, liveness detection and biometric matching must be implemented before real withdrawals can be enabled.')}/>
            </View>
            <View style={s.notice}><Text style={s.noticeText}>Cash-out is disabled until savings, identity verification and server-side withdrawal controls are implemented.</Text></View>
            <Button label="Log out" onPress={logout} outline/>
          </>}
          <View style={s.bottomNav}>{[['Home','⌂'],['Savings','◈'],['Activity','◷'],['Profile','○']].map(([name,icon])=><TouchableOpacity key={name} onPress={()=>nav(name)} style={[s.navItem,tab===name&&s.navActive]}><Text style={[s.navIcon,tab===name&&{color:C.green}]}>{icon}</Text><Text style={[s.navLabel,tab===name&&{color:C.green,fontWeight:'800'}]}>{name}</Text></TouchableOpacity>)}</View>
        </>}
        <Text style={s.footer}>PIGGY BANK  •  DEMONSTRATION ONLY  •  NO REAL MONEY</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.ivory},center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.ivory},
  scroll:{flexGrow:1,paddingHorizontal:18,paddingTop:35,paddingBottom:35,alignItems:'center'},
  shell:{width:'100%',maxWidth:560},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:38,flexWrap:'wrap',gap:8},
  brand:{fontSize:23,fontWeight:'900',color:C.forest},brandPill:{backgroundColor:'#E7EDE8',paddingHorizontal:10,paddingVertical:7,borderRadius:20},brandPillText:{fontSize:9,fontWeight:'800',color:C.green,letterSpacing:1.3},
  eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.8,color:C.green,marginBottom:10},title:{fontSize:30,fontWeight:'900',color:C.forest,marginBottom:8},subtitle:{fontSize:14,lineHeight:22,color:C.muted,marginBottom:23},
  auth:{paddingBottom:25},panel:{backgroundColor:C.white,borderRadius:22,padding:20,borderWidth:1,borderColor:C.border},
  label:{fontSize:12,fontWeight:'700',color:C.forest,marginBottom:7},input:{backgroundColor:C.ivory,borderColor:C.border,borderWidth:1,borderRadius:12,padding:14,fontSize:15,marginBottom:17,color:C.dark},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:18},chip:{borderWidth:1,borderColor:C.border,borderRadius:20,paddingHorizontal:11,paddingVertical:9},chipSelected:{backgroundColor:C.green,borderColor:C.green},chipText:{fontSize:12,color:C.forest,fontWeight:'600'},
  button:{backgroundColor:C.green,paddingVertical:16,paddingHorizontal:16,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:12},outline:{backgroundColor:'transparent',borderWidth:1,borderColor:C.green},buttonText:{fontSize:14,fontWeight:'800',color:C.white},link:{color:C.green,textAlign:'center',marginTop:22,fontWeight:'700',fontSize:13},
  balance:{backgroundColor:C.dark,borderRadius:24,padding:26,marginBottom:28},balanceLabel:{fontSize:11,color:'#B4C9BD',letterSpacing:1.4,fontWeight:'700'},balanceAmount:{fontSize:47,fontWeight:'900',color:C.white,marginTop:13,marginBottom:18},goldLine:{height:2,width:65,backgroundColor:C.gold,marginBottom:17},balanceFoot:{color:'#B4C9BD',fontSize:12},
  balanceBreakdown:{borderTopWidth:1,borderTopColor:'#304139',marginTop:20,paddingTop:16},balanceBreakdownTitle:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#B4C9BD',marginBottom:8},balanceBreakdownRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:14,paddingVertical:9},balancePlanName:{fontSize:13,color:'#E4EFE8',flex:1},balancePlanAmount:{fontSize:14,fontWeight:'800',color:C.white},
  sectionTitle:{fontSize:18,fontWeight:'900',color:C.forest,marginBottom:14},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},greenLink:{fontSize:13,fontWeight:'700',color:C.green},
  actions:{flexDirection:'row',gap:12,marginBottom:28},action:{flex:1,backgroundColor:C.white,borderRadius:17,padding:18,borderWidth:1,borderColor:C.border},actionIcon:{fontSize:27,color:C.green,marginBottom:12,fontWeight:'500'},actionText:{fontSize:13,fontWeight:'800',color:C.forest},
  empty:{backgroundColor:C.white,borderRadius:21,padding:24,borderWidth:1,borderColor:C.border,marginBottom:22},emptyIcon:{fontSize:30,marginBottom:12,color:C.green},emptyTitle:{fontSize:17,fontWeight:'800',color:C.forest,marginBottom:8},emptyText:{fontSize:13,lineHeight:21,color:C.muted,marginBottom:10},
  plan:{backgroundColor:C.white,borderRadius:20,padding:21,borderWidth:1,borderColor:C.border,marginBottom:15},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planTitle:{fontSize:19,fontWeight:'900',color:C.forest},term:{color:C.green,fontSize:10,fontWeight:'900',letterSpacing:1},planDetail:{color:C.muted,fontSize:13,marginTop:8},planLine:{height:1,backgroundColor:C.border,marginTop:18,marginBottom:8},
  notice:{padding:17,backgroundColor:'#EAF0EB',borderRadius:15,marginVertical:13},noticeText:{fontSize:12,lineHeight:20,color:C.forest},
  profileCard:{backgroundColor:C.white,borderRadius:18,padding:19,flexDirection:'row',alignItems:'center',gap:15,marginBottom:28,borderWidth:1,borderColor:C.border},avatar:{height:56,width:56,borderRadius:28,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},avatarText:{color:C.gold,fontSize:24,fontWeight:'900'},profileName:{fontSize:17,fontWeight:'800',color:C.forest},profileEmail:{fontSize:12,color:C.muted,marginTop:5},
  security:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:20,padding:22},securityBadge:{backgroundColor:'#F6EBD7',alignSelf:'flex-start',padding:7,borderRadius:8,marginBottom:13},securityBadgeText:{fontSize:10,fontWeight:'800',color:'#8A6429'},securityTitle:{fontSize:18,fontWeight:'900',color:C.forest,marginBottom:8},
  faceCircle:{height:178,width:178,borderRadius:89,borderWidth:3,borderColor:C.gold,backgroundColor:C.ivory,alignSelf:'center',alignItems:'center',justifyContent:'center',marginVertical:19},faceIcon:{fontSize:55,color:C.green},faceText:{fontSize:11,fontWeight:'700',color:C.forest},
  bottomNav:{flexDirection:'row',justifyContent:'space-around',backgroundColor:C.white,borderRadius:19,borderWidth:1,borderColor:C.border,paddingVertical:12,marginTop:15},navItem:{flex:1,alignItems:'center',paddingVertical:5},navActive:{backgroundColor:'#F0F6F1',borderRadius:12},navIcon:{fontSize:23,color:C.muted},navLabel:{fontSize:10,color:C.muted,marginTop:3},
  planChoice:{borderWidth:1,borderColor:C.border,borderRadius:12,padding:13,marginBottom:10},planChoiceSelected:{borderColor:C.green,backgroundColor:'#EDF6EF'},activityRow:{backgroundColor:C.white,borderRadius:14,padding:17,marginBottom:10,borderWidth:1,borderColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10},activityAmount:{fontSize:16,fontWeight:'900',color:C.green},
  amountRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.ivory,borderWidth:1,borderColor:C.border,borderRadius:12,marginBottom:17},amountPrefix:{fontSize:16,fontWeight:'800',color:C.forest,paddingLeft:14,paddingRight:8},amountInput:{flex:1,paddingVertical:14,paddingRight:14,fontSize:15,color:C.dark},
  ringWrap:{alignItems:'center',marginVertical:12},ring:{width:200,height:200,alignItems:'center',justifyContent:'center'},ringDot:{position:'absolute',width:10,height:10,borderRadius:5},ringPercent:{fontSize:39,fontWeight:'900',color:C.forest},ringCaption:{fontSize:10,fontWeight:'800',color:C.muted,letterSpacing:1.2},countdown:{backgroundColor:'#EDF6EF',borderRadius:16,padding:18,alignItems:'center',marginTop:20},countdownTitle:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:C.green},countdownDays:{fontSize:25,fontWeight:'900',color:C.forest,marginTop:7},countdownSub:{fontSize:12,color:C.muted,marginTop:5},
  progressTrack:{height:9,backgroundColor:C.border,borderRadius:6,overflow:'hidden',marginTop:15},progressFill:{height:9,backgroundColor:C.green,borderRadius:6},
  footer:{textAlign:'center',color:'#94A199',fontSize:9,letterSpacing:1,marginTop:24}
});
