(function () {
    'use strict';
    var App = window.App = {};
    function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,6)}
    function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}

    var DEFAULT_STUDENTS = DemoData.students;
    var DEFAULT_BANKS = DemoData.banks;

    var DATA_VERSION = 5;

    App.Storage = {
        get:function(k,d){try{var v=localStorage.getItem('exam_'+k);return v?JSON.parse(v):d}catch(e){return d}},
        set:function(k,v){try{localStorage.setItem('exam_'+k,JSON.stringify(v))}catch(e){}},
        ensureDefaults:function(){
            var ver=this.get('dataVersion',0);
            if(ver<DATA_VERSION){
                var students=this.get('students',null);
                if(!students||students.length===0){this.setStudents(DEFAULT_STUDENTS)}
                else{
                    var changed=false;
                    students.forEach(function(s){
                        if(s.gender===undefined){s.gender='';changed=true}
                        if(s.group===undefined){s.group='';changed=true}
                        if(s.totalPoints!==undefined){delete s.totalPoints;changed=true}
                    });
                    if(changed)this.setStudents(students);
                }
                var banks=this.get('banks',null);
                if(!banks||banks.length===0){this.setBanks(DEFAULT_BANKS.slice())}
                this.set('dataVersion',DATA_VERSION);
                localStorage.removeItem('exam_pointsCache');
            }
        },
        getStudents:function(){return this.get('students',[])},
        setStudents:function(s){this.set('students',s);if(!this._syncSilent)App.Sync.notifyChange('students',s)},
        getBanks:function(){return this.get('banks',[])},
        setBanks:function(b){this.set('banks',b);if(!this._syncSilent)App.Sync.notifyChange('banks',b)},
        getRecords:function(){return this.get('records',[])},
        setRecords:function(r){this.set('records',r);if(!this._syncSilent)App.Sync.notifyChange('records',r)},
        getExamProgress:function(){return this.get('examProgress',null)},
        setExamProgress:function(p){this.set('examProgress',p)},
        clearExamProgress:function(){localStorage.removeItem('exam_examProgress')},
        getSettings:function(){
            return this.get('settings',{
                levels:[
                    {name:'新手',minPoints:0,comment:'初出茅庐，继续加油！'},
                    {name:'学徒',minPoints:100,comment:'小有所成，前途无量！'},
                    {name:'熟手',minPoints:300,comment:'技艺精湛，令人佩服！'},
                    {name:'专家',minPoints:600,comment:'学识渊博，无人能敌！'},
                    {name:'大师',minPoints:1000,comment:'登峰造极，一代宗师！'}
                ],
                aiApiUrl:'https://open.bigmodel.cn/api/paas/v4/chat/completions',aiApiKey:'a2c7cedcd0c64b74abf9967d85ba3d4c.lRKWx5uvKXz7Gn6B',aiModel:'glm-4.7-flash',
                soundEnabled:true,soundVolume:70,
                shuffleOptions:true,baseTimeout:30,charTimeoutCompensation:0.2,autoNext:true,drawAnimation:true,drawDuration:3
            });
        },
        setSettings:function(s){this.set('settings',s);if(s&&s.levels&&!this._syncSilent)App.Sync.notifyChange('levels',s.levels)},
        getGroups:function(){
            var students=this.getStudents();
            var groups={};
            students.forEach(function(s){if(s.group&&s.group.trim())groups[s.group.trim()]=true});
            return Object.keys(groups).sort();
        }
    };

    function getLevel(pts){
        var lvls=App.Storage.getSettings().levels||[];
        var r={name:'新手',comment:'初出茅庐，继续加油！'};
        for(var i=lvls.length-1;i>=0;i--){if(pts>=lvls[i].minPoints){r={name:lvls[i].name,comment:lvls[i].comment};break}}
        return r;
    }

    function getStudentStats(studentId){
        var records=App.Storage.getRecords();
        var totalPoints=0,totalCorrect=0,totalCount=0,sessions=0;
        records.forEach(function(rec){
            var srs=rec.studentResults||{};
            var sr=srs[studentId];
            if(sr){
                totalPoints+=sr.pointsEarned||0;
                totalCorrect+=sr.correctCount||0;
                totalCount+=sr.totalCount||0;
                sessions++;
            }
        });
        return{totalPoints:totalPoints,totalCorrect:totalCorrect,totalCount:totalCount,sessions:sessions,accuracy:totalCount>0?Math.round(totalCorrect/totalCount*100):0};
    }

    function getAllStudentStats(){
        var students=App.Storage.getStudents();
        var records=App.Storage.getRecords();
        var statsMap={};
        students.forEach(function(s){statsMap[s.id]={totalPoints:0,totalCorrect:0,totalCount:0,sessions:0}});
        records.forEach(function(rec){
            var srs=rec.studentResults||{};
            Object.keys(srs).forEach(function(sid){
                if(statsMap[sid]){
                    statsMap[sid].totalPoints+=srs[sid].pointsEarned||0;
                    statsMap[sid].totalCorrect+=srs[sid].correctCount||0;
                    statsMap[sid].totalCount+=srs[sid].totalCount||0;
                    statsMap[sid].sessions++;
                }
            });
        });
        Object.keys(statsMap).forEach(function(sid){
            var st=statsMap[sid];
            st.accuracy=st.totalCount>0?Math.round(st.totalCorrect/st.totalCount*100):0;
        });
        return statsMap;
    }

    App.Effects = {
        audioCtx:null,soundEnabled:true,volume:0.7,bgParticles:[],confetti:[],
        init:function(){
            var s=App.Storage.getSettings();this.soundEnabled=s.soundEnabled!==false;
            this.volume=(s.soundVolume||70)/100;this.initBgCanvas();this.initFxCanvas();this.updateSoundToggle();
        },
        getAudioCtx:function(){if(!this.audioCtx)this.audioCtx=new(window.AudioContext||window.webkitAudioContext)();return this.audioCtx},
        toggleSound:function(){this.soundEnabled=!this.soundEnabled;var s=App.Storage.getSettings();s.soundEnabled=this.soundEnabled;App.Storage.setSettings(s);this.updateSoundToggle();if(this.soundEnabled)this.playClick()},
        updateSoundToggle:function(){var el=document.getElementById('sound-toggle');if(el)el.textContent=this.soundEnabled?'🔊':'🔇'},
        playTone:function(freq,dur,type,vol){if(!this.soundEnabled)return;try{var ctx=this.getAudioCtx(),osc=ctx.createOscillator(),g=ctx.createGain();osc.type=type||'sine';osc.frequency.value=freq;g.gain.value=(vol||0.3)*this.volume;g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);osc.connect(g);g.connect(ctx.destination);osc.start(ctx.currentTime);osc.stop(ctx.currentTime+dur)}catch(e){}},
        playClick:function(){this.playTone(800,0.08,'square',0.15)},
        playDrumRoll:function(){if(!this.soundEnabled)return;try{var ctx=this.getAudioCtx(),count=0;var iv=setInterval(function(){if(count>20){clearInterval(iv);return}var o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=200+Math.random()*100;g.gain.value=0.15*App.Effects.volume;g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.05);count++},60)}catch(e){}},
        playFanfare:function(){if(!this.soundEnabled)return;var self=this;[523,659,784,1047].forEach(function(f,i){setTimeout(function(){self.playTone(f,0.3,'sine',0.25)},i*120)})},
        playCorrect:function(){if(!this.soundEnabled)return;var self=this;self.playTone(880,0.15,'sine',0.3);setTimeout(function(){self.playTone(1175,0.25,'sine',0.3)},120)},
        playWrong:function(){this.playTone(200,0.4,'sawtooth',0.2)},
        playCountdown:function(){this.playTone(440,0.1,'sine',0.15)},
        playTimeUp:function(){if(!this.soundEnabled)return;var self=this;self.playTone(300,0.3,'sawtooth',0.25);setTimeout(function(){self.playTone(200,0.5,'sawtooth',0.25)},200)},
        playVictory:function(){if(!this.soundEnabled)return;var self=this;var notes=[523,659,784,1047,784,1047];notes.forEach(function(f,i){setTimeout(function(){self.playTone(f,0.25,'sine',0.3)},i*150)})},
        initBgCanvas:function(){var canvas=document.getElementById('bg-canvas');if(!canvas)return;var ctx=canvas.getContext('2d'),self=this;function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight}resize();window.addEventListener('resize',resize);self.bgParticles=[];for(var i=0;i<60;i++){self.bgParticles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+0.5,dx:(Math.random()-0.5)*0.5,dy:(Math.random()-0.5)*0.5,alpha:Math.random()*0.5+0.1,color:['108,92,231','168,85,247','6,182,212','244,114,182'][Math.floor(Math.random()*4)]})}function animate(){ctx.clearRect(0,0,canvas.width,canvas.height);var grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,0,canvas.width/2,canvas.height/2,canvas.width*0.7);grad.addColorStop(0,'rgba(20,20,50,0.3)');grad.addColorStop(1,'rgba(10,10,26,0.1)');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);self.bgParticles.forEach(function(p){p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=canvas.width;if(p.x>canvas.width)p.x=0;if(p.y<0)p.y=canvas.height;if(p.y>canvas.height)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba('+p.color+','+p.alpha+')';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*3,0,Math.PI*2);ctx.fillStyle='rgba('+p.color+','+(p.alpha*0.15)+')';ctx.fill()});for(var i=0;i<self.bgParticles.length;i++){for(var j=i+1;j<self.bgParticles.length;j++){var dx=self.bgParticles[i].x-self.bgParticles[j].x;var dy=self.bgParticles[i].y-self.bgParticles[j].y;var dist=Math.sqrt(dx*dx+dy*dy);if(dist<150){ctx.beginPath();ctx.moveTo(self.bgParticles[i].x,self.bgParticles[i].y);ctx.lineTo(self.bgParticles[j].x,self.bgParticles[j].y);ctx.strokeStyle='rgba(108,92,231,'+(0.08*(1-dist/150))+')';ctx.lineWidth=0.5;ctx.stroke()}}}requestAnimationFrame(animate)}animate()},
        initFxCanvas:function(){var canvas=document.getElementById('fx-canvas');if(!canvas)return;var ctx=canvas.getContext('2d'),self=this;function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight}resize();window.addEventListener('resize',resize);self.confetti=[];function animate(){ctx.clearRect(0,0,canvas.width,canvas.height);self.confetti=self.confetti.filter(function(c){return c.life>0});self.confetti.forEach(function(c){c.x+=c.vx;c.y+=c.vy;c.vy+=0.15;c.rotation+=c.rotSpeed;c.life-=1;var alpha=Math.min(1,c.life/30);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rotation*Math.PI/180);ctx.fillStyle=c.color.replace('1)',alpha+')');ctx.fillRect(-c.w/2,-c.h/2,c.w,c.h);ctx.restore()});requestAnimationFrame(animate)}animate()},
        spawnConfetti:function(x,y,count){count=count||50;var colors=['rgba(108,92,231,1)','rgba(168,85,247,1)','rgba(6,182,212,1)','rgba(244,114,182,1)','rgba(251,191,36,1)','rgba(34,197,94,1)','rgba(239,68,68,1)','rgba(59,130,246,1)'];for(var i=0;i<count;i++){this.confetti.push({x:x||window.innerWidth/2,y:y||window.innerHeight/3,vx:(Math.random()-0.5)*12,vy:-Math.random()*10-3,w:Math.random()*8+4,h:Math.random()*6+2,rotation:Math.random()*360,rotSpeed:(Math.random()-0.5)*10,color:colors[Math.floor(Math.random()*colors.length)],life:Math.random()*60+60})}},
        showScorePopup:function(pts,isCorrect){var el=document.createElement('div');el.className='score-popup '+(isCorrect?'positive':'negative');el.textContent=isCorrect?'+'+pts:'✗';document.body.appendChild(el);setTimeout(function(){el.remove()},1200)}
    };

    App.Modal = {
        open:function(title,bodyHTML,footerHTML){document.getElementById('modal-title').textContent=title;document.getElementById('modal-body').innerHTML=bodyHTML;document.getElementById('modal-footer').innerHTML=footerHTML||'';document.getElementById('modal-overlay').classList.add('active')},
        close:function(){document.getElementById('modal-overlay').classList.remove('active')},
        closeOnOverlay:function(e){if(e.target===document.getElementById('modal-overlay'))this.close()}
    };

    App.Toast = {
        container:null,
        init:function(){this.container=document.createElement('div');this.container.className='toast-container';document.body.appendChild(this.container)},
        show:function(msg,type){type=type||'info';var el=document.createElement('div');el.className='toast '+type;el.textContent=msg;this.container.appendChild(el);setTimeout(function(){el.remove()},3000)}
    };

    App.Students = {
        _sortBy:'points',
        _sortDir:'desc',
        _filterGroup:'',
        render:function(){
            var students=App.Storage.getStudents();
            var wrap=document.getElementById('student-table-wrap');
            var empty=document.getElementById('students-empty');
            if(students.length===0){wrap.innerHTML='';empty.classList.add('show');return}
            empty.classList.remove('show');
            var statsMap=getAllStudentStats();
            var groups=App.Storage.getGroups();
            var filterHTML='<div class="student-filters">';
            filterHTML+='<select id="sf-group" onchange="App.Students._filterGroup=this.value;App.Students.render()"><option value="">全部小组</option>';
            groups.forEach(function(g){filterHTML+='<option value="'+g+'"'+(this._filterGroup===g?' selected':'')+'>'+g+'</option>'}.bind(this));
            filterHTML+='</select>';
            filterHTML+='<select id="sf-sort" onchange="App.Students._sortBy=this.value;App.Students.render()">';
            filterHTML+='<option value="points"'+(this._sortBy==='points'?' selected':'')+'>按积分</option>';
            filterHTML+='<option value="accuracy"'+(this._sortBy==='accuracy'?' selected':'')+'>按正确率</option>';
            filterHTML+='<option value="name"'+(this._sortBy==='name'?' selected':'')+'>按姓名</option>';
            filterHTML+='<option value="sessions"'+(this._sortBy==='sessions'?' selected':'')+'>按场次</option>';
            filterHTML+='</select>';
            filterHTML+='<button class="btn-sm" onclick="App.Students._sortDir=App.Students._sortDir===\'desc\'?\'asc\':\'desc\';App.Students.render()" title="切换排序方向">'+(this._sortDir==='desc'?'↓ 降序':'↑ 升序')+'</button>';
            filterHTML+='</div>';
            var filtered=students;
            if(this._filterGroup){filtered=filtered.filter(function(s){return s.group===this._filterGroup}.bind(this))}
            filtered=filtered.map(function(s){
                var st=statsMap[s.id]||{totalPoints:0,accuracy:0,sessions:0,totalCorrect:0,totalCount:0};
                return{id:s.id,name:s.name,avatar:s.avatar,gender:s.gender,group:s.group,totalPoints:st.totalPoints,accuracy:st.accuracy,sessions:st.sessions,totalCorrect:st.totalCorrect,totalCount:st.totalCount};
            });
            var self=this;
            filtered.sort(function(a,b){
                var dir=self._sortDir==='desc'?-1:1;
                if(self._sortBy==='points')return(a.totalPoints-b.totalPoints)*dir;
                if(self._sortBy==='accuracy')return(a.accuracy-b.accuracy)*dir;
                if(self._sortBy==='sessions')return(a.sessions-b.sessions)*dir;
                return a.name.localeCompare(b.name,'zh-CN')*dir;
            });
            var html=filterHTML;
            html+='<table class="student-table readonly"><thead><tr>';
            html+='<th>头像</th><th>姓名</th><th>积分</th><th>等级</th><th>正确率</th><th>性别</th><th>小组</th><th>场次</th>';
            html+='</tr></thead><tbody>';
            filtered.forEach(function(s){
                var lv=getLevel(s.totalPoints);
                html+='<tr data-id="'+s.id+'">';
                html+='<td><div class="st-avatar-cell">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div></td>';
                html+='<td class="st-name-readonly">'+s.name+'</td>';
                html+='<td class="st-points-readonly" onclick="App.Students.showPointsDetail(\''+s.id+'\')" title="点击查看积分详情">⭐ '+s.totalPoints+'</td>';
                html+='<td><span class="st-level-badge">'+lv.name+'</span></td>';
                html+='<td>'+(s.totalCount>0?s.accuracy+'%':'-')+'</td>';
                html+='<td>'+(s.gender||'-')+'</td>';
                html+='<td>'+(s.group||'-')+'</td>';
                html+='<td>'+s.sessions+'</td>';
                html+='</tr>';
            });
            html+='</tbody></table>';
            wrap.innerHTML=html;
        },
        showPointsDetail:function(id){
            var students=App.Storage.getStudents();
            var student=students.find(function(s){return s.id===id});
            if(!student)return;
            var st=getStudentStats(id);
            var lv=getLevel(st.totalPoints);
            var history=App.Records.getStudentHistory(id);
            var body='<div class="student-history-modal">';
            body+='<div style="text-align:center;margin-bottom:20px">';
            body+='<div class="lb-avatar" style="width:64px;height:64px;font-size:28px;margin:0 auto 10px">'+(student.avatar?'<img src="'+student.avatar+'">':student.name.charAt(0))+'</div>';
            body+='<div style="font-size:22px;font-weight:800">'+student.name+'</div>';
            body+='<div style="color:var(--gold);font-weight:600">'+lv.name+' - '+lv.comment+'</div>';
            body+='<div style="font-size:28px;font-weight:900;color:var(--accent-2);margin-top:8px">⭐ '+st.totalPoints+' 分</div>';
            body+='<div style="font-size:14px;color:var(--text-muted);margin-top:4px">正确率 '+st.accuracy+'% · 共参加 '+st.sessions+' 场挑战</div>';
            body+='</div>';
            if(history.length===0){
                body+='<div style="text-align:center;color:var(--text-muted);padding:20px">暂无挑战记录</div>';
            }else{
                history.forEach(function(h){
                    var modeLabel=h.mode==='draw'?'🎲 多人挑战':h.mode==='assign'?'👤 单人挑战':h.mode==='pk'?'⚔️ PK':h.mode==='farm'?'🌾 打野':h.mode==='challenge'?'🎯 挑战':'🎮 未知';
                    var dateStr=new Date(h.date).toLocaleString('zh-CN');
                    var bankStr=h.bankNames.join('、')||'未知题库';
                    var pct=h.totalCount>0?Math.round(h.correctCount/h.totalCount*100):0;
                    body+='<div class="sh-session">';
                    body+='<div class="sh-session-header"><span class="sh-session-time">'+modeLabel+' · '+dateStr+'</span><span class="sh-session-score">+'+h.pointsEarned+' 分</span></div>';
                    body+='<div class="sh-session-detail">📚 '+bankStr+'</div>';
                    if(h.mode==='pk'||h.mode==='group'){
                        body+='<div class="sh-session-detail">'+(h.mode==='pk'?'PK':'小组')+'得分：'+h.pkScore+' 分</div>';
                    }else{
                        body+='<div class="sh-session-detail">答对 '+h.correctCount+'/'+h.totalCount+' · 正确率 '+pct+'%</div>';
                    }
                    body+='</div>';
                });
            }
            body+='</div>';
            App.Modal.open('📊 '+student.name+' 的积分详情',body,'');
        }
    };

    App.Questions = {
        render:function(){var banks=App.Storage.getBanks();var grid=document.getElementById('bank-grid');var empty=document.getElementById('banks-empty');if(banks.length===0){grid.innerHTML='';empty.classList.add('show');return}empty.classList.remove('show');var html='';banks.forEach(function(b){html+='<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-header"><div><div class="bc-name">'+b.name+'</div><div class="bc-count">('+b.questions.length+'道题)</div></div></div><div class="bc-desc">'+(b.description||'暂无描述')+'</div><div class="bc-actions"><button onclick="App.Questions.openBankManager(\''+b.id+'\')">📋 编辑预览</button><button onclick="App.Questions.showAddQuestionDialog(\''+b.id+'\')">➕ 添加题目</button><button onclick="App.Questions.showImportQuestionsDialog(\''+b.id+'\')">📥 导入题目</button><button class="btn-del" onclick="App.Questions.removeBank(\''+b.id+'\')">🗑️ 删除</button></div></div>'});grid.innerHTML=html},
        renderBankSelect:function(){var banks=App.Storage.getBanks();var info=document.getElementById('exam-bank-info');if(!info)return;if(banks.length===0){info.textContent='暂无题库，请先创建';return}var lastIds=App.Storage.getSettings()._lastBankIds||[];var matched=banks.filter(function(b){return lastIds.indexOf(b.id)>=0});if(matched.length>0){info.textContent=matched.map(function(b){return b.name}).join('、')+'（'+matched.reduce(function(s,b){return s+b.questions.length},0)+' 题）'}else{info.textContent='点击选择题库'}},
        showBankSelectModal:function(){var banks=App.Storage.getBanks();if(banks.length===0){App.Toast.show('暂无题库，请先在题库中创建','warning');return}var lastIds=App.Storage.getSettings()._lastBankIds||[];var body='<div class="bank-modal-grid">';banks.forEach(function(b){var sel=lastIds.indexOf(b.id)>=0?' selected':'';body+='<div class="bank-modal-item'+sel+'" data-bank-id="'+b.id+'" onclick="App.Questions.toggleModalBank(this)">';body+='<span class="bank-modal-check">'+(sel?'✓':'')+'</span>';body+='<span class="bank-modal-name">'+b.name+'</span>';body+='<span class="bank-modal-count">'+b.questions.length+' 题</span>';body+='</div>'});body+='</div>';var footer='<button class="btn-secondary" onclick="App.Questions.selectAllModalBanks()">全选/取消</button><button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.confirmBankSelect()">确定</button>';App.Modal.open('📚 选择题库',body,footer)},
        toggleModalBank:function(el){el.classList.toggle('selected');el.querySelector('.bank-modal-check').textContent=el.classList.contains('selected')?'✓':'';App.Effects.playClick()},
        selectAllModalBanks:function(){var items=document.querySelectorAll('.bank-modal-item');var allSel=true;items.forEach(function(el){if(!el.classList.contains('selected'))allSel=false});items.forEach(function(el){if(allSel){el.classList.remove('selected');el.querySelector('.bank-modal-check').textContent=''}else{if(!el.classList.contains('selected')){el.classList.add('selected');el.querySelector('.bank-modal-check').textContent='✓'}}});App.Effects.playClick()},
        confirmBankSelect:function(){var ids=[];document.querySelectorAll('.bank-modal-item.selected').forEach(function(el){ids.push(el.dataset.bankId)});if(ids.length===0){App.Toast.show('请至少选择一个题库','warning');return}var settings=App.Storage.getSettings();settings._lastBankIds=ids;App.Storage.setSettings(settings);App.Modal.close();this.renderBankSelect();App.Effects.playClick()},
        getSelectedBankIds:function(){var lastIds=App.Storage.getSettings()._lastBankIds||[];return lastIds},
        toggleBankSelect:function(el){el.classList.toggle('selected');el.querySelector('.check-mark').textContent=el.classList.contains('selected')?'✓':'';App.Effects.playClick()},
        showAddBankDialog:function(){var body='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" placeholder="请输入题库名称"></div><div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" placeholder="简要描述（可选）"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.addBank()">创建</button>';App.Modal.open('新建题库',body,footer)},
        addBank:function(){var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}var desc=document.getElementById('inp-bank-desc').value.trim();var banks=App.Storage.getBanks();banks.push({id:genId(),name:name,description:desc,questions:[],createdAt:Date.now(),_newFile:true});App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('题库 '+name+' 创建成功','success')},
        showEditBankDialog:function(id){var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;var body='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" value="'+b.name+'"></div><div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" value="'+(b.description||'')+'"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.updateBank(\''+id+'\')">保存</button>';App.Modal.open('编辑题库',body,footer)},
        updateBank:function(id){var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}var desc=document.getElementById('inp-bank-desc').value.trim();var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;b.name=name;b.description=desc;App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('题库信息已更新','success')},
        removeBank:function(id){if(!confirm('确定要删除该题库及其所有题目吗？'))return;var banks=App.Storage.getBanks();var deleted=banks.find(function(x){return x.id===id});var remaining=banks.filter(function(x){return x.id!==id});App.Storage.setBanks(remaining);if(deleted)App.Sync.deleteBank(deleted.id||deleted.name);this.render();App.Toast.show('题库已删除','info')},
        openBankManager:function(id){var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;var body='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" value="'+b.name.replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" value="'+(b.description||'').replace(/"/g,'&quot;')+'"></div><hr style="border-color:rgba(108,92,231,0.2);margin:12px 0"><div class="question-preview-list">';b.questions.forEach(function(q,i){body+='<div class="qp-item"><div class="qp-text">'+(i+1)+'. '+q.text+'</div><div class="qp-options">';['A','B','C','D'].forEach(function(l){if(q.options[l])body+='<span style="margin-right:12px">'+l+'. '+q.options[l]+'</span>'});body+='</div><div class="qp-answer">正确答案：'+q.answer+' | 分值：'+q.points+'分</div><div class="qp-actions"><button class="btn-sm" onclick="App.Questions.editQuestion(\''+id+'\',\''+q.id+'\')">✏️ 编辑</button><button class="btn-sm btn-del" onclick="App.Questions.deleteQuestion(\''+id+'\',\''+q.id+'\')">🗑️ 删除</button></div></div>'});body+='</div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-primary" onclick="App.Questions.updateBankFromManager(\''+id+'\')">💾 保存题库信息</button>';App.Modal.open('📋 '+b.name+' ('+b.questions.length+'道题)',body,footer)},
        updateBankFromManager:function(id){var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}var desc=document.getElementById('inp-bank-desc').value.trim();var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;b.name=name;b.description=desc;App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('题库信息已更新','success')},
        editQuestion:function(bankId,qId){var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var q=bank.questions.find(function(x){return x.id===qId});if(!q)return;var body='<div class="form-group"><label>题目内容</label><textarea id="inp-eq-text" rows="3">'+q.text+'</textarea></div><div class="form-group"><label>选项A</label><input type="text" id="inp-eq-a" value="'+(q.options.A||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项B</label><input type="text" id="inp-eq-b" value="'+(q.options.B||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项C</label><input type="text" id="inp-eq-c" value="'+(q.options.C||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项D</label><input type="text" id="inp-eq-d" value="'+(q.options.D||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>正确答案</label><select id="inp-eq-answer"><option value="A"'+(q.answer==='A'?' selected':'')+'>A</option><option value="B"'+(q.answer==='B'?' selected':'')+'>B</option><option value="C"'+(q.answer==='C'?' selected':'')+'>C</option><option value="D"'+(q.answer==='D'?' selected':'')+'>D</option></select></div><div class="form-group"><label>分值</label><input type="number" id="inp-eq-points" value="'+q.points+'" min="1" max="100" style="width:80px"></div>';var footer='<button class="btn-secondary" onclick="App.Questions.openBankManager(\''+bankId+'\')">取消</button><button class="btn-primary" onclick="App.Questions.saveEditQuestion(\''+bankId+'\',\''+qId+'\')">保存</button>';App.Modal.open('✏️ 编辑题目',body,footer)},
        saveEditQuestion:function(bankId,qId){var text=document.getElementById('inp-eq-text').value.trim();if(!text){App.Toast.show('请输入题目内容','warning');return}var a=document.getElementById('inp-eq-a').value.trim();var b=document.getElementById('inp-eq-b').value.trim();if(!a||!b){App.Toast.show('至少填写选项A和B','warning');return}var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var q=bank.questions.find(function(x){return x.id===qId});if(!q)return;q.text=text;q.options={A:a,B:b,C:document.getElementById('inp-eq-c').value.trim(),D:document.getElementById('inp-eq-d').value.trim()};q.answer=document.getElementById('inp-eq-answer').value;q.points=parseInt(document.getElementById('inp-eq-points').value)||10;App.Storage.setBanks(banks);App.Modal.close();this.openBankManager(bankId);App.Toast.show('题目已更新','success')},
        deleteQuestion:function(bankId,qId){if(!confirm('确定要删除这道题目吗？'))return;var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;bank.questions=bank.questions.filter(function(q){return q.id!==qId});App.Storage.setBanks(banks);App.Modal.close();this.openBankManager(bankId);this.render();App.Toast.show('题目已删除','info')},
        showAddQuestionDialog:function(bankId){var body='<div class="form-group"><label>题目内容</label><textarea id="inp-q-text" placeholder="请输入题目内容" rows="3"></textarea></div><div class="form-group"><label>选项A</label><input type="text" id="inp-q-a" placeholder="选项A内容"></div><div class="form-group"><label>选项B</label><input type="text" id="inp-q-b" placeholder="选项B内容"></div><div class="form-group"><label>选项C</label><input type="text" id="inp-q-c" placeholder="选项C内容"></div><div class="form-group"><label>选项D</label><input type="text" id="inp-q-d" placeholder="选项D内容"></div><div class="form-group"><label>正确答案</label><select id="inp-q-answer"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div><div class="form-group"><label>分值</label><input type="number" id="inp-q-points" value="10" min="1" max="100" style="width:80px"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.addQuestion(\''+bankId+'\')">添加</button>';App.Modal.open('添加题目',body,footer)},
        addQuestion:function(bankId){var text=document.getElementById('inp-q-text').value.trim();if(!text){App.Toast.show('请输入题目内容','warning');return}var a=document.getElementById('inp-q-a').value.trim();var b=document.getElementById('inp-q-b').value.trim();var c=document.getElementById('inp-q-c').value.trim();var d=document.getElementById('inp-q-d').value.trim();if(!a||!b){App.Toast.show('至少填写选项A和B','warning');return}var answer=document.getElementById('inp-q-answer').value;var points=parseInt(document.getElementById('inp-q-points').value)||10;var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;bank.questions.push({id:genId(),text:text,options:{A:a,B:b,C:c||'',D:d||''},answer:answer,points:points});App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('题目添加成功','success')},
        showImportQuestionsDialog:function(bankId){var body='<div class="import-format-hint">导入格式说明：每行一道题<br>格式：<code>题目|选项A|选项B|选项C|选项D|正确答案|分值</code><br>示例：<code>1+1=?|1|2|3|4|B|10</code></div><div class="form-group"><label>粘贴题目数据</label><textarea id="inp-import-questions" placeholder="每行一道题" rows="8"></textarea></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doImportQuestions(\''+bankId+'\')">导入</button>';App.Modal.open('导入题目',body,footer)},
        doImportQuestions:function(bankId){var text=document.getElementById('inp-import-questions').value.trim();if(!text){App.Toast.show('请输入题目数据','warning');return}var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var lines=text.split('\n'),count=0;lines.forEach(function(line){line=line.trim();if(!line)return;var p=line.split('|');if(p.length>=6){bank.questions.push({id:genId(),text:p[0].trim(),options:{A:p[1].trim(),B:p[2].trim(),C:p[3].trim(),D:p[4].trim()},answer:p[5].trim().toUpperCase(),points:parseInt(p[6])||10});count++}});App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('成功导入 '+count+' 道题目','success')},
        showAIDialog:function(){var body='<div class="form-group"><label>题目主题/知识点</label><textarea id="inp-ai-topic" placeholder="请描述要生成的题目主题，越详细越好" rows="4" maxlength="2000"></textarea><div style="text-align:right;font-size:11px;color:#666;margin-top:2px"><span id="ai-topic-count">0</span>/2000</div></div><div class="form-group"><label>题目数量</label><input type="number" id="inp-ai-count" value="5" min="1" max="30" style="width:80px"> <span class="form-hint">1~30题</span></div><div class="form-group"><label>题库名称 <span style="color:#888;font-weight:normal">（留空则AI自动命名）</span></label><input type="text" id="inp-ai-bank-name" placeholder="AI将根据主题自动生成名称"></div><div id="ai-status" class="ai-status" style="display:none"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" id="btn-ai-gen" onclick="App.Questions.generateAIQuestions()">🤖 生成</button>';App.Modal.open('🤖 AI生成题目',body,footer);var ta=document.getElementById('inp-ai-topic');if(ta){ta.addEventListener('input',function(){var c=document.getElementById('ai-topic-count');if(c)c.textContent=ta.value.length})}},
        generateAIQuestions:function(){var s=App.Storage.getSettings();if(!s.aiApiKey||!s.aiApiUrl){App.Toast.show('请先在设置中配置AI API','warning');return}var topic=document.getElementById('inp-ai-topic').value.trim();if(!topic){App.Toast.show('请输入题目主题','warning');return}var count=parseInt(document.getElementById('inp-ai-count').value)||5;if(count<1)count=1;if(count>30)count=30;var userBankName=document.getElementById('inp-ai-bank-name').value.trim();var statusEl=document.getElementById('ai-status');statusEl.style.display='block';statusEl.className='ai-status processing';statusEl.textContent='⏳ 正在生成题目，请稍候...';document.getElementById('btn-ai-gen').disabled=true;var prompt='你是一个专业的考试出题专家。请根据以下要求生成选择题：\n\n主题：'+topic+'\n数量：'+count+'道\n\n要求：\n1. 每道题必须有4个选项(A/B/C/D)，且只有一个正确答案\n2. 题目内容要准确、专业，选项要有迷惑性\n3. 分值默认10分，可根据难度调整(5/10/15/20)\n4. 如果用户没有指定题库名称，请根据主题生成一个简短贴切的题库名称\n\n请严格按照以下JSON格式返回，不要添加任何其他文字：\n{"bankName":"题库名称","questions":[{"text":"题目内容","options":{"A":"选项A","B":"选项B","C":"选项C","D":"选项D"},"answer":"B","points":10}]}\n\n注意：只返回这个JSON对象，不要返回任何解释或额外内容。';try{fetch(s.aiApiUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.aiApiKey},body:JSON.stringify({model:s.aiModel||'glm-4.7-flash',messages:[{role:'user',content:prompt}],temperature:0.7})}).then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json()}).then(function(data){var content='';if(data.choices&&data.choices[0]&&data.choices[0].message){content=data.choices[0].message.content||''}else if(data.output){content=data.output.text||data.output||''}else if(typeof data==='string'){content=data}content=content.trim();if(content.startsWith('```')){content=content.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')}var jsonMatch=content.match(/\{[\s\S]*\}/);if(!jsonMatch)throw new Error('AI返回内容无法解析为JSON');var result=JSON.parse(jsonMatch[0]);var questions=result.questions||result;var bankName=userBankName||result.bankName||'AI生成题库';if(!Array.isArray(questions))throw new Error('AI返回的题目格式不正确');var banks=App.Storage.getBanks();var newBank={id:genId(),name:bankName,description:'AI生成 - '+topic,questions:[],createdAt:Date.now(),_newFile:true};var validCount=0;questions.forEach(function(q){if(!q.text||!q.options||!q.answer)return;var opts={};if(typeof q.options==='object'){opts=q.options}else if(Array.isArray(q.options)){var keys=['A','B','C','D'];for(var oi=0;oi<Math.min(q.options.length,4);oi++){opts[keys[oi]]=String(q.options[oi])}}newBank.questions.push({id:genId(),text:q.text,options:opts,answer:String(q.answer).toUpperCase().charAt(0),points:parseInt(q.points)||10});validCount++});if(validCount===0)throw new Error('AI未生成有效题目');banks.push(newBank);App.Storage.setBanks(banks);App.Modal.close();App.Questions.render();App.Toast.show('成功生成 '+validCount+' 道题目 → '+bankName,'success')}).catch(function(err){statusEl.className='ai-status error';statusEl.textContent='❌ 生成失败：'+err.message;document.getElementById('btn-ai-gen').disabled=false})}catch(e){statusEl.className='ai-status error';statusEl.textContent='❌ 请求失败：'+e.message;document.getElementById('btn-ai-gen').disabled=false}},
        showImportBankDialog:function(){
            var body='<div class="import-format-hint">导入格式说明：第一行为题库名称，后续每行一道题<br>格式：<code>题库名称</code><br>题目格式：<code>题目|选项A|选项B|选项C|选项D|正确答案|分值</code></div>';
            body+='<div class="form-group"><label>粘贴题库数据</label><textarea id="inp-import-bank" placeholder="第一行：题库名称&#10;后续每行一道题" rows="8"></textarea></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doImportBank()">导入</button>';
            App.Modal.open('📥 导入题库',body,footer);
        },
        doImportBank:function(){
            var text=document.getElementById('inp-import-bank').value.trim();
            if(!text){App.Toast.show('请输入题库数据','warning');return}
            var lines=text.split('\n');
            var bankName=lines[0].trim()||'导入题库';
            var banks=App.Storage.getBanks();
            var newBank={id:genId(),name:bankName,description:'导入题库',questions:[],createdAt:Date.now(),_newFile:true};
            var count=0;
            for(var i=1;i<lines.length;i++){
                var line=lines[i].trim();
                if(!line)continue;
                var p=line.split('|');
                if(p.length>=6){
                    newBank.questions.push({id:genId(),text:p[0].trim(),options:{A:p[1].trim(),B:p[2].trim(),C:p[3].trim(),D:p[4].trim()},answer:p[5].trim().toUpperCase(),points:parseInt(p[6])||10});
                    count++;
                }
            }
            banks.push(newBank);
            App.Storage.setBanks(banks);
            App.Modal.close();this.render();
            App.Toast.show('成功导入题库「'+bankName+'」，共 '+count+' 道题目','success');
        },
        exportTemplate:function(){var template='题目|选项A|选项B|选项C|选项D|正确答案|分值\n1+1=?|1|2|3|4|B|10\n中国的首都是?|上海|北京|广州|深圳|B|10';var blob=new Blob([template],{type:'text/plain;charset=utf-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='题目导入模板.txt';a.click();URL.revokeObjectURL(url);App.Toast.show('模板已导出','success')}
    };

    App.Exam = {
        currentMode:'draw',currentExam:null,timerInterval:null,timeLeft:0,
        renderOptionsHTML:function(question){
            var settings=App.Storage.getSettings();
            var labels=['A','B','C','D'];
            var items=[];
            labels.forEach(function(l){if(question.options[l])items.push({label:l,text:question.options[l]})});
            if(settings.shuffleOptions){
                var shuffled=shuffle(items);
                var newOpts={};var newAnswer='';
                shuffled.forEach(function(item,i){
                    var newLabel=labels[i];
                    newOpts[newLabel]=item.text;
                    if(item.label===question.answer)newAnswer=newLabel;
                });
                question._shuffledOptions=newOpts;
                question._shuffledAnswer=newAnswer;
                items=shuffled.map(function(item,i){return{label:labels[i],text:item.text}});
            }else{
                delete question._shuffledOptions;delete question._shuffledAnswer;
            }
            var optsHTML='';
            items.forEach(function(item){optsHTML+='<button class="option-btn" data-option="'+item.label+'" onclick="App.Exam.selectOption(\''+item.label+'\')"><span class="option-label">'+item.label+'</span><span>'+item.text+'</span></button>'});
            return optsHTML;
        },
        getEffectiveAnswer:function(question){
            return question._shuffledAnswer||question.answer;
        },
        calcTimeout:function(questionText){
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            var base,charComp;
            if(baseInput&&document.getElementById('exam-setup')&&!document.getElementById('exam-setup').classList.contains('hidden')){
                base=parseFloat(baseInput.value)||0;
                charComp=parseFloat(charInput.value)||0;
            }else{
                var settings=App.Storage.getSettings();
                base=settings.baseTimeout!==undefined?settings.baseTimeout:30;
                charComp=settings.charTimeoutCompensation!==undefined?settings.charTimeoutCompensation:0.2;
            }
            if(base<=0&&charComp<=0)return 0;
            var charCount=(questionText||'').length;
            return Math.round(base+charCount*charComp);
        },
        checkResumableExam:function(){
            var progress=App.Storage.getExamProgress();
            if(!progress||!progress.questions||progress.questions.length===0)return false;
            var exam={
                mode:progress.mode,
                participationType:progress.participationType,
                questions:progress.questions,
                timeLimit:progress.timeLimit,
                autoNext:progress.autoNext,
                students:progress.students,
                currentIndex:progress.currentIndex,
                results:progress.results||[],
                playerScores:progress.playerScores||{},
                totalEarned:progress.totalEarned||0,
                playerQueue:progress.playerQueue,
                queueIndex:progress.queueIndex,
                avgQuestions:progress.avgQuestions,
                groupNames:progress.groupNames||[],
                groupRotation:progress.groupRotation||'alternate',
                groupMap:progress.groupMap||null,
                groupScores:progress.groupScores||null
            };
            if(progress.currentStudentId){
                var cs=exam.students.find(function(s){return s.id===progress.currentStudentId});
                if(cs)exam.currentStudent=cs;
            }
            this.currentExam=exam;
            document.getElementById('exam-mode-select').classList.add('hidden');
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.remove('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.add('in-exam');
            var labels=window.ParticipationLabels||{};
            var label=(labels[exam.participationType]&&labels[exam.participationType][exam.mode])||exam.mode;
            var navMode=document.getElementById('nav-exam-mode');if(navMode){navMode.textContent=label;navMode.classList.remove('hidden')}
            var navEnd=document.getElementById('nav-exam-end');if(navEnd)navEnd.classList.remove('hidden');
            if(!document.fullscreenElement){
                document.documentElement.requestFullscreen().catch(function(){});
            }
            this.renderWarReport(false);
            this.showQuestion();
            App.Toast.show('已恢复上次比赛','success');
            return true;
        },
        enterMode:function(mode){
            this.currentMode=mode;
            this.participationType='personal';
            document.getElementById('exam-mode-select').classList.add('hidden');
            document.getElementById('exam-setup').classList.remove('hidden');
            var titleEl=document.getElementById('setup-mode-title');
            var btnIcon=document.getElementById('btn-start-icon');
            var btnText=document.getElementById('btn-start-text');
            var groupArea=document.getElementById('exam-group-select-area');
            var studentArea=document.getElementById('exam-student-select-area');
            var rotationOpt=document.getElementById('opt-group-rotation');
            if(groupArea)groupArea.style.display='none';
            if(studentArea)studentArea.style.display='';
            if(rotationOpt)rotationOpt.style.display='none';
            this._updateModeTitle();
            btnText.textContent='开始';
            document.getElementById('ptab-personal').classList.add('active');
            document.getElementById('ptab-group').classList.remove('active');
            this.renderRulesPanel(mode,'personal');
            this.renderStudentSelect();App.Questions.renderBankSelect();
            var settings=App.Storage.getSettings();
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput)baseInput.value=settings.baseTimeout!==undefined?settings.baseTimeout:30;
            if(charInput)charInput.value=settings.charTimeoutCompensation!==undefined?settings.charTimeoutCompensation:0.2;
            App.Effects.playClick();
        },
        switchParticipation:function(type){
            this.participationType=type;
            var groupArea=document.getElementById('exam-group-select-area');
            var studentArea=document.getElementById('exam-student-select-area');
            var rotationOpt=document.getElementById('opt-group-rotation');
            document.getElementById('ptab-personal').classList.toggle('active',type==='personal');
            document.getElementById('ptab-group').classList.toggle('active',type==='group');
            if(type==='group'){
                if(groupArea)groupArea.style.display='';
                if(studentArea)studentArea.style.display='none';
                if(rotationOpt)rotationOpt.style.display='';
                this.renderGroupSelect();
            }else{
                if(groupArea)groupArea.style.display='none';
                if(studentArea)studentArea.style.display='';
                if(rotationOpt)rotationOpt.style.display='none';
            }
            this._updateModeTitle();
            this.renderRulesPanel(this.currentMode,type);
            App.Effects.playClick();
        },
        _updateModeTitle:function(){
            var mode=this.currentMode;
            var pType=this.participationType;
            var labels=window.ParticipationLabels||{};
            var label=(labels[pType]&&labels[pType][mode])||mode;
            var titleEl=document.getElementById('setup-mode-title');
            var btnIcon=document.getElementById('btn-start-icon');
            var studentTitleEl=document.getElementById('student-select-title');
            if(titleEl)titleEl.textContent=label;
            if(btnIcon){
                var icons={farm:'🌾',challenge:'🎯',pk:'⚔️'};
                btnIcon.textContent=icons[mode]||'🎮';
            }
            if(pType==='personal'){
                var titles={farm:'👥 参与人员',challenge:'👥 参与人员',pk:'⚔️ PK参赛选手（请选择2-8名）'};
                if(studentTitleEl)studentTitleEl.textContent=titles[mode]||'👥 参与人员';
            }
        },
        renderRulesPanel:function(mode,pType){
            var panel=document.getElementById('setup-rules-panel');
            if(!panel||!window.ModeRules)return;
            var rule=ModeRules[mode];
            if(!rule){panel.innerHTML='';return}
            var html='<div class="rules-card">';
            html+='<h4 class="rules-title">'+rule.title+' 规则</h4>';
            html+='<ul class="rules-list">';
            rule.rules.forEach(function(r){html+='<li>'+r+'</li>'});
            if(pType==='group'&&rule.groupExtra){html+='<li class="rules-group-extra">🏆 '+rule.groupExtra+'</li>'}
            html+='</ul>';
            if(window.CommonRules){
                html+='<h4 class="rules-title" style="margin-top:16px">通用规则</h4>';
                html+='<ul class="rules-list">';
                CommonRules.forEach(function(r){html+='<li>'+r+'</li>'});
                html+='</ul>';
            }
            html+='</div>';
            panel.innerHTML=html;
        },
        backToModes:function(){
            document.getElementById('exam-mode-select').classList.remove('hidden');
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.add('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
            App.Effects.playClick();
        },
        renderGroupSelect:function(){
            var groups=App.Storage.getGroups();
            var area=document.getElementById('exam-group-select-area');
            if(!area)return;
            if(groups.length===0){area.innerHTML='<h3 class="sub-title">👥 选择参赛小组</h3><p style="color:var(--text-muted);text-align:center;">暂无小组，请先在设置→学生中设置小组</p>';return}
            var html='<h3 class="sub-title">👥 选择参赛小组</h3><div class="group-select-list">';
            groups.forEach(function(g){
                html+='<div class="group-select-item" data-group-name="'+g+'" onclick="App.Exam.toggleGroupSelect(this)">';
                html+='<span class="group-name">🏆 '+g+'</span>';
                var students=App.Storage.getStudents().filter(function(s){return s.group===g});
                html+='<span class="group-count">'+students.length+' 人</span>';
                html+='<span class="check-mark"></span></div>';
            });
            html+='</div>';area.innerHTML=html;
        },
        toggleGroupSelect:function(el){el.classList.toggle('selected');el.querySelector('.check-mark').textContent=el.classList.contains('selected')?'✓':'';App.Effects.playClick()},
        getSelectedGroupNames:function(){var names=[];document.querySelectorAll('.group-select-item.selected').forEach(function(el){names.push(el.dataset.groupName)});return names},
        renderStudentSelect:function(){var students=App.Storage.getStudents();var list=document.getElementById('exam-student-list');if(students.length===0){list.innerHTML='<p style="color:var(--text-muted);text-align:center;">暂无学生，请先在设置→学生中添加</p>';return}var html='';students.forEach(function(s){html+='<div class="student-select-item" data-student-id="'+s.id+'" onclick="App.Exam.toggleStudentSelect(this)"><span>'+(s.avatar?'<img src="'+s.avatar+'" style="width:20px;height:20px;border-radius:50%;vertical-align:middle"> ':'')+' '+s.name+'</span><span class="check-mark"></span></div>'});list.innerHTML=html},
        toggleStudentSelect:function(el){var mode=this.currentMode;if(mode==='pk'){if(el.classList.contains('selected')){el.classList.remove('selected');el.querySelector('.check-mark').textContent=''}else{var count=document.querySelectorAll('.student-select-item.selected').length;if(count>=8){App.Toast.show('PK最多选择8名选手','warning');return}el.classList.add('selected');el.querySelector('.check-mark').textContent='✓'}}else{el.classList.toggle('selected');el.querySelector('.check-mark').textContent=el.classList.contains('selected')?'✓':''}App.Effects.playClick()},
        getSelectedStudentIds:function(){var ids=[];document.querySelectorAll('.student-select-item.selected').forEach(function(el){ids.push(el.dataset.studentId)});return ids},
        selectAllStudents:function(){var mode=this.currentMode;var items=document.querySelectorAll('.student-select-item');var allSelected=true;items.forEach(function(el){if(!el.classList.contains('selected'))allSelected=false});if(allSelected){items.forEach(function(el){el.classList.remove('selected');el.querySelector('.check-mark').textContent=''})}else if(mode==='pk'){var count=document.querySelectorAll('.student-select-item.selected').length;items.forEach(function(el){if(!el.classList.contains('selected')&&count<8){el.classList.add('selected');el.querySelector('.check-mark').textContent='✓';count++}})}else{items.forEach(function(el){if(!el.classList.contains('selected')){el.classList.add('selected');el.querySelector('.check-mark').textContent='✓'}})}App.Effects.playClick()},
        startExam:function(){
            var bankIds=App.Questions.getSelectedBankIds();
            if(bankIds.length===0){App.Toast.show('请至少选择一个题库','warning');return}
            var students=App.Storage.getStudents();
            if(students.length===0){App.Toast.show('请先添加学生','warning');return}
            var mode=this.currentMode;
            var pType=this.participationType;
            var selectedIds=this.getSelectedStudentIds();
            var groupNames=[];
            var examStudents;
            if(pType==='group'){
                groupNames=this.getSelectedGroupNames();
                if(groupNames.length<1){App.Toast.show('请至少选择1个小组','warning');return}
                if(mode==='pk'&&groupNames.length<2){App.Toast.show('PK模式请至少选择2个小组','warning');return}
                var groupStudentIds=[];
                groupNames.forEach(function(gn){students.forEach(function(s){if(s.group===gn)groupStudentIds.push(s.id)})});
                selectedIds=groupStudentIds;
                if(selectedIds.length<1){App.Toast.show('所选小组中没有学生','warning');return}
            }else{
                if(mode==='pk'){
                    if(selectedIds.length<2){App.Toast.show('PK请至少选择2名选手','warning');return}
                    if(selectedIds.length>8){App.Toast.show('PK最多8名选手','warning');return}
                }else{
                    if(selectedIds.length===0)selectedIds=students.map(function(s){return s.id});
                }
            }
            examStudents=students.filter(function(s){return selectedIds.indexOf(s.id)!==-1});
            var banks=App.Storage.getBanks(),allQ=[];
            bankIds.forEach(function(bid){var b=banks.find(function(x){return x.id===bid});if(b)allQ=allQ.concat(b.questions)});
            if(allQ.length===0){App.Toast.show('所选题库中没有题目','warning');return}
            var timeLimit=0;
            var autoNext=App.Storage.getSettings().autoNext!==false;
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput||charInput){
                var s=App.Storage.getSettings();
                if(baseInput)s.baseTimeout=parseFloat(baseInput.value)||0;
                if(charInput)s.charTimeoutCompensation=parseFloat(charInput.value)||0;
                App.Storage.setSettings(s);
            }
            var playerOrder=document.getElementById('exam-player-order').value;
            if(playerOrder==='fair'&&examStudents.length<3){App.Toast.show('公平随机至少需要3人','warning');return}
            if(playerOrder==='random'&&examStudents.length<2){App.Toast.show('真随机至少需要2人','warning');return}
            var questionOrder=document.getElementById('exam-question-order').value;
            var avgQuestions=parseInt(document.getElementById('exam-avg-questions').value)||5;
            var groupRotation=document.getElementById('exam-group-rotation').value;
            var totalQuestionsNeeded=avgQuestions*examStudents.length;
            var questionPool=this._buildQuestionPool(allQ,totalQuestionsNeeded,questionOrder);
            var playerQueue=this._buildPlayerQueue(examStudents,playerOrder,totalQuestionsNeeded,pType,groupNames,groupRotation);
            var exam={mode:mode,participationType:pType,questions:questionPool,timeLimit:timeLimit,autoNext:autoNext,students:examStudents,currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:playerQueue,queueIndex:0,avgQuestions:avgQuestions,groupNames:groupNames,groupRotation:groupRotation,playerOrder:playerOrder};
            if(pType==='group'){
                var groupMap={};examStudents.forEach(function(s){var g=s.group||'未分组';if(!groupMap[g])groupMap[g]=[];groupMap[g].push(s)});
                exam.groupMap=groupMap;exam.groupScores={};
                Object.keys(groupMap).forEach(function(g){exam.groupScores[g]=0});
            }
            examStudents.forEach(function(s){exam.playerScores[s.id]=0});
            this.currentExam=exam;
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            if(!document.fullscreenElement){
                document.documentElement.requestFullscreen().catch(function(){});
            }
            this._nextPlayer();
        },
        _buildQuestionPool:function(allQ,needed,order){
            if(order==='fair'){
                var pool=[];var idx=0;
                while(pool.length<needed){
                    var batch=allQ.slice().sort(function(){return Math.random()-0.5});
                    for(var i=0;i<batch.length&&pool.length<needed;i++){pool.push(batch[i])}
                }
                return pool;
            }else{
                var pool=[];
                for(var i=0;i<needed;i++){pool.push(allQ[Math.floor(Math.random()*allQ.length)])}
                return pool;
            }
        },
        _buildPlayerQueue:function(students,order,needed,pType,groupNames,groupRotation){
            if(pType==='group'){
                var groupMap={};
                students.forEach(function(s){var g=s.group||'未分组';if(!groupMap[g])groupMap[g]=[];groupMap[g].push(s)});
                var orderedGroups=groupNames.filter(function(g){return groupMap[g]});
                var shuffledGroups={};
                orderedGroups.forEach(function(g){shuffledGroups[g]=groupMap[g].slice().sort(function(){return Math.random()-0.5})});
                var queue=[];var gIdx=0;var inIdx={};
                orderedGroups.forEach(function(g){inIdx[g]=0});
                if(groupRotation==='alternate'){
                    while(queue.length<needed){
                        var g=orderedGroups[gIdx%orderedGroups.length];
                        var members=shuffledGroups[g];
                        if(members&&members.length>0){
                            queue.push(members[inIdx[g]%members.length]);
                            inIdx[g]++;
                        }
                        gIdx++;
                        var allDone=true;
                        for(var k in inIdx){if(inIdx[k]<needed){allDone=false;break}}
                        if(allDone)break;
                    }
                }else{
                    orderedGroups.forEach(function(g){
                        var members=shuffledGroups[g];
                        var count=0;
                        while(count<needed){
                            queue.push(members[count%members.length]);
                            count++;
                        }
                    });
                }
                return queue;
            }else{
                if(order==='order'){
                    var queue=[];var idx=0;
                    while(queue.length<needed){
                        queue.push(students[idx%students.length]);
                        idx++;
                    }
                    return queue;
                }else if(order==='fair'){
                    var queue=[];var shuffled=students.slice().sort(function(){return Math.random()-0.5});
                    var idx=0;
                    while(queue.length<needed){
                        queue.push(shuffled[idx%shuffled.length]);
                        idx++;
                    }
                    return queue;
                }else{
                    var queue=[];
                    for(var i=0;i<needed;i++){queue.push(students[Math.floor(Math.random()*students.length)])}
                    return queue;
                }
            }
        },
        _nextPlayer:function(){
            var exam=this.currentExam;
            if(exam.queueIndex>=exam.playerQueue.length||exam.currentIndex>=exam.questions.length){
                this.showResult();return;
            }
            var student=exam.playerQueue[exam.queueIndex];
            exam.currentStudent=student;
            exam.queueIndex++;
            exam.answered=false;
            this.renderWarReport(false);
            var settings=App.Storage.getSettings();
            var needDraw=settings.drawAnimation!==false&&exam.students.length>1&&exam.playerOrder!=='order';
            if(needDraw){
                document.getElementById('exam-drawing').classList.remove('hidden');
                document.getElementById('exam-playing').classList.add('hidden');
                this.startDrawing();
            }else{
                this.showQuestion();
            }
        },
        startDrawing:function(){var students=this.currentExam.students;if(students.length===0)return;var settings=App.Storage.getSettings();var drawDuration=(settings.drawDuration||3)*1000;var card=document.getElementById('drawing-card');var avatar=document.getElementById('drawing-avatar');var nameEl=document.getElementById('drawing-name');card.classList.add('spinning');card.classList.remove('revealed');App.Effects.playDrumRoll();var self=this,startTime=Date.now(),stopped=false;var finalStudent=this.currentExam.currentStudent;function animate(){var rs=students[Math.floor(Math.random()*students.length)];nameEl.textContent=rs.name;if(rs.avatar){avatar.innerHTML='<img src="'+rs.avatar+'">'}else{avatar.innerHTML='';avatar.textContent=rs.name.charAt(0)}var elapsed=Date.now()-startTime;var progress=Math.min(elapsed/drawDuration,1);if(progress>=1||stopped){setTimeout(function(){card.classList.remove('spinning');card.classList.add('revealed');nameEl.textContent=finalStudent.name;if(finalStudent.avatar){avatar.innerHTML='<img src="'+finalStudent.avatar+'">'}else{avatar.innerHTML='';avatar.textContent=finalStudent.name.charAt(0)}App.Effects.playFanfare();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/3,80);setTimeout(function(){self.showQuestion()},1800)},300);return}var delay=50+progress*200;setTimeout(animate,delay)}animate();this._drawingStop=function(){stopped=true}},
        stopDrawing:function(){if(this._drawingStop){this._drawingStop();this._drawingStop=null}},
        showQuestion:function(){
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.remove('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.add('in-exam');
            var exam=this.currentExam;
            var labels=window.ParticipationLabels||{};
            var label=(labels[exam.participationType]&&labels[exam.participationType][exam.mode])||exam.mode;
            var navMode=document.getElementById('nav-exam-mode');if(navMode){navMode.textContent=label;navMode.classList.remove('hidden')}
            var navEnd=document.getElementById('nav-exam-end');if(navEnd)navEnd.classList.remove('hidden');
            var student=exam.currentStudent;var question=exam.questions[exam.currentIndex];var st=getStudentStats(student.id);var level=getLevel(st.totalPoints);
            document.getElementById('exam-avatar').innerHTML=student.avatar?'<img src="'+student.avatar+'">':student.name.charAt(0);
            document.getElementById('exam-student-name').textContent=student.name;
            document.getElementById('exam-student-group').textContent=student.group?'('+student.group+')':'';
            document.getElementById('exam-student-level').textContent=level.name;
            document.getElementById('exam-student-comment').textContent=level.comment;
            document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[student.id]||0)+'⭐  累计：'+st.totalPoints+'⭐';
            document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 题 · 人均 '+(Math.round(exam.results.length/exam.students.length*10)/10)+'/'+exam.avgQuestions;
            document.getElementById('question-text').textContent=question.text;
            document.getElementById('question-options').innerHTML=this.renderOptionsHTML(question);
            var settings=App.Storage.getSettings();
            var cardEl=document.getElementById('question-card');
            if(cardEl&&settings.questionFontSize)cardEl.style.fontSize=settings.questionFontSize+'px';
            var nameEl=document.getElementById('exam-student-name');
            if(nameEl&&settings.studentNameFontSize)nameEl.style.fontSize=settings.studentNameFontSize+'px';
            var groupEl=document.getElementById('exam-student-group');
            if(groupEl&&settings.studentInfoFontSize)groupEl.style.fontSize=settings.studentInfoFontSize+'px';
            var levelEl=document.getElementById('exam-student-level');
            if(levelEl&&settings.studentInfoFontSize)levelEl.style.fontSize=settings.studentInfoFontSize+'px';
            var commentEl=document.getElementById('exam-student-comment');
            if(commentEl&&settings.studentInfoFontSize)commentEl.style.fontSize=settings.studentInfoFontSize+'px';
            var pointsEl=document.getElementById('exam-student-points');
            if(pointsEl&&settings.studentInfoFontSize)pointsEl.style.fontSize=settings.studentInfoFontSize+'px';
            document.getElementById('btn-next-question').style.display='none';this.startTimer(question.text);
        },
        toggleFullscreen:function(){
            if(!document.fullscreenElement){
                document.documentElement.requestFullscreen().catch(function(){});
            }else{
                document.exitFullscreen().catch(function(){});
            }
        },
        renderWarReport:function(expandCurrentGroup){
            var exam=this.currentExam;
            var container=document.getElementById('war-report-list');
            var sidebarTitle=document.getElementById('sidebar-title');
            if(!container)return;
            var settings=App.Storage.getSettings();
            var wrFs=settings.warReportFontSize||12;
            container.style.fontSize=wrFs+'px';
            if(exam.participationType==='group'){
                sidebarTitle.textContent='📊 小组战报';
                var gMap=exam.groupMap||{};
                var gScores=exam.groupScores||{};
                var gNames=exam.groupNames||Object.keys(gMap);
                var sortedGroups=gNames.slice().sort(function(a,b){return(gScores[b]||0)-(gScores[a]||0)});
                var groupCount=sortedGroups.length;
                var defaultShowCount=this._calcGroupMemberDisplay(groupCount);
                var html='';
                sortedGroups.forEach(function(gn,rank){
                    var score=gScores[gn]||0;
                    var isCurrent=exam.currentStudent&&exam.currentStudent.group===gn;
                    var members=(gMap[gn]||[]).slice().sort(function(a,b){return(exam.playerScores[b.id]||0)-(exam.playerScores[a.id]||0)});
                    var isExpanded=expandCurrentGroup&&isCurrent;
                    html+='<div class="war-report-item'+(isCurrent?' current-group':'')+(isExpanded?' expanded':'')+'">';
                    html+='<div class="war-report-header"><span class="war-report-group-name">'+(rank<3?['🥇','🥈','🥉'][rank]:'')+' '+gn+'</span><span class="war-report-group-score">'+score+' 分</span></div>';
                    html+='<div class="war-report-top3">';
                    var showCount=isExpanded?members.length:Math.min(defaultShowCount,members.length);
                    for(var i=0;i<showCount;i++){
                        var m=members[i];
                        var ps=exam.playerScores[m.id]||0;
                        html+='<div class="war-report-member"><span class="rank-badge">'+(i+1)+'</span><span class="member-name">'+m.name+'</span><span class="member-score">'+ps+'</span></div>';
                    }
                    html+='</div>';
                    if(!isExpanded&&members.length>defaultShowCount){
                        html+='<div class="war-report-expand-hint">共'+members.length+'人 · 答题后展开</div>';
                    }
                    html+='</div>';
                });
                container.innerHTML=html;
            }else{
                sidebarTitle.textContent='📊 个人战报';
                var students=exam.students.slice().sort(function(a,b){return(exam.playerScores[b.id]||0)-(exam.playerScores[a.id]||0)});
                var html='';
                students.forEach(function(s,i){
                    var isCurrent=exam.currentStudent&&s.id===exam.currentStudent.id;
                    var ps=exam.playerScores[s.id]||0;
                    var sr=exam.results.filter(function(r){return r.studentId===s.id});
                    var correct=sr.filter(function(r){return r.correct}).length;
                    html+='<div class="war-report-personal-item'+(isCurrent?' current-player':'')+'">';
                    html+='<span class="rp-rank">'+(i+1)+'</span>';
                    html+='<span class="rp-name">'+(s.avatar?'<img src="'+s.avatar+'" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">':'')+s.name+'</span>';
                    html+='<span class="rp-correct">'+correct+'/'+sr.length+'</span>';
                    html+='<span class="rp-score">'+ps+'</span>';
                    html+='</div>';
                });
                container.innerHTML=html;
            }
        },
        startTimer:function(questionText){
            var self=this,exam=this.currentExam;
            var fill=document.getElementById('timer-fill'),timerEl=document.getElementById('exam-timer');
            if(this.timerInterval)clearInterval(this.timerInterval);
            var timeLimit=this.calcTimeout(questionText);
            if(timeLimit<=0){fill.style.width='100%';fill.classList.remove('warning');timerEl.textContent='不限时';return}
            this.timeLeft=timeLimit;var totalTime=timeLimit;
            fill.style.width='100%';fill.classList.remove('warning');timerEl.textContent=this.timeLeft+'s';
            this.timerInterval=setInterval(function(){self.timeLeft--;var pct=(self.timeLeft/totalTime)*100;fill.style.width=pct+'%';timerEl.textContent=self.timeLeft+'s';if(self.timeLeft<=5){fill.classList.add('warning');App.Effects.playCountdown()}if(self.timeLeft<=0){clearInterval(self.timerInterval);self.timeUp()}},1000);
        },
        timeUp:function(){var exam=this.currentExam,question=exam.questions[exam.currentIndex];if(exam.answered)return;exam.answered=true;var correctAnswer=this.getEffectiveAnswer(question);document.querySelectorAll('.option-btn').forEach(function(btn){btn.classList.add('disabled');if(btn.dataset.option===correctAnswer)btn.classList.add('correct')});exam.results.push({studentId:exam.currentStudent.id,questionId:question.id,correct:false,pointsEarned:0,selectedOption:'超时'});App.Effects.playTimeUp();App.Effects.showScorePopup(0,false);this.renderWarReport(true);this._saveProgress();this.showNextButton()},
        selectOption:function(option){
            var exam=this.currentExam,question=exam.questions[exam.currentIndex];
            if(exam.answered)return;
            exam.answered=true;
            if(this.timerInterval)clearInterval(this.timerInterval);
            var correctAnswer=this.getEffectiveAnswer(question);
            var isCorrect=option===correctAnswer;
            document.querySelectorAll('.option-btn').forEach(function(btn){btn.classList.add('disabled');if(btn.dataset.option===correctAnswer)btn.classList.add('correct');if(btn.dataset.option===option&&!isCorrect)btn.classList.add('wrong')});
            var pointsEarned=0;
            if(isCorrect){
                pointsEarned=this._calcBasePoints(exam.mode);
                exam.totalEarned+=pointsEarned;
                exam.playerScores[exam.currentStudent.id]=(exam.playerScores[exam.currentStudent.id]||0)+pointsEarned;
                if(exam.participationType==='group'){var g=exam.currentStudent.group||'未分组';exam.groupScores[g]=(exam.groupScores[g]||0)+pointsEarned}
                App.Effects.playCorrect();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/2,40);App.Effects.showScorePopup(pointsEarned,true);
                var st=getStudentStats(exam.currentStudent.id);var tempPts=st.totalPoints+pointsEarned;var lv=getLevel(tempPts);document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐  累计：'+tempPts+'⭐';document.getElementById('exam-student-level').textContent=lv.name;document.getElementById('exam-student-comment').textContent=lv.comment
            }else{App.Effects.playWrong();App.Effects.showScorePopup(0,false)}
            exam.results.push({studentId:exam.currentStudent.id,questionId:question.id,correct:isCorrect,pointsEarned:pointsEarned,selectedOption:option});
            this.renderWarReport(true);this._saveProgress();this.showNextButton();
        },
        _calcBasePoints:function(mode){
            if(mode==='farm')return 10;
            if(mode==='challenge')return 5;
            if(mode==='pk')return 5;
            return 10;
        },
        _calcGroupMemberDisplay:function(groupCount){
            if(groupCount>=9)return 3;
            if(groupCount>=7)return 4;
            if(groupCount>=5)return 5;
            if(groupCount>=3)return 6;
            return 8;
        },
        _saveProgress:function(){
            var exam=this.currentExam;
            if(!exam)return;
            var progress={
                mode:exam.mode,
                participationType:exam.participationType,
                questions:exam.questions,
                timeLimit:exam.timeLimit,
                autoNext:exam.autoNext,
                students:exam.students,
                currentIndex:exam.currentIndex,
                results:exam.results,
                playerScores:exam.playerScores,
                totalEarned:exam.totalEarned,
                playerQueue:exam.playerQueue,
                queueIndex:exam.queueIndex,
                avgQuestions:exam.avgQuestions,
                groupNames:exam.groupNames,
                groupRotation:exam.groupRotation,
                groupMap:exam.groupMap||null,
                groupScores:exam.groupScores||null,
                currentStudentId:exam.currentStudent?exam.currentStudent.id:null,
                savedAt:Date.now()
            };
            App.Storage.setExamProgress(progress);
        },
        showNextButton:function(){var exam=this.currentExam;var btn=document.getElementById('btn-next-question');var undoBtn=document.getElementById('btn-undo-answer');btn.style.display='';undoBtn.style.display='';var isLast=exam.currentIndex>=exam.questions.length-1;btn.textContent=isLast?'查看结果 →':'下一题 →';btn.onclick=isLast?function(){App.Exam.showResult()}:function(){App.Exam.nextQuestion()};if(exam.autoNext){var delay=(App.Storage.getSettings().autoNextDelay||3)*1000;exam._autoNextTimer=setTimeout(isLast?function(){App.Exam.showResult()}:function(){App.Exam.nextQuestion()},delay)}},
        undoAnswer:function(){
            var exam=this.currentExam;if(!exam||!exam.answered)return;
            if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}
            var lastResult=exam.results.pop();
            if(!lastResult)return;
            if(lastResult.pointsEarned>0){
                exam.totalEarned-=lastResult.pointsEarned;
                exam.playerScores[lastResult.studentId]=(exam.playerScores[lastResult.studentId]||0)-lastResult.pointsEarned;
                if(exam.participationType==='group'){var g=exam.currentStudent.group||'未分组';exam.groupScores[g]=(exam.groupScores[g]||0)-lastResult.pointsEarned}
            }
            exam.answered=false;
            document.querySelectorAll('.option-btn').forEach(function(btn){btn.classList.remove('disabled','correct','wrong')});
            var undoBtn=document.getElementById('btn-undo-answer');undoBtn.style.display='none';
            var nextBtn=document.getElementById('btn-next-question');nextBtn.style.display='none';
            var st=getStudentStats(exam.currentStudent.id);var lv=getLevel(st.totalPoints);
            document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐  累计：'+st.totalPoints+'⭐';
            document.getElementById('exam-student-level').textContent=lv.name;
            document.getElementById('exam-student-comment').textContent=lv.comment;
            this.renderWarReport(false);this._saveProgress();
            var question=exam.questions[exam.currentIndex];
            this.startTimer(question.text);
            App.Toast.show('已撤销，请重新作答','info');
        },
        nextQuestion:function(){
            var exam=this.currentExam;if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}exam.currentIndex++;
            if(exam.currentIndex>=exam.questions.length){this.showResult();return}
            this._nextPlayer();
        },
        endExam:function(){var body='<p style="text-align:center;font-size:1.1em;padding:12px 0">确定要结束本次挑战吗？</p>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-danger" onclick="App.Modal.close();App.Exam._doEndExam()">⏹ 结束挑战</button>';App.Modal.open('⏹ 结束挑战',body,footer)},
        _doEndExam:function(){if(this.timerInterval)clearInterval(this.timerInterval);var navMode=document.getElementById('nav-exam-mode');if(navMode)navMode.classList.add('hidden');var navEnd=document.getElementById('nav-exam-end');if(navEnd)navEnd.classList.add('hidden');this.showResult()},
        showResult:function(){
            var exam=this.currentExam;if(!exam||exam._ended)return;exam._ended=true;
            if(this.timerInterval)clearInterval(this.timerInterval);
            if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.add('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
            var exam=this.currentExam;var correct=exam.results.filter(function(r){return r.correct}).length;
            var banks=App.Storage.getBanks();var bankNames=[];var bankIds=App.Questions.getSelectedBankIds();
            bankIds.forEach(function(bid){var b=banks.find(function(x){return x.id===bid});if(b)bankNames.push(b.name)});
            var studentResults={};
            exam.students.forEach(function(s){studentResults[s.id]={id:s.id,name:s.name,avatar:s.avatar,group:s.group||'',correctCount:0,totalCount:0,pointsEarned:0}});
            exam.results.forEach(function(r){if(studentResults[r.studentId]){studentResults[r.studentId].totalCount++;if(r.correct){studentResults[r.studentId].correctCount++;studentResults[r.studentId].pointsEarned+=r.pointsEarned}}});
            if(exam.mode==='challenge'){
                var sIds=Object.keys(studentResults);
                sIds.forEach(function(sid){
                    var sr=studentResults[sid];
                    if(sr.totalCount>0){
                        var acc=Math.round(sr.correctCount/sr.totalCount*100);
                        var bonusPerQ=0;
                        if(acc>=100)bonusPerQ=15;
                        else if(acc>=95)bonusPerQ=12;
                        else if(acc>=90)bonusPerQ=9;
                        else if(acc>=85)bonusPerQ=6;
                        if(bonusPerQ>0){
                            var bonus=bonusPerQ*sr.correctCount;
                            sr.pointsEarned+=bonus;
                            exam.playerScores[sid]=(exam.playerScores[sid]||0)+bonus;
                        }
                    }
                });
            }
            if(exam.mode==='pk'){
                var pScores=exam.playerScores||{};
                var pkIds=Object.keys(studentResults).filter(function(sid){return pScores[sid]!==undefined});
                if(pkIds.length>0){
                    var topId=pkIds.sort(function(a,b){return(pScores[b]||0)-(pScores[a]||0)})[0];
                    var bonus=studentResults[topId].pointsEarned;
                    studentResults[topId].pointsEarned+=bonus;
                    exam.playerScores[topId]=(exam.playerScores[topId]||0)+bonus;
                }
            }
            if(exam.participationType==='group'&&exam.groupScores){
                var gScores=exam.groupScores;
                var gNames=Object.keys(gScores);
                if(gNames.length>0){
                    var topGroup=gNames.sort(function(a,b){return gScores[b]-gScores[a]})[0];
                    var groupBonusIds=Object.keys(studentResults).filter(function(sid){return studentResults[sid].group===topGroup});
                    groupBonusIds.forEach(function(sid){
                        var sr=studentResults[sid];
                        var bonus=sr.correctCount*5;
                        if(bonus>0){sr.pointsEarned+=bonus;exam.playerScores[sid]=(exam.playerScores[sid]||0)+bonus}
                    });
                }
            }
            var questionDetails=[];
            exam.results.forEach(function(r,i){var question=null;banks.forEach(function(b){var q=b.questions.find(function(x){return x.id===r.questionId});if(q)question=q});if(question){questionDetails.push({index:i+1,text:question.text,answer:question.answer,studentId:r.studentId,studentName:(studentResults[r.studentId]||{}).name||'未知',selectedOption:r.selectedOption||'',correct:r.correct,pointsEarned:r.pointsEarned})}});
            var record={id:genId(),date:Date.now(),mode:exam.mode,participationType:exam.participationType||'personal',bankNames:bankNames,timeLimit:exam.timeLimit,totalQuestions:exam.questions.length,totalCorrect:correct,totalEarned:exam.totalEarned,studentResults:studentResults,playerScores:exam.playerScores||{},groupScores:exam.groupScores||{},questionDetails:questionDetails,results:exam.results};
            var records=App.Storage.getRecords();records.push(record);App.Storage.setRecords(records);this.currentExam=null;
            App.Storage.clearExamProgress();
            App.Sync.syncNow();
            App.Effects.playVictory();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/3,80);
            App.Exam.showRoundLeaderboard(record);
        },
        showRoundLeaderboard:function(record){
            this._showingRound=true;
            this._roundRecord=record;
            App.switchView('leaderboard');
            var empty=document.getElementById('leaderboard-empty');
            var container=document.querySelector('.leaderboard-container h2.section-title');
            empty.classList.remove('show');
            if(this._roundTimer){clearTimeout(this._roundTimer)}
            var self=this;
            if(record.participationType==='group'){
                this._roundPage='group';
                this._renderGroupRanking(record);
                if(container)container.textContent='🏆 本场小组积分榜';
                this._roundTimer=setTimeout(function(){
                    self._roundPage='group-winner';
                    self._renderGroupWinnerRanking(record);
                    if(container)container.textContent='🏆 获胜小组个人积分榜';
                    self._roundTimer=setTimeout(function(){self._showTotalLeaderboard()},5000);
                },5000);
            }else{
                this._roundPage='personal';
                this._renderPersonalRanking(record);
                if(container)container.textContent='🏆 本场排名';
                this._roundTimer=setTimeout(function(){self._showTotalLeaderboard()},5000);
            }
        },
        _showTotalLeaderboard:function(){
            if(this._roundTimer){clearTimeout(this._roundTimer);this._roundTimer=null}
            this._roundPage=null;
            App.Leaderboard.render();
            App.Students.render();
        },
        _renderGroupRanking:function(record){
            var podium=document.getElementById('leaderboard-podium');
            var list=document.getElementById('leaderboard-list');
            var gScores=record.groupScores||{};
            var sortedGroups=Object.keys(gScores).filter(function(gn){return gScores[gn]>0}).sort(function(a,b){return gScores[b]-gScores[a]});
            var medals=['🥇','🥈','🥉'];
            var podiumOrder=[5,3,1,0,2,4,6];
            if(sortedGroups.length===0){
                podium.innerHTML='<div class="no-podium-hint">😔 无人上榜</div>';
                var hintHTML='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
                list.innerHTML=hintHTML;
                return;
            }
            var podiumCount=Math.min(sortedGroups.length,7);
            var topN=sortedGroups.slice(0,podiumCount);
            var remaining=sortedGroups.slice(podiumCount);
            var baseRankHeights=[140,110,95,80,60,50,35];
            var rankHeights=baseRankHeights.slice();
            for(var ri=1;ri<topN.length;ri++){
                if(gScores[topN[ri]]===gScores[topN[ri-1]]){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHeights=[];
            for(var pi=0;pi<7;pi++){var ridx=podiumOrder[pi];podiumHeights.push(ridx<rankHeights.length?rankHeights[ridx]:0)}
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var gn=topN[idx];
                var h=podiumHeights[p];
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                podiumHTML+='<div class="podium-slot rank-'+rank+'">';
                podiumHTML+='<div class="podium-avatar">'+(idx<3?medals[idx]:'🏆')+'</div>';
                podiumHTML+='<div class="podium-name">'+gn+'</div>';
                podiumHTML+='<div class="podium-level">小组</div>';
                podiumHTML+='<div class="podium-points">⭐ '+gScores[gn]+'</div>';
                podiumHTML+='<div class="podium-bar" style="height:'+h+'px"></div>';
                podiumHTML+='<div class="podium-rank-label">'+rankLabel+'</div>';
                podiumHTML+='</div>';
            }
            podiumHTML+='</div>';
            podium.innerHTML=podiumHTML;
            var listHTML='';
            if(remaining.length>0){
                listHTML+='<div class="remaining-list"><div class="remaining-grid">';
                remaining.forEach(function(gn,i){
                    var rank=podiumCount+i+1;
                    listHTML+='<div class="flb-item"><div class="flb-rank">#'+rank+'</div><div class="flb-avatar">🏆</div><div class="flb-name">'+gn+'</div><div class="flb-level">小组</div><div class="flb-pts">⭐ '+gScores[gn]+'</div></div>';
                });
                listHTML+='</div></div>';
            }
            listHTML+='<div class="round-leaderboard-hint" onclick="App.Exam._showRoundPersonal()">👆 点击查看个人排名（5秒后自动跳转）</div>';
            list.innerHTML=listHTML;
        },
        _showRoundPersonal:function(){
            if(this._roundTimer){clearTimeout(this._roundTimer);this._roundTimer=null}
            this._roundPage='personal';
            this._renderPersonalRanking(this._roundRecord);
            var container=document.querySelector('.leaderboard-container h2.section-title');
            if(container)container.textContent='🏆 本场个人排名';
            var self=this;
            this._roundTimer=setTimeout(function(){self._showTotalLeaderboard()},5000);
        },
        _renderGroupWinnerRanking:function(record){
            var podium=document.getElementById('leaderboard-podium');
            var list=document.getElementById('leaderboard-list');
            var gScores=record.groupScores||{};
            var gNames=Object.keys(gScores);
            if(gNames.length===0){podium.innerHTML='';list.innerHTML='';return}
            var topGroup=gNames.sort(function(a,b){return gScores[b]-gScores[a]})[0];
            var srs=record.studentResults||{};
            var pScores=record.playerScores||{};
            var groupMembers=Object.keys(srs).filter(function(sid){return srs[sid].group===topGroup}).map(function(k){return srs[k]}).sort(function(a,b){
                var sa=pScores[a.id]||a.pointsEarned||0;var sb=pScores[b.id]||b.pointsEarned||0;return sb-sa;
            });
            var medals=['🥇','🥈','🥉'];
            var podiumOrder=[5,3,1,0,2,4,6];
            if(groupMembers.length===0){
                podium.innerHTML='<div class="no-podium-hint">🏆 获胜小组：'+topGroup+'</div>';
                list.innerHTML='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
                return;
            }
            var podiumCount=Math.min(groupMembers.length,7);
            var topN=groupMembers.slice(0,podiumCount);
            var remaining=groupMembers.slice(podiumCount);
            var baseRankHeights=[140,110,95,80,60,50,35];
            var rankHeights=baseRankHeights.slice(0,podiumCount);
            for(var ri=1;ri<topN.length;ri++){
                var sa=pScores[topN[ri].id]||topN[ri].pointsEarned||0;
                var sb=pScores[topN[ri-1].id]||topN[ri-1].pointsEarned||0;
                if(sa===sb){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var s=topN[idx];
                var h=idx<rankHeights.length?rankHeights[idx]:35;
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                var pts=pScores[s.id]||s.pointsEarned||0;
                podiumHTML+='<div class="podium-slot rank-'+rank+'">';
                podiumHTML+='<div class="podium-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div>';
                podiumHTML+='<div class="podium-name">'+s.name+'</div>';
                podiumHTML+='<div class="podium-level">'+topGroup+'</div>';
                podiumHTML+='<div class="podium-points">⭐ '+pts+'</div>';
                podiumHTML+='<div class="podium-bar" style="height:'+h+'px"></div>';
                podiumHTML+='<div class="podium-rank-label">'+rankLabel+'</div>';
                podiumHTML+='</div>';
            }
            podiumHTML+='</div>';
            podium.innerHTML=podiumHTML;
            var listHTML='';
            if(remaining.length>0){
                listHTML+='<div class="remaining-list"><div class="remaining-grid">';
                remaining.forEach(function(s,i){
                    var rank=podiumCount+i+1;
                    var pts=pScores[s.id]||s.pointsEarned||0;
                    listHTML+='<div class="flb-item"><div class="flb-rank">#'+rank+'</div><div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div><div class="flb-name">'+s.name+'</div><div class="flb-level">'+topGroup+'</div><div class="flb-pts">⭐ '+pts+'</div></div>';
                });
                listHTML+='</div></div>';
            }
            listHTML+='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
            list.innerHTML=listHTML;
        },
        _showRoundPersonalFromHistory:function(recordId){
            var records=App.Storage.getRecords();
            var rec=records.find(function(r){return r.id===recordId});
            if(!rec)return;
            this._renderPersonalRanking(rec);
            var container=document.querySelector('.leaderboard-container h2.section-title');
            var dateStr=new Date(rec.date).toLocaleString('zh-CN');
            if(container)container.textContent='🏆 历史积分榜 - '+dateStr+' 个人排名';
            var list=document.getElementById('leaderboard-list');
            var existing=list.innerHTML;
            list.innerHTML=existing+'<div class="round-leaderboard-hint" onclick="App.Leaderboard.render()">👆 点击返回总积分榜</div>';
        },
        _renderPersonalRanking:function(record){
            var podium=document.getElementById('leaderboard-podium');
            var list=document.getElementById('leaderboard-list');
            var srs=record.studentResults||{};
            var pScores=record.playerScores||{};
            var sorted=Object.keys(srs).map(function(k){return srs[k]}).sort(function(a,b){
                var sa=pScores[a.id]||a.pointsEarned||0;var sb=pScores[b.id]||b.pointsEarned||0;return sb-sa;
            });
            var medals=['🥇','🥈','🥉'];
            var podiumOrder=[5,3,1,0,2,4,6];
            if(sorted.length===0){
                podium.innerHTML='<div class="no-podium-hint">😔 无人上榜</div>';
                list.innerHTML='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
                return;
            }
            var podiumCount=Math.min(sorted.length,7);
            var topN=sorted.slice(0,podiumCount);
            var remaining=sorted.slice(podiumCount);
            var baseRankHeights=[140,110,95,80,60,50,35];
            var rankHeights=baseRankHeights.slice();
            for(var ri=1;ri<topN.length;ri++){
                var sc_ri=pScores[topN[ri].id]||topN[ri].pointsEarned||0;
                var sc_prev=pScores[topN[ri-1].id]||topN[ri-1].pointsEarned||0;
                if(sc_ri===sc_prev){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHeights=[];
            for(var pi=0;pi<7;pi++){var ridx=podiumOrder[pi];podiumHeights.push(ridx<rankHeights.length?rankHeights[ridx]:0)}
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var s=topN[idx];
                var score=pScores[s.id]||s.pointsEarned||0;
                var h=podiumHeights[p];
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                podiumHTML+='<div class="podium-slot rank-'+rank+'">';
                podiumHTML+='<div class="podium-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div>';
                podiumHTML+='<div class="podium-name">'+s.name+'</div>';
                podiumHTML+='<div class="podium-level">'+(s.group||'')+'</div>';
                podiumHTML+='<div class="podium-points">⭐ '+score+'</div>';
                podiumHTML+='<div class="podium-bar" style="height:'+h+'px"></div>';
                podiumHTML+='<div class="podium-rank-label">'+rankLabel+'</div>';
                podiumHTML+='</div>';
            }
            podiumHTML+='</div>';
            podium.innerHTML=podiumHTML;
            var listHTML='';
            if(remaining.length>0){
                listHTML+='<div class="remaining-list"><div class="remaining-grid">';
                remaining.forEach(function(s,i){
                    var score=pScores[s.id]||s.pointsEarned||0;
                    var rank=podiumCount+i+1;
                    listHTML+='<div class="flb-item"><div class="flb-rank">#'+rank+'</div><div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div><div class="flb-name">'+s.name+'</div><div class="flb-level">'+(s.group||'')+'</div><div class="flb-pts">⭐ '+score+'</div></div>';
                });
                listHTML+='</div></div>';
            }
            listHTML+='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
            list.innerHTML=listHTML;
        }
    };

    App.Records = {
        render:function(){
            var records=App.Storage.getRecords();var list=document.getElementById('records-list');var empty=document.getElementById('records-empty');
            if(records.length===0){list.innerHTML='';empty.classList.add('show');return}
            empty.classList.remove('show');records.sort(function(a,b){return b.date-a.date});
            var html='';
            records.forEach(function(rec){
                var modeLabel=rec.mode==='draw'?'🎲 多人挑战':rec.mode==='assign'?'👤 单人挑战':rec.mode==='pk'?'⚔️ PK':rec.mode==='farm'?'🌾 打野':rec.mode==='challenge'?'🎯 挑战':'🎮 未知';
                var dateStr=new Date(rec.date).toLocaleString('zh-CN');
                var srs=rec.studentResults||{};var sNames=Object.keys(srs).map(function(k){return srs[k].name});
                var nameStr=sNames.slice(0,3).join('、')+(sNames.length>3?'...':'');
                var titleText=dateStr+' '+modeLabel+' '+nameStr;
                var totalQ=rec.totalQuestions||0;var totalC=rec.totalCorrect||0;var totalE=rec.totalEarned||0;
                html+='<div class="record-card" data-rid="'+rec.id+'">';
                html+='<div class="record-header"><div class="record-title" onclick="App.Records.toggleDetail(this.parentElement)">'+titleText+'</div>';
                html+='<div class="record-header-actions">';
                html+='<button class="record-view-btn" onclick="event.stopPropagation();App.Records.viewLeaderboard(\''+rec.id+'\')" title="查看积分榜">🏆</button>';
                html+='<button class="record-del-btn" onclick="event.stopPropagation();App.Records.deleteRecord(\''+rec.id+'\')" title="删除此记录">🗑️</button>';
                html+='</div></div>';
                html+='<div class="record-stats"><span class="record-stat">📝 <strong>'+totalQ+'</strong> 题</span><span class="record-stat">✅ <strong>'+totalC+'</strong> 对</span><span class="record-stat">⭐ <strong>'+totalE+'</strong> 分</span></div>';
                html+='<div class="record-detail">';
                var sKeys=Object.keys(srs);
                if(rec.mode==='group'||rec.participationType==='group'){
                    var gScores=rec.groupScores||{};var sortedGroups=Object.keys(gScores).sort(function(a,b){return gScores[b]-gScores[a]});
                    sortedGroups.forEach(function(gn,i){
                        var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                        html+='<div class="record-student-row"><span class="record-student-name">'+medal+' 🏆 '+gn+'</span><span class="record-student-score">'+gScores[gn]+' 分</span></div>';
                    });
                    sKeys.forEach(function(k){var sr=srs[k];var ps=(rec.playerScores||{})[sr.id]||0;html+='<div class="record-student-row"><span class="record-student-name">'+sr.name+(sr.group?' ('+sr.group+')':'')+'</span><span class="record-student-score">+'+ps+' 分</span></div>'});
                }else if(rec.mode==='pk'){
                    var pScores=rec.playerScores||{};var sorted=sKeys.map(function(k){return srs[k]}).sort(function(a,b){return(pScores[b.id]||0)-(pScores[a.id]||0)});
                    sorted.forEach(function(sr,i){var ps=pScores[sr.id]||0;var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';html+='<div class="record-student-row"><span class="record-student-name">'+medal+' '+sr.name+'</span><span class="record-student-score">'+ps+' 分</span></div>'});
                }else{
                    sKeys.forEach(function(k){var sr=srs[k];var pct=sr.totalCount>0?Math.round(sr.correctCount/sr.totalCount*100):0;html+='<div class="record-student-row"><span class="record-student-name">'+sr.name+'<span class="record-student-detail">'+sr.correctCount+'/'+sr.totalCount+' 正确率 '+pct+'%</span></span><span class="record-student-score">+'+sr.pointsEarned+' 分</span></div>'});
                }
                var qds=rec.questionDetails||[];
                if(qds.length>0){html+='<div class="record-questions-list">';qds.forEach(function(qd){var cls=qd.correct?'correct':'wrong';html+='<div class="record-q-item '+cls+'">'+qd.index+'. ['+qd.studentName+'] '+qd.text+' → <strong>'+qd.answer+'</strong>'+(qd.correct?' ✅':' ❌ 你选'+qd.selectedOption)+' +'+qd.pointsEarned+'</div>'});html+='</div>'}
                html+='</div></div>';
            });
            list.innerHTML=html;
        },
        toggleDetail:function(el){el.classList.toggle('expanded')},
        viewLeaderboard:function(recordId){
            var records=App.Storage.getRecords();
            var rec=records.find(function(r){return r.id===recordId});
            if(!rec){App.Toast.show('记录不存在','error');return}
            App.Exam._showingRound=true;
            App.switchView('leaderboard');
            var empty=document.getElementById('leaderboard-empty');
            var container=document.querySelector('.leaderboard-container h2.section-title');
            empty.classList.remove('show');
            var dateStr=new Date(rec.date).toLocaleString('zh-CN');
            var modeLabel=rec.mode==='draw'?'多人挑战':rec.mode==='assign'?'单人挑战':rec.mode==='pk'?'PK':rec.mode==='farm'?'打野':rec.mode==='challenge'?'挑战':'未知';
            if(rec.mode==='group'||rec.participationType==='group'){
                if(container)container.textContent='🏆 历史积分榜 - '+dateStr+' '+modeLabel;
                App.Exam._renderGroupRanking(rec);
                var list=document.getElementById('leaderboard-list');
                var existing=list.innerHTML;
                list.innerHTML=existing+'<div class="round-leaderboard-hint" onclick="App.Exam._showRoundPersonalFromHistory(\''+recordId+'\')">👆 点击查看个人排名</div>';
            }else{
                if(container)container.textContent='🏆 历史积分榜 - '+dateStr+' '+modeLabel;
                App.Exam._renderPersonalRanking(rec);
                var list=document.getElementById('leaderboard-list');
                var existing=list.innerHTML;
                list.innerHTML=existing+'<div class="round-leaderboard-hint" onclick="App.Leaderboard.render()">👆 点击返回总积分榜</div>';
            }
        },
        deleteRecord:function(recordId){
            if(!confirm('确定要删除此记录吗？删除后相关学生的积分将重新计算。'))return;
            var records=App.Storage.getRecords();records=records.filter(function(r){return r.id!==recordId});
            App.Storage.setRecords(records);
            this.render();App.Leaderboard.render();App.Students.render();
            App.Toast.show('记录已删除，积分已更新','info');
        },
        getStudentHistory:function(studentId){
            var records=App.Storage.getRecords();var history=[];
            records.forEach(function(rec){var srs=rec.studentResults||{};if(srs[studentId]){history.push({date:rec.date,mode:rec.mode,bankNames:rec.bankNames||[],correctCount:srs[studentId].correctCount,totalCount:srs[studentId].totalCount,pointsEarned:srs[studentId].pointsEarned,pkScore:(rec.playerScores||{})[studentId]||0})}});
            history.sort(function(a,b){return b.date-a.date});return history;
        }
    };

    App.Leaderboard = {
        render:function(){
            var students=App.Storage.getStudents();
            var empty=document.getElementById('leaderboard-empty');
            var podium=document.getElementById('leaderboard-podium');
            var container=document.querySelector('.leaderboard-container h2.section-title');
            if(container)container.textContent='🏆 个人总积分榜';
            var list=document.getElementById('leaderboard-list');
            if(students.length===0){podium.innerHTML='';list.innerHTML='';empty.classList.add('show');return}
            empty.classList.remove('show');
            var statsMap=getAllStudentStats();
            var enriched=students.map(function(s){
                var st=statsMap[s.id]||{totalPoints:0};
                return{id:s.id,name:s.name,avatar:s.avatar,totalPoints:st.totalPoints};
            });
            var sorted=enriched.slice().sort(function(a,b){return b.totalPoints-a.totalPoints});
            var podiumCount=Math.min(sorted.length,7);
            var topN=sorted.slice(0,podiumCount);
            var remaining=sorted.slice(podiumCount);
            var podiumOrder=[5,3,1,0,2,4,6];
            var baseRankHeights=[140,110,95,80,60,50,35];
            var rankHeights=baseRankHeights.slice();
            for(var ri=1;ri<topN.length;ri++){
                if(topN[ri].totalPoints===topN[ri-1].totalPoints){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHeights=[];
            for(var pi=0;pi<7;pi++){var ridx=podiumOrder[pi];podiumHeights.push(ridx<rankHeights.length?rankHeights[ridx]:0)}
            var medals=['🥇','🥈','🥉'];
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var s=topN[idx];
                var lv=getLevel(s.totalPoints);
                var h=podiumHeights[p];
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                var rankClass='rank-'+rank;
                podiumHTML+='<div class="podium-slot '+rankClass+'">';
                podiumHTML+='<div class="podium-avatar" onclick="App.Students.showPointsDetail(\''+s.id+'\')" title="点击查看详情">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div>';
                podiumHTML+='<div class="podium-name">'+s.name+'</div>';
                podiumHTML+='<div class="podium-level">'+lv.name+'</div>';
                podiumHTML+='<div class="podium-points">⭐ '+s.totalPoints+'</div>';
                podiumHTML+='<div class="podium-bar" style="height:'+h+'px"></div>';
                podiumHTML+='<div class="podium-rank-label">'+rankLabel+'</div>';
                podiumHTML+='</div>';
            }
            podiumHTML+='</div>';
            podium.innerHTML=podiumHTML;
            var listHTML='';
            if(remaining.length>0){
                listHTML+='<div class="remaining-list"><div class="remaining-grid">';
                remaining.forEach(function(s,i){
                    var lv=getLevel(s.totalPoints);
                    var rank=podiumCount+i+1;
                    listHTML+='<div class="flb-item" onclick="App.Students.showPointsDetail(\''+s.id+'\')" title="点击查看详情">';
                    listHTML+='<div class="flb-rank">#'+rank+'</div>';
                    listHTML+='<div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'</div>';
                    listHTML+='<div class="flb-name">'+s.name+'</div>';
                    listHTML+='<div class="flb-level">'+lv.name+'</div>';
                    listHTML+='<div class="flb-pts">⭐ '+s.totalPoints+'</div>';
                    listHTML+='</div>';
                });
                listHTML+='</div></div>';
            }
            list.innerHTML=listHTML;
        }
    };

    App.Settings = {
        switchTab:function(tab){
            document.querySelectorAll('.settings-tab').forEach(function(t){t.classList.remove('active')});
            document.querySelectorAll('.settings-panel').forEach(function(p){p.classList.remove('active')});
            var tabBtn=document.querySelector('.settings-tab[data-stab="'+tab+'"]');
            var panel=document.getElementById('stab-'+tab);
            if(tabBtn)tabBtn.classList.add('active');
            if(panel)panel.classList.add('active');
            if(tab==='records')App.Records.render();
            if(tab==='levels')this.renderLevels();
            if(tab==='sound')this.loadSoundSettings();
            if(tab==='ai')this.loadAISettings();
            if(tab==='exam')this.loadExamSettings();
            if(tab==='students')this.StudentMgmt.render();
            if(tab==='sync')this.loadSyncSettings();
        },
        renderLevels:function(){
            var settings=App.Storage.getSettings();
            var levels=settings.levels||[];
            var container=document.getElementById('level-settings');
            if(!container)return;
            var html='';
            levels.forEach(function(lv,i){
                html+='<div class="level-item">';
                html+='<input type="text" class="level-name-input" value="'+lv.name+'" data-idx="'+i+'" placeholder="等级名">';
                html+='<input type="number" class="level-pts-input" value="'+lv.minPoints+'" data-idx="'+i+'" placeholder="积分" min="0">';
                html+='<input type="text" class="level-comment-input" value="'+lv.comment+'" data-idx="'+i+'" placeholder="评语">';
                html+='<button class="btn-remove-level" onclick="App.Settings.removeLevel('+i+')">✕</button>';
                html+='</div>';
            });
            container.innerHTML=html;
        },
        addLevel:function(){
            var settings=App.Storage.getSettings();
            if(!settings.levels)settings.levels=[];
            var maxPts=0;
            settings.levels.forEach(function(l){if(l.minPoints>maxPts)maxPts=l.minPoints});
            settings.levels.push({name:'新等级',minPoints:maxPts+100,comment:'自定义等级评语'});
            App.Storage.setSettings(settings);
            this.renderLevels();
        },
        removeLevel:function(idx){
            var settings=App.Storage.getSettings();
            if(settings.levels.length<=1){App.Toast.show('至少保留一个等级','warning');return}
            settings.levels.splice(idx,1);
            App.Storage.setSettings(settings);
            this.renderLevels();
        },
        loadAISettings:function(){
            var settings=App.Storage.getSettings();
            var urlEl=document.getElementById('ai-api-url');
            var keyEl=document.getElementById('ai-api-key');
            var modelEl=document.getElementById('ai-model');
            if(urlEl)urlEl.value=settings.aiApiUrl||'';
            if(keyEl)keyEl.value=settings.aiApiKey||'';
            if(modelEl)modelEl.value=settings.aiModel||'';
        },
        loadExamSettings:function(){
            var settings=App.Storage.getSettings();
            var shuffleEl=document.getElementById('exam-shuffle-options');
            var baseEl=document.getElementById('exam-base-timeout');
            var charEl=document.getElementById('exam-char-timeout');
            var autoNextEl=document.getElementById('exam-auto-next');
            var autoNextDelayEl=document.getElementById('exam-auto-next-delay');
            var drawDurEl=document.getElementById('exam-draw-duration');
            var qFontEl=document.getElementById('exam-question-fontsize');
            var snFontEl=document.getElementById('exam-student-name-fontsize');
            var siFontEl=document.getElementById('exam-student-info-fontsize');
            var wrFontEl=document.getElementById('exam-warreport-fontsize');
            if(shuffleEl)shuffleEl.checked=settings.shuffleOptions!==false;
            if(baseEl)baseEl.value=settings.baseTimeout!==undefined?settings.baseTimeout:30;
            if(charEl)charEl.value=settings.charTimeoutCompensation!==undefined?settings.charTimeoutCompensation:0.2;
            if(autoNextEl)autoNextEl.checked=settings.autoNext!==false;
            if(autoNextDelayEl)autoNextDelayEl.value=settings.autoNextDelay!==undefined?settings.autoNextDelay:3;
            var drawAnimEl=document.getElementById('exam-draw-animation');
            if(drawAnimEl)drawAnimEl.checked=settings.drawAnimation!==false;
            if(drawDurEl)drawDurEl.value=settings.drawDuration!==undefined?settings.drawDuration:3;
            if(qFontEl)qFontEl.value=settings.questionFontSize||30;
            if(snFontEl)snFontEl.value=settings.studentNameFontSize||35;
            if(siFontEl)siFontEl.value=settings.studentInfoFontSize||20;
            if(wrFontEl)wrFontEl.value=settings.warReportFontSize||20;
            this.updateTimeoutPreview();
            var self=this;
            if(baseEl)baseEl.oninput=function(){self.updateTimeoutPreview()};
            if(charEl)charEl.oninput=function(){self.updateTimeoutPreview()};
        },
        saveExamSettings:function(){
            var settings=App.Storage.getSettings();
            settings.shuffleOptions=document.getElementById('exam-shuffle-options').checked;
            settings.baseTimeout=parseFloat(document.getElementById('exam-base-timeout').value)||0;
            settings.charTimeoutCompensation=parseFloat(document.getElementById('exam-char-timeout').value)||0;
            settings.autoNext=document.getElementById('exam-auto-next').checked;
            settings.autoNextDelay=parseFloat(document.getElementById('exam-auto-next-delay').value)||3;
            settings.drawAnimation=document.getElementById('exam-draw-animation').checked;
            settings.drawDuration=parseFloat(document.getElementById('exam-draw-duration').value)||3;
            settings.questionFontSize=parseInt(document.getElementById('exam-question-fontsize').value)||30;
            settings.studentNameFontSize=parseInt(document.getElementById('exam-student-name-fontsize').value)||35;
            settings.studentInfoFontSize=parseInt(document.getElementById('exam-student-info-fontsize').value)||24;
            settings.warReportFontSize=parseInt(document.getElementById('exam-warreport-fontsize').value)||12;
            App.Storage.setSettings(settings);
            App.Toast.show('挑战参数已保存','success');
        },
        updateTimeoutPreview:function(){
            var base=parseFloat(document.getElementById('exam-base-timeout').value)||0;
            var charComp=parseFloat(document.getElementById('exam-char-timeout').value)||0;
            var previewEl=document.getElementById('exam-timeout-preview');
            if(!previewEl)return;
            var examples=[
                {label:'短题（10字）',chars:10},
                {label:'中题（30字）',chars:30},
                {label:'长题（60字）',chars:60},
                {label:'超长题（100字）',chars:100}
            ];
            var html='';
            examples.forEach(function(ex){
                var total=base+ex.chars*charComp;
                html+='<div class="timeout-example"><span class="te-label">'+ex.label+'</span><span class="te-calc">'+base+' + '+ex.chars+'×'+charComp+' = <strong>'+total.toFixed(1)+'秒</strong></span></div>';
            });
            previewEl.innerHTML=html;
        },
        saveAISettings:function(){
            var settings=App.Storage.getSettings();
            settings.aiApiUrl=document.getElementById('ai-api-url').value.trim();
            settings.aiApiKey=document.getElementById('ai-api-key').value.trim();
            settings.aiModel=document.getElementById('ai-model').value.trim();
            App.Storage.setSettings(settings);
            App.Toast.show('AI设置已保存','success');
        },
        loadSoundSettings:function(){
            var settings=App.Storage.getSettings();
            var enabledEl=document.getElementById('sound-enabled');
            var volEl=document.getElementById('sound-volume');
            if(enabledEl)enabledEl.checked=settings.soundEnabled!==false;
            if(volEl)volEl.value=settings.soundVolume||70;
        },
        saveSoundSettings:function(){
            var settings=App.Storage.getSettings();
            settings.soundEnabled=document.getElementById('sound-enabled').checked;
            settings.soundVolume=parseInt(document.getElementById('sound-volume').value)||70;
            App.Storage.setSettings(settings);
            App.Effects.soundEnabled=settings.soundEnabled;
            App.Effects.volume=settings.soundVolume/100;
            App.Effects.updateSoundToggle();
            App.Toast.show('音效设置已保存','success');
        },
        loadSyncSettings:function(){
            var config=App.Sync._lastConfig;
            if(!config){
                try{config=JSON.parse(localStorage.getItem('exam_sync_config')||'null')}catch(e){config=null}
            }
            config=config||{};
            var enabledEl=document.getElementById('sync-enabled');
            var webhookEl=document.getElementById('sync-webhook-url');
            var tokenEl=document.getElementById('sync-token');
            var checkEl=document.getElementById('sync-check-interval');
            var debounceEl=document.getElementById('sync-debounce');
            var retryCountEl=document.getElementById('sync-retry-count');
            var retryIntervalEl=document.getElementById('sync-retry-interval');
            if(enabledEl)enabledEl.checked=config.enabled!==false;
            if(webhookEl)webhookEl.value=config.webhookUrl||'';
            if(tokenEl)tokenEl.value=config.token||'';
            if(checkEl)checkEl.value=config.cloudCheckInterval||5;
            if(debounceEl)debounceEl.value=config.syncDeltaInterval||3;
            if(retryCountEl)retryCountEl.value=config.retryCount||5;
            if(retryIntervalEl)retryIntervalEl.value=config.retryInterval||2;
            this.updateSyncStatus();
        },
        saveSyncSettings:function(){
            var config={
                enabled:document.getElementById('sync-enabled').checked,
                webhookUrl:document.getElementById('sync-webhook-url').value.trim(),
                token:document.getElementById('sync-token').value.trim(),
                cloudCheckInterval:parseInt(document.getElementById('sync-check-interval').value)||5,
                syncDeltaInterval:parseInt(document.getElementById('sync-debounce').value)||3,
                retryCount:parseInt(document.getElementById('sync-retry-count').value)||5,
                retryInterval:parseInt(document.getElementById('sync-retry-interval').value)||2
            };
            App.Sync.updateConfig(config);
            App.Sync._lastConfig=config;
            App.Toast.show('同步设置已保存','success');
        },
        syncNow:function(){
            var btn=document.getElementById('btn-sync-now');
            if(btn){btn.disabled=true;btn.textContent='⏳ 同步中...'}
            App.Sync.syncNow();
        },
        updateSyncStatus:function(){
            var el=document.getElementById('sync-status-info');
            if(!el)return;
            var lastTime=parseInt(localStorage.getItem('exam_sync_last_time')||'0');
            var statusText='未同步';
            if(lastTime>0){
                var d=new Date(lastTime);
                statusText='上次同步：'+d.toLocaleString('zh-CN');
            }
            el.textContent=statusText;
        },
        exportData:function(){
            var data={
                students:App.Storage.getStudents(),
                banks:App.Storage.getBanks(),
                records:App.Storage.getRecords(),
                settings:App.Storage.getSettings(),
                dataVersion:App.Storage.get('dataVersion',0)
            };
            var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
            var url=URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;a.download='挑战系统数据_'+new Date().toISOString().slice(0,10)+'.json';
            a.click();URL.revokeObjectURL(url);
            App.Toast.show('数据已导出','success');
        },
        importData:function(){
            var body='<div class="form-group"><label>选择备份文件</label><input type="file" id="inp-import-file" accept=".json"></div>';
            body+='<div style="color:var(--warning);font-size:13px;margin-top:8px">⚠️ 导入将覆盖当前所有数据</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Settings.doImportData()">导入</button>';
            App.Modal.open('📥 导入数据',body,footer);
        },
        doImportData:function(){
            var fileInput=document.getElementById('inp-import-file');
            if(!fileInput||!fileInput.files||!fileInput.files[0]){App.Toast.show('请选择文件','warning');return}
            var reader=new FileReader();
            reader.onload=function(e){
                try{
                    var data=JSON.parse(e.target.result);
                    if(data.students)App.Storage.setStudents(data.students);
                    if(data.banks)App.Storage.setBanks(data.banks);
                    if(data.records)App.Storage.setRecords(data.records);
                    if(data.settings)App.Storage.setSettings(data.settings);
                    if(data.dataVersion)App.Storage.set('dataVersion',data.dataVersion);
                    App.Modal.close();
                    App.Students.render();
                    App.Questions.render();
                    App.Leaderboard.render();
                    App.Settings.renderLevels();
                    App.Toast.show('数据导入成功','success');
                }catch(err){
                    App.Toast.show('导入失败：文件格式错误','error');
                }
            };
            reader.readAsText(fileInput.files[0]);
        },
        resetData:function(){
            if(!confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！'))return;
            if(!confirm('再次确认：所有学生、题库、记录将被删除！'))return;
            var keys=Object.keys(localStorage);
            keys.forEach(function(k){if(k.indexOf('exam_')===0&&k.indexOf('exam_sync_')!==0)localStorage.removeItem(k)});
            App.Storage.ensureDefaults();
            App.Students.render();
            App.Questions.render();
            App.Leaderboard.render();
            App.Records.render();
            this.renderLevels();
            App.Sync.notifyChange('students',App.Storage.getStudents());
            App.Sync.notifyChange('banks',App.Storage.getBanks());
            App.Sync.notifyChange('records',App.Storage.getRecords());
            App.Sync.notifyChange('levels',App.Storage.getSettings().levels||[]);
            App.Sync.syncNow();
            App.Toast.show('数据已重置','info');
        },
        StudentMgmt:{
            _dirty:false,
            _markDirty:function(){
                this._dirty=true;
                var btn=document.getElementById('btn-save-students');
                if(btn)btn.style.display='inline-flex';
            },
            _clearDirty:function(){
                this._dirty=false;
                var btn=document.getElementById('btn-save-students');
                if(btn)btn.style.display='none';
            },
            render:function(){
                var students=App.Storage.getStudents();
                var wrap=document.getElementById('student-mgmt-wrap');
                var empty=document.getElementById('student-mgmt-empty');
                if(students.length===0){wrap.innerHTML='';empty.classList.add('show');this._clearDirty();return}
                empty.classList.remove('show');
                var groups=App.Storage.getGroups();
                var groupOptions='';
                groups.forEach(function(g){groupOptions+='<option value="'+g+'">'});
                var html='<table class="student-table editable"><thead><tr>';
                html+='<th>头像</th><th>姓名</th><th>性别</th><th>小组</th><th>操作</th>';
                html+='</tr></thead><tbody>';
                students.forEach(function(s){
                    html+='<tr data-id="'+s.id+'">';
                    html+='<td><div class="st-avatar-cell" onclick="App.Settings.StudentMgmt.triggerAvatarUpload(\''+s.id+'\')" title="点击更换头像">'+(s.avatar?'<img src="'+s.avatar+'">':s.name.charAt(0))+'<input type="file" class="hidden-avatar-input" data-id="'+s.id+'" accept="image/*" onchange="App.Settings.StudentMgmt.onAvatarChange(this)"></div></td>';
                    html+='<td><input type="text" class="inline-input inline-name" data-id="'+s.id+'" data-field="name" value="'+s.name.replace(/"/g,'&quot;')+'" onchange="App.Settings.StudentMgmt._markDirty()"></td>';
                    html+='<td><select class="inline-select inline-gender" data-id="'+s.id+'" data-field="gender" onchange="App.Settings.StudentMgmt._markDirty()"><option value=""'+(s.gender===''?' selected':'')+'>-</option><option value="男"'+(s.gender==='男'?' selected':'')+'>男</option><option value="女"'+(s.gender==='女'?' selected':'')+'>女</option></select></td>';
                    html+='<td><input type="text" class="inline-input inline-group" data-id="'+s.id+'" data-field="group" value="'+(s.group||'').replace(/"/g,'&quot;')+'" list="group-dl-'+s.id+'" onchange="App.Settings.StudentMgmt._markDirty()"><datalist id="group-dl-'+s.id+'">'+groupOptions+'</datalist></td>';
                    html+='<td class="st-actions"><button class="btn-table btn-table-del" onclick="App.Settings.StudentMgmt.remove(\''+s.id+'\')" title="删除">🗑️</button></td>';
                    html+='</tr>';
                });
                html+='</tbody></table>';
                wrap.innerHTML=html;
                this._clearDirty();
            },
            triggerAvatarUpload:function(id){
                var inp=document.querySelector('#stab-students .hidden-avatar-input[data-id="'+id+'"]');
                if(inp)inp.click();
            },
            onAvatarChange:function(input){
                if(!input.files||!input.files[0])return;
                var id=input.dataset.id;
                var reader=new FileReader();
                reader.onload=function(e){
                    var cell=input.closest('.st-avatar-cell');
                    var img=cell.querySelector('img');
                    if(img){img.src=e.target.result}
                    else{cell.innerHTML='<img src="'+e.target.result+'"><input type="file" class="hidden-avatar-input" data-id="'+id+'" accept="image/*" onchange="App.Settings.StudentMgmt.onAvatarChange(this)">'};
                    cell._newAvatar=e.target.result;
                    App.Settings.StudentMgmt._markDirty();
                };
                reader.readAsDataURL(input.files[0]);
            },
            saveAll:function(){
                var students=App.Storage.getStudents();
                var hasError=false;
                document.querySelectorAll('#stab-students .inline-name').forEach(function(inp){
                    var val=inp.value.trim();
                    if(!val){hasError=true;inp.classList.add('input-error');return}
                    inp.classList.remove('input-error');
                    var s=students.find(function(x){return x.id===inp.dataset.id});
                    if(s)s.name=val;
                });
                if(hasError){App.Toast.show('姓名不能为空','warning');return}
                document.querySelectorAll('#stab-students .inline-gender').forEach(function(sel){
                    var s=students.find(function(x){return x.id===sel.dataset.id});
                    if(s)s.gender=sel.value;
                });
                document.querySelectorAll('#stab-students .inline-group').forEach(function(inp){
                    var s=students.find(function(x){return x.id===inp.dataset.id});
                    if(s)s.group=inp.value.trim();
                });
                document.querySelectorAll('#stab-students .st-avatar-cell').forEach(function(cell){
                    if(cell._newAvatar){
                        var inp=cell.querySelector('.hidden-avatar-input');
                        if(inp){
                            var sid=inp.dataset.id;
                            var s=students.find(function(x){return x.id===sid});
                            if(s)s.avatar=cell._newAvatar;
                        }
                    }
                });
                App.Storage.setStudents(students);
                this.render();
                App.Students.render();
                App.Leaderboard.render();
                App.Toast.show('学生信息已保存','success');
                App.Effects.playClick();
            },
            addRow:function(){
                var students=App.Storage.getStudents();
                var newStudent={id:genId(),name:'新学生',avatar:'',gender:'',group:'',createdAt:Date.now()};
                students.push(newStudent);
                App.Storage.setStudents(students);
                this.render();
                var nameInput=document.querySelector('#stab-students .inline-name[data-id="'+newStudent.id+'"]');
                if(nameInput){nameInput.focus();nameInput.select()}
                this._markDirty();
                App.Toast.show('已添加新学生，请修改信息后保存','info');
            },
            remove:function(id){
                if(!confirm('确定要删除该学生吗？'))return;
                var students=App.Storage.getStudents().filter(function(x){return x.id!==id});
                App.Storage.setStudents(students);
                this.render();
                App.Students.render();
                App.Leaderboard.render();
                App.Toast.show('学生已删除','info');
            },
            clearAll:function(){
                if(!confirm('确定要清空所有学生吗？此操作不可恢复！'))return;
                App.Storage.setStudents([]);
                this.render();
                App.Students.render();
                App.Leaderboard.render();
                App.Toast.show('所有学生已清空','info');
            },
            showImportDialog:function(){
                var body='<div class="import-format-hint">批量导入格式说明：每行一个学生姓名<br>也可使用格式：<code>姓名,性别,小组</code><br>示例：<br><code>张三,男,第一组</code><br><code>李四,女,第二组</code></div>';
                body+='<div class="form-group"><label>粘贴学生列表</label><textarea id="inp-import-students" placeholder="每行一个学生姓名" rows="8"></textarea></div>';
                body+='<div class="form-group"><label>或从TXT文件导入</label><input type="file" id="inp-import-file" accept=".txt"></div>';
                var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Settings.StudentMgmt.doImport()">导入</button>';
                App.Modal.open('批量导入学生',body,footer);
            },
            doImport:function(){
                var ta=document.getElementById('inp-import-students');var fi=document.getElementById('inp-import-file');var text=ta.value.trim();
                if(fi.files&&fi.files[0]){var reader=new FileReader();reader.onload=function(e){App.Settings.StudentMgmt.processImport(e.target.result)};reader.readAsText(fi.files[0]);return}
                if(!text){App.Toast.show('请输入学生数据或选择文件','warning');return}
                this.processImport(text);
            },
            processImport:function(text){
                var lines=text.split('\n'),students=App.Storage.getStudents(),count=0;
                lines.forEach(function(line){line=line.trim();if(!line)return;var parts=line.split(','),name=parts[0].trim(),gender=parts[1]?parts[1].trim():'',group=parts[2]?parts[2].trim():'';if(name){var exists=students.some(function(s){return s.name===name});if(!exists){students.push({id:genId(),name:name,avatar:'',gender:gender,group:group,createdAt:Date.now()});count++}}});
                App.Storage.setStudents(students);App.Modal.close();this.render();App.Students.render();App.Toast.show('成功导入 '+count+' 名学生','success');
            }
        }
    };

    App.switchView = function(view){
        document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});
        document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active')});
        var viewEl=document.getElementById('view-'+view);
        var navBtn=document.querySelector('.nav-btn[data-view="'+view+'"]');
        if(viewEl)viewEl.classList.add('active');
        if(navBtn)navBtn.classList.add('active');
        if(view==='students')App.Students.render();
        if(view==='questions')App.Questions.render();
        if(view==='leaderboard'){if(App.Exam._showingRound){App.Exam._showingRound=false}else{App.Leaderboard.render()}}
        if(view==='settings'){App.Settings.renderLevels();App.Settings.loadSoundSettings();App.Settings.loadAISettings();App.Settings.loadExamSettings()}
        if(view==='home'){
            if(App.Exam.currentExam){
                document.getElementById('exam-mode-select').classList.add('hidden');
                document.getElementById('exam-setup').classList.add('hidden');
                var drawing=document.getElementById('exam-drawing');
                var playing=document.getElementById('exam-playing');
                if(!drawing.classList.contains('hidden')||!playing.classList.contains('hidden')){
                }else{
                    document.getElementById('exam-playing').classList.remove('hidden');
                }
                var sidebar=document.getElementById('exam-play-sidebar');
                if(sidebar)sidebar.classList.remove('hidden');
            }else{
                var resumed=App.Exam.checkResumableExam();
                if(!resumed){
                    document.getElementById('exam-mode-select').classList.remove('hidden');
                    document.getElementById('exam-setup').classList.add('hidden');
                    document.getElementById('exam-drawing').classList.add('hidden');
                    document.getElementById('exam-playing').classList.add('hidden');
                    var sidebar=document.getElementById('exam-play-sidebar');
                    if(sidebar)sidebar.classList.add('hidden');
                    var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
                }
            }
        }
    };

    App.toggleFullscreen = function(){
        if(!document.fullscreenElement){
            document.documentElement.requestFullscreen().catch(function(){});
        }else{
            document.exitFullscreen().catch(function(){});
        }
    };

    App.Sync = {
        frame:null,
        ready:false,
        pendingMessages:[],
        _lastConfig:null,
        init:function(){
            this.frame=document.getElementById('sync-frame');
            if(!this.frame)return;
            var self=this;
            window.addEventListener('message',function(e){
                if(!e.data||typeof e.data!=='object')return;
                var msg=e.data;
                switch(msg.type){
                    case 'syncReady':
                        self.ready=true;
                        self.sendToFrame({target:'examSync',type:'init'});
                        for(var i=0;i<self.pendingMessages.length;i++){
                            self.sendToFrame(self.pendingMessages[i]);
                        }
                        self.pendingMessages=[];
                        break;
                    case 'dataUpdated':
                        App.Storage._syncSilent=true;
                        try{
                            if(msg.dataType==='students'){
                                App.Storage.set('students',msg.data);
                                App.Students.render();
                                if(App.Settings&&App.Settings.StudentMgmt&&App.Settings.StudentMgmt.render)App.Settings.StudentMgmt.render();
                            }else if(msg.dataType==='records'){
                                App.Storage.set('records',msg.data);
                                if(App.Settings&&App.Settings.renderRecords)App.Settings.renderRecords();
                            }else if(msg.dataType==='banks'){
                                App.Storage.set('banks',msg.data);
                                App.Questions.render();
                            }else if(msg.dataType==='levels'){
                                var curSettings=App.Storage.getSettings();
                                curSettings.levels=msg.data;
                                App.Storage.set('settings',curSettings);
                                if(App.Settings&&App.Settings.renderLevels)App.Settings.renderLevels();
                            }
                        }finally{
                            App.Storage._syncSilent=false;
                        }
                        break;
                    case 'syncStatus':
                        var btn=document.getElementById('btn-sync-now');
                        if(msg.status==='syncing'){
                            if(btn){btn.disabled=true;btn.textContent='⏳ 同步中...'}
                        }else{
                            if(btn){btn.disabled=false;btn.textContent='☁️ 立即同步'}
                        }
                        if(App.Settings&&App.Settings.updateSyncStatus)App.Settings.updateSyncStatus();
                        break;
                    case 'syncConfig':
                        if(msg.config)self._lastConfig=msg.config;
                        break;
                }
            });
            document.addEventListener('visibilitychange',function(){
                if(!document.hidden&&self.ready){
                    self.sendToFrame({target:'examSync',type:'syncNow'});
                }
            });
            setTimeout(function(){
                if(!self.ready&&self.frame&&self.frame.contentWindow){
                    self.sendToFrame({target:'examSync',type:'ping'});
                }
            },2000);
        },
        sendToFrame:function(msg){
            if(this.frame&&this.frame.contentWindow){
                try{this.frame.contentWindow.postMessage(msg,'*')}catch(e){}
            }
        },
        notifyChange:function(dataType,data){
            var delay=(this._lastConfig&&this._lastConfig.syncDeltaInterval||3)*1000;
            if(!this.ready){
                this.pendingMessages.push({target:'examSync',type:'dataChanged',dataType:dataType,data:data,debounce:delay});
                return;
            }
            this.sendToFrame({target:'examSync',type:'dataChanged',dataType:dataType,data:data,debounce:delay});
        },
        syncNow:function(){
            this.sendToFrame({target:'examSync',type:'syncNow'});
        },
        getConfig:function(){
            this.sendToFrame({target:'examSync',type:'getConfig'});
        },
        updateConfig:function(config){
            this.sendToFrame({target:'examSync',type:'updateConfig',config:config});
        },
        deleteBank:function(bankKey){
            this.sendToFrame({target:'examSync',type:'deleteBank',bankKey:bankKey});
        }
    };

    App.init = function(){
        App.Storage.ensureDefaults();
        App.Sync.init();
        App.Toast.init();
        App.Effects.init();
        App.Students.render();
        App.Questions.render();
        App.Leaderboard.render();
        App.Settings.renderLevels();
        App.Settings.loadSoundSettings();
        App.Settings.loadAISettings();
        App.Settings.loadExamSettings();
        var progress=App.Storage.getExamProgress();
        if(progress&&progress.questions&&progress.questions.length>0){
            App.Exam.checkResumableExam();
        }
        document.getElementById('sound-volume').addEventListener('input',function(){
            App.Settings.saveSoundSettings();
        });
        document.getElementById('sound-enabled').addEventListener('change',function(){
            App.Settings.saveSoundSettings();
        });
    };

    document.addEventListener('DOMContentLoaded',function(){
        App.init();
    });
})();