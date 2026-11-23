function openGroups(){state.drawer=false;state.view="groups";render();}
function groupById(id){return findById(cache.groups||[],id);}
function groupAvatar(g){return '<span class="group-avatar">'+(g&&g.iconDataUrl?'<img src="'+esc(g.iconDataUrl)+'" alt="">':esc([...(g&&g.name||"群聊")][0]||"群"))+'</span>';}
function groupModeName(m){return m==="task"?"协作讨论":m==="solo"?"单人交流":"闲聊";}
function viewGroups(){
 var groups=[...(cache.groups||[])].sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
 var cards=groups.map(g=>'<button class="group-card" onclick="openGroup(\\''+g.id+'\\')">'+groupAvatar(g)+'<span class="group-card-copy"><strong>'+esc(g.name||"未命名群聊")+'</strong><small>'+esc(g.announcement||"暂无群公告")+' · '+(g.members||[]).length+' 位成员</small><small>'+groupModeName(g.mode||"chat")+' · '+fmtTime(g.updatedAt||g.createdAt)+'</small></span><span class="group-card-arrow">›</span></button>').join("");
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
function openGroup(id){if(state.groupRunning)stopGroupTurn(true);state.groupId=id;state.view="groupChat";state.groupComposerMode="message";state.groupThinkingOverride=null;state.groupMessages=[];state.drawer=false;render();}
function openGroupDetail(){state.view="groupDetail";render();}
function viewGroupDetail(){
 var g=groupById(state.groupId);if(!g)return "";
 var members=(g.members||[]).map(m=>{var p=findById(cache.persons,m.personId),model=findById(cache.models,m.modelId);if(!p)return "";return '<div class="group-member-setting">'+avatar(p.name,p.avatar)+'<div class="group-member-setting-copy"><strong>'+esc(p.name)+'</strong><small>'+esc(model?model.name:"未选择模型")+' · 深度思考'+(m.thinkingEnabled===false?"关闭":"开启")+'</small></div><button class="btn" onclick="openGroupMemberSettings(\\''+m.personId+'\\')">模型与思考</button><button class="icon-btn" onclick="removeGroupMember(\\''+m.personId+'\\')">'+icon("x")+'</button></div>';}).join("");
 return '<div class="group-detail-page"><header class="group-detail-head"><button class="icon-btn" onclick="openGroup(\\''+g.id+'\\')">'+icon("back")+'</button><div><h2>群聊详情</h2><div class="muted small">群资料、成员与发言规则</div></div><span class="spacer"></span><button class="btn btn-danger" onclick="deleteGroup(\\''+g.id+'\\')">删除群聊</button></header>'+
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
 actions:[{label:"取消",onClick:closeModal},{label:"保存",primary:true,onClick:async()=>{
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
 confirmDialog("移除群成员","只会将该 AI 移出当前群聊，不会删除身份、模型或其他聊天。",async()=>{var members=g.members.filter(x=>x.personId!==id);await dbPut("groups",Object.assign({},g,{members:members,soloMemberId:g.soloMemberId===id?members[0].personId:g.soloMemberId,updatedAt:nowISO()}));await loadCache();render();});
}
async function deleteGroup(id){
 confirmDialog("删除群聊","将删除这个群聊及其群聊消息，不会删除群成员身份、单聊和长期记忆。",async()=>{
  var msgs=await idbReq(tx("groupMessages").index("groupId").getAll(id)),t=db.transaction(["groups","groupMessages"],"readwrite");msgs.forEach(m=>t.objectStore("groupMessages").delete(m.id));t.objectStore("groups").delete(id);
  await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);});state.groupId=null;state.view="groups";await loadCache();render();
 });
}
