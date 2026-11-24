function workspaceNav(active){
  return '<nav class="home-bottom-nav" aria-label="主导航"><button class="home-nav-item" onclick="goHome()"><span class="home-nav-symbol">'+icon("home")+'</span><small>Home</small></button><button class="home-nav-item '+(active==="code"?"active":"")+'" onclick="openWorkspaceModule(\'code\')"><span class="home-nav-symbol">'+icon("code")+'</span><small>Code</small></button><button class="home-nav-item '+(active==="projects"?"active":"")+'" onclick="openWorkspaceModule(\'projects\')"><span class="home-nav-symbol">'+icon("folder")+'</span><small>Projects</small></button><button class="home-nav-item '+(active==="artifacts"?"active":"")+'" onclick="openWorkspaceModule(\'artifacts\')"><span class="home-nav-symbol">'+icon("layers")+'</span><small>Artifacts</small></button></nav>';
}
function workspaceHeader(title,description,action){
  return '<header class="workspace-head"><div><div class="workspace-eyebrow">HOMY WORKSPACE</div><h1>'+title+'</h1><p>'+description+'</p></div><div class="workspace-head-action">'+action+'</div></header>';
}
function workspaceItems(kind){return (cache.workspaceItems||[]).filter(x=>x.kind===kind).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));}
function workspaceProjectName(id){const p=findById(cache.workspaceItems,id);return p&&p.kind==="project"?p.name:"未关联项目";}
function viewWorkspaceModule(){
  const active=state.workspaceModule||"code";
  const content=active==="projects"?viewWorkspaceProjects():active==="artifacts"?viewWorkspaceArtifacts():viewWorkspaceCode();
  return '<div class="workspace-page">'+content+workspaceNav(active)+'</div>';
}
function viewWorkspaceCode(){
  const files=workspaceItems("code"),current=findById(files,state.workspaceEditorId)||files[0]||null;
  const projectOptions=workspaceItems("project").map(p=>'<option value="'+esc(p.id)+'" '+(current?.projectId===p.id?"selected":"")+' >'+esc(p.name)+'</option>').join("");
  if(current&&state.workspaceEditorId!==current.id)state.workspaceEditorId=current.id;
  const list='<aside class="workspace-file-list"><div class="workspace-list-head"><strong>文件</strong><button class="icon-btn" onclick="createWorkspaceCode()" aria-label="新建文件">'+icon("plus")+'</button></div>'+
    (files.map(f=>'<button class="workspace-file-row '+(current&&f.id===current.id?"active":"")+'" onclick="openWorkspaceCode(\''+f.id+'\')"><span class="workspace-file-icon">'+icon("file")+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.language||"text")+' · '+fmtTime(f.updatedAt)+'</small></span></button>').join("")||'<div class="workspace-empty-mini">还没有文件</div>')+'</aside>';
  let editor='';
  if(current){
    editor='<section class="workspace-editor"><div class="workspace-editor-toolbar"><input id="workspaceCodeName" value="'+esc(current.name)+'" aria-label="文件名"><select id="workspaceCodeProject" aria-label="关联项目"><option value="">不关联项目</option>'+projectOptions+'</select><span class="spacer"></span><button class="btn" onclick="downloadWorkspaceCode(\''+current.id+'\')">'+icon("download")+' 下载</button><button class="btn btn-primary" onclick="saveWorkspaceCode()">'+icon("check")+' 保存</button></div><textarea id="workspaceCodeContent" class="workspace-code-input" spellcheck="false" autocapitalize="off" autocomplete="off">'+esc(current.content||"")+'</textarea><div class="workspace-editor-foot"><span>'+esc(current.language||"text")+'</span><span>'+String((current.content||"").length)+' 字符</span><span class="spacer"></span>'+(current.language==="html"||/\.html?$/i.test(current.name)?'<button class="text-action" onclick="previewWorkspaceCode(\''+current.id+'\')">预览网页</button>':'')+'<button class="text-action" onclick="showWorkspaceCodeVersions(\\''+current.id+'\\')">历史版本（'+(current.versions||[]).length+'）</button>'+'<button class="text-action danger-text" onclick="deleteWorkspaceCode(\''+current.id+'\')">删除文件</button></div></section>';
  }else editor='<section class="workspace-editor workspace-editor-empty"><div class="workspace-empty-mark">'+icon("code")+'</div><h2>本地代码工作区</h2><p>创建文件后，可以在这里编辑、保存、下载。HTML 文件还可以直接预览。</p><button class="btn btn-primary" onclick="createWorkspaceCode()">新建文件</button></section>';
  return workspaceHeader("Code","本地文件编辑器 · 内容保存在当前设备",'<button class="btn btn-primary" onclick="createWorkspaceCode()">'+icon("plus")+' 新建文件</button>')+'<div class="workspace-code-layout">'+list+editor+'</div>';
}
function workspaceCodeLanguage(name){
  const ext=(String(name).split(".").pop()||"txt").toLowerCase();
  return ({html:"html",htm:"html",css:"css",js:"javascript",mjs:"javascript",json:"json",md:"markdown",txt:"text",xml:"xml",svg:"svg",py:"python",ts:"typescript",tsx:"typescript",jsx:"javascript",yml:"yaml",yaml:"yaml"})[ext]||"text";
}
function createWorkspaceCode(){
  modal({title:"新建代码文件",body:'<div class="field"><label>文件名</label><input id="newCodeName" value="untitled.html" maxlength="120"></div><div class="field"><label>初始内容</label><textarea id="newCodeContent" rows="7" placeholder="从空文件开始，也可以粘贴已有代码。"></textarea></div>',actions:[{label:"取消",onClick:closeModal},{label:"创建文件",primary:true,onClick:async()=>{
    const name=document.getElementById("newCodeName").value.trim(),content=document.getElementById("newCodeContent").value;
    if(!name||/[\\/]/.test(name)){toast("请填写有效文件名");return;}
    const ts=nowISO(),rec={id:uid("wf"),kind:"code",name,language:workspaceCodeLanguage(name),content,versions:[],projectId:null,createdAt:ts,updatedAt:ts};
    await dbPut("workspaceItems",rec);state.workspaceEditorId=rec.id;closeModal();await loadCache();render();toast("文件已创建");
  }}]});
}
function openWorkspaceCode(id){state.workspaceEditorId=id;render();}
async function saveWorkspaceCode(){
  const file=findById(workspaceItems("code"),state.workspaceEditorId);if(!file)return;
  const name=document.getElementById("workspaceCodeName")?.value.trim(),content=document.getElementById("workspaceCodeContent")?.value??"";
  if(!name||/[\\/]/.test(name)){toast("文件名无效");return;}
  const ts=nowISO(),versions=Array.isArray(file.versions)?file.versions.slice():[];
  if(content!==file.content)versions.push({content:file.content||"",savedAt:file.updatedAt||file.createdAt});
  Object.assign(file,{name,content,language:workspaceCodeLanguage(name),projectId:document.getElementById("workspaceCodeProject")?.value||null,versions:versions.slice(-20),updatedAt:ts});
  await dbPut("workspaceItems",file);await loadCache();render();toast("已保存到本机");
}
function downloadWorkspaceCode(id){
  const f=findById(workspaceItems("code"),id);if(!f)return;
  downloadTextFile(f.name||"code.txt",f.content||"",f.language==="html"?"text/html;charset=utf-8":"text/plain;charset=utf-8");
}

function showWorkspaceCodeVersions(id){
  const file=findById(workspaceItems("code"),id);if(!file)return;
  const versions=Array.isArray(file.versions)?file.versions:[];
  const rows=versions.map((v,index)=>({v,index})).reverse().map(({v,index})=>
    '<div class="workspace-version-row"><div><strong>版本 '+(versions.length-index)+'</strong><small>'+esc(fmtTime(v.savedAt||""))+' · '+String((v.content||"").length)+' 字符</small></div><button class="btn" onclick="restoreWorkspaceCodeVersion(\''+id+'\','+index+')">恢复此版本</button></div>'
  ).join("");
  modal({title:"文件历史版本",body:rows?'<div class="workspace-version-list">'+rows+'</div>':'<div class="workspace-empty-mini">还没有历史版本。修改文件并保存后，旧内容会自动留档。</div>',actions:[{label:"关闭",onClick:closeModal}]});
}
async function restoreWorkspaceCodeVersion(id,index){
  const file=findById(workspaceItems("code"),id);if(!file)return;
  const versions=Array.isArray(file.versions)?file.versions.slice():[],version=versions[index];if(!version)return;
  versions.push({content:file.content||"",savedAt:file.updatedAt||nowISO()});
  Object.assign(file,{content:version.content||"",versions:versions.slice(-20),updatedAt:nowISO()});
  await dbPut("workspaceItems",file);state.workspaceEditorId=id;closeModal();await loadCache();render();toast("已恢复历史版本，原内容也已留档");
}
function previewWorkspaceCode(id){
  const f=findById(workspaceItems("code"),id);if(!f)return;
  const mask=document.createElement("div");mask.className="code-preview-mask";
  mask.innerHTML='<section class="code-preview-panel"><header><strong>'+esc(f.name)+'</strong><span class="spacer"></span><button class="btn" id="workspacePreviewDownload">下载 HTML</button><button class="btn icon-btn" id="workspacePreviewClose" aria-label="关闭">'+icon("x")+'</button></header><iframe title="本地网页预览" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></section>';
  document.body.appendChild(mask);mask.querySelector("iframe").srcdoc=f.content||"";
  mask.querySelector("#workspacePreviewClose").onclick=()=>mask.remove();
  mask.querySelector("#workspacePreviewDownload").onclick=()=>downloadWorkspaceCode(id);
  mask.addEventListener("click",e=>{if(e.target===mask)mask.remove();});
}
async function deleteWorkspaceCode(id){
  const f=findById(workspaceItems("code"),id);if(!f)return;
  modal({title:"删除文件",body:'确定删除「'+esc(f.name)+'」？此操作无法撤销。',actions:[{label:"取消",onClick:closeModal},{label:"删除",danger:true,onClick:async()=>{await dbDelete("workspaceItems",id);state.workspaceEditorId=null;closeModal();await loadCache();render();toast("文件已删除");}}]});
}
function viewWorkspaceProjects(){
  const projects=workspaceItems("project");
  const cards=projects.map(p=>{
    const linked=Array.isArray(p.sessionIds)?p.sessionIds.map(id=>findById(cache.sessions,id)).filter(Boolean):[];
    const files=(cache.workspaceItems||[]).filter(x=>x.projectId===p.id&&x.kind!=="project").length;
    const progress=Math.max(0,Math.min(100,Number(p.progress)||0));
    return '<article class="workspace-project-card"><div class="workspace-project-top"><div><div class="workspace-eyebrow">'+esc(p.status||"进行中")+'</div><h2>'+esc(p.name)+'</h2></div><button class="icon-btn" onclick="editWorkspaceProject(\''+p.id+'\')" aria-label="编辑项目">'+icon("edit")+'</button><button class="icon-btn danger-text" onclick="deleteWorkspaceProject(\''+p.id+'\')" aria-label="删除项目">'+icon("trash")+'</button></div><p>'+esc(p.description||"还没有项目说明。")+'</p><div class="workspace-progress"><span style="width:'+progress+'%"></span></div><div class="workspace-project-meta"><strong>'+progress+'%</strong><span>'+linked.length+' 个关联会话</span><span>'+files+' 个关联文件</span><span class="spacer"></span><small>'+fmtTime(p.updatedAt)+'</small></div>'+(linked.length?'<div class="workspace-linked-sessions">'+linked.slice(0,3).map(x=>'<button onclick="openChat(\''+x.id+'\')">'+esc(x.title||"新窗口")+'</button>').join("")+'</div>':'')+'</article>';
  }).join("");
  return workspaceHeader("Projects","项目资料、进度与关联对话分开管理",'<button class="btn btn-primary" onclick="editWorkspaceProject()">'+icon("plus")+' 新建项目</button>')+'<div class="workspace-project-grid">'+(cards||'<div class="workspace-empty"><div class="workspace-empty-mark">'+icon("folder")+'</div><h2>还没有项目</h2><p>把长期任务、开发事项或创作计划放在这里。项目可以关联现有对话和本地文件。</p><button class="btn btn-primary" onclick="editWorkspaceProject()">创建第一个项目</button></div>')+'</div>';
}
function editWorkspaceProject(id){
  const old=id?findById(workspaceItems("project"),id):null,linked=new Set(old?.sessionIds||[]);
  const sessionChecks=cache.sessions.slice().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||"")).map(x=>'<label class="workspace-check-row"><input type="checkbox" name="projectSession" value="'+esc(x.id)+'" '+(linked.has(x.id)?"checked":"")+'><span>'+esc(x.title||"新窗口")+'</span><small>'+esc(findById(cache.persons,x.personId)?.name||"AI")+'</small></label>').join("");
  modal({title:old?"编辑项目":"新建项目",body:'<div class="field"><label>项目名称</label><input id="projectName" maxlength="80" value="'+esc(old?.name||"")+'" placeholder="例如：HOMY 中控平台"></div><div class="field"><label>项目说明</label><textarea id="projectDescription" rows="4" maxlength="2000">'+esc(old?.description||"")+'</textarea></div><div class="workspace-form-grid"><div class="field"><label>状态</label><select id="projectStatus">'+["规划中","进行中","暂停","已完成"].map(x=>'<option '+((old?.status||"进行中")===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div><div class="field"><label>进度（%）</label><input id="projectProgress" type="number" min="0" max="100" value="'+Number(old?.progress||0)+'"></div></div><div class="field"><label>关联对话</label><div class="workspace-session-checks">'+(sessionChecks||'<span class="muted small">暂时没有可关联的对话。</span>')+'</div></div>',actions:[{label:"取消",onClick:closeModal},{label:"保存项目",primary:true,onClick:async()=>{
    const name=document.getElementById("projectName").value.trim();if(!name){toast("项目名称不能为空");return;}
    const ts=nowISO(),sessionIds=[...document.querySelectorAll('input[name="projectSession"]:checked')].map(x=>x.value);
    const rec=Object.assign({},old||{id:uid("project"),kind:"project",createdAt:ts},{kind:"project",name,description:document.getElementById("projectDescription").value,status:document.getElementById("projectStatus").value,progress:Math.max(0,Math.min(100,Number(document.getElementById("projectProgress").value)||0)),sessionIds,updatedAt:ts});
    await dbPut("workspaceItems",rec);closeModal();await loadCache();render();toast("项目已保存");
  }}]});
}
async function deleteWorkspaceProject(id){
  const p=findById(workspaceItems("project"),id);if(!p)return;
  modal({title:"删除项目",body:'删除项目「'+esc(p.name)+'」？关联文件不会删除，只会解除项目关联。',actions:[{label:"取消",onClick:closeModal},{label:"删除项目",danger:true,onClick:async()=>{
    const related=(cache.workspaceItems||[]).filter(x=>x.projectId===id);
    await dbDelete("workspaceItems",id);
    for(const item of related)await dbPut("workspaceItems",Object.assign({},item,{projectId:null,updatedAt:nowISO()}));
    closeModal();await loadCache();render();toast("项目已删除，关联文件已保留");
  }}]});
}
function viewWorkspaceArtifacts(){
  const items=workspaceItems("artifact");
  const cards=items.map(x=>'<article class="workspace-artifact-row"><div class="workspace-artifact-icon">'+icon(x.mime?.startsWith("image/")?"image":"file")+'</div><div class="workspace-artifact-copy"><strong>'+(x.mime?.startsWith("image/")&&x.dataUrl?'<button class="workspace-artifact-preview-link" onclick="previewWorkspaceArtifact(\\''+x.id+'\\')">'+esc(x.name)+'</button>':esc(x.name))+'</strong><small>'+esc(x.source||"本地文件")+' · '+esc(workspaceProjectName(x.projectId))+' · '+fmtTime(x.updatedAt)+'</small><p>'+esc((x.content||x.description||"").slice(0,120))+'</p></div><div class="workspace-artifact-actions"><button class="icon-btn" onclick="editWorkspaceArtifactProject(\\''+x.id+'\\')" aria-label="关联项目">'+icon("folder")+'</button><button class="icon-btn" onclick="downloadWorkspaceArtifact(\''+x.id+'\')" aria-label="下载">'+icon("download")+'</button>'+(x.dataUrl?'':'<button class="icon-btn" onclick="editWorkspaceArtifact(\''+x.id+'\')" aria-label="编辑">'+icon("edit")+'</button>')+'<button class="icon-btn danger-text" onclick="deleteWorkspaceArtifact(\''+x.id+'\')" aria-label="删除">'+icon("trash")+'</button></div></article>').join("");
  return workspaceHeader("Artifacts","集中保存文档、图片、代码片段与 AI 产物",'<button class="btn" onclick="chooseWorkspaceArtifactFile()">'+icon("plus")+' 上传文件</button><button class="btn btn-primary" onclick="editWorkspaceArtifact()">'+icon("edit")+' 新建笔记</button>')+'<div class="workspace-artifact-list">'+(cards||'<div class="workspace-empty"><div class="workspace-empty-mark">'+icon("layers")+'</div><h2>还没有产物</h2><p>上传文件、记录笔记，或把最近的 AI 回复保存到这里。内容保存在本机。</p><button class="btn" onclick="saveLatestAssistantArtifact()">保存最近一条 AI 回复</button></div>')+'</div><div class="workspace-artifact-footer"><button class="text-action" onclick="saveLatestAssistantArtifact()">＋ 保存最近一条 AI 回复</button></div>';
}
function editWorkspaceArtifact(id){
  const old=id?findById(workspaceItems("artifact"),id):null,projects=workspaceItems("project");
  modal({title:old?"编辑产物":"新建笔记",body:'<div class="field"><label>标题</label><input id="artifactName" maxlength="120" value="'+esc(old?.name||"未命名笔记")+'"></div><div class="field"><label>内容</label><textarea id="artifactContent" rows="12">'+esc(old?.content||"")+'</textarea></div><div class="field"><label>关联项目</label><select id="artifactProject"><option value="">不关联项目</option>'+projects.map(p=>'<option value="'+esc(p.id)+'" '+(old?.projectId===p.id?"selected":"")+'>'+esc(p.name)+'</option>').join("")+'</select></div>',actions:[{label:"取消",onClick:closeModal},{label:"保存笔记",primary:true,onClick:async()=>{
    const name=document.getElementById("artifactName").value.trim(),content=document.getElementById("artifactContent").value;if(!name){toast("标题不能为空");return;}
    const ts=nowISO(),rec=Object.assign({},old||{id:uid("artifact"),kind:"artifact",createdAt:ts},{kind:"artifact",name,content,mime:"text/markdown",source:"笔记",projectId:document.getElementById("artifactProject").value||null,updatedAt:ts});
    await dbPut("workspaceItems",rec);closeModal();await loadCache();render();toast("笔记已保存");
  }}]});
}
function chooseWorkspaceArtifactFile(){
  const input=document.createElement("input");input.type="file";input.multiple=true;input.accept="image/*,.pdf,.txt,.md,.json,.html,.css,.js,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
  input.onchange=async()=>{for(const file of [...(input.files||[])]){if(file.size>12*1024*1024){toast(file.name+" 超过 12 MB，已跳过");continue;}
      const textLike=file.type.startsWith("text/")||/\.(txt|md|json|html?|css|js|xml|svg)$/i.test(file.name);
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);if(textLike)reader.readAsText(file);else reader.readAsDataURL(file);});
      const ts=nowISO(),rec={id:uid("artifact"),kind:"artifact",name:file.name,mime:file.type||"application/octet-stream",content:textLike?String(data):"",dataUrl:textLike?"":String(data),source:"上传文件",projectId:null,size:file.size,createdAt:ts,updatedAt:ts};
      await dbPut("workspaceItems",rec);
    }await loadCache();render();toast("文件已保存到本机");};
  input.click();
}
async function saveLatestAssistantArtifact(){
  const all=await dbAll("messages"),latest=all.filter(x=>x.role==="assistant"&&x.content).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))[0];
  if(!latest){toast("还没有可保存的 AI 回复");return;}
  const session=findById(cache.sessions,latest.sessionId),ts=nowISO(),rec={id:uid("artifact"),kind:"artifact",name:(session?.title||"AI 回复")+" · "+fmtTime(latest.createdAt),mime:"text/markdown",content:latest.content,source:"AI 对话",sessionId:latest.sessionId,projectId:null,createdAt:ts,updatedAt:ts};
  await dbPut("workspaceItems",rec);await loadCache();render();toast("最近一条 AI 回复已保存");
}

function editWorkspaceArtifactProject(id){
  const item=findById(workspaceItems("artifact"),id);if(!item)return;
  const projects=workspaceItems("project");
  modal({title:"关联项目",body:'<div class="field"><label>选择项目</label><select id="artifactProjectLink"><option value="">不关联项目</option>'+projects.map(p=>'<option value="'+esc(p.id)+'" '+(item.projectId===p.id?"selected":"")+'>'+esc(p.name)+'</option>').join("")+'</select></div>',actions:[{label:"取消",onClick:closeModal},{label:"保存",primary:true,onClick:async()=>{
    item.projectId=document.getElementById("artifactProjectLink").value||null;item.updatedAt=nowISO();
    await dbPut("workspaceItems",item);closeModal();await loadCache();render();toast("项目关联已更新");
  }}]});
}
function previewWorkspaceArtifact(id){
  const item=findById(workspaceItems("artifact"),id);if(!item||!item.mime?.startsWith("image/")||!item.dataUrl)return;
  const mask=document.createElement("div");mask.className="artifact-preview-mask";
  mask.innerHTML='<section class="artifact-preview-panel"><header><strong></strong><span class="spacer"></span><button class="btn icon-btn" aria-label="关闭">'+icon("x")+'</button></header><div class="artifact-preview-stage"><img alt=""></div></section>';
  mask.querySelector("header strong").textContent=item.name||"图片预览";
  const img=mask.querySelector("img");img.src=item.dataUrl;img.alt=item.name||"图片预览";
  const close=()=>mask.remove();mask.querySelector("header button").onclick=close;
  mask.addEventListener("click",event=>{if(event.target===mask)close();});document.body.appendChild(mask);
}
function downloadWorkspaceArtifact(id){
  const x=findById(workspaceItems("artifact"),id);if(!x)return;
  if(x.dataUrl){const a=document.createElement("a");a.href=x.dataUrl;a.download=x.name||"artifact";document.body.appendChild(a);a.click();a.remove();}
  else downloadTextFile(x.name||"artifact.md",x.content||"",x.mime||"text/plain;charset=utf-8");
}
async function deleteWorkspaceArtifact(id){
  const x=findById(workspaceItems("artifact"),id);if(!x)return;
  modal({title:"删除产物",body:'确定删除「'+esc(x.name)+'」？',actions:[{label:"取消",onClick:closeModal},{label:"删除",danger:true,onClick:async()=>{await dbDelete("workspaceItems",id);closeModal();await loadCache();render();toast("产物已删除");}}]});
}