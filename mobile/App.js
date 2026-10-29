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
const fields = [['firstName','First name'],['surname','Surname'],['idNumber','South African ID number'],['address','Residential address'],['mobileNumber','Mobile number (e.g. 0821234567)'],['gender','Gender'],['email','Email address'],['password','Password (12+ characters)'],['confirmPassword','Confirm password']];
const TERMS_VERSION='2026-10-28-demo-v2';
const TERMS=[["Demo service","Piggy Bank is a demonstration only. Balances and deposits are simulated. No real money is held, transferred or withdrawn."],["Locked savings","The proposed policy allows partial or full early withdrawals with a 2% penalty on the amount withdrawn. After maturity, no early withdrawal penalty applies. Any real-money fee is subject to legal review."],["Identity checks","A future real-money withdrawal requires successful identity, liveness and payout-account verification, whether early or matured. If the verification does not match, the withdrawal will be blocked pending review. These checks are not yet implemented."],["Contributions and goals","Contributions are flexible and simulated. Changing a goal name or target does not change its maturity date or erase saved amounts."],["Keep your account safe","Protect your password and device. Never share OTPs, PINs or CVVs. Report suspicious activity. Never enter real bank or card details into this demo."],["Payments and privacy","A future real-money version will need a secure payment provider, bank-account verification, privacy disclosures and appropriate POPIA safeguards. CVVs must never be stored after authorisation."],["Important limitations","These draft demo terms are not a legally reviewed financial services agreement. Real-money operations require regulatory and legal review, fees and dispute policies, and suitable provider arrangements."]];
const MATURITY_GUIDE=[
['What is maturity?','Maturity is the end of your selected savings period. Your plan shows its maturity date and a countdown.'],
['Can I withdraw early?','Yes, under the proposed policy you may withdraw part or all of your savings before maturity. A 2% penalty applies to the withdrawn amount, not the entire savings balance.'],
['What happens if I save more or less?','You can contribute flexible amounts at any time. Saving more or less than your target does not move your maturity date.'],
['What happens on the maturity date?','A matured plan becomes eligible for penalty-free withdrawal, but payment is not automatic. Verification and other applicable checks must be completed first.'],
['How will withdrawals work?','You may request a partial withdrawal and continue saving, or withdraw the full balance. In the future live service, you will select a verified payout bank account, request a withdrawal and complete secure identity and liveness checks. The service will verify account ownership and process an eligible request through its payment provider.'],
['What if verification fails?','If your identity, face/liveness verification or bank account ownership does not match, the withdrawal is blocked pending secure review. Do not share passwords, OTPs, PINs or CVVs with anyone.'],
['What works today?','Piggy Bank currently uses simulated deposits and balances. No real funds are held. Demo withdrawals change only simulated balances; biometric matching and bank payouts are not available yet.']
];
const plans = [{type:'starter',months:6,title:'The Starter',detail:'Short-term focus'},{type:'builder',months:12,title:'The Builder',detail:'Build lasting habits'},{type:'visionary',months:18,title:'The Visionary',detail:'Your long-term goal'},{type:'custom',months:null,title:'Custom Plan',detail:'Choose 1–60 months'}];
const daysUntil = date => Math.max(0,Math.ceil((new Date(date+'T00:00:00Z').getTime()-Date.now())/86400000));
const money = amount => 'R'+Number(amount||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
const demoMessage = () => notify('Demo feature','Savings and withdrawals are not yet connected to the backend. No money is being moved.');
const Button = ({label,onPress,outline=false,disabled=false}) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,outline&&s.outline,disabled&&{opacity:.55}]}><Text style={[s.buttonText,outline&&{color:C.forest}]}>{label}</Text></TouchableOpacity>;
const Icon = ({name,size=22,color=C.green}) => {
  const line={position:'absolute',backgroundColor:color,borderRadius:3};
  const box={width:size,height:size,position:'relative',alignItems:'center',justifyContent:'center'};
  if(name==='home')return <View style={box}><View style={{width:size*.59,height:size*.48,borderWidth:2,borderColor:color,borderTopWidth:0,borderRadius:2,marginTop:size*.26}}/><View style={[line,{width:size*.65,height:2,top:size*.24,transform:[{rotate:'-38deg'}],left:0}]}/><View style={[line,{width:size*.65,height:2,top:size*.24,transform:[{rotate:'38deg'}],right:0}]}/></View>;
  if(name==='savings')return <View style={box}><View style={{width:size*.8,height:size*.67,borderWidth:2,borderColor:color,borderRadius:5,justifyContent:'center',alignItems:'center'}}><View style={{width:size*.28,height:size*.28,borderRadius:size*.14,borderWidth:2,borderColor:color}}/></View></View>;
  if(name==='activity')return <View style={box}><View style={{width:size*.79,height:size*.79,borderRadius:size*.4,borderWidth:2,borderColor:color}}/><View style={[line,{width:2,height:size*.29,top:size*.27,left:size*.49}]}/><View style={[line,{width:size*.22,height:2,top:size*.52,left:size*.49}]}/></View>;
  if(name==='profile')return <View style={box}><View style={{width:size*.32,height:size*.32,borderWidth:2,borderColor:color,borderRadius:size*.16,position:'absolute',top:size*.09}}/><View style={{width:size*.73,height:size*.34,borderWidth:2,borderColor:color,borderBottomWidth:0,borderTopLeftRadius:size*.4,borderTopRightRadius:size*.4,position:'absolute',bottom:size*.08}}/></View>;
  if(name==='plus')return <View style={box}><View style={[line,{width:size*.7,height:2}]}/><View style={[line,{height:size*.7,width:2}]}/></View>;
  if(name==='arrow')return <View style={box}><View style={[line,{width:size*.55,height:2,transform:[{rotate:'-45deg'}]}]}/><View style={[line,{width:size*.3,height:2,top:size*.23,right:size*.12}]}/><View style={[line,{height:size*.3,width:2,top:size*.23,right:size*.12}]}/></View>;
  if(name==='lock')return <View style={box}><View style={{width:size*.54,height:size*.43,borderWidth:2,borderColor:color,borderRadius:3,position:'absolute',bottom:size*.13}}/><View style={{width:size*.35,height:size*.35,borderWidth:2,borderColor:color,borderBottomWidth:0,borderTopLeftRadius:size*.18,borderTopRightRadius:size*.18,position:'absolute',top:size*.12}}/></View>;
  return <View style={box}><View style={{width:size*.76,height:size*.76,borderRadius:size*.4,borderWidth:2,borderColor:color}}/></View>;
};
export default function App() {
  const [screen,setScreen] = useState('loading');
  const [children,setChildren]=useState([]);
  const [kidsOpen,setKidsOpen]=useState(false);
  const [childEditingId,setChildEditingId]=useState(null);
  const [childForm,setChildForm]=useState({firstName:'',surname:'',dateOfBirth:'',relationship:'Legal Guardian',avatarColor:'emerald'});
  const loadChildren=async()=>{
    try{const token=await sessionStore.get();if(!token)return;const response=await fetch(API_URL+'/api/v1/kids',{headers:{Authorization:'Bearer '+token}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load children.');setChildren(data.children||[]);}
    catch(e){notify('Piggy Bank Kids',e.message);}
  };
  const startChild=(child=null)=>{
    setChildEditingId(child?.id||null);
    setChildForm(child?{firstName:child.firstName,surname:child.surname,dateOfBirth:child.dateOfBirth,relationship:child.relationship,avatarColor:child.avatarColor||'emerald'}:{firstName:'',surname:'',dateOfBirth:'',relationship:'Legal Guardian',avatarColor:'emerald'});
    setKidsOpen(true);setTab('Savings');
  };
  const saveChild=async()=>{
    if(!childForm.firstName.trim()||!childForm.surname.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(childForm.dateOfBirth))return notify('Child details','Enter first name, surname and a date of birth as YYYY-MM-DD.');
    setBusy(true);
    try{const token=await sessionStore.get();const response=await fetch(API_URL+'/api/v1/kids'+(childEditingId?'/'+childEditingId:''),{method:childEditingId?'PATCH':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(childForm)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to save child.');setKidsOpen(false);await loadChildren();notify('Piggy Bank Kids',childEditingId?'Child profile updated.':'Child profile added. No real child verification is performed.');}
    catch(e){notify('Unable to save child',e.message);}finally{setBusy(false);}
  };
  const removeChild=async(child)=>{
    const proceed=async()=>{setBusy(true);try{const token=await sessionStore.get();const response=await fetch(API_URL+'/api/v1/kids/'+child.id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to remove child.');await loadChildren();notify('Removed','Child profile removed.');}catch(e){notify('Unable to remove child',e.message);}finally{setBusy(false);}};
    if(Platform.OS==='web'){if(window.confirm('Remove '+child.firstName+'\'s demo child profile?'))await proceed();}
    else Alert.alert('Remove child profile','Remove '+child.firstName+'\'s demo child profile?',[{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:proceed}]);
  };

  const [tab,setTab] = useState('Home');
  const [user,setUser] = useState(null);
  const [profileOpen,setProfileOpen] = useState(false);
  const [profileForm,setProfileForm] = useState({});
  const [bankingOpen,setBankingOpen] = useState(false);
  const [bankingForm,setBankingForm] = useState({bank:'',accountType:''});
  const [savedBanking,setSavedBanking] = useState(null);
  const [values,setValues] = useState({});
  const [registrationStep,setRegistrationStep] = useState(1);
  const [termsOpen,setTermsOpen] = useState(false);
  const [maturityGuideOpen,setMaturityGuideOpen] = useState(false);
  const [termsAccepted,setTermsAccepted] = useState(false);
  const [demoPayment,setDemoPayment] = useState({bank:'',accountType:'',cardConfirmed:false});
  const [busy,setBusy] = useState(false);
  const [savedPlans,setSavedPlans] = useState([]);
  const [plansLoading,setPlansLoading] = useState(false);
  const [deposits,setDeposits] = useState([]);
  const [withdrawals,setWithdrawals] = useState([]);
  const [withdrawOpen,setWithdrawOpen] = useState(false);
  const [withdrawAmount,setWithdrawAmount] = useState('');
  const [withdrawConfirmed,setWithdrawConfirmed] = useState(false);
  const [depositOpen,setDepositOpen] = useState(false);
  const [detailPlanId,setDetailPlanId] = useState(null);
  const [editingPlan,setEditingPlan] = useState(false);
  const [editName,setEditName] = useState('');
  const [editTarget,setEditTarget] = useState('');
  const [planChanges,setPlanChanges] = useState([]);
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

  const loadWithdrawals=async()=>{
    try{const saved=await sessionStore.get();if(!saved)return;const response=await fetch(API_URL+'/api/v1/savings/withdrawals',{headers:{Authorization:'Bearer '+saved}});if(response.ok)setWithdrawals((await response.json()).withdrawals||[]);}catch(e){console.warn('Demo withdrawals',e);}
  };
  const submitWithdrawal=async(plan)=>{
    const amount=Number(withdrawAmount);
    if(!/^\d+(\.\d{1,2})?$/.test(withdrawAmount.trim())||!Number.isFinite(amount)||amount<=0||amount>Number(plan.savedAmount))return notify('Check withdrawal amount','Enter an amount above R0 and no more than your saved balance, with at most two decimals.');
    if(!withdrawConfirmed)return notify('Confirm demo','Confirm that this withdrawal is simulated and does not transfer real money.');
    const early=daysUntil(plan.maturesOn)>0,penalty=early?Math.round(amount*2)/100:0;
    const summary='Withdraw '+money(amount)+' from '+plan.name+'?\nEarly withdrawal penalty: '+money(penalty)+'\nSimulated payout: '+money(amount-penalty)+'\n\nNo real money moves. Identity and bank verification are NOT performed in this demo.';
    const proceed=async()=>{
      setBusy(true);
      try{
        const saved=await sessionStore.get();
        const response=await fetch(API_URL+'/api/v1/savings/withdrawals',{method:'POST',headers:{Authorization:'Bearer '+saved,'Content-Type':'application/json'},body:JSON.stringify({planId:plan.id,amount,confirmDemo:true})});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to withdraw.');
        setWithdrawOpen(false);setWithdrawAmount('');setWithdrawConfirmed(false);
        await Promise.all([loadPlans(),loadWithdrawals()]);
        notify('Demo withdrawal recorded','Simulated payout: '+money(data.withdrawal.payout)+'\nPenalty: '+money(data.withdrawal.penalty)+'\nNo real money moved.');
      }catch(e){notify('Withdrawal failed',e.message);}finally{setBusy(false);}
    };
    if(Platform.OS==='web'){if(window.confirm(summary))await proceed();}
    else Alert.alert('Confirm demo withdrawal',summary,[{text:'Cancel',style:'cancel'},{text:'Confirm demo withdrawal',onPress:proceed}]);
  };

  const loadPlanChanges = async planId => {
    try{
      const saved=await sessionStore.get();
      const response=await fetch(API_URL+'/api/v1/savings/plans/'+planId+'/changes',{headers:{Authorization:'Bearer '+saved}});
      const data=await response.json();
      if(response.ok)setPlanChanges(data.changes||[]);
    }catch(e){console.warn('Unable to load change history',e);}
  };
  const openPlanDetails = planId => { setSelectedPlan(null);setDepositOpen(false);setEditingPlan(false);setWithdrawOpen(false);setWithdrawAmount('');setWithdrawConfirmed(false);setPlanChanges([]);setDetailPlanId(planId);setTab('Savings');loadDeposits();loadPlanChanges(planId); };
  const savePlanEdit = async () => {
    const p=savedPlans.find(item=>item.id===detailPlanId);
    const target=Number(editTarget);
    if(!p||!editName.trim()||!/^\d+(\.\d{1,2})?$/.test(editTarget.trim())||target<=0||target>100000000||target<Number(p.savedAmount))
      return notify('Check your changes','Enter a name and a target at least equal to your saved balance, with up to two decimals.');
    const summary='Update '+p.name+'?\n\nName: '+p.name+' → '+editName.trim()+'\nTarget: '+money(p.targetAmount)+' → '+money(target)+'\n\nYour savings and maturity date will not change.';
    const proceed=async()=>{
      setBusy(true);
      try{
        const saved=await sessionStore.get();
        const response=await fetch(API_URL+'/api/v1/savings/plans/'+p.id,{method:'PATCH',headers:{Authorization:'Bearer '+saved,'Content-Type':'application/json'},body:JSON.stringify({name:editName.trim(),targetAmount:target})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Unable to save changes.');
        await Promise.all([loadPlans(),loadPlanChanges(p.id)]);
        setEditingPlan(false);
        notify('Plan updated','Your goal was updated. Your savings and lock date are unchanged.');
      }catch(e){notify('Unable to update plan',e.message);}
      finally{setBusy(false);}
    };
    if(Platform.OS==='web'){if(window.confirm(summary))await proceed();}
    else Alert.alert('Confirm plan changes',summary,[{text:'Cancel',style:'cancel'},{text:'Confirm changes',onPress:proceed}]);
  };
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
      notify('Plan created','Your savings plan was saved successfully. No money has been deposited.');
    } catch(e) { notify('Unable to create plan',e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { (async () => {
    try {
      const saved = await sessionStore.get();
      if (saved) {
        const response = await fetch(API_URL+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+saved}});
        if (response.ok) { setUser((await response.json()).user);setScreen('home');loadPlans();loadWithdrawals();loadBanking();loadDeposits();loadChildren();return; }
        await sessionStore.remove();
      }
    } catch {}
    setScreen('register');
  })(); }, []);
  const submit = async () => {
    if(screen==='register' && registrationStep===1){
      if(!values.firstName?.trim()||!values.surname?.trim()||!values.idNumber?.trim()||!values.address?.trim()||!values.mobileNumber?.trim()||!values.gender||!values.email?.trim()||!values.password||values.password.length<12||values.password!==values.confirmPassword)return notify('Complete your details','Fill in all personal information and use matching passwords of at least 12 characters.');
      setRegistrationStep(2);return;
    }
    if(screen==='register' && !termsAccepted)return notify('Terms required','Read and accept the Terms & Conditions to create your account.');
    if(screen==='register' && (!demoPayment.bank||!demoPayment.accountType||!demoPayment.cardConfirmed))return notify('Complete payment setup','Choose a bank and account type, then confirm you understand that only fictional test payment details are supported in this demo.');
    if (screen==='register' && !/^(?:\\+27|0)[6-8]\\d{8}$/.test(values.mobileNumber||''))return notify('Mobile number','Enter a valid South African mobile number, e.g. 0821234567.');
    if (screen==='register' && values.password!==values.confirmPassword) return notify('Check password','Passwords do not match.');
    setBusy(true);
    try {
      const endpoint=screen==='register'?'register':'login';
      const body=screen==='register'?{...(({confirmPassword,...data})=>data)(values),termsVersion:TERMS_VERSION,termsAccepted:true}:{email:values.email,password:values.password};
      const response=await fetch(API_URL+'/api/v1/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error||'Please try again.');
      await sessionStore.set(data.token);
      setUser(data.user);setValues({});setDemoPayment({bank:'',accountType:'',cardConfirmed:false});setRegistrationStep(1);setTermsAccepted(false);setTermsOpen(false);setTab('Home');setScreen('home');loadPlans();
    } catch(e) { notify('Unable to continue',e.message); }
    finally { setBusy(false); }
  };

  const loadBanking=async()=>{
    try{const token=await sessionStore.get();if(!token)return;const r=await fetch(API_URL+'/api/v1/auth/demo-banking',{headers:{Authorization:'Bearer '+token}});if(r.ok)setSavedBanking((await r.json()).banking);}catch(e){console.warn('Banking preferences',e);}
  };
  const openBanking=()=>{setBankingForm({bank:savedBanking?.bank||'',accountType:savedBanking?.accountType||''});setBankingOpen(v=>!v);};
  const saveBanking=async()=>{
    if(!bankingForm.bank||!bankingForm.accountType)return notify('Complete banking preferences','Select a bank and account type.');
    setBusy(true);
    try{const token=await sessionStore.get();const r=await fetch(API_URL+'/api/v1/auth/demo-banking',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(bankingForm)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to save preferences.');setSavedBanking(data.banking);setBankingOpen(false);notify('Demo banking updated','Your fictional bank selection was saved. No real banking or card details were stored or verified.');}
    catch(e){notify('Banking preferences',e.message);}finally{setBusy(false);}
  };

  const openProfile=()=>{setProfileForm({firstName:user?.firstName||'',surname:user?.surname||'',address:user?.address||'',mobileNumber:user?.mobileNumber||'',gender:user?.gender||'Female'});setProfileOpen(true);};
  const saveProfile=async()=>{
    if(!profileForm.firstName?.trim()||!profileForm.surname?.trim()||!profileForm.address?.trim()||!profileForm.mobileNumber?.trim())return notify('Complete profile','Please complete all editable fields.');
    setBusy(true);
    try{
      const saved=await sessionStore.get();
      const response=await fetch(API_URL+'/api/v1/auth/profile',{method:'PATCH',headers:{Authorization:'Bearer '+saved,'Content-Type':'application/json'},body:JSON.stringify(profileForm)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Unable to update profile.');
      setUser(data.user);setProfileOpen(false);notify('Profile updated','Your information was saved successfully.');
    }catch(e){notify('Unable to update profile',e.message);}
    finally{setBusy(false);}
  };
  const logout=async()=>{await sessionStore.remove();setUser(null);setValues({});setSavedPlans([]);setChildren([]);setKidsOpen(false);setDeposits([]);setWithdrawals([]);setSavedBanking(null);setBankingOpen(false);setDepositOpen(false);setDetailPlanId(null);setEditingPlan(false);setSelectedPlan(null);setScreen('login');};
  const nav=target=>{setSelectedPlan(null);setDepositOpen(false);setDetailPlanId(null);setProfileOpen(false);setTab(target);if(target==='Savings'||target==='Home')loadPlans();if(target==='Activity'){loadDeposits();loadWithdrawals();}};
  if(screen==='loading') return <View style={s.center}><ActivityIndicator size="large" color={C.green}/></View>;
  const loggedIn=screen==='home';
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
    <StatusBar style="dark"/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View style={s.shell}>
        <View style={s.header}><View style={s.brandGroup}><View style={s.brandMark}><Icon name="savings" size={20} color={C.gold}/></View><Text style={s.brand}>Piggy Bank</Text></View><View style={s.brandPill}><Text style={s.brandPillText}>EMERALD LUXE</Text></View></View>
        {!loggedIn ? <View style={s.auth}>
          <Text style={s.eyebrow}>YOUR FUTURE, SECURED</Text>
          <Text style={s.title}>{screen==='register'?(registrationStep===1?'Start saving beautifully.':'Set up payment details.'):'Welcome back.'}</Text>
          <Text style={s.subtitle}>{screen==='register'?(registrationStep===1?'Step 1 of 2 · Personal information':'Step 2 of 2 · Mandatory demo payment setup. No real card or bank account numbers.'):'Sign in to your Piggy Bank account.'}</Text>
          <View style={s.panel}>{screen==='register'&&registrationStep===2?<View>
            <View style={s.notice}><Text style={s.noticeText}>DEMONSTRATION ONLY: Do not enter real card numbers, CVVs, expiry dates or bank account numbers. Real payment details will be collected by a certified payment provider when integrated.</Text></View>
            <Text style={s.label}>Choose your bank</Text>
            <View style={s.chips}>{['FNB','Capitec','Standard Bank','Absa','Nedbank','Other'].map(bank=><TouchableOpacity key={bank} style={[s.chip,demoPayment.bank===bank&&s.chipSelected]} onPress={()=>setDemoPayment(v=>({...v,bank}))}><Text style={[s.chipText,demoPayment.bank===bank&&{color:C.white}]}>{bank}</Text></TouchableOpacity>)}</View>
            <Text style={s.label}>Bank account type</Text>
            <View style={s.chips}>{['Savings','Current','Cheque'].map(accountType=><TouchableOpacity key={accountType} style={[s.chip,demoPayment.accountType===accountType&&s.chipSelected]} onPress={()=>setDemoPayment(v=>({...v,accountType}))}><Text style={[s.chipText,demoPayment.accountType===accountType&&{color:C.white}]}>{accountType}</Text></TouchableOpacity>)}</View>
            <Text style={s.sectionTitle}>Card payment verification · Preview</Text>
            <View style={s.plan}><Text style={s.label}>Card number</Text><Text style={s.planDetail}>•••• •••• •••• 4242 · fictional preview</Text><View style={s.planLine}/><Text style={s.label}>Expiry date</Text><Text style={s.planDetail}>MM/YY · collected securely by payment provider</Text><View style={s.planLine}/><Text style={s.label}>CVV</Text><Text style={s.planDetail}>••• · entered only into provider's secure checkout</Text></View>
            <TouchableOpacity style={[s.planChoice,demoPayment.cardConfirmed&&s.planChoiceSelected]} onPress={()=>setDemoPayment(v=>({...v,cardConfirmed:!v.cardConfirmed}))}><Text style={s.planDetail}>{demoPayment.cardConfirmed?'✓ ':'○ '}I understand this is a demo and will provide real card details only through a secure payment provider.</Text></TouchableOpacity>
            <Button label="← Back to personal information" outline onPress={()=>setRegistrationStep(1)}/>
          </View>:(screen==='register'?fields:[['email','Email address'],['password','Password']]).map(([key,label])=><View key={key}>
            <Text style={s.label}>{label}</Text>
            {key==='gender'?<View style={s.chips}>{['Female','Male','Non-binary','Other'].map(g=><TouchableOpacity key={g} onPress={()=>setValues(v=>({...v,gender:g}))} style={[s.chip,values.gender===g&&s.chipSelected]}><Text style={[s.chipText,values.gender===g&&{color:C.white}]}>{g}</Text></TouchableOpacity>)}</View>:
            <TextInput style={s.input} placeholder={label} placeholderTextColor="#96A39A" value={values[key]||''} onChangeText={v=>setValues(prev=>({...prev,[key]:v}))} autoCapitalize={key==='email'?'none':'sentences'} autoCorrect={false} secureTextEntry={key.toLowerCase().includes('password')} keyboardType={key==='email'?'email-address':key==='idNumber'||key==='mobileNumber'?'phone-pad':'default'}/>}
          </View>)}
          {screen==='register'&&registrationStep===2&&<View style={{marginTop:15}}><Text style={s.emptyText}>Before creating your account, please go through our Terms &amp; Conditions.</Text><TouchableOpacity onPress={()=>setTermsOpen(v=>!v)} accessibilityRole="button"><Text style={s.greenLink}>{termsOpen?'Hide Terms & Conditions':'Read Terms & Conditions →'}</Text></TouchableOpacity>{termsOpen&&<View style={s.notice}><Text style={s.sectionTitle}>Terms &amp; Conditions</Text>{TERMS.map(([heading,body])=><View key={heading} style={{marginBottom:14}}><Text style={s.label}>{heading}</Text><Text style={s.noticeText}>{body}</Text></View>)}</View>}<TouchableOpacity style={[s.planChoice,termsAccepted&&s.planChoiceSelected,{marginTop:12}]} accessibilityRole="checkbox" accessibilityState={{checked:termsAccepted}} onPress={()=>setTermsAccepted(v=>!v)}><Text style={s.planDetail}>{termsAccepted?'☑':'☐'} I have read and agree to the Terms & Conditions.</Text></TouchableOpacity></View>}
          <Button label={busy?'Please wait...':screen==='register'?(registrationStep===1?'Continue to payment setup':'Create demo account'):'Sign in'} disabled={busy} onPress={submit}/>
          <TouchableOpacity onPress={()=>{setValues({});setRegistrationStep(1);setTermsAccepted(false);setTermsOpen(false);setDemoPayment({bank:'',accountType:'',cardConfirmed:false});setScreen(screen==='register'?'login':'register');}}><Text style={s.link}>{screen==='register'?'Already have an account? Sign in':'New to Piggy Bank? Create an account'}</Text></TouchableOpacity>
          </View>
        </View> : <>
          {tab==='Home'&&<>
            <Text style={s.eyebrow}>GOOD TO HAVE YOU HERE</Text><Text style={s.title}>Hello, {user?.firstName||'Saver'}</Text>
            <Text style={s.subtitle}>Your future is worth saving for.</Text>
            <View style={s.balance}><Text style={s.balanceLabel}>TOTAL SAVINGS  ·  DEMO</Text><Text style={s.balanceAmount}>{money(savedPlans.reduce((sum,p)=>sum+Number(p.savedAmount||0),0))}</Text><View style={s.goldLine}/><Text style={s.balanceFoot}>{savedPlans.length} active plans    •    {deposits.length} demo deposits</Text>{savedPlans.length>0&&<View style={s.balanceBreakdown}><Text style={s.balanceBreakdownTitle}>SAVINGS BY PLAN</Text>{savedPlans.map(p=><View key={p.id} style={s.balanceBreakdownRow}><Text style={s.balancePlanName} numberOfLines={1}>{p.name}</Text><Text style={s.balancePlanAmount}>{money(p.savedAmount)}</Text></View>)}</View>}</View>
            <Text style={s.sectionTitle}>Quick actions</Text>
            <View style={s.actions}><TouchableOpacity style={s.action} onPress={()=>beginPlan(plans[0])}><Icon name="plus" size={26}/><Text style={s.actionText}>New savings plan</Text></TouchableOpacity><TouchableOpacity style={s.action} onPress={()=>beginDeposit()}><Icon name="arrow" size={26}/><Text style={s.actionText}>Add savings</Text></TouchableOpacity></View>
            <View style={s.sectionRow}><Text style={s.sectionTitle}>My savings plans</Text><TouchableOpacity onPress={()=>nav('Savings')}><Text style={s.greenLink}>Explore →</Text></TouchableOpacity></View>
            {savedPlans.length===0?<View style={s.empty}><View style={s.emptyGraphic}><Icon name="savings" size={32}/></View><Text style={s.emptyTitle}>Your journey starts here</Text><Text style={s.emptyText}>Choose a savings plan to start building your future.</Text><Button label="Explore savings plans" onPress={()=>nav('Savings')}/></View>:savedPlans.map(p=><TouchableOpacity key={p.id} style={s.plan} onPress={()=>openPlanDetails(p.id)} accessibilityRole="button" accessibilityLabel={'View details for '+p.name}><Text style={s.planTitle}>{p.name}  ›</Text><Text style={s.planDetail}>{p.durationMonths} months · Matures {p.maturesOn}</Text><Text style={s.planDetail}>{money(p.savedAmount)} of {money(p.targetAmount)} saved</Text><View style={s.progressTrack}><View style={[s.progressFill,{width:Math.min(100,Math.max(0,100*p.savedAmount/p.targetAmount))+'%'}]}/></View><Text style={s.planDetail}>{Math.round(100*p.savedAmount/p.targetAmount)}% complete · Suggested {money(p.targetAmount/p.durationMonths)}/month</Text></TouchableOpacity>)}
          </>}
          {tab==='Savings'&&<>
            {depositOpen&&<View style={s.panel}>
              <TouchableOpacity onPress={()=>setDepositOpen(false)}><Text style={s.greenLink}>← Back to savings</Text></TouchableOpacity>
              <Text style={[s.sectionTitle,{marginTop:20}]}>Add savings · Demo</Text>
              <Text style={s.emptyText}>Choose a plan and enter any contribution amount. No real money will move.</Text>
              <Text style={s.label}>Choose a savings plan</Text>
              {savedPlans.map(p=><TouchableOpacity key={p.id} onPress={()=>setDepositPlanId(p.id)} style={[s.planChoice,depositPlanId===p.id&&s.planChoiceSelected]}><Text style={s.planTitle}>{depositPlanId===p.id?'◉ ':'○ '}{p.name}</Text><Text style={s.planDetail}>Saved {money(p.savedAmount)} · Target {money(p.targetAmount)}</Text></TouchableOpacity>)}
              <Text style={s.label}>Deposit amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} placeholder="500" keyboardType="decimal-pad" value={depositAmount} onChangeText={setDepositAmount}/></View>
              <View style={s.notice}><Text style={s.noticeText}>This is a simulated contribution. Early demo withdrawals are allowed with a 2% penalty before maturity and no penalty after maturity. No bank account or payment method is charged.</Text></View>
              <Button label={busy?'Adding savings...':'Confirm simulated deposit'} disabled={busy} onPress={submitDeposit}/>
            </View>}

            <Text style={s.eyebrow}>SAVE WITH PURPOSE</Text><Text style={s.title}>Savings plans</Text><Text style={s.subtitle}>Create as many savings plans as you need. All amounts are simulated.</Text>
            {detailPlanId && !depositOpen && (() => {
              const p=savedPlans.find(item=>item.id===detailPlanId);
              if(!p) return <View style={s.empty}><Text style={s.emptyText}>This plan is no longer available.</Text><Button label="Back to savings" onPress={()=>setDetailPlanId(null)}/></View>;
              const planDeposits=deposits.filter(d=>d.planId===p.id);
              const progress=Math.round(100*Number(p.savedAmount)/Number(p.targetAmount));
              return <View>
                <TouchableOpacity onPress={()=>setDetailPlanId(null)}><Text style={s.greenLink}>← All savings plans</Text></TouchableOpacity>
                <View style={[s.balance,{marginTop:18}]}>
                  <Text style={s.balanceLabel}>SAVINGS BALANCE · DEMO</Text>
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
                  <View style={s.countdown}><Text style={s.countdownTitle}>MATURITY COUNTDOWN</Text><Text style={s.countdownDays}>{daysUntil(p.maturesOn)===0?'Matured':daysUntil(p.maturesOn)+' days left'}</Text><Text style={s.countdownSub}>Maturity date: {p.maturesOn}</Text><Text style={s.emptyText}>Partial and full demo withdrawals are available. Before maturity a 2% penalty applies; after maturity it is 0%. Real withdrawals will require identity and bank verification.</Text></View>
                  <View style={s.planLine}/>
                  <Text style={s.planDetail}>Plan: {p.planType==='custom'?'Custom':p.planType.charAt(0).toUpperCase()+p.planType.slice(1)}</Text>
                  <Text style={s.planDetail}>Started: {p.startsOn}</Text>
                  <Text style={s.planDetail}>Maturity date: {p.maturesOn} · Early withdrawal penalty: 2%</Text>
                  <Text style={s.planDetail}>Suggested monthly savings: {money(Number(p.targetAmount)/p.durationMonths)}</Text>
                  <Button label="Add savings" onPress={()=>beginDeposit(p.id)}/>
                  <Button label="Request demo withdrawal" outline onPress={()=>{setWithdrawOpen(v=>!v);setWithdrawAmount('');setWithdrawConfirmed(false);}}/>
                  {withdrawOpen&&<View style={[s.panel,{marginTop:16}]}><Text style={s.sectionTitle}>Withdraw savings · Demo</Text><Text style={s.emptyText}>Choose a partial amount or the full balance. This changes simulated savings only. No real money is paid out and no identity or bank verification is performed.</Text><Text style={s.label}>Withdrawal amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} keyboardType="decimal-pad" placeholder="0.00" value={withdrawAmount} onChangeText={setWithdrawAmount}/></View><TouchableOpacity onPress={()=>setWithdrawAmount(Number(p.savedAmount).toFixed(2))}><Text style={s.greenLink}>Use full balance ({money(p.savedAmount)})</Text></TouchableOpacity><View style={s.notice}><Text style={s.noticeText}>Available: {money(p.savedAmount)}{'\n'}{daysUntil(p.maturesOn)>0?'Early withdrawal · 2% penalty':'Matured · 0% penalty'}{'\n'}Penalty: {money(/^\d+(\.\d{1,2})?$/.test(withdrawAmount)&&Number(withdrawAmount)>0?(daysUntil(p.maturesOn)>0?Math.round(Number(withdrawAmount)*2)/100:0):0)}{'\n'}Simulated payout: {money(/^\d+(\.\d{1,2})?$/.test(withdrawAmount)&&Number(withdrawAmount)>0?Number(withdrawAmount)-(daysUntil(p.maturesOn)>0?Math.round(Number(withdrawAmount)*2)/100:0):0)}</Text></View><TouchableOpacity style={s.planChoice} accessibilityRole="checkbox" accessibilityState={{checked:withdrawConfirmed}} onPress={()=>setWithdrawConfirmed(v=>!v)}><Text style={s.planDetail}>{withdrawConfirmed?'☑':'☐'} I understand this is a simulation, not a real withdrawal or verification.</Text></TouchableOpacity><Button label={busy?'Processing...':'Review demo withdrawal'} disabled={busy||!withdrawConfirmed||Number(p.savedAmount)<=0} onPress={()=>submitWithdrawal(p)}/><Button label="Cancel" outline onPress={()=>setWithdrawOpen(false)}/></View>}
                  <Button label="Edit savings goal" outline onPress={()=>{setEditName(p.name);setEditTarget(String(p.targetAmount));setEditingPlan(true);}}/>
                  {editingPlan&&<View style={[s.panel,{marginTop:16}]}>
                    <Text style={s.sectionTitle}>Edit your goal</Text>
                    <Text style={s.label}>Goal name</Text><TextInput style={s.input} value={editName} onChangeText={setEditName}/>
                    <Text style={s.label}>New target amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} keyboardType="decimal-pad" value={editTarget} onChangeText={setEditTarget}/></View>
                    <Text style={s.emptyText}>Your maturity date, duration and saved balance stay locked. The target cannot be below {money(p.savedAmount)}.</Text>
                    <Button label={busy?'Saving...':'Review and confirm changes'} disabled={busy} onPress={savePlanEdit}/>
                    <Button label="Cancel" outline onPress={()=>setEditingPlan(false)}/>
                  </View>}
                </View>
                <Text style={s.sectionTitle}>Goal change history</Text>
                {planChanges.length===0?<Text style={[s.emptyText,{marginBottom:18}]}>No changes to this goal yet.</Text>:planChanges.map(change=><View key={change.id} style={s.activityRow}><View style={{flex:1}}><Text style={s.planDetail}>{new Date(change.createdAt).toLocaleString('en-ZA')}</Text>{change.oldName!==change.newName&&<Text style={s.planDetail}>Name: {change.oldName} → {change.newName}</Text>}{change.oldTarget!==change.newTarget&&<Text style={s.planDetail}>Target: {money(change.oldTarget)} → {money(change.newTarget)}</Text>}</View></View>)}
                <Text style={s.sectionTitle}>Deposit history</Text>
                {planDeposits.length===0?<View style={s.empty}><Text style={s.emptyText}>No deposits recorded for this plan yet.</Text></View>:planDeposits.map(d=><View key={d.id} style={s.activityRow}><View style={{flex:1}}><Text style={s.planTitle}>Simulated deposit</Text><Text style={s.planDetail}>{new Date(d.createdAt).toLocaleString('en-ZA')}</Text></View><Text style={s.activityAmount}>+{money(d.amount)}</Text></View>)}
                <View style={s.notice}><Text style={s.noticeText}>Cash-out remains disabled. This plan uses simulated funds only; facial verification and withdrawal checks are not implemented yet.</Text></View>
              </View>;
            })()}
            {depositOpen || detailPlanId ? null : selectedPlan ? <View style={s.panel}>
              <TouchableOpacity onPress={()=>setSelectedPlan(null)}><Text style={s.greenLink}>← Back to plans</Text></TouchableOpacity>
              <Text style={[s.sectionTitle,{marginTop:20}]}>{selectedPlan.title}</Text>
              <Text style={s.planDetail}>Your savings will be locked for {selectedPlan.type==='custom'?'your chosen duration':selectedPlan.months+' months'}.</Text>
              <Text style={[s.label,{marginTop:20}]}>Savings goal name</Text><TextInput style={s.input} placeholder="e.g. My First Car" value={planForm.name} onChangeText={name=>setPlanForm(v=>({...v,name}))}/>
              <Text style={s.label}>Target amount</Text><View style={s.amountRow}><Text style={s.amountPrefix}>R</Text><TextInput style={s.amountInput} placeholder="5000" keyboardType="decimal-pad" value={planForm.targetAmount} onChangeText={targetAmount=>setPlanForm(v=>({...v,targetAmount}))}/></View>
              {selectedPlan.type==='custom'&&<><Text style={s.label}>Duration in months (1–60)</Text><TextInput style={s.input} keyboardType="number-pad" value={planForm.durationMonths} onChangeText={durationMonths=>setPlanForm(v=>({...v,durationMonths}))}/></>}
              <View style={s.notice}><Text style={s.noticeText}>Locked for {planForm.durationMonths||'?'} months. Suggested monthly savings: {Number(planForm.targetAmount)>0&&Number(planForm.durationMonths)>0?money(Number(planForm.targetAmount)/Number(planForm.durationMonths)):'—'}. Cash-out is not available in this demo.</Text></View>
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
            <Text style={s.sectionTitle}>Simulated withdrawals</Text>{withdrawals.length===0?<Text style={s.emptyText}>No demo withdrawals yet.</Text>:withdrawals.map(w=><View key={w.id} style={s.activityRow}><View style={{flex:1}}><Text style={s.planTitle}>{w.planName}</Text><Text style={s.planDetail}>{new Date(w.createdAt).toLocaleString('en-ZA')} · {w.early?'Early':'Matured'} · {w.fullWithdrawal?'Full':'Partial'}</Text><Text style={s.planDetail}>Penalty {money(w.penalty)} · Demo payout {money(w.payout)}</Text></View><Text style={s.activityAmount}>−{money(w.amount)}</Text></View>)}<Text style={s.sectionTitle}>Simulated deposits</Text>
            {deposits.length===0?<View style={s.empty}><View style={s.emptyGraphic}><Icon name="activity" size={32}/></View><Text style={s.emptyTitle}>No activity yet</Text><Text style={s.emptyText}>Your simulated deposits will appear here.</Text></View>:deposits.map(d=><View key={d.id} style={s.activityRow}><View><Text style={s.planTitle}>{d.planName}</Text><Text style={s.planDetail}>{new Date(d.createdAt).toLocaleString('en-ZA')} · Demo deposit</Text></View><Text style={s.activityAmount}>+{money(d.amount)}</Text></View>)}
          </>}
          {tab==='Profile'&&<>
            <Text style={s.eyebrow}>ACCOUNT & SECURITY</Text><Text style={s.title}>Your profile</Text><Text style={s.subtitle}>Manage your personal information and security settings.</Text>
            <TouchableOpacity style={s.profileCard} onPress={openProfile} accessibilityRole="button" accessibilityLabel="Edit personal information"><View style={s.avatar}><Text style={s.avatarText}>{(user?.firstName||'P').charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.profileName}>{[user?.firstName,user?.surname].filter(Boolean).join(' ')||'Piggy Bank Saver'}</Text><Text style={s.profileEmail}>{user?.email||'Account holder'}</Text><Text style={[s.greenLink,{marginTop:8}]}>Edit personal information →</Text></View></TouchableOpacity>
            {profileOpen&&<View style={[s.panel,{marginBottom:22}]}>
              <Text style={s.sectionTitle}>Update personal information</Text>
              {([['firstName','First name'],['surname','Surname'],['mobileNumber','Mobile number'],['address','Residential address']]).map(([key,label])=><View key={key}><Text style={s.label}>{label}</Text><TextInput style={s.input} value={profileForm[key]||''} onChangeText={v=>setProfileForm(p=>({...p,[key]:v}))} keyboardType={key==='mobileNumber'?'phone-pad':'default'}/></View>)}
              <Text style={s.label}>Gender</Text><View style={s.chips}>{['Female','Male','Non-binary','Prefer not to say','Other'].map(g=><TouchableOpacity key={g} onPress={()=>setProfileForm(p=>({...p,gender:g}))} style={[s.chip,profileForm.gender===g&&s.chipSelected]}><Text style={[s.chipText,profileForm.gender===g&&{color:C.white}]}>{g}</Text></TouchableOpacity>)}</View>
              <Text style={s.emptyText}>Your email and identity number cannot be changed here. Contact verified support for sensitive identity changes when that feature becomes available.</Text>
              <Button label={busy?'Saving...':'Save profile changes'} disabled={busy} onPress={saveProfile}/>
              <Button label="Cancel" outline onPress={()=>setProfileOpen(false)}/>
            </View>}
            <TouchableOpacity style={s.plan} onPress={openBanking} accessibilityRole="button"><Text style={s.planTitle}>Banking &amp; Card Details</Text><Text style={s.planDetail}>{savedBanking?savedBanking.bank+' · '+savedBanking.accountType+' (demo only)':'No demo bank selected'} · Update →</Text></TouchableOpacity>
            {bankingOpen&&<View style={[s.panel,{marginBottom:20}]}><Text style={s.sectionTitle}>Update banking preferences</Text><Text style={s.emptyText}>Demo only. Choose a fictional bank preference and account type. Do not enter real account numbers, card numbers, expiry dates, PINs or CVVs.</Text><Text style={s.label}>Bank</Text><View style={s.chips}>{['FNB','Capitec','Standard Bank','Absa','Nedbank','Other'].map(bank=><TouchableOpacity key={bank} style={[s.chip,bankingForm.bank===bank&&s.chipSelected]} onPress={()=>setBankingForm(v=>({...v,bank}))}><Text style={[s.chipText,bankingForm.bank===bank&&{color:C.white}]}>{bank}</Text></TouchableOpacity>)}</View><Text style={s.label}>Account type</Text><View style={s.chips}>{['Savings','Current','Cheque'].map(accountType=><TouchableOpacity key={accountType} style={[s.chip,bankingForm.accountType===accountType&&s.chipSelected]} onPress={()=>setBankingForm(v=>({...v,accountType}))}><Text style={[s.chipText,bankingForm.accountType===accountType&&{color:C.white}]}>{accountType}</Text></TouchableOpacity>)}</View><View style={s.notice}><Text style={s.noticeText}>Card details: Not linked. A future secure payment provider will manage card updates. Identity and bank ownership checks are not active in this demo.</Text></View><Button label={busy?'Saving...':'Save demo banking preferences'} disabled={busy} onPress={saveBanking}/><Button label="Cancel" outline onPress={()=>setBankingOpen(false)}/></View>}
            <TouchableOpacity style={s.plan} onPress={()=>setTermsOpen(v=>!v)} accessibilityRole="button"><Text style={s.planTitle}>Terms &amp; Conditions</Text><Text style={s.planDetail}>Review savings, withdrawals and account safety →</Text></TouchableOpacity>{termsOpen&&<View style={s.notice}><Text style={s.sectionTitle}>Terms &amp; Conditions</Text>{TERMS.map(([heading,body])=><View key={heading} style={{marginBottom:14}}><Text style={s.label}>{heading}</Text><Text style={s.noticeText}>{body}</Text></View>)}</View>}
            <TouchableOpacity style={s.plan} accessibilityRole="button" onPress={()=>setMaturityGuideOpen(v=>!v)}><Text style={s.planTitle}>Savings Maturity &amp; Withdrawals</Text><Text style={s.planDetail}>Learn when your savings unlock and how withdrawal checks work →</Text></TouchableOpacity>{maturityGuideOpen&&<View style={s.notice}><Text style={s.sectionTitle}>Savings Maturity &amp; Withdrawals</Text>{MATURITY_GUIDE.map(([heading,body])=><View key={heading} style={{marginBottom:14}}><Text style={s.label}>{heading}</Text><Text style={s.noticeText}>{body}</Text></View>)}</View>}
            <Text style={s.sectionTitle}>Identity & security</Text>
            <View style={s.security}><View style={s.securityBadge}><Text style={s.securityBadgeText}>NOT ENROLLED</Text></View><Text style={s.securityTitle}>Face verification</Text><Text style={s.emptyText}>Required before your first cash-out. Secure biometric enrollment and matching are not available in this demo.</Text>
            <View style={s.faceCircle}><Icon name="profile" size={64} color={C.green}/><Text style={s.faceText}>Face scan preview</Text></View>
            <Button label="Set up face verification · Coming soon" onPress={()=>notify('Security feature coming soon','A secure identity check, liveness detection and biometric matching must be implemented before real withdrawals can be enabled.')}/>
            </View>
            <View style={s.notice}><Text style={s.noticeText}>Cash-out is disabled until savings, identity verification and server-side withdrawal controls are implemented.</Text></View>
            <Button label="Log out" onPress={logout} outline/>
          </>}
          <View style={s.bottomNav}>{[['Home','home'],['Savings','savings'],['Activity','activity'],['Profile','profile']].map(([name,icon])=><TouchableOpacity key={name} onPress={()=>nav(name)} style={[s.navItem,tab===name&&s.navActive]}><Icon name={icon} size={22} color={tab===name?C.green:C.muted}/><Text style={[s.navLabel,tab===name&&{color:C.green,fontWeight:'800'}]}>{name}</Text></TouchableOpacity>)}</View>
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
  brandGroup:{flexDirection:'row',alignItems:'center',gap:10},brandMark:{backgroundColor:C.forest,width:35,height:35,borderRadius:11,alignItems:'center',justifyContent:'center'},emptyGraphic:{width:56,height:56,borderRadius:16,backgroundColor:'#EDF6EF',alignItems:'center',justifyContent:'center',marginBottom:12},
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
