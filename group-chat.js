function openGroups(){state.drawer=false;state.view="groups";render();}
function groupById(id){return findById(cache.groups||[],id);}
function groupAvatar(g){return '<span class="group-avatar">'+(g&&g.iconDataUrl?'<img src="'+esc(g.iconDataUrl)+'" alt="">':esc([...(g&&g.name||"群聊")][0]||"群"))+'</span>';}
function groupModeName(m){return m==="task"?"协作讨论":m==="solo"?"单人交流":"闲聊";}
function viewGroups(){
 var groups=[...(cache.groups||[])].sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
 var cards=groups.map(g=>'<button class="group-card" onclick="openGroup(\''+g.id+'\')">'+groupAvatar(g)+'<span class="group-card-copy"><strong>'+esc(g.name||"未命名群聊")+'</strong><small>'+esc(g.announcement||"暂无群公告")+' · '+(g.members||[]).length+' 位成员</small><small>'+groupModeName(g.mode||"chat")+' · '+fmtTime(g.updatedAt||g.createdAt)+'</small></span><span class="group-card-arrow">›</span></button>').join("");
 return '<div class="groups-page"><header class="groups-head"><button class="icon-btn" onclick="goTree()">'+icon("back")+'</button><div><h2>群聊空间</h2><div class="muted small">让不同 AI 在同一段公共对话中交流</div></div><span class="spacer"></span><button class="btn btn-primary" onclick="createGroupDialog()">'+icon("plus")+'新建群聊</button></header>'+(cards?'<div class="group-list">'+cards+'</div>':'<div class="group-empty"><strong>还没有群聊</strong>创建一个群聊，选择 AI 成员并设置讨论目的。<div style="margin-top:16px"><button class="btn btn-primary" onclick="createGroupDialog()">创建第一个群聊</button></div></div>')+'</div>';
}
function groupMemberCheckboxes(existing){
 return (cache.persons||[]).map(p=>'<label class="switch"><input type="checkbox" name="groupMemberPick" value="'+p.id+'" '+((existing||[]).includes(p.id)?"checked":"")+'>'+avatar(p.name,p.avatar)+'<span>'+esc(p.name)+'</span></label>').join("")||'<p class="muted small">还没有 AI 身份，请先创建 AI 身份并绑定可用模型。</p>';
}
function createGroupDialog(){
 if(!cache.persons.length){toast("请先创建至少一个 AI 身份");goSettings("models");return;}
 modal({title:"创建群聊",body:'<div class="field"><label>群图标（可选）</label><input id="groupCreateIcon" type="file" accept="image/*"><div class="hint">不上传图片时使用群名称首字作为默认图标。</div></div><div class="field"><label>群名称</label><input id="groupCreateName" maxlength="40" placeholder="例如：HOMY 产品讨论组"></div><div class="field"><label>群公告 / 群聊目的</label><textarea id="groupCreateAnnouncement" rows="3" placeholder="说明这个群聊用来做什么、成员如何交流……"></textarea></div><div class="field"><label>选择 AI 成员</label><div class="group-member-picks">'+groupMemberCheckboxes([])+'</div></div><div class="field"><label>初始交流模式</label><select id="groupCreateMode"><option value="chat">闲聊</option><option value="task">协作讨论</option><option value="solo">单人交流</option></select></div>',
 actions:[{label:"取消",onClick:closeModal},{label:"创建群聊",primary:true,onClick:createGroupFromDialog}]});
}
async function createGroupFromDialog(){
 var name=document.getElementById("groupCreateName").value.trim(),ids=[...document.querySelectorAll('input[name="groupMemberPick"]:checked')].map(x=>x.value);
 if(!name){toast("请填写群名称");return;}if(!ids.length){toast("至少选择一位 AI 成员");return;}
 var file=document.getElementById("groupCreateIcon").files[0],iconDataUrl="";
 if(file){if(file.size>2097152){toast("群图标请控制在 2MB 以内");return;}iconDataUrl=await fileToDataURL(file);}
 var ts=nowISO(),mode=document.getElementById("groupCreateMode").value;
 var g={id:uid("gr"),name:name,iconDataUrl:iconDataUrl,announcement:document.getElementById("groupCreateAnnouncement").value.trim(),mode:mode,soloMemberId:ids[0],
 members:ids.map(id=>{var p=findById(cache.persons,id);return {personId:id,modelId:p.modelId||(p.modelIds||[])[0]||"",thinkingEnabled:true,lastSpokeAt:""};}),
 autoReply:true,autoReplyPaused:false,allowCrossTalk:true,maxAutoReplies:2,createdAt:ts,updatedAt:ts};
 await dbPut("groups",g);closeModal();await loadCache();openGroup(g.id);
}
function openGroup(id){if(state.groupRunning)stopGroupTurn(true);state.groupId=id;state.view="groupChat";state.groupComposerMode="message";state.groupThinkingOverride=null;state.groupIconDraft="";state.groupMessages=[];state.drawer=false;render();}
function openGroupDetail(){state.groupIconDraft="";state.view="groupDetail";render();}
function viewGroupDetail(){
 var g=groupById(state.groupId);if(!g)return "";
 var members=(g.members||[]).map(m=>{var p=findById(cache.persons,m.personId),model=findById(cache.models,m.modelId);if(!p)return "";return '<div class="group-member-setting">'+avatar(p.name,p.avatar)+'<div class="group-member-setting-copy"><strong>'+esc(p.name)+'</strong><small>'+esc(model?model.name:"未选择模型")+' · 深度思考'+(m.thinkingEnabled===false?"关闭":"开启")+'</small></div><button class="btn" onclick="openGroupMemberSettings(\''+m.personId+'\')">模型与思考</button><button class="icon-btn" onclick="removeGroupMember(\''+m.personId+'\')">'+icon("x")+'</button></div>';}).join("");
 return '<div class="group-detail-page"><header class="group-detail-head"><button class="icon-btn" onclick="openGroup(\''+g.id+'\')">'+icon("back")+'</button><div><h2>群聊详情</h2><div class="muted small">群资料、成员与发言规则</div></div><span class="spacer"></span><button class="btn btn-danger" onclick="deleteGroup(\''+g.id+'\')">删除群聊</button></header>'+
 '<div class="card"><div class="group-icon-preview">'+groupAvatar(g)+'<div><strong>'+esc(g.name)+'</strong><div class="muted small">群图标与名称只影响这个群聊</div></div></div><div class="field"><label>更换群图标</label><input id="groupDetailIcon" type="file" accept="image/*" onchange="previewGroupIcon(this)"></div><div class="field"><label>群名称</label><input id="groupDetailName" maxlength="40" value="'+esc(g.name)+'"></div><div class="field"><label>群公告 / 群聊目的</label><textarea id="groupDetailAnnouncement" rows="4">'+esc(g.announcement||"")+'</textarea></div><button class="btn btn-primary" onclick="saveGroupDetail()">保存群资料</button></div>'+
 '<div class="card"><div class="row"><strong>群成员（'+(g.members||[]).length+'）</strong><span class="spacer"></span><button class="btn" onclick="addGroupMembersDialog()">添加成员</button></div>'+members+'</div>'+
 '<div class="card"><strong>群聊行为</strong><div class="field"><label>默认交流模式</label><select id="groupDetailMode"><option value="chat" '+(g.mode==="chat"?"selected":"")+'>闲聊</option><option value="solo" '+(g.mode==="solo"?"selected":"")+'>单人交流</option><option value="task" '+(g.mode==="task"?"selected":"")+'>协作讨论</option></select></div><div class="field"><label>单人交流对象</label><select id="groupDetailSolo">'+(g.members||[]).map(m=>{var p=findById(cache.persons,m.personId);return p?'<option value="'+p.id+'" '+(g.soloMemberId===p.id?"selected":"")+'>'+esc(p.name)+'</option>':"";}).join("")+'</select></div><label class="switch"><input id="groupDetailAuto" type="checkbox" '+(g.autoReply!==false?"checked":"")+'>允许 AI 自动接话</label><br><label class="switch"><input id="groupDetailCross" type="checkbox" '+(g.allowCrossTalk!==false?"checked":"")+'>允许 AI 之间继续接话</label><div class="field" style="margin-top:12px"><label>每条用户消息最多自动接话次数</label><input id="groupDetailMax" type="number" min="1" max="5" value="'+(Number(g.maxAutoReplies)||2)+'"></div><button class="btn btn-primary" onclick="saveGroupBehavior()">保存群聊规则</button></div></div>';
}
async function previewGroupIcon(input){
 var file=input.files[0];if(!file)return;if(file.size>2097152){toast("群图标请控制在 2MB 以内");input.value="";return;}
 state.groupIconDraft=await fileToDataURL(file);var el=document.querySelector(".group-icon-preview .group-avatar");if(el)el.innerHTML='<img src="'+state.groupIconDraft+'" alt="">';
}
async function saveGroupDetail(){
 var g=groupById(state.groupId),name=document.getElementById("groupDetailName").value.trim();if(!g)return;if(!name){toast("群名称不能为空");return;}
 await dbPut("groups",Object.assign({},g,{name:name,announcement:document.getElementById("groupDetailAnnouncement").value.trim(),iconDataUrl:state.groupIconDraft||g.iconDataUrl||"",updatedAt:nowISO()}));
 state.groupIconDraft="";await loadCache();toast("群资料已保存");render();
}
async function saveGroupBehavior(){
 var g=groupById(state.groupId);if(!g)return;
 await dbPut("groups",Object.assign({},g,{mode:document.getElementById("groupDetailMode").value,soloMemberId:document.getElementById("groupDetailSolo").value,autoReply:document.getElementById("groupDetailAuto").checked,allowCrossTalk:document.getElementById("groupDetailCross").checked,maxAutoReplies:Math.max(1,Math.min(5,Number(document.getElementById("groupDetailMax").value)||2)),updatedAt:nowISO()}));
 await loadCache();toast("群聊规则已保存");render();
}
function openGroupMemberSettings(personId){
 var g=groupById(state.groupId),member=g&&g.members.find(x=>x.personId===personId),p=findById(cache.persons,personId);if(!g||!member||!p)return;
 var models=modelsOfPerson(p).filter(modelReady),selected=member.modelId||p.modelId,model=findById(cache.models,selected),channel=activeChannelOf(model),provider=findById(cache.providers,channel?channel.providerId:model&&model.providerId),canThink=modelSupportsThinking(model,channel,provider);
 modal({title:p.name+" · 群聊配置",body:'<div class="field"><label>本群使用的模型型号</label><select id="groupMemberModel">'+models.map(x=>'<option value="'+x.id+'" '+(x.id===selected?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select><div class="hint">只影响这个 AI 在当前群聊中的模型选择，不修改其他单聊。</div></div><div class="field"><label class="switch"><input type="checkbox" id="groupMemberThinking" '+(member.thinkingEnabled!==false?"checked":"")+' '+(canThink?"":"disabled")+'>默认开启深度思考</label><div class="hint" id="groupThinkingCapability">'+(canThink?"当前模型支持深度思考开关。":"当前型号尚未确认支持深度思考。")+'</div></div><div class="muted small">当前通道：'+esc(provider?provider.name:"未配置")+' · 实际模型 ID：'+esc(channel?channel.remoteModelId:model?model.name:"未选择")+'</div>',
 actions:[...(state.groupRunning?[{label:"停止该成员",onClick:()=>{stopGroupMember(personId);closeModal();}}]:[]),{label:"取消",onClick:closeModal},{label:"保存",primary:true,onClick:async()=>{
  var modelId=document.getElementById("groupMemberModel").value,m=findById(cache.models,modelId),ch=activeChannelOf(m),pv=findById(cache.providers,ch?ch.providerId:m&&m.providerId);
  if(!m||!modelReady(m)){toast("请选择可用模型");return;}var supported=modelSupportsThinking(m,ch,pv);
  var next=Object.assign({},g,{members:g.members.map(x=>x.personId===personId?Object.assign({},x,{modelId:modelId,thinkingEnabled:supported?document.getElementById("groupMemberThinking").checked:false}):x),updatedAt:nowISO()});
  await dbPut("groups",next);closeModal();await loadCache();render();
 }}]});
 document.getElementById("groupMemberModel").addEventListener("change",function(){var m=findById(cache.models,this.value),ch=activeChannelOf(m),pv=findById(cache.providers,ch?ch.providerId:m&&m.providerId),ok=modelSupportsThinking(m,ch,pv),toggle=document.getElementById("groupMemberThinking");toggle.disabled=!ok;if(!ok)toggle.checked=false;document.getElementById("groupThinkingCapability").textContent=ok?"当前模型支持深度思考开关。":"当前型号尚未确认支持深度思考。";});
}
function groupAddMembersDialog(g){
 var existing=(g.members||[]).map(x=>x.personId);
 modal({title:"添加群成员",body:'<div class="group-member-picks">'+groupMemberCheckboxes(existing)+'</div>',actions:[{label:"取消",onClick:closeModal},{label:"添加所选成员",primary:true,onClick:async()=>{
  var ids=[...document.querySelectorAll('input[name="groupMemberPick"]:checked')].map(x=>x.value),members=(g.members||[]).slice();
  ids.filter(id=>!members.some(m=>m.personId===id)).forEach(id=>{var p=findById(cache.persons,id);if(p)members.push({personId:id,modelId:p.modelId||(p.modelIds||[])[0]||"",thinkingEnabled:true,lastSpokeAt:""});});
  await dbPut("groups",Object.assign({},g,{members:members,soloMemberId:g.soloMemberId||members[0].personId,updatedAt:nowISO()}));closeModal();await loadCache();render();
 }}]});
}
function addGroupMembersDialog(){var g=groupById(state.groupId);if(g)groupAddMembersDialog(g);}
function addGroupMembersDialogFromChat(){var g=groupById(state.groupId);if(g)groupAddMembersDialog(g);}
function removeGroupMember(id){
 var g=groupById(state.groupId);if(!g)return;if(g.members.length<=1){toast("群聊至少保留一位成员");return;}
 confirmDialog("移除群成员","只会将该 AI 移出当前群聊，不会删除身份、模型或其他聊天。",async()=>{stopGroupMember(id);var members=g.members.filter(x=>x.personId!==id);await dbPut("groups",Object.assign({},g,{members:members,soloMemberId:g.soloMemberId===id?members[0].personId:g.soloMemberId,updatedAt:nowISO()}));await loadCache();render();});
}
async function deleteGroup(id){
 confirmDialog("删除群聊","将删除这个群聊及其群聊消息，不会删除群成员身份、单聊和长期记忆。",async()=>{
  if(state.groupRunning)stopGroupTurn(true);
  var msgs=await idbReq(tx("groupMessages").index("groupId").getAll(id)),t=db.transaction(["groups","groupMessages"],"readwrite");msgs.forEach(m=>t.objectStore("groupMessages").delete(m.id));t.objectStore("groups").delete(id);
  await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);});state.groupId=null;state.view="groups";await loadCache();render();
 });
}

function loadGroupMessages(){return idbReq(tx("groupMessages").index("groupId").getAll(state.groupId)).then(rows=>{state.groupMessages=rows.sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));renderGroupMessages({forceBottom:true});});}
function groupMessageHTML(m){
 if(m.role==="user"){
  var userAvatar=avatar(cache.settings.userName||"我",cache.settings.userAvatar);
  return '<div class="group-message-row group-user-row" data-group-msg-id="'+m.id+'"><div class="group-message-stack"><div class="msg-body group-bubble group-user-bubble">'+esc(m.content)+'</div><div class="group-msg-meta"><span>你</span><span>'+fmtTime(m.createdAt)+'</span></div></div><span class="group-message-avatar">'+userAvatar+'</span></div>';
 }
 if(m.role==="narrator")return '<div class="group-narrator"><span class="group-narrator-label">旁白 · 用户发布</span>'+esc(m.content)+'</div>';
 if(m.role==="system-note")return '<div class="msg sysnote">'+esc(m.content)+'</div>';
 if(m.role==="error")return '<div class="msg err">'+esc(m.content)+'</div>';
 var p=findById(cache.persons,m.personId),model=findById(cache.models,m.modelId);
 var reason=m.reasoning?'<details class="reason-box"><summary><span>深度思考</span><span class="reason-hint">模型提供 · 点击展开</span></summary><pre>'+esc(m.reasoning)+'</pre></details>':"";
 return '<div class="group-message-row group-ai-row" data-group-msg-id="'+m.id+'"><span class="group-message-avatar">'+(p?avatar(p.name,p.avatar):avatar("AI",""))+'</span><div class="group-message-stack"><div class="group-ai-name">'+esc(p?p.name:"AI")+'</div>'+reason+'<div class="msg-body group-bubble group-ai-bubble">'+esc(m.content)+'</div><div class="group-msg-meta"><span>'+esc(model?model.name:m.modelId||"模型")+'</span><span>'+(m.thinkingUsed?"深度思考":"")+'</span><span>'+fmtTime(m.createdAt)+'</span></div></div></div>';
}
function bindGroupMessageEvents(list){
 if(!list||list.dataset.messageEvents==="1")return;list.dataset.messageEvents="1";
 var timer=null,target=null,moved=false,opened=false;
 var clear=()=>{if(timer)clearTimeout(timer);timer=null;target=null;};
 list.addEventListener("contextmenu",e=>{var row=e.target.closest("[data-group-msg-id]");if(!row)return;e.preventDefault();openGroupMessageActions(row.dataset.groupMsgId);});
 list.addEventListener("pointerdown",e=>{var row=e.target.closest("[data-group-msg-id]");if(!row)return;target=row.dataset.groupMsgId;moved=false;opened=false;timer=setTimeout(()=>{if(!moved&&target){opened=true;openGroupMessageActions(target);}clear();},560);});
 list.addEventListener("pointermove",()=>{moved=true;if(timer){clearTimeout(timer);timer=null;}});
 list.addEventListener("click",e=>{if(opened){e.preventDefault();e.stopPropagation();opened=false;}},true);
 ["pointerup","pointercancel","pointerleave"].forEach(type=>list.addEventListener(type,clear));
}
function openGroupMessageActions(id){
 var m=(state.groupMessages||[]).find(x=>x.id===id);if(!m||state.groupRunning)return;
 var actions=[];
 if(m.role==="user"){actions.push({label:"重新发送",onClick:()=>resendGroupUserMessage(id)});actions.push({label:"编辑并重新回答",onClick:()=>editGroupUserMessage(id)});}
 if(m.role==="assistant")actions.push({label:"重新生成",onClick:()=>regenerateGroupMessage(id)});
 actions.push({label:"复制",onClick:async()=>{closeModal();try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(m.content||"");else{var box=document.createElement("textarea");box.value=m.content||"";document.body.appendChild(box);box.select();document.execCommand("copy");box.remove();}toast("已复制");}catch(e){toast("复制失败，请手动选择文字");}}});
 actions.push({label:"删除消息",danger:true,onClick:()=>deleteGroupMessage(id)},{label:"关闭",onClick:closeModal});
 modal({title:m.role==="user"?"用户消息":(m.role==="assistant"?"AI 回复":"群聊消息"),body:'<div class="muted">长按消息可再次打开此菜单。</div>',actions});
}
async function deleteGroupMessage(id){
 var m=(state.groupMessages||[]).find(x=>x.id===id);if(!m)return;
 await dbDelete("groupMessages",id);state.groupMessages=state.groupMessages.filter(x=>x.id!==id);closeModal();renderGroupMessages();toast("已删除这条群聊消息");
}
async function resendGroupUserMessage(id){
 var index=state.groupMessages.findIndex(x=>x.id===id),m=state.groupMessages[index];if(!m||m.role!=="user")return;
 var tail=state.groupMessages.slice(index+1);
 for(var item of tail)await dbDelete("groupMessages",item.id);
 state.groupMessages=state.groupMessages.slice(0,index+1);closeModal();renderGroupMessages({forceBottom:true});
 await runGroupTurn(groupById(state.groupId),m);
}
function editGroupUserMessage(id){
 var m=(state.groupMessages||[]).find(x=>x.id===id);if(!m||m.role!=="user")return;
 modal({title:"编辑并重新回答",body:'<div class="field"><label>消息内容</label><textarea id="editGroupMessageText" style="min-height:140px">'+esc(m.content||"")+'</textarea></div><div class="muted small">保存后会删除这条消息之后的群聊记录，并重新触发群聊回复。</div>',actions:[
  {label:"取消",onClick:closeModal},
  {label:"保存并重新回答",primary:true,onClick:async()=>{
   var next=document.getElementById("editGroupMessageText").value.trim();if(!next){toast("消息不能为空");return;}
   var index=state.groupMessages.findIndex(x=>x.id===id),tail=state.groupMessages.slice(index+1),updated=Object.assign({},m,{content:next,updatedAt:nowISO()});
   for(var item of tail)await dbDelete("groupMessages",item.id);await dbPut("groupMessages",updated);
   state.groupMessages=state.groupMessages.slice(0,index).concat([updated]);closeModal();renderGroupMessages({forceBottom:true});
   await runGroupTurn(groupById(state.groupId),updated);
  }}
 ]});
}
async function regenerateGroupMessage(id){
 var index=state.groupMessages.findIndex(x=>x.id===id),m=state.groupMessages[index];if(!m||m.role!=="assistant")return;
 var user=null;for(var i=index-1;i>=0;i--){if(state.groupMessages[i].role==="user"){user=state.groupMessages[i];break;}}
 if(!user){toast("找不到对应的用户消息");return;}
 var personId=m.personId;confirmDialog("重新生成回复","只撤回这条 AI 回复，并让对应成员重新回答。其他成员的消息会保留。确定？",async()=>{
  await dbDelete("groupMessages",id);state.groupMessages=state.groupMessages.filter(x=>x.id!==id);closeModal();renderGroupMessages({forceBottom:true});
  await runGroupTurn(groupById(state.groupId),user,personId);
 });
}
function renderGroupMessages(options){
 var list=document.getElementById("groupMsgList");if(!list)return;var near=list.scrollHeight-list.scrollTop-list.clientHeight<150;
 list.innerHTML=(state.groupMessages||[]).map(groupMessageHTML).join("");bindGroupMessageEvents(list);if((options&&options.forceBottom)||near)list.scrollTop=list.scrollHeight;renderGroupStatus();
}
function renderGroupStatus(){var el=document.getElementById("groupStatus");if(el)el.textContent=state.groupStatus||"";var stop=document.getElementById("groupStopBtn");if(stop)stop.disabled=!state.groupRunning;}
function viewGroupChat(){
 var g=groupById(state.groupId);if(!g)return "";var members=(g.members||[]).filter(m=>findById(cache.persons,m.personId));
 var chips=members.map(m=>{var p=findById(cache.persons,m.personId);return '<button class="group-member-chip '+(state.groupControllers.has(m.personId)?"running":"")+'" onclick="openGroupMemberSettings(\''+m.personId+'\')" title="'+esc(p.name)+' · 模型与思考设置">'+avatar(p.name,p.avatar)+'<span>'+esc(p.name)+'</span></button>';}).join("");
 return '<div class="chat-page"><div class="topbar group-topbar"><button class="btn icon-btn" onclick="openGroups()">'+icon("back")+'</button><button class="group-title-button" onclick="openGroupDetail()">'+groupAvatar(g)+'<span class="group-title-copy"><strong>'+esc(g.name)+'</strong><small>群聊详情</small></span></button><select class="group-mode-select" onchange="changeGroupMode(this.value)"><option value="chat" '+(g.mode==="chat"?"selected":"")+'>闲聊</option><option value="solo" '+(g.mode==="solo"?"selected":"")+'>单人</option><option value="task" '+(g.mode==="task"?"selected":"")+'>讨论</option></select><div class="group-member-strip">'+chips+'</div><button class="btn" onclick="toggleGroupPause()">'+(g.autoReplyPaused?"恢复":"暂停")+'</button><button class="btn btn-stop" id="groupStopBtn" onclick="stopGroupTurn()" '+(state.groupRunning?"":"disabled")+'>停止</button></div>'+
 '<div class="group-status" id="groupStatus">'+esc(state.groupStatus||"")+'</div><div class="msg-list" id="groupMsgList"></div><div class="chat-input"><div class="group-composer-mode" id="groupComposerMode">'+(state.groupComposerMode==="narrator"?"旁白模式 · 第三方视角发布，不触发 AI 回复":"")+'</div><div class="input-row group-chat-input"><button class="btn icon-btn composer-attach" onclick="openGroupComposerMenu()">'+icon("plus")+'</button><div class="group-command-menu hidden" id="groupCommandMenu"></div><textarea id="groupChatInput" rows="1" placeholder="'+(state.groupComposerMode==="narrator"?"编写旁白内容……":"发消息给群聊……")+'"></textarea><button class="btn icon-btn" title="本轮深度思考设置" onclick="cycleGroupThinkingOverride()">脑</button><button class="btn btn-primary" onclick="sendGroupMessage()">发送</button></div><div class="composer-style-link"><button onclick="openGroupDetail()">群聊设置与成员模型</button></div></div></div>';
}
async function changeGroupMode(mode){var g=groupById(state.groupId);if(!g)return;await dbPut("groups",Object.assign({},g,{mode:mode,updatedAt:nowISO()}));await loadCache();render();}
function cycleGroupThinkingOverride(){state.groupThinkingOverride=state.groupThinkingOverride===null?true:state.groupThinkingOverride===true?false:null;toast(state.groupThinkingOverride===null?"本轮思考：跟随成员默认设置":state.groupThinkingOverride?"本轮思考：强制开启（仅支持模型）":"本轮思考：强制关闭");}
async function toggleGroupPause(){var g=groupById(state.groupId);if(!g)return;var pause=!g.autoReplyPaused;await dbPut("groups",Object.assign({},g,{autoReplyPaused:pause,updatedAt:nowISO()}));await loadCache();if(pause)stopGroupTurn(true);render();}
function openGroupComposerMenu(){modal({title:"群聊输入",body:'<p class="muted small">选择这条消息的发送形式。</p>',actions:[
 {label:state.groupComposerMode==="narrator"?"切回普通消息":"发布旁白",primary:true,onClick:()=>{state.groupComposerMode=state.groupComposerMode==="narrator"?"message":"narrator";closeModal();render();document.getElementById("groupChatInput")?.focus();}},
 {label:"添加群成员",onClick:()=>{closeModal();addGroupMembersDialogFromChat();}},{label:"取消",onClick:closeModal}
]});}
function groupCommands(){return [["/chat","切换闲聊模式"],["/task","切换协作讨论模式"],["/solo","只与指定 AI 交流"],["/to","指定某个 AI 回答"],["/think","设置本轮深度思考"],["/stop","停止全体或指定 AI"],["/pause","暂停自动接话"],["/continue","恢复自动接话"],["/add","添加群成员"],["/remove","移除群成员"],["/help","查看群聊命令"]];}
function bindGroupChatInput(){
 var input=document.getElementById("groupChatInput");if(!input||input.dataset.bound==="1")return;input.dataset.bound="1";
 input.addEventListener("input",handleGroupInput);input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!("ontouchstart" in window)){e.preventDefault();sendGroupMessage();}});input.focus();
}
function handleGroupInput(){
 var input=document.getElementById("groupChatInput"),menu=document.getElementById("groupCommandMenu");if(!input||!menu)return;var value=input.value.trimStart(),token=value.split(/\s/)[0];
 if(!value.startsWith("/")||value.includes(" ")){menu.classList.add("hidden");menu.innerHTML="";return;}
 var matches=groupCommands().filter(x=>x[0].startsWith(token.toLowerCase()));if(!matches.length){menu.classList.add("hidden");return;}
 menu.innerHTML=matches.map(x=>'<button type="button" data-command="'+x[0]+'"><code>'+x[0]+'</code><span>'+x[1]+'</span></button>').join("");menu.classList.remove("hidden");
 menu.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{input.value=btn.dataset.command+" ";menu.classList.add("hidden");input.focus();}));
}
function groupFindPerson(text,g){var key=String(text||"").replace(/^@/,"").trim().toLowerCase();return (g.members||[]).map(m=>findById(cache.persons,m.personId)).find(p=>p&&(p.name.toLowerCase()===key||p.id===key||p.name.toLowerCase().includes(key)));}
async function sendGroupMessage(){
 var input=document.getElementById("groupChatInput"),g=groupById(state.groupId);if(!input||!g)return;var text=input.value.trim();if(!text)return;
 if(text.startsWith("/")){input.value="";document.getElementById("groupCommandMenu").classList.add("hidden");await executeGroupCommand(text);return;}
 var target=null,mention=text.match(/^@([^\s]+)\s*/);if(mention){var p=groupFindPerson(mention[1],g);if(!p){toast("没有找到这个群成员");return;}target=p.id;text=text.slice(mention[0].length).trim();}
 var narrator=state.groupComposerMode==="narrator";if(!text)return;if(state.groupRunning)stopGroupTurn(true);
 var msg={id:uid("gm"),groupId:g.id,role:narrator?"narrator":"user",content:text,createdAt:nowISO(),turnId:state.groupTurnId+1};
 await dbPut("groupMessages",msg);state.groupMessages.push(msg);input.value="";state.groupComposerMode="message";
 var mode=document.getElementById("groupComposerMode");if(mode)mode.textContent="";input.placeholder="发消息给群聊……";renderGroupMessages({forceBottom:true});
 await dbPut("groups",Object.assign({},g,{updatedAt:nowISO()}));await loadCache();if(!narrator)await runGroupTurn(groupById(g.id),msg,target);
}
async function executeGroupCommand(raw){
 var g=groupById(state.groupId);if(!g)return;var parts=raw.trim().split(/\s+/),cmd=parts[0].toLowerCase(),arg=parts[1]||"";
 if(cmd==="/chat"||cmd==="/task"){await changeGroupMode(cmd==="/chat"?"chat":"task");return;}
 if(cmd==="/solo"){var p=arg?groupFindPerson(arg,g):findById(cache.persons,g.soloMemberId||g.members[0]?.personId);if(!p){toast("请填写群成员名称");return;}await dbPut("groups",Object.assign({},g,{mode:"solo",soloMemberId:p.id,updatedAt:nowISO()}));await loadCache();render();return;}
 if(cmd==="/stop"){if(arg){var who=groupFindPerson(arg,g);if(who)stopGroupMember(who.id);else toast("没有找到这个群成员");}else stopGroupTurn();return;}
 if(cmd==="/pause"){await dbPut("groups",Object.assign({},g,{autoReplyPaused:true,updatedAt:nowISO()}));await loadCache();stopGroupTurn(true);render();return;}
 if(cmd==="/continue"){await dbPut("groups",Object.assign({},g,{autoReplyPaused:false,updatedAt:nowISO()}));await loadCache();render();return;}
 if(cmd==="/think"){state.groupThinkingOverride=arg==="on"||arg==="开"?true:arg==="off"||arg==="关"?false:null;toast("本轮深度思考设置已更新");return;}
 if(cmd==="/add"){addGroupMembersDialogFromChat();return;}
 if(cmd==="/remove"){var person=arg?groupFindPerson(arg,g):null;if(person)removeGroupMember(person.id);else toast("用法：/remove 成员名称");return;}
 if(cmd==="/to"){var name=parts[1],person=groupFindPerson(name,g),content=raw.slice(raw.indexOf(name)+name.length).trim();if(!person||!content){toast("用法：/to 成员名称 你要说的话");return;}var direct={id:uid("gm"),groupId:g.id,role:"user",content:content,createdAt:nowISO(),turnId:state.groupTurnId+1};await dbPut("groupMessages",direct);state.groupMessages.push(direct);renderGroupMessages({forceBottom:true});await runGroupTurn(g,direct,person.id);return;}
 if(cmd==="/help"){toast("/chat /task /solo /to /think /stop /pause /continue /add /remove");return;}
 toast("未识别的命令。输入 / 查看命令。");
}
function stopGroupMember(id){state.groupStoppedMembers.add(id);var c=state.groupControllers.get(id);if(c){c.abort();state.groupControllers.delete(id);}toast("已停止该成员的本轮生成");renderGroupStatus();}
function stopGroupTurn(silent){
 state.groupTurnId++;for(var c of state.groupControllers.values())try{c.abort();}catch(e){}state.groupControllers.clear();state.groupStoppedMembers.clear();state.groupRunning=false;state.groupStatus="已停止本轮发言";if(!silent)toast("已停止群聊中的全部 AI");renderGroupStatus();
}
function groupTranscript(){return (state.groupMessages||[]).filter(m=>["user","narrator","assistant"].includes(m.role)).slice(-30).map(m=>{if(m.role==="user")return "用户："+m.content;if(m.role==="narrator")return "旁白（用户发布的第三方叙述/指令）："+m.content;var p=findById(cache.persons,m.personId);return (p?p.name:"AI")+"："+m.content;}).join("\n");}
async function requestGroupCandidate(g,member,turn){
 var p=findById(cache.persons,member.personId);if(!p)return null;var model=findById(cache.models,member.modelId||p.modelId||(p.modelIds||[])[0]);if(!model||!modelReady(model))throw new Error((p.name||"成员")+"没有可用模型");
 var channel=activeChannelOf(model),provider=findById(cache.providers,channel?channel.providerId:model.providerId);if(!provider?.apiKey||!provider?.baseUrl)throw new Error((p.name||"成员")+"的 API 连接尚未配置完整");
 var spend=await getMonthSpend();if(turn!==state.groupTurnId||state.groupStoppedMembers.has(p.id))return null;if(spend>=(Number(cache.settings.monthlyCap)||0))throw new Error("本月费用已达上限，群聊请求已停止");
 var persona=findById(cache.personas,p.personaId),memories=cache.memories.filter(x=>x.personId===p.id&&x.enabled).sort((a,b)=>MEM_LEVELS.indexOf(a.level)-MEM_LEVELS.indexOf(b.level)||b.importance-a.importance);
 var memoryText=memories.slice(0,20).map(x=>"["+x.level+"] "+x.content).join("\n"),mode=g.mode||"chat";
 var instruction=mode==="task"?"当前是协作讨论模式：认真分析、给出依据，允许质疑，但不要为了反驳而反驳。":"当前是自然闲聊模式：尽量用一到三句话自然回应，不要把普通聊天写成长篇报告。";
 var system=["你是群聊中的独立 AI 成员，只代表自己的身份发言。","【AI 身份】"+p.name+"\n"+(persona?.content||""),cache.settings.userBio?"【用户资料】"+cache.settings.userBio:"",p.breakLimitEnabled&&p.breakLimitDoc?"【用户补充文档】\n"+p.breakLimitDoc:"",memoryText?"【该身份自己的长期记忆】\n"+memoryText:"","【群名称】"+g.name+"\n【群公告】"+(g.announcement||"无")+"\n【交流规则】"+instruction,"【发言规则】只阅读群聊公共记录，不假设自己知道其他 AI 的私有记忆或内部思考。没有新观点时只输出 [[PASS]]。如需发言，第一行输出 [P:1] 到 [P:5] 表示优先级，第二行开始写回复。"].filter(Boolean).join("\n\n");
 var messages=[{role:"system",content:system},{role:"user",content:"【群聊公共记录】\n"+groupTranscript()+"\n\n请判断是否值得参与并按规则回复。"}];
 var controller=new AbortController();state.groupControllers.set(p.id,controller);var requestBody={model:channel?.remoteModelId||model.name,messages:messages,stream:provider.streamEnabled!==false};
 var supports=modelSupportsThinking(model,channel,provider),thinking=state.groupThinkingOverride===null?member.thinkingEnabled!==false:state.groupThinkingOverride;if(supports)requestBody.thinking={type:thinking?"enabled":"disabled"};
 try{
  var endpoint=provider.baseUrl.replace(/\/+$/,"")+"/chat/completions",resp=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+provider.apiKey},body:JSON.stringify(requestBody),signal:controller.signal});
  if(!resp.ok)throw new Error(p.name+" 接口错误 HTTP "+resp.status+"："+(await resp.text()).slice(0,240));
  var result=await readStreamingCompletion(resp,function(){}),content=String(result.content||"").trim();if(!content||/^\[\[PASS\]\]$/i.test(content))return null;
  var pm=content.match(/^\s*\[P\s*:\s*([1-5])\]\s*/i),priority=pm?Number(pm[1]):3;if(pm)content=content.slice(pm[0].length).trim();if(!content)return null;
  var usage=result.usage||{},pt=Number(usage.prompt_tokens)||0,ct=Number(usage.completion_tokens)||0;
  return {personId:p.id,modelId:model.id,providerId:provider.id,content:content,reasoning:result.reasoning||"",priority:priority,promptTokens:pt,completionTokens:ct,totalTokens:Number(usage.total_tokens)||(pt+ct),cost:(pt*(Number(model.priceInput)||0)+ct*(Number(model.priceOutput)||0))/1e6,thinkingUsed:supports&&thinking,lastSpokeAt:member.lastSpokeAt||"",readyAt:Date.now()};
 }finally{if(state.groupControllers.get(p.id)===controller)state.groupControllers.delete(p.id);}
}
async function runGroupTurn(g,userMsg,targetId){
 if(!g||g.autoReply===false||g.autoReplyPaused)return;if(state.groupRunning)stopGroupTurn(true);
 var turn=++state.groupTurnId;state.groupRunning=true;state.groupStoppedMembers.clear();
 var members=(g.members||[]).filter(m=>findById(cache.persons,m.personId));if(targetId)members=members.filter(m=>m.personId===targetId);else if(g.mode==="solo")members=members.filter(m=>m.personId===g.soloMemberId);
 if(!members.length){state.groupRunning=false;state.groupStatus="没有可参与的群成员";renderGroupStatus();return;}
 state.groupStatus=members.length+" 位 AI 正在并行准备发言";renderGroupStatus();
 var settled=await Promise.allSettled(members.map(m=>requestGroupCandidate(g,m,turn)));if(turn!==state.groupTurnId)return;
 var candidates=settled.filter(x=>x.status==="fulfilled"&&x.value).map(x=>x.value),errors=settled.filter(x=>x.status==="rejected"&&x.reason?.name!=="AbortError").map(x=>x.reason?.message||"成员请求失败");
 candidates.sort((a,b)=>b.priority-a.priority||(a.lastSpokeAt||"").localeCompare(b.lastSpokeAt||"")||a.readyAt-b.readyAt);
 var max=targetId||g.mode==="solo"||g.allowCrossTalk===false?1:Math.max(1,Math.min(5,Number(g.maxAutoReplies)||2)),shown=0;
 for(var item of candidates){
  if(turn!==state.groupTurnId||shown>=max)break;if(state.groupStoppedMembers.has(item.personId))continue;
  var msg={id:uid("gm"),groupId:g.id,role:"assistant",personId:item.personId,modelId:item.modelId,providerId:item.providerId,content:item.content,reasoning:item.reasoning,promptTokens:item.promptTokens,completionTokens:item.completionTokens,totalTokens:item.totalTokens,cost:item.cost,thinkingUsed:item.thinkingUsed,turnId:turn,createdAt:nowISO()};
  await dbPut("groupMessages",msg);state.groupMessages.push(msg);shown++;renderGroupMessages({forceBottom:true});
  var current=groupById(g.id);if(current){await dbPut("groups",Object.assign({},current,{members:current.members.map(m=>m.personId===item.personId?Object.assign({},m,{lastSpokeAt:msg.createdAt}):m),updatedAt:msg.createdAt}));await loadCache();}
  state.groupStatus=shown+"/"+max+" 位 AI 已发言";renderGroupStatus();await new Promise(r=>setTimeout(r,350));
 }
 if(turn!==state.groupTurnId)return;
 if(errors.length){var note={id:uid("gm"),groupId:g.id,role:"system-note",content:errors.join("；"),createdAt:nowISO()};await dbPut("groupMessages",note);state.groupMessages.push(note);}
 state.groupRunning=false;state.groupStatus=shown?"本轮结束 · "+shown+" 位 AI 发言":"本轮结束 · 暂无成员需要补充";state.groupThinkingOverride=null;renderGroupMessages({forceBottom:true});refreshMonthPill();
}
