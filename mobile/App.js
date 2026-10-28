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
const plans = [{months:6,title:'The Starter',detail:'Short-term focus'},{months:12,title:'The Builder',detail:'Build lasting habits'},{months:18,title:'The Visionary',detail:'Your long-term goal'}];
const demoMessage = () => notify('Demo feature','Savings and withdrawals are not yet connected to the backend. No money is being moved.');
const Button = ({label,onPress,outline=false,disabled=false}) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,outline&&s.outline,disabled&&{opacity:.55}]}><Text style={[s.buttonText,outline&&{color:C.forest}]}>{label}</Text></TouchableOpacity>;
export default function App() {
  const [screen,setScreen] = useState('loading');
  const [tab,setTab] = useState('Home');
  const [user,setUser] = useState(null);
  const [values,setValues] = useState({});
  const [busy,setBusy] = useState(false);
  useEffect(() => { (async () => {
    try {
      const saved = await sessionStore.get();
      if (saved) {
        const response = await fetch(API_URL+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+saved}});
        if (response.ok) { setUser((await response.json()).user);setScreen('home');return; }
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
      setUser(data.user);setValues({});setTab('Home');setScreen('home');
    } catch(e) { notify('Unable to continue',e.message); }
    finally { setBusy(false); }
  };
  const logout=async()=>{await sessionStore.remove();setUser(null);setValues({});setScreen('login');};
  const nav=target=>setTab(target);
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
            <View style={s.balance}><Text style={s.balanceLabel}>TOTAL SAVINGS  ·  DEMO</Text><Text style={s.balanceAmount}>R0.00</Text><View style={s.goldLine}/><Text style={s.balanceFoot}>0 active plans    •    No deposits yet</Text></View>
            <Text style={s.sectionTitle}>Quick actions</Text>
            <View style={s.actions}><TouchableOpacity style={s.action} onPress={()=>nav('Savings')}><Text style={s.actionIcon}>＋</Text><Text style={s.actionText}>New savings plan</Text></TouchableOpacity><TouchableOpacity style={s.action} onPress={demoMessage}><Text style={s.actionIcon}>↗</Text><Text style={s.actionText}>Add savings</Text></TouchableOpacity></View>
            <View style={s.sectionRow}><Text style={s.sectionTitle}>My savings plans</Text><TouchableOpacity onPress={()=>nav('Savings')}><Text style={s.greenLink}>Explore →</Text></TouchableOpacity></View>
            <View style={s.empty}><Text style={s.emptyIcon}>🐷</Text><Text style={s.emptyTitle}>Your journey starts here</Text><Text style={s.emptyText}>Choose a savings plan to start building your future. Plans are previews for now.</Text><Button label="Explore savings plans" onPress={()=>nav('Savings')}/></View>
          </>}
          {tab==='Savings'&&<>
            <Text style={s.eyebrow}>SAVE WITH PURPOSE</Text><Text style={s.title}>Savings plans</Text><Text style={s.subtitle}>Choose a term that suits your goals. These are previews — no funds are collected.</Text>
            {plans.map(p=><View key={p.months} style={s.plan}><View style={s.planTop}><Text style={s.planTitle}>{p.title}</Text><Text style={s.term}>{p.months} MONTHS</Text></View><Text style={s.planDetail}>{p.detail}</Text><View style={s.planLine}/><Text style={s.planDetail}>Locked savings term: {p.months} months</Text><Button label="Choose plan · Coming soon" onPress={demoMessage} outline/></View>)}
            <View style={s.notice}><Text style={s.noticeText}>🔒 Locked-plan rules, deposits, maturity dates and withdrawals will be enforced by the backend in a future phase.</Text></View>
          </>}
          {tab==='Activity'&&<>
            <Text style={s.eyebrow}>YOUR MONEY STORY</Text><Text style={s.title}>Activity</Text><Text style={s.subtitle}>Track your savings journey in one place.</Text>
            <View style={s.empty}><Text style={s.emptyIcon}>◷</Text><Text style={s.emptyTitle}>No activity yet</Text><Text style={s.emptyText}>Your savings transactions will appear here once deposits are implemented.</Text></View>
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
  sectionTitle:{fontSize:18,fontWeight:'900',color:C.forest,marginBottom:14},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},greenLink:{fontSize:13,fontWeight:'700',color:C.green},
  actions:{flexDirection:'row',gap:12,marginBottom:28},action:{flex:1,backgroundColor:C.white,borderRadius:17,padding:18,borderWidth:1,borderColor:C.border},actionIcon:{fontSize:27,color:C.green,marginBottom:12,fontWeight:'500'},actionText:{fontSize:13,fontWeight:'800',color:C.forest},
  empty:{backgroundColor:C.white,borderRadius:21,padding:24,borderWidth:1,borderColor:C.border,marginBottom:22},emptyIcon:{fontSize:30,marginBottom:12,color:C.green},emptyTitle:{fontSize:17,fontWeight:'800',color:C.forest,marginBottom:8},emptyText:{fontSize:13,lineHeight:21,color:C.muted,marginBottom:10},
  plan:{backgroundColor:C.white,borderRadius:20,padding:21,borderWidth:1,borderColor:C.border,marginBottom:15},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},planTitle:{fontSize:19,fontWeight:'900',color:C.forest},term:{color:C.green,fontSize:10,fontWeight:'900',letterSpacing:1},planDetail:{color:C.muted,fontSize:13,marginTop:8},planLine:{height:1,backgroundColor:C.border,marginTop:18,marginBottom:8},
  notice:{padding:17,backgroundColor:'#EAF0EB',borderRadius:15,marginVertical:13},noticeText:{fontSize:12,lineHeight:20,color:C.forest},
  profileCard:{backgroundColor:C.white,borderRadius:18,padding:19,flexDirection:'row',alignItems:'center',gap:15,marginBottom:28,borderWidth:1,borderColor:C.border},avatar:{height:56,width:56,borderRadius:28,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},avatarText:{color:C.gold,fontSize:24,fontWeight:'900'},profileName:{fontSize:17,fontWeight:'800',color:C.forest},profileEmail:{fontSize:12,color:C.muted,marginTop:5},
  security:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:20,padding:22},securityBadge:{backgroundColor:'#F6EBD7',alignSelf:'flex-start',padding:7,borderRadius:8,marginBottom:13},securityBadgeText:{fontSize:10,fontWeight:'800',color:'#8A6429'},securityTitle:{fontSize:18,fontWeight:'900',color:C.forest,marginBottom:8},
  faceCircle:{height:178,width:178,borderRadius:89,borderWidth:3,borderColor:C.gold,backgroundColor:C.ivory,alignSelf:'center',alignItems:'center',justifyContent:'center',marginVertical:19},faceIcon:{fontSize:55,color:C.green},faceText:{fontSize:11,fontWeight:'700',color:C.forest},
  bottomNav:{flexDirection:'row',justifyContent:'space-around',backgroundColor:C.white,borderRadius:19,borderWidth:1,borderColor:C.border,paddingVertical:12,marginTop:15},navItem:{flex:1,alignItems:'center',paddingVertical:5},navActive:{backgroundColor:'#F0F6F1',borderRadius:12},navIcon:{fontSize:23,color:C.muted},navLabel:{fontSize:10,color:C.muted,marginTop:3},
  footer:{textAlign:'center',color:'#94A199',fontSize:9,letterSpacing:1,marginTop:24}
});
