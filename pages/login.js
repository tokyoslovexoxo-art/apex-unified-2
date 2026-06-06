import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
    const [pw, setPw] = useState('');
    const [error, setError] = useState(false);
    const router = useRouter();

  const handleLogin = () => {
        fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw }),
        }).then(r => {
                if (r.ok) { router.push('/'); }
                else { setError(true); setPw(''); }
        });
  };

  return (
        <>
          <Head><title>APEX - Access Required</title></Head>
          <div style={{minHeight:'100vh',background:'#03070a',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:24}}>
        <div style={{fontSize:52,letterSpacing:6,color:'#00ff88',fontWeight:900}}>APEX</div>
        <div style={{color:'#4a6a7a',fontSize:13,letterSpacing:2,marginTop:-16}}>UNIFIED TRADING INTELLIGENCE</div>
        <div style={{background:'#060d12',border:'1px solid rgba(0,255,136,0.15)',borderRadius:12,padding:'32px 40px',display:'flex',flexDirection:'column',gap:16,minWidth:300}}>
          <div style={{color:'#c8d8e8',fontSize:13,textAlign:'center'}}>Enter access password</div>
          <input
            type='password'
            value={pw}
            onChange={e=>{setPw(e.target.value);setError(false);}}
                                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                          placeholder='Password'
            autoFocus
            style={{background:'#0a1520',border:error?'1px solid #ff3355':'1px solid rgba(0,255,136,0.2)',borderRadius:8,padding:'12px 16px',color:'#fff',fontSize:15,outline:'none'}}
          />
{error&&<div style={{color:'#ff3355',fontSize:12,textAlign:'center'}}>Incorrect password</div>}
          <button onClick={handleLogin} style={{background:'#00ff88',color:'#000',border:'none',borderRadius:8,padding:'12px',fontWeight:800,fontSize:14,cursor:'pointer',letterSpacing:2}}>ENTER</button>
  </div>
  </div>
  </>
  );
}
