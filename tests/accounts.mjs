import assert from 'node:assert/strict';
let handler,role='content_manager',privilegedCalls=0;
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://cms.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[k]},serve:fn=>handler=fn};
globalThis.fetch=async(url,opts)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'owner'});
 if(url.includes('/rest/v1/ra_roles?'))return Response.json([{role}]);
 assert.equal(opts.headers.apikey,'private');privilegedCalls++;
 if(url.endsWith('/auth/v1/admin/users'))return Response.json({id:'new-manager'});
 if(url.endsWith('/rest/v1/ra_roles')){assert.deepEqual(JSON.parse(opts.body),{user_id:'new-manager',role:'content_manager'});return new Response(null,{status:201});}
 throw Error('Unexpected endpoint');
};
await import('../backend/accounts.ts');
const request=(body,origin='https://roseauras.ca')=>new Request('https://cms.test/functions/v1/ra-accounts',{method:'POST',headers:{Origin:origin,Authorization:'Bearer valid'},body:JSON.stringify(body)});
let response=await handler(request({email:'gestionnaire@example.com',password:'unique-password'}));assert.equal(response.status,403);assert.equal(privilegedCalls,0);
role='admin';response=await handler(request({email:'gestionnaire@example.com',password:'unique-password',role:'admin'}));assert.equal(response.status,400);assert.equal(privilegedCalls,0);
response=await handler(request({email:'gestionnaire@example.com',password:'unique-password'},'https://other.test'));assert.equal(response.status,403);assert.equal(privilegedCalls,0);
response=await handler(request({email:'gestionnaire@example.com',password:'unique-password'}));assert.equal(response.status,201);assert.equal(privilegedCalls,2);
console.log('4 account endpoint authorization checks passed (mock Auth/REST transport)');
