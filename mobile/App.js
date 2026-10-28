import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? 'http://localhost:4000' : 'http://10.0.2.2:4000');

// Browser preview only: native apps continue to use the device's secure storage.
const sessionStore = {
  get: () => Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.getItem('piggy_bank_session'))
    : SecureStore.getItemAsync('session'),
  set: (value) => Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.setItem('piggy_bank_session', value))
    : SecureStore.setItemAsync('session', value),
  remove: () => Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.removeItem('piggy_bank_session'))
    : SecureStore.deleteItemAsync('session')
};
const showError = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
};
const fields = [
  ['firstName','First name'],['surname','Surname'],['idNumber','South African ID number'],
  ['address','Residential address'],['gender','Gender (Female/Male/Non-binary/Other)'],
  ['email','Email address'],['password','Password (12+ characters)'],['confirmPassword','Confirm password']
];
export default function App() {
  const [screen,setScreen] = useState('loading');
  const [user,setUser] = useState(null);
  const [values,setValues] = useState({});
  const [busy,setBusy] = useState(false);
  useEffect(() => { (async () => {
    try {
      const saved = await sessionStore.get();
      if (saved) {
        const response = await fetch(`${API_URL}/api/v1/auth/me`,{headers:{Authorization:`Bearer ${saved}`}});
        if (response.ok) { setUser((await response.json()).user); setScreen('home'); return; }
        await sessionStore.remove();
      }
    } catch {}
    setScreen('register');
  })(); }, []);
  const submit = async () => {
    if (screen === 'register' && values.password !== values.confirmPassword) return showError('Check password','Passwords do not match.');
    setBusy(true);
    try {
      const endpoint = screen === 'register' ? 'register' : 'login';
      const response = await fetch(`${API_URL}/api/v1/auth/${endpoint}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(screen === 'register' ? (({confirmPassword, ...data}) => data)(values) : values)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please try again.');
      await sessionStore.set(data.token);
      setUser(data.user);setValues({});setScreen('home');
    } catch(e) { showError('Unable to continue',e.message); }
    finally { setBusy(false); }
  };
  const logout = async () => { await sessionStore.remove();setUser(null);setScreen('login'); };
  if (screen === 'loading') return <View style={styles.center}><ActivityIndicator color="#167a56" size="large" /></View>;
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':undefined}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.logo}>🐷 Piggy Bank</Text>
      {screen === 'home' ? <>
        <Text style={styles.title}>Welcome, {user?.firstName}!</Text>
        <Text style={styles.subtitle}>Your savings journey starts here.</Text>
        <View style={styles.card}><Text style={styles.caption}>TOTAL SAVINGS · DEMO</Text><Text style={styles.amount}>R0.00</Text><Text>Active savings plans: 0</Text></View>
        <Text style={styles.subtitle}>Savings goal creation is coming in the next phase.</Text>
        <TouchableOpacity style={styles.button} onPress={logout}><Text style={styles.buttonText}>Log out</Text></TouchableOpacity>
      </> : <>
        <Text style={styles.title}>{screen==='register'?'Create your account':'Welcome back'}</Text>
        <Text style={styles.subtitle}>{screen==='register'?'Start building your savings future.':'Sign in with your email and password.'}</Text>
        {(screen==='register'?fields:[['email','Email address'],['password','Password']]).map(([key,label]) => <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput style={styles.input} placeholder={label} value={values[key]||''} onChangeText={text=>setValues(v=>({...v,[key]:text}))}
            autoCapitalize={key==='email'?'none':'sentences'} autoCorrect={false} secureTextEntry={key.toLowerCase().includes('password')}
            keyboardType={key==='email'?'email-address':key==='idNumber'?'number-pad':'default'} />
        </View>)}
        <TouchableOpacity style={[styles.button,busy&&{opacity:.6}]} disabled={busy} onPress={submit}><Text style={styles.buttonText}>{busy?'Please wait...':screen==='register'?'Create Account':'Sign In'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>{setValues({});setScreen(screen==='register'?'login':'register');}}><Text style={styles.link}>{screen==='register'?'Already registered? Sign in':'New here? Create an account'}</Text></TouchableOpacity>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#f5faf6'},center:{flex:1,justifyContent:'center',alignItems:'center'},content:{padding:24,paddingTop:70,paddingBottom:60},logo:{fontSize:26,fontWeight:'800',color:'#167a56',marginBottom:36},title:{fontSize:29,fontWeight:'800',color:'#173e2c',marginBottom:8},subtitle:{fontSize:15,color:'#607369',marginBottom:24},label:{fontSize:13,fontWeight:'600',color:'#34483e',marginBottom:6},input:{borderWidth:1,borderColor:'#d2e2d7',backgroundColor:'#fff',borderRadius:12,padding:14,fontSize:16,marginBottom:16},button:{backgroundColor:'#167a56',padding:17,borderRadius:14,alignItems:'center',marginTop:12},buttonText:{color:'white',fontWeight:'700',fontSize:16},link:{textAlign:'center',color:'#167a56',marginTop:24,fontWeight:'600'},card:{backgroundColor:'white',borderRadius:18,padding:24,marginBottom:24},caption:{color:'#607369',fontSize:12},amount:{fontSize:38,fontWeight:'800',color:'#167a56',marginVertical:12}});
