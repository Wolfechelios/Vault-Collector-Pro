import { spawn } from 'node:child_process';
let driver;
export const config={runner:'local',hostname:'127.0.0.1',port:4444,path:'/',specs:['./specs/**/*.e2e.js'],maxInstances:1,logLevel:'info',framework:'mocha',reporters:['spec'],mochaOpts:{timeout:120000},capabilities:[{'tauri:options':{application:process.env.VAULT_TAURI_BINARY}}],onPrepare(){driver=spawn('tauri-driver',[],{stdio:['ignore','pipe','pipe']});driver.stdout?.pipe(process.stdout);driver.stderr?.pipe(process.stderr);return new Promise(resolve=>setTimeout(resolve,1500));},onComplete(){driver?.kill('SIGTERM');}};
