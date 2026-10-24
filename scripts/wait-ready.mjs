const origin=process.env.APP_ORIGIN??'http://localhost:3000';
for(let i=0;i<60;i++){
  try{const response=await fetch(`${origin}/api/v1/health`);if(response.ok){console.log('Web, database and worker are ready.');process.exit(0);}}catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
}
throw new Error('Readiness timed out. Check web and worker logs.');
