import React from 'react';
import{acceptPairing,analyzePhoto,completeJob,createJob,createPairingSession,failJob,findDuplicates,inferItem,nextRunnableJob,parseCaptureBundle,startJob,summarizeQueue,type CaptureJob,type OfflineCapture,type PairingSession,type PhotoAsset}from'@vault/capture';

type Props={onImportCapture:(capture:OfflineCapture)=>Promise<void>};
const storeKey='vault.capture.jobs.v1';
const photoKey='vault.capture.photos.v1';
const load=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)??'') as T}catch{return fallback}};
export function CaptureCenter({onImportCapture}:Props){
 const[jobs,setJobs]=React.useState<CaptureJob[]>(()=>load(storeKey,[]));
 const[photos,setPhotos]=React.useState<PhotoAsset[]>(()=>load(photoKey,[]));
 const[pairing,setPairing]=React.useState<PairingSession|null>(null);
 const[code,setCode]=React.useState('');
 const[device,setDevice]=React.useState('iPhone');
 const[message,setMessage]=React.useState('Ready');
 const fileRef=React.useRef<HTMLInputElement>(null);
 React.useEffect(()=>localStorage.setItem(storeKey,JSON.stringify(jobs)),[jobs]);
 React.useEffect(()=>localStorage.setItem(photoKey,JSON.stringify(photos)),[photos]);
 const summary=summarizeQueue(jobs),duplicates=findDuplicates(photos);
 async function addPhotos(files:FileList|null){if(!files)return;const added:PhotoAsset[]=[];for(const file of Array.from(files)){const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result));r.readAsDataURL(file)});const dims=await new Promise<{width:number;height:number}>((resolve)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=dataUrl});const quality=analyzePhoto({...dims,sizeBytes:file.size});added.push({id:`photo_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,name:file.name,dataUrl,sizeBytes:file.size,mimeType:file.type||'image/jpeg',createdAt:new Date().toISOString(),primary:photos.length+added.length===0,quality,...dims})}setPhotos(v=>[...v,...added]);setJobs(v=>[...v,...added.flatMap(p=>['thumbnail','quality','ocr','barcode','duplicate','classify'].map(type=>createJob(type as any,{name:p.name},{photoId:p.id})))]);setMessage(`${added.length} photo(s) queued`)}
 function runNext(){const next=nextRunnableJob(jobs);if(!next){setMessage('Queue is empty');return}setJobs(v=>v.map(j=>j.id===next.id?startJob(j):j));setTimeout(()=>setJobs(v=>v.map(j=>j.id===next.id?completeJob({...j,status:'running',attempts:j.attempts||1}):j)),120);setMessage(`Processed ${next.type}`)}
 function retryFailed(){setJobs(v=>v.map(j=>j.status==='failed'?{...j,status:'queued',error:undefined}:j));setMessage('Failed jobs requeued')}
 function clearCompleted(){setJobs(v=>v.filter(j=>j.status!=='completed'&&j.status!=='cancelled'))}
 function newPair(){setPairing(createPairingSession('Vault Desktop'));setMessage('Pairing code created')}
 function pair(){if(!pairing)return;try{setPairing(acceptPairing(pairing,code,device));setMessage(`${device} paired securely`)}catch(e){setMessage(String(e))}}
 async function importBundle(file:File){try{const bundle=parseCaptureBundle(await file.text());for(const capture of bundle.captures)await onImportCapture(capture);setMessage(`Imported ${bundle.captures.length} capture(s) from ${bundle.device.name}`)}catch(e){setMessage(`Import failed: ${String(e)}`)}}
 const inferred=photos.length?inferItem(photos.map(p=>p.name).join(' ')):null;
 return <div className="capture-layout">
  <section className="panel capture-hero"><div><p className="eyebrow">CAPTURE INTELLIGENCE</p><h3>Phone, photos and background processing</h3><p>Local-first intake with resumable jobs, quality checks, duplicate detection and offline phone bundles.</p></div><button className="primary" onClick={()=>fileRef.current?.click()}>＋ Add photos</button><input ref={fileRef} hidden type="file" accept="image/*,.json" multiple onChange={e=>{const files=e.target.files;if(!files)return;if(files.length===1&&files[0].name.endsWith('.json'))importBundle(files[0]);else addPhotos(files)}}/></section>
  <section className="stats capture-stats"><article><span>Queued</span><strong>{summary.queued}</strong></article><article><span>Running</span><strong>{summary.running}</strong></article><article><span>Completed</span><strong>{summary.completed}</strong></article><article><span>Failed</span><strong>{summary.failed}</strong></article><article><span>Duplicates</span><strong>{duplicates.length}</strong></article></section>
  <div className="dashboard-grid"><section className="panel"><h3>Background queue</h3><div className="capture-actions"><button className="primary" onClick={runNext}>Run next</button><button className="secondary" onClick={retryFailed}>Retry failed</button><button className="secondary" onClick={clearCompleted}>Clear completed</button></div><div className="job-list">{jobs.slice(-12).reverse().map(j=><div key={j.id}><span>{j.type}</span><b>{j.status}</b><small>{j.progress}% · attempt {j.attempts}/{j.maxAttempts}</small></div>)}{!jobs.length&&<p>No jobs yet.</p>}</div></section>
   <section className="panel"><h3>Secure phone pairing</h3>{!pairing?<button className="primary" onClick={newPair}>Create pairing code</button>:pairing.pairedAt?<><div className="pair-code success">PAIRED</div><p>{pairing.deviceName}</p></>:<><div className="pair-code">{pairing.code}</div><p>Expires {new Date(pairing.expiresAt).toLocaleTimeString()}</p><input value={device} onChange={e=>setDevice(e.target.value)} placeholder="Device name"/><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter code from phone"/><button className="primary" onClick={pair}>Pair device</button></>}</section>
  </div>
  <section className="panel"><div className="panel-title"><h3>Photo workspace</h3>{inferred&&<span>{inferred.category} · {inferred.brand??'unknown brand'} · {inferred.confidence}%</span>}</div><div className="photo-grid">{photos.map(p=><article key={p.id}><img src={p.dataUrl}/><div><b>{p.name}</b><small>{p.width}×{p.height} · {p.quality?.score??0}/100</small>{p.quality?.warnings.map(w=><em key={w}>{w}</em>)}</div></article>)}{!photos.length&&<p>Add photos or import a phone capture bundle.</p>}</div></section>
  {duplicates.length>0&&<section className="panel"><h3>Possible duplicates</h3>{duplicates.map(d=><div className="health-row" key={`${d.a}-${d.b}`}><span>{d.a} ↔ {d.b}</span><b>{d.confidence}%</b></div>)}</section>}
  <div className="banner">{message}</div>
 </div>
}
