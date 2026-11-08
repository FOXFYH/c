(function () {
    'use strict';
    var App = window.App = window.App || {};
    // 按需加载模块：拼音题 / 课外阅读题等新功能不塞进本文件
    App.Modules = {
        _q:{},
        load:function(name,cb){
            if((name==='pinyin'&&App.Pinyin)||(name==='reading'&&App.Reading)){if(cb)cb();return}
            var q=this._q[name];
            if(q){if(cb)q.push(cb);return}
            q=this._q[name]=cb?[cb]:[];
            var s=document.createElement('script');
            s.src=name+'.js?v='+(window.__APP_VER||'0');
            s.onload=function(){delete App.Modules._q[name];q.forEach(function(f){try{if(f)f()}catch(e){}})};
            s.onerror=function(){delete App.Modules._q[name];if(App.Toast)App.Toast.show('模块加载失败：'+name,'error')};
            document.head.appendChild(s);
        }
    };
    function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,6)}
    // 题库专用ID：QB_ + 10位数字，与云端格式一致
    function genBankId(){return 'QB_'+Math.floor(Math.random()*9000000000+1000000000)}
    function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
    function getAvatarChar(name,usedChars){
        if(!name)return'?';
        var last=name.charAt(name.length-1);
        if(!usedChars||!usedChars[last])return last;
        for(var i=name.length-2;i>=1;i--){
            var ch=name.charAt(i);
            if(!usedChars[ch])return ch;
        }
        var first=name.charAt(0);
        if(!usedChars[first])return first;
        return last;
    }
    function buildAvatarCharMap(students){
        var used={},result={};
        var sorted=students.slice().sort(function(a,b){return a.name.length-b.name.length});
        sorted.forEach(function(s){
            if(s.avatar)return;
            var ch=getAvatarChar(s.name,used);
            result[s.id]=ch;
            used[ch]=true;
        });
        return result;
    }
    // 供拆分出去的 exam.js / questions.js 复用
    App.genId=genId;App.genBankId=genBankId;App.shuffle=shuffle;App.buildAvatarCharMap=buildAvatarCharMap;

    var DEFAULT_STUDENTS = DemoData.students;
    var DEFAULT_BANKS = DemoData.banks;

    var DATA_VERSION = 5;
    // 学生等级默认表：前5级为原有，后9级为新增（门槛逐级翻倍到 512000）
    var DEFAULT_LEVELS = [
        {name:'新手',minPoints:0,comment:'初出茅庐，继续加油！'},
        {name:'学徒',minPoints:100,comment:'小有所成，前途无量！'},
        {name:'熟手',minPoints:300,comment:'技艺精湛，令人佩服！'},
        {name:'专家',minPoints:600,comment:'学识渊博，无人能敌！'},
        {name:'大师',minPoints:1000,comment:'登峰造极，一代宗师！'},
        {name:'宗师',minPoints:2000,comment:'开宗立派，实力超群！'},
        {name:'泰斗',minPoints:4000,comment:'学识如海，众人仰望！'},
        {name:'传奇',minPoints:8000,comment:'已成传奇，故事流传！'},
        {name:'王者',minPoints:16000,comment:'王者风范，所向披靡！'},
        {name:'神话',minPoints:32000,comment:'书写神话，无人能及！'},
        {name:'圣者',minPoints:64000,comment:'超凡入圣，心如明镜！'},
        {name:'至尊',minPoints:128000,comment:'至尊之位，天下无双！'},
        {name:'战神',minPoints:256000,comment:'战无不胜，气吞山河！'},
        {name:'巅峰',minPoints:512000,comment:'登临巅峰，俯瞰群雄！'}
    ];
    var LEVEL_SCHEMA_VERSION = 2;

    App.Storage = {
        get:function(k,d){try{var v=localStorage.getItem('exam_'+k);return v?JSON.parse(v):d}catch(e){return d}},
        set:function(k,v){try{localStorage.setItem('exam_'+k,JSON.stringify(v))}catch(e){}},
        ensureDefaults:function(){
            var ver=this.get('dataVersion',0);
            if(ver<DATA_VERSION){
                var students=this.get('students',null);
                // 演示名单已彻底停用：没有学生就保持空，等云端/老师自己录入
                if(students&&students.length>0){
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
        // 一次性为三种新模式各建一个「测试用·可删除」的正常题库；删掉后不会再自动补回
        seedNewModeBanks:function(){
            try{
                if(localStorage.getItem('exam_seed_new_modes_v1'))return;
                var banks=this.getBanks(),changed=false;
                var add=function(name,type,extra){
                    if(banks.some(function(b){return b.name===name}))return;
                    var b={id:App.genBankId(),name:name,type:type,description:'测试用，可删除',createdAt:Date.now(),_newFile:true};
                    for(var k in extra)b[k]=extra[k];
                    banks.push(b);changed=true;
                };
                add('拼音测试题库','pinyin',{questions:[
                    {id:App.genId(),text:'春天来了',char:'春',pinyin:'chūn',points:10},
                    {id:App.genId(),text:'夏天很热',char:'夏',pinyin:'xià',points:10},
                    {id:App.genId(),text:'秋天到了',char:'秋',pinyin:'qiū',points:10},
                    {id:App.genId(),text:'冬天很冷',char:'冬',pinyin:'dōng',points:10},
                    {id:App.genId(),text:'花园里的花开了',char:'花',pinyin:'huā',points:10},
                    {id:App.genId(),text:'树上有一只小鸟',char:'鸟',pinyin:'niǎo',points:10},
                    {id:App.genId(),text:'小河里的水很清',char:'水',pinyin:'shuǐ',points:10},
                    {id:App.genId(),text:'月亮挂在天上',char:'月',pinyin:'yuè',points:10},
                    {id:App.genId(),text:'我们每天都要学习',char:'学',pinyin:'xué',points:10},
                    {id:App.genId(),text:'树叶变绿了',char:'绿',pinyin:'lǜ',points:10},
                    {id:App.genId(),text:'下雨了要带伞',char:'雨',pinyin:'yǔ',points:10},
                    {id:App.genId(),text:'白云在天上飘',char:'云',pinyin:'yún',points:10}
                ]});
                add('阅读测试题库','reading',{
                    title:'春天来了',
                    article:'春天来了。小草从土里钻出来，绿绿的。花园里的花开了，红的、白的、黄的，真好看。小鸟在树上唱歌，蝴蝶在花丛中飞舞。小朋友们脱下棉衣，在草地上奔跑。春天真美啊！',
                    questions:[
                        {id:App.genId(),text:'文章写的是哪个季节？',options:{A:'春天',B:'夏天',C:'秋天',D:'冬天'},answer:'A',points:10},
                        {id:App.genId(),text:'小草是什么颜色的？',options:{A:'红的',B:'绿的',C:'黄的',D:'白的'},answer:'B',points:10},
                        {id:App.genId(),text:'小朋友们在草地上做什么？',options:{A:'睡觉',B:'奔跑',C:'读书',D:'吃饭'},answer:'B',points:10}
                    ]
                });
                add('填空测试题库','fill',{questions:[
                    {id:App.genId(),text:'我会写数字____。',answers:['一'],points:10},
                    {id:App.genId(),text:'天上有____个太阳。',answers:['一'],points:10},
                    {id:App.genId(),text:'____和____都是数字。',answers:['一','二'],points:10}
                ]});
                if(changed)this.setBanks(banks);
                localStorage.setItem('exam_seed_new_modes_v1','1');
            }catch(e){}
        },
        getStudents:function(){
            var s=this.get('students',[])||[];
            // 演示名单已停用：任何位置读到演示学生一律剔除，顺手清理存储
            var clean=(s||[]).filter(function(x){return x&&!x._demo});
            if(clean.length!==s.length){this.set('students',clean)}
            return clean;
        },
        setStudents:function(s){var hasReal=s.some(function(x){return!x._demo});if(hasReal){s=s.filter(function(x){return!x._demo})}this.set('students',s);if(!this._syncSilent)App.Sync.notifyChange('students',s)},
        getBanks:function(){
            var banks=this.get('banks',[]);
            // 本地始终保留且仅保留一条测试题库；只写本地，不写 exam_file_index，不上云
            if(!this._skipDemoRefill&&!banks.some(function(x){return x._demo})&&typeof DemoData!=='undefined'&&DemoData.banks&&DemoData.banks[0]){
                var demo=JSON.parse(JSON.stringify(DemoData.banks[0]));
                demo._demo=true;demo.createdAt=Date.now();
                banks.push(demo);
                this.set('banks',banks);
            }
            this._skipDemoRefill=false;
            // 老题库可能没写 type：按内容补一次并落盘，保证各模式题库严格分开
            var _typeFixed=false;
            banks.forEach(function(b){
                if(!b||!App.BankTypes||!App.BankTypes.guess)return;
                if(!b.type){
                    var _t=App.BankTypes.guess(b);
                    if(_t!=='single'){b.type=_t;_typeFixed=true}
                    return;
                }
                // 老题库被记成“单选题”，但内容明确是阅读（有主文章）等类型 → 按内容纠正
                if(b.type==='single'){
                    var _g=App.BankTypes.guess(b);
                    if(_g!=='single'){b.type=_g;_typeFixed=true}
                }
            });
            if(_typeFixed)this.set('banks',banks);
            return banks
        },
        setBanks:function(b){
            // 至多保留一条 demo 题库（只留第一条），真实题库照常保留
            var demoKept=false;
            b=b.filter(function(x){
                if(!x._demo)return true;
                if(demoKept)return false;
                demoKept=true;return true
            });
            this.set('banks',b);
            if(!this._syncSilent)App.Sync.notifyChange('banks',b);
            // 把题库类型写进文件索引，并把文件名补上类型后缀（云端未下载也能识别类型）
            try{
                if(App.BankTypes){
                    var _ix=JSON.parse(localStorage.getItem('exam_file_index')||'[]'),_ch=false;
                    b.forEach(function(x){
                        if(!x||!x.id||x._demo)return;
                        var ty=App.BankTypes.of(x),tags=App.BankTypes.tagsOfBank(x),e=_ix.find(function(y){return y.id===x.id});
                        if(!e)return;
                        if(e.bankType!==ty){e.bankType=ty;_ch=true}
                        if(String(e.bankTags||'')!==String(tags.join(','))){e.bankTags=tags;_ch=true}
                        var want=App.BankTypes.fileWithTags(x.name,tags);
                        if(e.name!==want){e.name=want;_ch=true}
                    });
                    if(_ch)localStorage.setItem('exam_file_index',JSON.stringify(_ix));
                }
            }catch(e){}
        },
        // 把文件索引里“仅云端题库”的类型补齐（能读文件名后缀的读后缀，本地有副本的用本地类型）
        fixBankIndexTypes:function(){
            try{
                if(!App.BankTypes)return;
                var idx=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                // 用 getBanks 取（内含“按内容纠正旧题库题型”），「补标签」按钮也能纠正
                var banks=this.getBanks()||[];
                var ch=false;
                // 云端索引里的文件名是“权威名”，本地同 ID 题库跟随（云端改了编号，本地也同步显示）
                var _idxNames={};
                idx.forEach(function(f){if(f&&f.id&&f.name)_idxNames[f.id]=f.name});
                // 本地题库：缺标签的补成 [题型, 科目]
                var _bch=false;
                banks.forEach(function(b){
                    if(!b||!b.id)return;
                    var _iname=_idxNames[b.id];
                    if(_iname&&b.name!==App.BankTypes.stripAllTags(_iname)){
                        var _it=App.BankTypes.tagsOfName(_iname);
                        b.name=App.BankTypes.stripAllTags(_iname);
                        if(_it.length)b.tags=_it;
                        _bch=true;
                    }
                    // 云端文件名带标签下载到本地后：拆出标签，显示名只留主干
                    var nameTags=App.BankTypes.tagsOfName(b.name);
                    if(nameTags.length){
                        b.name=App.BankTypes.stripAllTags(b.name);
                        b.tags=nameTags;
                        if(!App.BankTypes.TYPES[b.type])b.type=nameTags[0];
                        _bch=true;
                    }
                    var tags=App.BankTypes.tagsOfBank(b);
                    var sub=App.BankTypes.guessSubject(b.name,tags[0]);
                    if(tags.length<2||(tags[1]==='未分类'&&sub!=='未分类')){
                        b.tags=[tags[0],sub];
                        _bch=true;
                    }else if(!b.tags||b.tags[0]!==tags[0]){
                        b.tags=tags;
                        _bch=true;
                    }
                });
                if(_bch){this.set('banks',banks);ch=true}
                // 对账：索引里存在、但本地 banks 没有的题库 → 一定属于“仅云端”，避免老题库凭空消失
                var _localIds={};
                banks.forEach(function(b){if(b&&b.id)_localIds[b.id]=1});
                idx.forEach(function(f){
                    if(f&&f.id&&/^QB_/.test(String(f.id))&&!_localIds[f.id]&&!f.cloudOnly){f.cloudOnly=true;ch=true}
                });
                idx.forEach(function(f){
                    if(!f||!f.id||!f.cloudOnly||!/^QB_/.test(String(f.id)))return;
                    var tags=App.BankTypes.tagsOfName(f.name);
                    var local=banks.find(function(x){return x.id===f.id});
                    var ty=tags[0]||(local?App.BankTypes.of(local):'single');
                    if(!ty)return;
                    if(f.bankType!==ty){f.bankType=ty;ch=true}
                    var full=tags.length?tags:[ty];
                    if(full.length<2)full=[ty,App.BankTypes.guessSubject(f.name,ty)];
                    if(String(f.bankTags||'')!==String(full.join(','))){f.bankTags=full;ch=true}
                    var want=App.BankTypes.fileWithTags(f.name,full);
                    if(f.name!==want){f.name=want;ch=true}
                });
                if(ch)localStorage.setItem('exam_file_index',JSON.stringify(idx));
            }catch(e){}
        },
        getRecords:function(){return this.get('records',[])},
        setRecords:function(r){this.set('records',r);if(!this._syncSilent){App.Sync.notifyChange('records',r);if(App.Ledger)App.Ledger.onRecordsChanged(r)}},
        getExamProgress:function(){return this.get('examProgress',null)},
        setExamProgress:function(p){this.set('examProgress',p)},
        clearExamProgress:function(){localStorage.removeItem('exam_examProgress')},
        getWrongSets:function(){return this.get('wrongSets',{})},
        setWrongSets:function(w){this.set('wrongSets',w)},
        getWrongSet:function(studentId,bankId){var all=this.getWrongSets();return all[studentId+'_'+bankId]||null},
        setWrongSet:function(studentId,bankId,data){var all=this.getWrongSets();all[studentId+'_'+bankId]=data;this.setWrongSets(all)},
        clearWrongSet:function(studentId,bankId){var all=this.getWrongSets();delete all[studentId+'_'+bankId];this.setWrongSets(all)},
        getAbsences:function(){return this.get('absences',{})},
        setAbsences:function(a){this.set('absences',a)},
        getAbsence:function(studentId){var all=this.getAbsences();return all[studentId]||null},
        setAbsence:function(studentId,data){var all=this.getAbsences();all[studentId]=data;this.setAbsences(all)},
        clearAbsence:function(studentId){var all=this.getAbsences();delete all[studentId];this.setAbsences(all)},
        getSettings:function(){
            var def={
                levels:DEFAULT_LEVELS.map(function(l){return {name:l.name,minPoints:l.minPoints,comment:l.comment}}),
                levelSchemaVersion:LEVEL_SCHEMA_VERSION,
                aiApiUrl:'https://open.bigmodel.cn/api/paas/v4/chat/completions',aiApiKey:'a2c7cedcd0c64b74abf9967d85ba3d4c.lRKWx5uvKXz7Gn6B',aiModel:'glm-4.7-flash',
                soundEnabled:true,soundVolume:70,
                shuffleOptions:true,baseTimeout:30,charTimeoutCompensation:0.2,autoNext:true,drawAnimation:true,drawDuration:3
            };
            var s=this.get('settings',def);
            if(!s||typeof s!=='object')s=def;
            if(!Array.isArray(s.levels))s.levels=DEFAULT_LEVELS.map(function(l){return {name:l.name,minPoints:l.minPoints,comment:l.comment}});
            // 一次性升级：只补缺失的高等级，不覆盖老师自定义的等级名/门槛；升级过就不再重复
            if(!s.levelSchemaVersion||s.levelSchemaVersion<LEVEL_SCHEMA_VERSION){
                var changed=false;
                DEFAULT_LEVELS.slice(5).forEach(function(l){
                    if(!s.levels.some(function(x){return x.minPoints===l.minPoints})){
                        s.levels.push({name:l.name,minPoints:l.minPoints,comment:l.comment});
                        changed=true;
                    }
                });
                if(changed)s.levels.sort(function(a,b){return (a.minPoints||0)-(b.minPoints||0)});
                s.levelSchemaVersion=LEVEL_SCHEMA_VERSION;
                this.set('settings',s);
            }
            return s;
        },
        setSettings:function(s){
            var oldSettings=this.getSettings();
            var oldLevels=oldSettings.levels;
            var oldAiConfig={aiApiUrl:oldSettings.aiApiUrl,aiApiKey:oldSettings.aiApiKey,aiModel:oldSettings.aiModel};
            this.set('settings',s);
            if(!this._syncSilent){
                var newLevels=s&&s.levels;
                var newAiConfig=s?{aiApiUrl:s.aiApiUrl,aiApiKey:s.aiApiKey,aiModel:s.aiModel}:null;
                if(JSON.stringify(oldLevels)!==JSON.stringify(newLevels)&&newLevels){
                    App.Sync.notifyChange('levels',newLevels);
                }
                if(JSON.stringify(oldAiConfig)!==JSON.stringify(newAiConfig)&&newAiConfig){
                    App.Sync.notifyChange('aiConfig',newAiConfig);
                }
            }
        },
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
            }else if(rec.allParticipants){
                // 全员参与但不在studentResults中 = 参与了但未被抽中答题
                sessions++;
            }
        });
        return{totalPoints:totalPoints,totalCorrect:totalCorrect,totalCount:totalCount,sessions:sessions,accuracy:totalCount>0?Math.round(totalCorrect/totalCount*100):0};
    }
    // 供按需加载的模块（拼音/课外阅读）复用
    App.getLevel=getLevel;
    App.getStudentStats=getStudentStats;

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
            // 全员参与时，不在studentResults中的学生也算参与了1场
            if(rec.allParticipants){
                students.forEach(function(s){
                    if(!srs[s.id]&&statsMap[s.id]){
                        statsMap[s.id].sessions++;
                    }
                });
            }
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
        showScorePopup:function(pts,isCorrect,label){var el=document.createElement('div');el.className='score-popup '+(isCorrect?'positive':'negative');el.textContent=isCorrect?'+'+pts+(label?' '+label:''):'✗';document.body.appendChild(el);setTimeout(function(){el.remove()},1200)}
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
            if(App.Role&&App.Role.isStudent()){var _me=App.Role.student();students=_me?[_me]:[]}
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
            var avMap=buildAvatarCharMap(filtered);
            html+='<div class="student-list">';
            filtered.forEach(function(s){
                var lv=getLevel(s.totalPoints);
                html+='<div class="student-row" data-id="'+s.id+'">';
                html+='<div class="sr-head" onclick="App.Students.toggleRow(this)">';
                html+='<span class="sr-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</span>';
                html+='<span class="sr-name">'+s.name+'</span>';
                html+='<span class="sr-points">⭐ '+s.totalPoints+'</span>';
                html+='<span class="sr-arrow">▾</span>';
                html+='</div>';
                html+='<div class="sr-body">';
                html+='<div class="sr-line"><span>等级</span><b>'+lv.name+'</b></div>';
                html+='<div class="sr-line"><span>正确率</span><b>'+(s.totalCount>0?s.accuracy+'%':'-')+'</b></div>';
                html+='<div class="sr-line"><span>正确/总题</span><b>'+(s.totalCount>0?s.totalCorrect+'/'+s.totalCount:'-')+'</b></div>';
                html+='<div class="sr-line"><span>性别</span><b>'+(s.gender||'-')+'</b></div>';
                html+='<div class="sr-line"><span>小组</span><b>'+(s.group||'-')+'</b></div>';
                html+='<div class="sr-line"><span>场次</span><b>'+s.sessions+'</b></div>';
                html+='<div class="sr-actions"><button class="btn-secondary btn-sm" onclick="event.stopPropagation();App.Students.showPointsDetail(\''+s.id+'\')">查看完整详情</button></div>';
                html+='</div></div>';
            });
            html+='</div>';
            wrap.innerHTML=html;
            if(App.Students&&App.Students.renderRanking)App.Students.renderRanking();
        },
        // 全班总账排名：优先用云端批量读回的总账，没有就用本地统计
        renderRanking:function(){
            var el=document.getElementById('ledger-rank');
            if(!el)return;
            var cache=App.Ledger?App.Ledger.getCachedSummaries():{at:0,items:[]};
            var rows=cache.items&&cache.items.length?cache.items.map(function(x){
                return {name:x.name||'',absId:x.absId||'',points:x.points||0,accuracy:x.accuracy||0,sessions:x.sessions||0,fromCloud:true};
            }):App.Storage.getStudents().map(function(s){
                var st=getStudentStats(s.id)||{totalPoints:0,accuracy:0,sessions:0};
                return {name:s.name,absId:App.Ledger?App.Ledger.absIdOf(s):s.id,points:st.totalPoints||0,accuracy:st.accuracy||0,sessions:st.sessions||0,fromCloud:false};
            });
            if(!rows.length){el.innerHTML='<span style="color:var(--text-muted)">暂无学生</span>';return}
            rows.sort(function(a,b){return b.points-a.points});
            var when=cache.at?new Date(cache.at).toLocaleTimeString('zh-CN'):'';
            var html='<div style="color:var(--text-muted);font-size:12px;margin-bottom:6px">'+(cache.at?('☁️ 云端总账 · '+when+' 读取 · '+rows.length+' 人'):'📱 本地统计（点右上角从云端批量读取）')+'</div>';
            html+='<div style="display:flex;flex-direction:column;gap:2px">';
            rows.forEach(function(r,i){
                var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
                html+='<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
                html+='<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+medal+' '+r.name+'</span>';
                html+='<span style="flex:0 0 auto;color:var(--text-muted)">'+r.points+'⭐ · '+r.accuracy+'% · '+r.sessions+'场</span>';
                html+='</div>';
            });
            html+='</div>';
            el.innerHTML=html;
        },
        // 学情：一次只展开一个学生
        toggleRow:function(el){
            var row=el&&el.closest?el.closest('.student-row'):null;
            if(!row)return;
            var open=row.classList.contains('open');
            document.querySelectorAll('.student-row.open').forEach(function(r){r.classList.remove('open')});
            if(!open)row.classList.add('open');
            if(App.Effects&&App.Effects.playClick)App.Effects.playClick();
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
            body+='<div class="lb-avatar" style="width:64px;height:64px;font-size:28px;margin:0 auto 10px">'+(student.avatar?'<img src="'+student.avatar+'">':(buildAvatarCharMap([student])[student.id]||student.name.charAt(0)))+'</div>';
            body+='<div style="font-size:22px;font-weight:800">'+student.name+'</div>';
            body+='<div style="font-size:12px;color:var(--text-muted);margin-top:2px">绝对ID：'+(App.Ledger?App.Ledger.absIdOf(student):student.id)+'</div>';
            body+='<div style="color:var(--gold);font-weight:600">'+lv.name+' - '+lv.comment+'</div>';
            body+='<div style="font-size:28px;font-weight:900;color:var(--accent-2);margin-top:8px">⭐ '+st.totalPoints+' 分</div>';
            body+='<div style="font-size:14px;color:var(--text-muted);margin-top:4px">正确率 '+st.accuracy+'% · 共参加 '+st.sessions+' 场挑战</div>';
            body+='</div>';
            if(history.length===0){
                body+='<div style="text-align:center;color:var(--text-muted);padding:20px">暂无挑战记录</div>';
            }else{
                // 按题库汇总（含练习模式）
                var bankSum=App.Records.summarizeByBank?App.Records.summarizeByBank(history):[];
                if(bankSum.length){
                    body+='<div style="font-weight:700;font-size:14px;margin:4px 0 8px">📚 按题库汇总</div>';
                    body+='<div class="sh-bank-sum">';
                    bankSum.forEach(function(b){
                        var c=b.pct>=90?'var(--success)':b.pct>=60?'var(--gold)':'var(--danger)';
                        body+='<div class="sh-bank-row">';
                        body+='<div class="sh-bank-name" title="'+b.bank+'">'+b.bank+'</div>';
                        body+='<div class="sh-bank-meta">'+b.times+' 次 · 答对 '+b.correct+'/'+b.total+' · <b style="color:'+c+'">'+b.pct+'%</b> · +'+b.points+'⭐</div>';
                        body+='</div>';
                    });
                    body+='</div>';
                }
                body+='<div style="font-weight:700;font-size:14px;margin:14px 0 8px">📅 逐场记录</div>';
                history.forEach(function(h){
                    var modeLabel=h.mode==='draw'?'🎲 多人挑战':h.mode==='assign'?'👤 单人挑战':h.mode==='pk'?'⚔️ PK':h.mode==='farm'?'🌾 打野':h.mode==='challenge'?'🎯 挑战':h.mode==='pinyin'?'拼 拼音练习':h.mode==='fill'?'✍️ 填空练习':h.mode==='reading'?'📖 阅读选择':h.mode==='practice'?'📝 选择练习':h.mode==='smart'?'🧠 智能抽查':h.mode==='group'?'👥 分组':'🎮 未知';
                    var dateStr=new Date(h.date).toLocaleString('zh-CN');
                    var bankStr=h.bankNames.join('、')||'未知题库';
                    body+='<div class="sh-session">';
                    if(h.notDrawn){
                        body+='<div class="sh-session-header"><span class="sh-session-time">'+modeLabel+' · '+dateStr+'</span><span class="sh-session-score" style="color:var(--text-muted)">未抽中</span></div>';
                        body+='<div class="sh-session-detail">📚 '+bankStr+'</div>';
                        body+='<div class="sh-session-detail" style="color:var(--text-muted)">全员参与，本场未被抽中答题</div>';
                    }else{
                        var pct=h.totalCount>0?Math.round(h.correctCount/h.totalCount*100):0;
                        body+='<div class="sh-session-header"><span class="sh-session-time">'+modeLabel+' · '+dateStr+'</span><span class="sh-session-score">+'+h.pointsEarned+' 分</span></div>';
                        body+='<div class="sh-session-detail">📚 '+bankStr+'</div>';
                        body+='<div class="sh-session-detail">答对 '+h.correctCount+'/'+h.totalCount+' · 正确率 '+pct+'%</div>';
                    }
                    body+='</div>';
                });
            }
            body+='</div>';
            App.Modal.open('📊 '+student.name+' 的积分详情',body,'');
        }
    };

    App.Records = {
        render:function(){
            var records=App.Storage.getRecords();var list=document.getElementById('records-list');var empty=document.getElementById('records-empty');
            var _mf=(document.getElementById('records-mode-filter')||{}).value||'all';
            if(_mf!=='all')records=records.filter(function(r){return r.mode===_mf});
            if(records.length===0){list.innerHTML='';empty.classList.add('show');return}
            empty.classList.remove('show');records.sort(function(a,b){return b.date-a.date});
            var html='';
            records.forEach(function(rec){
                var modeLabel=rec.mode==='draw'?'🎲 多人挑战':rec.mode==='assign'?'👤 单人挑战':rec.mode==='pk'?'⚔️ PK':rec.mode==='farm'?'🌾 打野':rec.mode==='challenge'?'🎯 挑战':rec.mode==='pinyin'?'拼 拼音练习':rec.mode==='fill'?'✍️ 填空练习':rec.mode==='reading'?'📖 阅读选择':rec.mode==='practice'?'📝 选择练习':rec.mode==='smart'?'🧠 智能抽查':rec.mode==='group'?'👥 分组':'🎮 未知';
                var dateStr=new Date(rec.date).toLocaleString('zh-CN');
                var srs=rec.studentResults||{};var sNames=Object.keys(srs).map(function(k){return srs[k].name});
                var partLabel=rec.allParticipants?' 👥全员':'';
                var nameStr=sNames.slice(0,3).join('、')+(sNames.length>3?'...':'');
                var titleText=dateStr+' '+modeLabel+partLabel+' '+nameStr;
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
                    var gScores={};
                    sKeys.forEach(function(k){var sr=srs[k];if(sr.group){gScores[sr.group]=(gScores[sr.group]||0)+(sr.pointsEarned||0)}});
                    var sortedGroups=Object.keys(gScores).sort(function(a,b){return gScores[b]-gScores[a]});
                    sortedGroups.forEach(function(gn,i){
                        var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                        html+='<div class="record-student-row"><span class="record-student-name">'+medal+' 🏆 '+gn+'</span><span class="record-student-score">'+gScores[gn]+' 分</span></div>';
                    });
                    var gSorted=sKeys.map(function(k){return srs[k]}).sort(function(a,b){return(b.pointsEarned||0)-(a.pointsEarned||0)});
                    gSorted.forEach(function(sr,i){
                        var pct=sr.totalCount>0?Math.round(sr.correctCount/sr.totalCount*100):0;
                        var pctColor=pct>=90?'var(--success)':pct>=60?'var(--gold)':'var(--danger)';
                        var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                        html+='<div class="record-student-row" style="flex-wrap:wrap;gap:4px 0">';
                        html+='<div style="display:flex;justify-content:space-between;width:100%;align-items:center">';
                        html+='<span class="record-student-name">'+medal+' '+sr.name+(sr.group?' <span style="font-size:12px;color:var(--text-muted)">('+sr.group+')</span>':'')+'</span>';
                        html+='<span class="record-student-score">+'+sr.pointsEarned+' ⭐</span>';
                        html+='</div>';
                        html+='<div style="display:flex;gap:12px;width:100%;font-size:12px;color:var(--text-muted);padding-left:24px">';
                        html+='<span>答题 '+sr.totalCount+' 题</span>';
                        html+='<span>答对 '+sr.correctCount+' 题</span>';
                        html+='<span>正确率 <b style="color:'+pctColor+'">'+pct+'%</b></span>';
                        html+='</div>';
                        html+='</div>';
                    });
                }else{
                    var sorted=sKeys.map(function(k){return srs[k]}).sort(function(a,b){return(b.pointsEarned||0)-(a.pointsEarned||0)});
                    sorted.forEach(function(sr,i){
                        var pct=sr.totalCount>0?Math.round(sr.correctCount/sr.totalCount*100):0;
                        var pctColor=pct>=90?'var(--success)':pct>=60?'var(--gold)':'var(--danger)';
                        var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                        html+='<div class="record-student-row" style="flex-wrap:wrap;gap:4px 0">';
                        html+='<div style="display:flex;justify-content:space-between;width:100%;align-items:center">';
                        html+='<span class="record-student-name">'+medal+' '+sr.name+'</span>';
                        html+='<span class="record-student-score">+'+sr.pointsEarned+' ⭐</span>';
                        html+='</div>';
                        html+='<div style="display:flex;gap:12px;width:100%;font-size:12px;color:var(--text-muted);padding-left:24px">';
                        html+='<span>答题 '+sr.totalCount+' 题</span>';
                        html+='<span>答对 '+sr.correctCount+' 题</span>';
                        html+='<span>正确率 <b style="color:'+pctColor+'">'+pct+'%</b></span>';
                        html+='</div>';
                        html+='</div>';
                    });
                }
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
            var modeLabel=rec.mode==='draw'?'多人挑战':rec.mode==='assign'?'单人挑战':rec.mode==='pk'?'PK':rec.mode==='farm'?'打野':rec.mode==='challenge'?'挑战':rec.mode==='pinyin'?'拼音练习':rec.mode==='fill'?'填空练习':rec.mode==='reading'?'阅读选择':rec.mode==='practice'?'选择练习':rec.mode==='smart'?'智能抽查':rec.mode==='group'?'分组':'未知';
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
        // 账本核对结果展示（数据管理页）
        showAudit:function(){
            var el=document.getElementById('ledger-audit-result');
            var r=App.Ledger?App.Ledger.audit():null;
            if(!r){if(el)el.textContent='核对不可用（缺少账本模块）';return}
            var ok='var(--success)',bad='var(--danger)';
            var html='';
            html+='<div style="font-weight:700;color:'+(r.ok?ok:bad)+';margin-bottom:6px">'+(r.ok?'✅ 总账与分账一致':'⚠️ 发现不一致，需检查')+'</div>';
            html+='<div>总账：答对 '+r.total.correct+' / 总题 '+r.total.total+' · 积分 '+r.total.points+'</div>';
            html+='<div>分账：答对 '+r.ledger.correct+' / 总题 '+r.ledger.total+' · 积分 '+r.ledger.points+'</div>';
            html+='<div style="color:var(--text-muted);margin-top:4px">学生 '+r.students+' 人 · 场次 '+r.records+' 场</div>';
            if(r.mismatches.length){
                html+='<div style="margin-top:8px;font-weight:600">对不上的学生（'+r.mismatches.length+'）：</div>';
                r.mismatches.forEach(function(m){
                    html+='<div>· '+m.name+'（'+m.absId+'） 账本 '+m.stats.c+'/'+m.stats.t+'/'+m.stats.p+' vs 重算 '+m.recalc.c+'/'+m.recalc.t+'/'+m.recalc.p+'</div>';
                });
            }
            if(el)el.innerHTML=html;
            App.Toast.show(r.ok?'账本核对通过':'账本核对发现问题',r.ok?'success':'error');
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
            records.forEach(function(rec){var srs=rec.studentResults||{};if(srs[studentId]){history.push({id:rec.id,date:rec.date,mode:rec.mode,bankNames:rec.bankNames||[],bankIds:rec.bankIds||[],correctCount:srs[studentId].correctCount,totalCount:srs[studentId].totalCount,pointsEarned:srs[studentId].pointsEarned})}else if(rec.allParticipants){history.push({id:rec.id,date:rec.date,mode:rec.mode,bankNames:rec.bankNames||[],bankIds:rec.bankIds||[],correctCount:0,totalCount:0,pointsEarned:0,notDrawn:true})}});
            history.sort(function(a,b){return b.date-a.date});return history;
        },
        // 按题库汇总某学生历史：每份题库做了几次、答对多少、正确率、累计得分
        summarizeByBank:function(history){
            var map={},order=[];
            (history||[]).forEach(function(h){
                if(h.notDrawn)return;
                var nm=(h.bankNames&&h.bankNames.length)?h.bankNames.join('、'):'未知题库';
                if(!map[nm]){map[nm]={bank:nm,times:0,correct:0,total:0,points:0,lastDate:0};order.push(nm)}
                var o=map[nm];
                o.times++;o.correct+=(h.correctCount||0);o.total+=(h.totalCount||0);o.points+=(h.pointsEarned||0);
                if(h.date>o.lastDate)o.lastDate=h.date;
            });
            return order.map(function(k){var o=map[k];o.pct=o.total>0?Math.round(o.correct/o.total*100):0;return o})
                        .sort(function(a,b){return b.lastDate-a.lastDate});
        }
    };

    // ========== 学生个人考试历史（按考试类型切割总流水账） ==========
    App.History = {
        META:{farm:{n:'🌾 打野'},challenge:{n:'🎯 挑战'},pk:{n:'⚔️ PK'},practice:{n:'📝 选择练习'},smart:{n:'🧠 智能抽查'},pinyin:{n:'拼 拼音练习'},reading:{n:'📖 阅读选择'},fill:{n:'✍️ 填空练习'},lottery:{n:'🎲 抽签'}},
        _summaryHTML:function(sid){
            var st=App.getStudentStats(sid);
            return '<div class="history-summary-row"><span>总积分 <b style="color:var(--gold)">'+st.totalPoints+'⭐</b></span><span>正确率 <b>'+st.accuracy+'%</b></span><span>场次 <b>'+st.sessions+'</b></span><span>答对 <b>'+st.totalCorrect+'/'+st.totalCount+'</b></span></div>';
        },
        open:function(){
            var me=App.Role&&App.Role.student?App.Role.student():null;
            if(!me){App.Toast.show('请先在学生模式下查看','warning');return}
            this._mode='all';this._bank='';
            var body=this._summaryHTML(me.id)+'<div class="history-filter">';
            body+='<button class="btn-sm btn-primary" data-m="all" onclick="App.History.filter(this,\''+me.id+'\')">全部</button>';
            ['practice','pinyin','reading','fill','farm','challenge','pk','smart'].forEach(function(m){
                body+='<button class="btn-sm btn-secondary" data-m="'+m+'" onclick="App.History.filter(this,\''+me.id+'\')">'+(App.History.META[m]?App.History.META[m].n:m)+'</button>';
            });
            body+='</div><div class="history-filter" style="margin-top:8px"><select id="hist-bank" onchange="App.History._bank=this.value;App.History.render(\''+me.id+'\',App.History._mode||\'all\')"><option value="">全部题库</option>';
            App.Storage.getBanks().forEach(function(b){
                var nm=String(b.name||'').replace(/</g,'&lt;');
                body+='<option value="'+String(b.id||'').replace(/"/g,'')+'">'+nm+'</option>';
            });
            body+='</select></div><div id="history-list" style="margin-top:10px"></div>';
            App.Modal.open('📜 '+me.name+' 的考试历史',body,'<button class="btn-secondary" onclick="App.Modal.close()">关闭</button>');
            this.render(me.id,'all');
        },
        // 开始考试前的设置界面：只看当前模式的历史
        openCurrent:function(){
            var mode=App.Exam&&App.Exam.currentMode;
            if(!mode||mode==='history'){App.Toast.show('请先选择考试模式','warning');return}
            var me=App.Role&&App.Role.student?App.Role.student():null;
            if(me){this.openFor(me.id,mode);return}
            var ids=App.Exam.getSelectedStudentIds();
            if(ids.length===1){
                var st=App.Storage.getStudents().find(function(s){return s.id===ids[0]});
                if(st){this.openFor(st.id,mode);return}
            }
            App.Toast.show('请先选择1名学生（或切到学生模式）','warning');
        },
        openFor:function(sid,mode){
            var st=App.Storage.getStudents().find(function(s){return s.id===sid});
            if(!st){App.Toast.show('找不到该学生','warning');return}
            var nm=(this.META[mode]&&this.META[mode].n)||mode;
            var body=this._summaryHTML(sid)+'<div id="history-list"></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-secondary" onclick="App.Modal.close();App.History.open()">看全部类型</button>';
            App.Modal.open('📜 '+st.name+' · '+nm+' 历史',body,footer);
            this.render(sid,mode);
        },
        filter:function(btn,sid){
            var wrap=btn.parentNode;wrap.querySelectorAll('button').forEach(function(b){b.className='btn-sm btn-secondary'});
            btn.className='btn-sm btn-primary';
            this._mode=btn.dataset.m;
            this.render(sid,btn.dataset.m);
        },
        render:function(sid,mode){
            var box=document.getElementById('history-list');if(!box)return;
            var bid=this._bank||'';
            var bn='';if(bid){var _b=(App.Storage.getBanks()||[]).find(function(x){return x.id===bid});bn=_b?_b.name:''}
            var recs=App.Storage.getRecords().filter(function(r){
                var sr=(r.studentResults||{})[sid];
                if(!(sr&&sr.totalCount>0&&(mode==='all'||r.mode===mode)))return false;
                if(bid){var hit=(r.bankIds&&r.bankIds.length)?(r.bankIds.indexOf(bid)>=0):((r.bankNames||[]).indexOf(bn)>=0);if(!hit)return false}
                return true;
            });
            recs.sort(function(a,b){return b.date-a.date});
            if(!recs.length){box.innerHTML='<p style="color:var(--text-muted);padding:10px 0">该类型还没有考试记录</p>';return}
            var html='<div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px">共 '+recs.length+' 场</div>';
            recs.forEach(function(r){
                var sr=r.studentResults[sid];
                var pct=sr.totalCount>0?Math.round(sr.correctCount/sr.totalCount*100):0;
                var name=(App.History.META[r.mode]&&App.History.META[r.mode].n)||r.mode;
                html+='<div style="border-bottom:1px solid var(--border-color);padding:8px 0">';
                html+='<div style="display:flex;justify-content:space-between;gap:8px"><b>'+name+'</b><span style="color:var(--gold);font-weight:700">+'+sr.pointsEarned+' ⭐</span></div>';
                html+='<div style="font-size:12px;color:var(--text-muted);margin-top:2px">'+new Date(r.date).toLocaleString('zh-CN')+' · 答对 '+sr.correctCount+'/'+sr.totalCount+'（'+pct+'%）'+(r.bankNames&&r.bankNames.length?' · '+r.bankNames.join('、'):'')+'</div>';
                html+='</div>';
            });
            box.innerHTML=html;
        }
    };

    // ========== 绝对 ID 与「每学生一本分账」 ==========
    // 规则：学生注册即分配绝对ID，此后永不更改；学生的一切追踪（分账、云端分行）都锚定它。
    // 总账＝系统-学生信息 + 系统-考试数据（全班）；分账＝每生一本「学生-<绝对ID>」，两者同源派生，可核对。
    App.Ledger = {
        genAbsId:function(){
            var t=Date.now().toString(36).toUpperCase();
            var pool='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r='';
            for(var i=0;i<4;i++)r+=pool.charAt(Math.floor(Math.random()*pool.length));
            return 'S'+t.slice(-6)+r;
        },
        // 补齐历史学生：优先沿用原 id 作为绝对ID（保证旧记录仍对得上），原 id 缺失才新生成
        ensureAbsIds:function(){
            var students=App.Storage.getStudents();var changed=false;var used={};
            students.forEach(function(s){if(s.absId)used[s.absId]=1});
            students.forEach(function(s){
                if(s.absId)return;
                var cand=(s.id&&!used[s.id])?s.id:'';
                if(!cand){cand=this.genAbsId();used[cand]=1}
                s.absId=cand;
                if(!s.id)s.id=cand;
                changed=true;
            }.bind(this));
            if(changed)App.Storage.setStudents(students);
            return changed;
        },
        absIdOf:function(student){return (student&&(student.absId||student.id))||''},
        detailNameOf:function(student){return '学生-'+this.absIdOf(student)},
        summaryNameOf:function(student){return '总账-'+this.absIdOf(student)},
        // 总账（轻）：只有总分/正确率/场次，几十条可一条批量读取
        buildSummary:function(student){
            var st=getStudentStats(student.id)||{totalPoints:0,accuracy:0,sessions:0,totalCorrect:0,totalCount:0};
            return JSON.stringify({
                absId:this.absIdOf(student),name:student.name||'',group:student.group||'',
                points:st.totalPoints||0,accuracy:st.accuracy||0,sessions:st.sessions||0,
                correct:st.totalCorrect||0,total:st.totalCount||0,updatedAt:Date.now()
            });
        },
        // 详细账（重）：按题库汇总 + 逐场明细，班主任点名才拉
        buildDetail:function(student){
            var history=App.Records.getStudentHistory(student.id);
            var banks=App.Records.summarizeByBank?App.Records.summarizeByBank(history):[];
            var st=getStudentStats(student.id)||{totalPoints:0,accuracy:0,sessions:0,totalCorrect:0,totalCount:0};
            return JSON.stringify({
                absId:this.absIdOf(student),name:student.name||'',gender:student.gender||'',group:student.group||'',
                stats:{totalPoints:st.totalPoints,accuracy:st.accuracy,sessions:st.sessions,correct:st.totalCorrect,total:st.totalCount},
                banks:banks.map(function(b){return {bank:b.bank,times:b.times,correct:b.correct,total:b.total,pct:b.pct,points:b.points}}),
                sessions:history.slice(0,200).map(function(h){return {date:h.date,mode:h.mode,banks:h.bankNames,pct:(h.totalCount>0?Math.round(h.correctCount/h.totalCount*100):0),correct:h.correctCount,total:h.totalCount,points:h.pointsEarned,notDrawn:!!h.notDrawn}}),
                updatedAt:Date.now()
            });
        },
        // 写入本地并登记为云端文件（同名只更新不新建，防重复）。
        // opts: {ids:[学生id], summary:true, detail:false, saveNow:false}
        push:function(ids,opts){
            if(!App.Sync||!App.Sync._pushContent)return 0;
            opts=opts||{};
            var students=App.Storage.getStudents(),self=this,n=0;
            students.forEach(function(s){
                if(ids&&ids.length&&ids.indexOf(s.id)<0)return;
                if(opts.summary!==false){
                    var sn=self.summaryNameOf(s);
                    App.Sync._pushContent(sn,self.buildSummary(s));n++;
                    if(opts.saveNow&&App.Sync.forceSaveFile)App.Sync.forceSaveFile(sn);
                }
                if(opts.detail){
                    var dn=self.detailNameOf(s);
                    App.Sync._pushContent(dn,self.buildDetail(s));n++;
                    if(opts.saveNowDetail&&App.Sync.forceSaveFile)App.Sync.forceSaveFile(dn);
                }
            });
            return n;
        },
        // 一场考试结束：总账即时落云（轻、必定要）；详细账只在本地刷新，走常规同步慢慢传
        onRecordsChanged:function(records){
            var last=(records&&records.length)?records[records.length-1]:null;
            if(!last)return 0;
            var ids=Object.keys(last.studentResults||{});
            return this.push(ids,{summary:true,detail:true,saveNow:App.Sync._pref('on_exam_end')});
        },
        // 一条消息批量读取全班总账（只读轻账，几十行一次拿完）
        pullAllSummaries:function(){
            if(!App.Sync||!App.Sync.postToFileManager)return;
            App.Sync.postToFileManager({type:'pullLedgerSummaries'});
        },
        cacheSummaries:function(items){
            try{localStorage.setItem('exam_ledger_summaries',JSON.stringify({at:Date.now(),items:items||[]}))}catch(e){}
            if(App.Students&&App.Students.renderRanking)App.Students.renderRanking();
        },
        getCachedSummaries:function(){
            try{
                var o=JSON.parse(localStorage.getItem('exam_ledger_summaries')||'{}');
                return {at:o.at||0,items:o.items||[]};
            }catch(e){return {at:0,items:[]}}
        },
        // 账本核对：总账（records 逐条累加）vs 分账（每生累计），逐生点名差异（含已被删除的学生）
        audit:function(){
            var students=App.Storage.getStudents(),records=App.Storage.getRecords();
            var total={correct:0,total:0,points:0},per={};
            records.forEach(function(r){
                var srs=r.studentResults||{};
                Object.keys(srs).forEach(function(k){
                    var sr=srs[k]||{};
                    total.correct+=sr.correctCount||0;total.total+=sr.totalCount||0;total.points+=sr.pointsEarned||0;
                    var o=per[k]||(per[k]={name:sr.name||k,correct:0,total:0,points:0});
                    o.correct+=sr.correctCount||0;o.total+=sr.totalCount||0;o.points+=sr.pointsEarned||0;
                    if(sr.name)o.name=sr.name;
                });
            });
            var led={correct:0,total:0,points:0},rows=[],exist={};
            students.forEach(function(s){
                exist[s.id]=1;
                var st=getStudentStats(s.id)||{totalCorrect:0,totalCount:0,totalPoints:0};
                led.correct+=st.totalCorrect||0;led.total+=st.totalCount||0;led.points+=st.totalPoints||0;
                var acc=per[s.id]||{correct:0,total:0,points:0};
                if((st.totalCorrect||0)!==acc.correct||(st.totalCount||0)!==acc.total||(st.totalPoints||0)!==acc.points){
                    rows.push({name:s.name,absId:this.absIdOf(s),stats:{c:st.totalCorrect||0,t:st.totalCount||0,p:st.totalPoints||0},recalc:{c:acc.correct,t:acc.total,p:acc.points}});
                }
            }.bind(this));
            Object.keys(per).forEach(function(id){
                if(exist[id])return;
                var a=per[id];
                rows.push({name:(a.name||id)+'（已不在学生名单）',absId:id,stats:{c:0,t:0,p:0},recalc:{c:a.correct,t:a.total,p:a.points}});
            });
            return {ok:rows.length===0&&total.correct===led.correct&&total.total===led.total&&total.points===led.points,
                    total:total,ledger:led,mismatches:rows,students:students.length,records:records.length};
        }
    };

    App.Leaderboard = {
        render:function(){
            var students=App.Storage.getStudents();
            // 学生模式只看自己，不暴露全班榜单
            var _me=App.Role&&App.Role.isStudent?App.Role.student():null;
            if(_me)students=students.filter(function(s){return s.id===_me.id});
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
            var avMap=buildAvatarCharMap(sorted);
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
                podiumHTML+='<div class="podium-avatar" onclick="App.Students.showPointsDetail(\''+s.id+'\')" title="点击查看详情">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div>';
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
                    listHTML+='<div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div>';
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
            if(tab==='records'){App.Records.render();this.updateIOCounts()}
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
            var absenceEl=document.getElementById('exam-absence-compensation');
            if(absenceEl)absenceEl.checked=settings.absenceCompensation!==false;
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
            settings.absenceCompensation=document.getElementById('exam-absence-compensation').checked;
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
            var e=document.getElementById('sync-on-exam-end');
            var x=document.getElementById('sync-on-exit');
            if(e)e.checked=App.Sync._pref('on_exam_end');
            if(x)x.checked=App.Sync._pref('on_exit');
            this.updateSyncStatus();
        },
        saveSyncSettings:function(){
            App.Toast.show('同步设置请在文件管理器中修改','info');
        },
        syncNow:function(){
            var btn=document.getElementById('btn-sync-now');
            if(btn){btn.disabled=true;btn.textContent='⏳ 同步中...'}
            App.Sync.syncNow();
        },
        updateSyncStatus:function(){
            var el=document.getElementById('sync-status-info');
            if(!el)return;
            var lastTime=parseInt(localStorage.getItem('exam_last_sync_time')||'0');
            var statusText='未同步';
            if(lastTime>0){
                var d=new Date(lastTime);
                statusText='上次同步：'+d.toLocaleString('zh-CN');
            }
            el.textContent=statusText;
        },
        exportDataType:function(type){
            var data,label;
            if(type==='students'){data=App.Storage.getStudents();label='学生信息'}
            else if(type==='banks'){data=App.Storage.getBanks();label='题库文件'}
            else if(type==='records'){data=App.Storage.getRecords();label='考试数据'}
            else return;
            var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
            var url=URL.createObjectURL(blob);
            var a=document.createElement('a');
            a.href=url;a.download=label+'_'+new Date().toISOString().slice(0,10)+'.json';
            a.click();URL.revokeObjectURL(url);
            App.Toast.show(label+'已导出','success');
        },
        importDataType:function(type){
            var label=type==='students'?'学生信息':type==='banks'?'题库文件':'考试数据';
            var body='<div class="form-group"><label>选择 '+label+' 备份文件</label><input type="file" id="inp-import-dtype-file" accept=".json"></div>';
            body+='<div style="color:var(--warning);font-size:13px;margin-top:8px">⚠️ 导入将强制覆盖本地及云端'+label+'，此操作不可恢复！</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Settings.doImportDataType(\''+type+'\')">确认导入</button>';
            App.Modal.open('📥 导入'+label,body,footer);
        },
        doImportDataType:function(type){
            var fileInput=document.getElementById('inp-import-dtype-file');
            if(!fileInput||!fileInput.files||!fileInput.files[0]){App.Toast.show('请选择文件','warning');return}
            var label=type==='students'?'学生信息':type==='banks'?'题库文件':'考试数据';
            var reader=new FileReader();
            reader.onload=function(e){
                try{
                    var data=JSON.parse(e.target.result);
                    if(!Array.isArray(data)){App.Toast.show('文件格式错误：需要JSON数组','error');return}
                    if(type==='students'){App.Storage.setStudents(data);App.Students.render()}
                    else if(type==='banks'){App.Storage.setBanks(data);App.Questions.render()}
                    else if(type==='records'){App.Storage.setRecords(data);App.Records.render();App.Leaderboard.render();App.Students.render()}
                    App.Modal.close();
                    App.Settings.updateIOCounts();
                    App.Toast.show(label+'导入成功，已覆盖本地及云端','success');
                }catch(err){
                    App.Toast.show('导入失败：文件格式错误','error');
                }
            };
            reader.readAsText(fileInput.files[0]);
        },
        updateIOCounts:function(){
            var students=App.Storage.getStudents();
            var banks=App.Storage.getBanks();
            var records=App.Storage.getRecords();
            var el1=document.getElementById('io-count-students');
            var el2=document.getElementById('io-count-banks');
            var el3=document.getElementById('io-count-records');
            if(el1)el1.textContent=students.length+'人';
            if(el2)el2.textContent=banks.length+'个题库';
            if(el3)el3.textContent=records.length+'场';
        },
        clearRecords:function(){
            if(!confirm('⚠️ 确定要清空所有场次数据吗？此操作不可恢复！'))return;
            App.Storage.setRecords([]);
            App.Records.render();
            App.Leaderboard.render();
            // 清空云端场次数据文件（整行删除）
            var prefix='exam';
            var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
            var recordsFile=fileIndex.find(function(f){return f.name==='系统-考试数据'});
            if(recordsFile&&recordsFile.id){
                App.Sync.postToFileManager({type:'fileDeleted_local',fileId:recordsFile.id});
            }
            App.Toast.show('场次数据已清空','info');
        },
        resetData:function(){
            if(!confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！'))return;
            if(!confirm('再次确认：所有学生、题库、记录将被删除！云端数据也将一并删除！'))return;
            // 先删除云端所有文件（整行删除），再清空本地
            var prefix='exam';
            var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
            fileIndex.forEach(function(f){
                if(f.id){
                    App.Sync.postToFileManager({type:'fileDeleted_local',fileId:f.id});
                }
            });
            // 清空本地数据
            var keys=Object.keys(localStorage);
            keys.forEach(function(k){if(k.indexOf('exam_')===0&&k.indexOf('exam_file_')!==0&&k.indexOf('exam_sync_config')!==0&&k.indexOf('exam_last_sync')!==0&&k.indexOf('exam_device_id')!==0&&k.indexOf('exam_auth_')!==0)localStorage.removeItem(k)});
            // 同时清空文件索引和文件数据
            keys.forEach(function(k){if(k.indexOf('exam_file_')===0)localStorage.removeItem(k)});
            App.Storage.ensureDefaults();
            App.Students.render();
            App.Questions.render();
            App.Leaderboard.render();
            App.Records.render();
            this.renderLevels();
            App.Toast.show('数据已重置，云端数据正在删除中','info');
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
                var avMap=buildAvatarCharMap(students);
                groups.forEach(function(g){groupOptions+='<option value="'+g+'">'});
                var html='<table class="student-table editable"><thead><tr>';
                html+='<th>头像</th><th>姓名</th><th>性别</th><th>小组</th><th>操作</th>';
                html+='</tr></thead><tbody>';
                students.forEach(function(s){
                    html+='<tr data-id="'+s.id+'">';
                    html+='<td><div class="st-avatar-cell" onclick="App.Settings.StudentMgmt.triggerAvatarUpload(\''+s.id+'\')" title="点击更换头像">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'<input type="file" class="hidden-avatar-input" data-id="'+s.id+'" accept="image/*" onchange="App.Settings.StudentMgmt.onAvatarChange(this)"></div></td>';
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
                // 学生信息变更：刷新每人的总账与详账（姓名/组别同步进账本）
                if(App.Ledger)App.Ledger.push(null,{summary:true,detail:true});
                App.Toast.show('学生信息已保存','success');
                App.Effects.playClick();
            },
            addRow:function(){
                var students=App.Storage.getStudents();
                var absId=App.Ledger?App.Ledger.genAbsId():genId();
                var newStudent={id:absId,absId:absId,name:'新学生',avatar:'',gender:'',group:'',createdAt:Date.now()};
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
                // 清空云端学生信息文件（整行删除）
                var prefix='exam';
                var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                var studentFile=fileIndex.find(function(f){return f.name==='系统-学生信息'});
                if(studentFile&&studentFile.id){
                    App.Sync.postToFileManager({type:'fileDeleted_local',fileId:studentFile.id});
                }
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
                lines.forEach(function(line){line=line.trim();if(!line)return;var parts=line.split(','),name=parts[0].trim(),gender=parts[1]?parts[1].trim():'',group=parts[2]?parts[2].trim():'';if(name){var exists=students.some(function(s){return s.name===name});if(!exists){var sid=App.Ledger?App.Ledger.genAbsId():genId();students.push({id:sid,absId:sid,name:name,avatar:'',gender:gender,group:group,createdAt:Date.now()});count++}}});
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

    // 进入答题页时的自动全屏：仅电脑版；手机版改为手动按钮触发
    App._autoFS = function(){
        if(document.documentElement.getAttribute('data-ui')==='mobile')return;
        if(!document.fullscreenElement){
            document.documentElement.requestFullscreen().catch(function(){});
        }
    };
    App._syncFullscreenBtn = function(){
        var b=document.querySelector('.btn-play-fs');
        if(b)b.textContent=document.fullscreenElement?'退出全屏':'全屏';
    };
    document.addEventListener('fullscreenchange',function(){App._syncFullscreenBtn()});

    App._zoomLevel=100;
    App.zoomIn=function(){
        if(App._zoomLevel>=200)return;
        App._zoomLevel+=10;
        App._applyZoom();
    };
    App.zoomOut=function(){
        if(App._zoomLevel<=50)return;
        App._zoomLevel-=10;
        App._applyZoom();
    };
    App._applyZoom=function(){
        document.body.style.zoom=App._zoomLevel/100;
        var el=document.getElementById('zoom-level');
        if(el)el.textContent=App._zoomLevel+'%';
        try{localStorage.setItem('exam_zoom',App._zoomLevel)}catch(e){}
    };
    (function(){
        var saved=parseInt(localStorage.getItem('exam_zoom'));
        if(saved>=50&&saved<=200){App._zoomLevel=saved;App._applyZoom()}
    })();

    App.Sync = {
        frame:null,
        ready:false,
        _sessionReady:false,
        _isFileManagerOpen:false,
        _currentFileName:'',
        _pulling:false,
        init:function(){
            this.frame=document.getElementById('fileManagerBg');
            if(!this.frame)return;
            var self=this;
            this._attachFrameReady(this.frame);
            this._attachFrameReady(document.getElementById('fileManagerFrame'));
            window.addEventListener('message',function(e){
                if(!e.data||typeof e.data!=='object')return;
                var msg=e.data;
                if(!msg.type)return;
                // H9二次：文件管理器把多条通知合并成一帧 hostBatch，这里按原顺序逐条还原处理
                var _list=(msg.type==='hostBatch'&&Array.isArray(msg.items))?msg.items:[msg];
                _list.forEach(function(m){
                if(!m||!m.type)return;
                msg=m;
                switch(msg.type){
                    case 'fmReady':
                        // 文件管理器就绪握手：记下已就绪，只回给刚就绪的这个帧
                        self._anyFrameReady=true;
                        self._sendInitAndAuth(e.source);
                        // 帧未就绪时排队的删库请求，就绪后补发
                        if(self._pendingBankDeletes&&self._pendingBankDeletes.length){
                            var _pd=self._pendingBankDeletes;self._pendingBankDeletes=[];
                            _pd.forEach(function(m){self.postToFileManager(m)});
                        }
                        // 帧就绪前攒下的关键节点保存请求，就绪后补发
                        if(self._pendingForceSaves&&self._pendingForceSaves.length){
                            var _pfs=self._pendingForceSaves;self._pendingForceSaves=[];
                            _pfs.forEach(function(nm){self.postToFileManager({type:'forceSyncFile',name:nm})});
                        }
                        break;
                    case 'sessionReady':
                        self._sessionReady=true;
                        // H9二次：索引建好后主动拉一次，别等 syncComplete 再拉（否则通知被拆成两帧）
                        setTimeout(function(){ self.pullAllCloudContent(); },3000);
                        setTimeout(function(){ self.pullAllCloudContent(); },6500);
                        break;
                    case 'pullAllComplete':
                        // 文件管理器批量拉取完成
                        self._pulling = false;
                        break;
                    case 'openFile':
                        self._onOpenFile(msg);
                        break;
                    case 'fileContentUpdated':
                        self._onFileContentUpdated(msg);
                        break;
                    case 'fileDeleted':
                        self._onFileDeleted(msg);
                        break;
                    case 'fileRenamed':
                        self._onFileRenamed(msg);
                        break;
                    case 'closeFileManager':
                        self._isFileManagerOpen=false;
                        var modal=document.getElementById('file-modal');
                        if(modal)modal.style.display='none';
                        break;
                    case 'syncStatusChanged':
                        var btn=document.getElementById('btn-sync-now');
                        if(btn){
                            if(msg.icon==='🔄'||msg.icon==='⏳'){btn.disabled=true;btn.textContent='⏳ 同步中...'}
                            else{btn.disabled=false;btn.textContent='☁️ 立即同步'}
                        }
                        if(App.Settings&&App.Settings.updateSyncStatus)App.Settings.updateSyncStatus();
                        break;
                    case 'syncToast':
                        if(!self._isFileManagerOpen)App.Toast.show(msg.message||'','info');
                        break;
                    case 'ledgerSummaries':
                        // 一条消息批量读回的全班总账：缓存后刷新排名
                        App.Ledger.cacheSummaries(msg.items||[]);
                        if(msg.tongzhi)App.Toast.show('总账读取：'+msg.tongzhi,'warning');
                        else if(!(msg.items||[]).length)App.Toast.show('云端暂无总账，请先让学生做一场或点「重建全部账本」','info');
                        break;
                    case 'forceSyncResult':
                        // 关键节点保存结果：成功只记日志，失败必须让老师看见
                        console.log('[Save] 关键节点保存:',msg.name,msg.ok,msg.status||msg.reason||'',msg.message||'');
                        if(!msg.ok&&msg.reason!=='empty_local')App.Toast.show('「'+(msg.name||'数据')+'」未能保存到云端：'+((msg.message||msg.reason||'未知原因'))+'，请点「☁️ 立即同步」重试','error');
                        break;
                    case 'registerResult':
                        console.log('[Sync] 注册结果:',msg.success,msg.name,msg.id);
                        break;
                    case 'importResult':
                        console.log('[Sync] 导入结果:',msg.success,msg.name,msg.id);
                        break;
                    case 'loginGateResult':
                        App.Sync._applyLoginGate(msg);
                        break;
                    case 'syncComplete':
                        // 登录门禁未完成时，不允许同步完成消息提前把门禁撤掉
                        if(App.Sync._gateDone)App.Sync._hideGate();
                        if(App.Settings&&App.Settings.updateSyncStatus)App.Settings.updateSyncStatus();
                        if(!self._pulling)self.pullAllCloudContent();
                        if(App.Questions)App.Questions.render();
                        break;
                    case 'bankIdMigrated':
                        // 文件管理器通知题库ID从旧格式迁移到QB_格式
                        if(msg.oldId&&msg.newId){
                            var banks=App.Storage.getBanks();
                            var bank=banks.find(function(b){return b.id===msg.oldId});
                            if(bank){
                                bank.id=msg.newId;
                                App.Storage.setBanks(banks);
                                console.log('[Sync] 题库ID迁移: '+msg.oldId+' → '+msg.newId+' ('+msg.name+')');
                            }
                        }
                        break;
                    case 'cloudIndexUpdated':
                        // 云端索引更新完成，刷新题库列表
                        if(App.Questions)App.Questions.render();
                        break;
                    case 'bankDeleted':
                        // 文件管理器确认云端「删除行」成功 → 此时才允许本地隐藏
                        (function(){
                            var delId=msg.fileId;
                            if(!delId)return;
                            var bk=App.Storage.getBanks();
                            var remaining=bk.filter(function(x){return x.id!==delId});
                            if(remaining.length!==bk.length)App.Storage.setBanks(remaining);
                            var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                            fi=fi.filter(function(f){return f.id!==delId});
                            try{localStorage.setItem('exam_file_index',JSON.stringify(fi))}catch(e){}
                            if(App._bankDeleteTimer){clearTimeout(App._bankDeleteTimer);App._bankDeleteTimer=null}
                            if(App._bankDeleting===delId)App._bankDeleting=null;
                            if(App.Questions)App.Questions.render();
                            App.Toast.show('云端已删除'+(msg.name?'题库「'+msg.name+'」':''),'success');
                        })();
                        break;
                    case 'bankDeleteFailed':
                        // 云端删除失败/无法确认 → 本地列表原样保留；但「云端本就没有这行」视为已达成目标，清掉本地残留索引
                        (function(){
                            var delId=msg.fileId;
                            var reason=msg.reason||'cloud_delete_failed';
                            if(App._bankDeleteTimer){clearTimeout(App._bankDeleteTimer);App._bankDeleteTimer=null}
                            if(!App._bankDeleting||App._bankDeleting===delId)App._bankDeleting=null;
                            if(reason==='cloud_not_found'){
                                // 云端本来就没有这行：删除目标已达成，本地一并清掉，不再报错
                                var bk0=App.Storage.getBanks();
                                var remain0=bk0.filter(function(b){return b.id!==delId});
                                if(remain0.length!==bk0.length)App.Storage.setBanks(remain0);
                                var fi0=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                                fi0=fi0.filter(function(f){return f.id!==delId});
                                try{localStorage.setItem('exam_file_index',JSON.stringify(fi0))}catch(e){}
                                if(App.Questions)App.Questions.render();
                                App.Toast.show('云端已无此题库，已删除本地残留','success');
                                return;
                            }
                            var reasonText={'cloud_not_found':'云端找不到该题库行','network_error':'网络异常，无法连接云端','sync_disabled':'云同步未启用'}[reason]||('云端删除失败（'+reason+'）');
                            if(App.Questions)App.Questions.render();
                            App.Toast.show('删除失败：'+reasonText+'（题库已保留，未被隐藏）','error');
                        })();
                        break;
                }
                });
            });
            document.addEventListener('visibilitychange',function(){
                if(!document.hidden&&self.ready){
                    self.postToFileManager({type:'mainActivated'});
                    self._ensureCoreStars();
                }
                if(document.hidden&&self.ready){ self.syncOnExit(); }
            });
            window.addEventListener('pagehide',function(){ if(App.Sync)App.Sync.syncOnExit(); });
            window.addEventListener('beforeunload',function(){ if(App.Sync)App.Sync.syncOnExit(); });
            setTimeout(function(){
                self.migrateOldData();
                // 绝对ID：历史学生补齐（沿用原 id，旧记录不受影响）
                if(App.Ledger)App.Ledger.ensureAbsIds();
                self._sendInitAndAuth();   // 首屏唯一一条握手；索引同步由 initSession 在管理器内触发一次
                self.ready=true;
                self._ensureCoreStars();
                // 系统文件补传：另一台设备占着云端写锁时先保住本地，每 60 秒重试一次，锁一空就自动补传
                if(!self._pendingSyncTimer){
                    self._pendingSyncTimer=setInterval(function(){
                        if(!App.Login||!App.Login.isLoggedIn())return;
                        if(!self._anyFrameReady)return;
                        try{
                            var _ix=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                            var _sys={'系统-学生信息':1,'系统-考试数据':1,'系统-等级设置':1,'系统-AI配置':1};
                            _ix.forEach(function(f){
                                if(_sys[f.name]&&(f.isNewFile||((f.e||0)>(f.s||0)))){
                                    try{ self._pushSystemToCloud(f.name); }catch(e){}
                                }
                            });
                        }catch(e){}
                    },60000);
                }
                // 握手保底：fmReady 可能在监听器挂上之前就发丢了，每 4 秒补发一次 initSession，直到 sessionReady
                if(!self._hsTimer){
                    self._hsTimer=setInterval(function(){
                        if(self._sessionReady){clearInterval(self._hsTimer);self._hsTimer=null;return}
                        try{
                            var m={target:'fileManager',type:'initSession',appPrefix:'exam',syncOnReady:true};
                            if(App.Login&&App.Login.isLoggedIn()){m.username=App.Login._username;m.password=App.Login._password}
                            self.postToFileManager(m);
                        }catch(e){}
                    },4000);
                    setTimeout(function(){ if(self._hsTimer){clearInterval(self._hsTimer);self._hsTimer=null} },90000);
                }
            },1500);
        },
        getFrame:function(){
            if(this._isFileManagerOpen)return document.getElementById('fileManagerFrame');
            return document.getElementById('fileManagerBg');
        },
        postToFileManager:function(msg){
            var frame=this.getFrame();
            if(frame&&frame.contentWindow){
                try{frame.contentWindow.postMessage(Object.assign({target:'fileManager'},msg),'*')}catch(e){}
            }
        },
        // 只发给已真正加载管理器的帧：弹窗未 set src 前不发，避免同一条 initSession 被数两份、凭据发进空白帧
        postToBothFrames:function(msg){
            ['fileManagerBg','fileManagerFrame'].forEach(function(id){
                var frame=document.getElementById(id);
                if(frame&&frame.getAttribute('src')&&frame.contentWindow){
                    try{frame.contentWindow.postMessage(Object.assign({target:'fileManager'},msg),'*')}catch(e){}
                }
            });
        },
        // 统一下发初始化配置与凭据（收到 fmReady 时也调用，确保晚加载的iframe补收）
        _sendInitAndAuth:function(targetWin){
            // 一发一收：配置+就绪+凭据合成一条 initSession，文件管理器回 sessionReady 并只跑一次登录同步
            // 有目标帧就只发给它（每次 fmReady 各握手一次）；无目标只在没有任何帧就绪时兜底发一次
            // 注意：initSession 内含 username/password，接 H12 日志模板时必须脱敏，禁止原文落盘
            var msg={target:'fileManager',type:'initSession',appPrefix:'exam',syncOnReady:true};
            if(App.Login&&App.Login.isLoggedIn()){msg.username=App.Login._username;msg.password=App.Login._password}
            if(targetWin){try{targetWin.postMessage(msg,'*')}catch(e){};return}
            if(this._anyFrameReady||this._initTimeoutSent)return;
            this._initTimeoutSent=true;
            this.postToBothFrames(msg);
        },
        _frameReady:false,
        _pending:null,
        _attachFrameReady:function(frame){
            if(!frame)return;
            var self=this;
            var mark=function(){
                // 弹窗未 set src（还是 data-src）时不算就绪，也不参与首屏握手
                if(!frame.getAttribute('src'))return;
                try{if(frame.contentDocument&&frame.contentDocument.readyState!=='complete')return}catch(e){}
                self._frameReady=true;
                self._flushPending();
            };
            try{frame.addEventListener('load',mark)}catch(e){}
            mark();
        },
        _pushContent:function(name,content){
            if(!name||content===undefined)return;
            if(!this._frameReady){this._pending=this._pending||[];this._pending.push({name:name,content:content});return}
            this._pushQueue=this._pushQueue||[];
            this._pushQueue.push({name:name,content:content});
            if(this._pushTimer)return;
            var self=this;
            this._pushTimer=setTimeout(function(){
                var q=self._pushQueue||[];self._pushQueue=[];self._pushTimer=null;
                if(q.length)self.postToFileManager({type:'contentBatch',items:q});
            },50);
        },
        _flushPending:function(){
            if(!this._pending||!this._pending.length)return;
            var q=this._pending;this._pending=[];
            if(q.length)this.postToFileManager({type:'contentBatch',items:q});
        },
        _ensureCoreStars:function(){
            try{
                var prefix='exam';
                var idx=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                var names=['系统-学生信息','系统-考试数据','系统-等级设置','系统-AI配置'];
                var changed=false,ids=[];
                for(var i=0;i<idx.length;i++){if(names.indexOf(idx[i].name)>=0&&!idx[i].star){idx[i].star=true;changed=true}}
                if(changed){localStorage.setItem(prefix+'_file_index',JSON.stringify(idx));}
                for(var j=0;j<idx.length;j++){if(names.indexOf(idx[j].name)>=0&&idx[j].id)ids.push(idx[j].id);}
                if(ids.length)this.postToFileManager({type:'setStars',ids:ids,star:true});
            }catch(e){}
        },
        _formatTime:function(){
            var d=new Date();
            var offset=d.getTimezoneOffset();
            var bjTime=new Date(d.getTime()-offset*60000+8*3600000);
            var pad=function(n){return String(n).padStart(2,'0')};
            return bjTime.getFullYear()+'-'+pad(bjTime.getMonth()+1)+'-'+pad(bjTime.getDate())+' '+pad(bjTime.getHours())+':'+pad(bjTime.getMinutes())+':'+pad(bjTime.getSeconds());
        },
        _getFileNameForDataType:function(dataType,bankName){
            if(dataType==='students')return '系统-学生信息';
            if(dataType==='records')return '系统-考试数据';
            if(dataType==='levels')return '系统-等级设置';
            if(dataType==='aiConfig')return '系统-AI配置';
            if(dataType==='bank'&&bankName)return bankName;
            return null;
        },
        _getDataTypeForFileName:function(fileName){
            if(fileName==='系统-学生信息')return 'students';
            if(fileName==='系统-考试数据')return 'records';
            if(fileName==='系统-等级设置')return 'levels';
            if(fileName==='系统-AI配置')return 'aiConfig';
            if(fileName!=='')return 'bank';
            return null;
        },
        _getContentForDataType:function(dataType){
            if(dataType==='students')return JSON.stringify(App.Storage.getStudents());
            if(dataType==='records')return JSON.stringify(App.Storage.getRecords());
            if(dataType==='levels')return JSON.stringify(App.Storage.getSettings().levels||[]);
            if(dataType==='aiConfig')return JSON.stringify({aiApiUrl:App.Storage.getSettings().aiApiUrl||'',aiApiKey:App.Storage.getSettings().aiApiKey||'',aiModel:App.Storage.getSettings().aiModel||''});
            return null;
        },
        _getFileIdForDataType:function(dataType){
            var user='';try{user=localStorage.getItem('exam_auth_user')||''}catch(e){}
            var suffix=user?('__'+user):'';
            if(dataType==='students')return 'EXAM_SYS_STUDENT_INFO'+suffix;
            if(dataType==='records')return 'EXAM_SYS_RECORDS'+suffix;
            if(dataType==='levels')return 'EXAM_SYS_LEVELS'+suffix;
            if(dataType==='aiConfig')return 'EXAM_SYS_AI_CONFIG'+suffix;
            return null;
        },
        _applyContentToApp:function(dataType,content,force){
            try{
                if(content===undefined||content===null||String(content).trim()==='')return;
                // 本地有未上传改动时，拒绝云端旧内容覆盖（防止同步回写把刚改的数据打回旧版）
                // force=true（登录门禁）时例外：系统文件以云端为准，保证进来就是云端那一份
                if(!force){
                try{
                    var _fid=this._getFileIdForDataType(dataType);
                    if(_fid){
                        var _idx=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                        var _ent=_idx.find(function(x){return x.id===_fid});
                        if(_ent&&(_ent.isNewFile||((_ent.e||0)>(_ent.s||0)))){
                            console.log('[Sync] 本地有未上传改动，忽略云端旧内容：'+dataType);
                            return;
                        }
                    }
                }catch(_e){}
                // 本地 30 秒内刚改过 → 暂时拒绝云端回包，避免同步竞态覆盖刚录入的数据
                if(this._localEditAt&&this._localEditAt[dataType]&&(Date.now()-this._localEditAt[dataType]<30000)){
                    console.log('[Sync] 本地刚改过，暂不接受云端覆盖：'+dataType);
                    return;
                }
                }
                var data=JSON.parse(content);
                // 全演示学生数据一律不应用（防止云端被污染的演示名单覆盖本机真实名单）
                if(dataType==='students'&&Array.isArray(data)&&data.length&&data.every(function(x){return x&&x._demo})){
                    console.log('[Sync] 忽略全演示学生数据');
                    return;
                }
                App.Storage._syncSilent=true;
                try{
                    if(dataType==='students'){
                        App.Storage.set('students',data);
                        App.Students.render();
                        if(App.Settings&&App.Settings.StudentMgmt&&App.Settings.StudentMgmt.render)App.Settings.StudentMgmt.render();
                    }else if(dataType==='records'){
                        App.Storage.set('records',data);
                        if(App.Settings&&App.Settings.renderRecords)App.Settings.renderRecords();
                    }else if(dataType==='levels'){
                        var curSettings=App.Storage.getSettings();
                        curSettings.levels=data;
                        App.Storage.set('settings',curSettings);
                        if(App.Settings&&App.Settings.renderLevels)App.Settings.renderLevels();
                    }else if(dataType==='aiConfig'){
                        var curSettings2=App.Storage.getSettings();
                        curSettings2.aiApiUrl=data.aiApiUrl||'';
                        curSettings2.aiApiKey=data.aiApiKey||'';
                        curSettings2.aiModel=data.aiModel||'';
                        App.Storage.set('settings',curSettings2);
                        if(App.Settings&&App.Settings.loadAISettings)App.Settings.loadAISettings();
                    }else if(dataType==='bank'){
                        if(data&&data.id){
                            var existingBanks=App.Storage.getBanks();
                            var bankId=data.id;
                            var idx=existingBanks.findIndex(function(b){return b.id===bankId});
                            if(idx>=0){
                                existingBanks[idx]=data;
                            }else{
                                // ID不匹配时，按名称查找同名空题库并替换
                                var nameIdx=existingBanks.findIndex(function(b){return b.name===data.name&&(!b.questions||b.questions.length===0)});
                                if(nameIdx>=0){
                                    existingBanks[nameIdx]=data;
                                }else{
                                    existingBanks.push(data);
                                }
                            }
                            App.Storage.set('banks',existingBanks);
                            App.Questions.render();
                        }
                    }
                }finally{
                    App.Storage._syncSilent=false;
                }
            }catch(e){console.error('[Sync] 应用内容失败:',e)}
        },
        _onOpenFile:function(msg){
            if(!msg.name)return;
            var dataType=this._getDataTypeForFileName(msg.name);
            if(dataType&&msg.content!==undefined){
                this._applyContentToApp(dataType,msg.content);
            }
        },
        _onFileContentUpdated:function(msg){
            if(!msg.name)return;
            var dataType=this._getDataTypeForFileName(msg.name);
            if(dataType&&msg.content!==undefined){
                this._applyContentToApp(dataType,msg.content);
            }
        },
        _onFileDeleted:function(msg){
            if(!msg.name)return;
            var dataType=this._getDataTypeForFileName(msg.name);
            if(dataType==='bank'){
                var bankId=msg.name.replace('题库-','');
                var banks=App.Storage.getBanks().filter(function(b){return b.id!==bankId&&b.name!==bankId});
                App.Storage._syncSilent=true;
                try{App.Storage.set('banks',banks);App.Questions.render()}finally{App.Storage._syncSilent=false}
            }
        },
        _onFileRenamed:function(msg){
            // 文件重命名暂不处理
        },
        notifyChange:function(dataType,data){
            if(!this.ready)return;
            // 记录本地最近一次改动时刻：15 秒内拒绝云端旧回包覆盖，防同步竞态把刚改的数据打回旧版
            this._localEditAt=this._localEditAt||{};
            this._localEditAt[dataType]=Date.now();
            // 系统文件一改就（1.5 秒防抖后）强制落云，不等「版本差≥10」或 5 分钟兜底
            var _forceName={students:'系统-学生信息',records:'系统-考试数据',levels:'系统-等级设置',aiConfig:'系统-AI配置'}[dataType];
            if(_forceName&&App.Login&&App.Login.isLoggedIn()){
                this._forceTimers=this._forceTimers||{};
                var _self=this;
                if(this._forceTimers[dataType])clearTimeout(this._forceTimers[dataType]);
                this._forceTimers[dataType]=setTimeout(function(){
                    _self._forceTimers[dataType]=null;
                    try{ if(App.Sync&&App.Sync._pushSystemToCloud)App.Sync._pushSystemToCloud(_forceName); }catch(e){}
                },1500);
            }
            var isLoggedIn=App.Login&&App.Login.isLoggedIn();
            var prefix='exam';
            if(dataType==='banks'){
                var banks=App.Storage.getBanks();
                var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                var self=this;
                var banksChanged=false;
                // 清理历史残留的 demo 行：demo 题库永远只在本地，不进文件索引
                var demoIds={demo_b1:1,demo_b2:1};
                banks.forEach(function(b){if(b._demo&&b.id)demoIds[b.id]=1});
                if(fileIndex.some(function(f){return demoIds[f.id]})){
                    fileIndex=fileIndex.filter(function(f){return !demoIds[f.id]});
                    try{localStorage.setItem(prefix+'_file_index',JSON.stringify(fileIndex))}catch(e){}
                }
                // 跳过demo题库，不创建文件索引也不上传
                banks.forEach(function(b){
                    if(b._demo)return;
                    var bankId=b.id||b.name;
                    // 兼容旧数据：如果题库ID不是QB_前缀，分配新的QB_ ID
                    if(!bankId.startsWith('QB_')){
                        // 先检查文件索引中是否有同名文件已有QB_ ID（云端已存在的）
                        var sameNameEntry=fileIndex.find(function(x){return x.name===b.name&&x.id&&x.id.startsWith('QB_')});
                        if(sameNameEntry){
                            // 复用云端已有的QB_ ID
                            b.id=sameNameEntry.id;
                            bankId=sameNameEntry.id;
                            banksChanged=true;
                        }else{
                            var newId=genBankId();
                            // 检查文件索引中是否已有该旧ID的记录，需要迁移
                            var oldEntry=fileIndex.find(function(x){return x.id===bankId});
                            if(oldEntry){
                                // 迁移旧ID到新QB_ ID
                                var oldData=localStorage.getItem(prefix+'_file_id_'+bankId);
                                if(oldData){
                                    localStorage.setItem(prefix+'_file_id_'+newId,oldData);
                                    localStorage.removeItem(prefix+'_file_id_'+bankId);
                                }
                                oldEntry.id=newId;
                            }
                            b.id=newId;
                            bankId=newId;
                            banksChanged=true;
                        }
                    }
                    // 云端「文件名」列必须带标签：题库名.__题型.__科目…（前端靠这一列分类）
                    var fileName=App.BankTypes?App.BankTypes.fileWithTags(b.name,App.BankTypes.tagsOfBank(b)):(b.name||bankId);
                    var content=JSON.stringify(b);
                    var existing=fileIndex.find(function(x){return x.id===bankId});
                    // 如果ID不匹配，再检查是否有同名文件（云端已有同名题库；忽略旧的无标签后缀差异）
                    if(!existing){
                        existing=fileIndex.find(function(x){return x.id!==bankId&&(x.name===fileName||(App.BankTypes&&App.BankTypes.stripAllTags(x.name)===b.name))});
                        if(existing){
                            // 复用已有文件索引的ID，避免同名不同ID导致重复
                            var oldBankData=localStorage.getItem(prefix+'_file_id_'+bankId);
                            if(oldBankData){
                                localStorage.setItem(prefix+'_file_id_'+existing.id,oldBankData);
                                localStorage.removeItem(prefix+'_file_id_'+bankId);
                            }
                            b.id=existing.id;
                            bankId=existing.id;
                            banksChanged=true;
                        }
                    }
                    if(existing){
                        // 比较内容是否真正变化，只有变化时才增加版本号
                        var oldData=null;
                        try{var raw=localStorage.getItem(prefix+'_file_id_'+existing.id);if(raw)oldData=JSON.parse(raw).data}catch(e){}
                        var contentChanged=!oldData||oldData!==content;
                        if(contentChanged){existing.version=(existing.version||0)+1}
                        // 索引文件名与云端文件名保持一致（带标签），否则按名查不到会重复建行
                        if(existing.name!==fileName){existing.name=fileName}
                        existing.contentLength=[...content].length;
                        existing.lastEditTime=App.Sync._formatTime();
                        // 题库文件不设置文件夹（云端平铺）
                        self._pushContent(fileName,content);
                    }else{
                        fileIndex.push({name:fileName,id:bankId,version:1,lastSyncVersion:0,isNewFile:true,folder:'',owner:'',createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:[...content].length,time:Date.now()});
                        self._pushContent(fileName,content);
                    }
                });
                if(banksChanged)App.Storage.setBanks(banks);
                try{localStorage.setItem(prefix+'_file_index',JSON.stringify(fileIndex))}catch(e){}
                if(isLoggedIn)this.postToFileManager({type:'syncAllFiles'});
            }else{
                var fileName=this._getFileNameForDataType(dataType);
                var content=this._getContentForDataType(dataType);
                // 如果学生全是demo数据，不上传系统-学生信息文件
                if(dataType==='students'&&content){
                    try{var parsed=JSON.parse(content);if(Array.isArray(parsed)&&parsed.every(function(s){return s._demo})){content=null}}catch(e){}
                }
                if(fileName&&content){
                    var fileIndex2=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                    var existing2=fileIndex2.find(function(x){return x.name===fileName});
                    if(existing2){
                        var oldData2=null;
                        try{var raw2=localStorage.getItem(prefix+'_file_id_'+existing2.id);if(raw2)oldData2=JSON.parse(raw2).data}catch(e){}
                        var contentChanged2=!oldData2||oldData2!==content;
                        if(contentChanged2){existing2.version=(existing2.version||0)+1}
                        existing2.contentLength=[...content].length;
                        existing2.lastEditTime=this._formatTime();
                        existing2.star=true;
                        try{localStorage.setItem(prefix+'_file_id_'+existing2.id,JSON.stringify({data:content,view:null}))}catch(e){}
                        this._pushContent(fileName,content);
                    }else{
                        var id=this._getFileIdForDataType(dataType);
                        fileIndex2.push({name:fileName,id:id,version:1,lastSyncVersion:0,isNewFile:true,folder:'',owner:'',createTime:'',lastUploadTime:'',lastEditTime:this._formatTime(),contentLength:[...content].length,time:Date.now(),star:true});
                        try{localStorage.setItem(prefix+'_file_id_'+id,JSON.stringify({data:content,view:null}))}catch(e){}
                        this._pushContent(fileName,content);
                    }
                    try{localStorage.setItem(prefix+'_file_index',JSON.stringify(fileIndex2))}catch(e){}
                    if(isLoggedIn)this.postToFileManager({type:'syncAllFiles'});
                }
            }
        },
        // 同步开关（默认开）：on_exam_end=考试结束立即同步，on_exit=退出/切后台时同步
        _pref:function(k){
            try{var v=localStorage.getItem('exam_sync_'+k);return v===null?true:v==='1'}catch(e){return true}
        },
        setPref:function(k,on){
            try{localStorage.setItem('exam_sync_'+k,on?'1':'0')}catch(e){}
        },
        // 退出/切后台时补一次：只推有本地改动的系统文件，尽力而为
        syncOnExit:function(){
            if(!this._pref('on_exit'))return;
            if(App.Login&&!App.Login.isLoggedIn())return;
            if(!this._anyFrameReady)return;
            ['系统-考试数据','系统-学生信息'].forEach(function(nm){
                if(nm==='系统-考试数据'){try{App.Sync._pushSystemToCloud(nm)}catch(e){return}}
                else App.Sync.postToFileManager({type:'forceSyncFile',name:nm});
            });
        },
        // 关键节点保存：一场答题结束立刻点名让文件管理器把该文件推上云，不等「版本差≥10」
        forceSaveFile:function(name){
            if(!name)return;
            if(App.Login&&!App.Login.isLoggedIn())return;
            if(!this._anyFrameReady){
                this._pendingForceSaves=this._pendingForceSaves||[];
                this._pendingForceSaves.push(name);
                return;
            }
            this.postToFileManager({type:'forceSyncFile',name:name});
        },
        // 系统文件直传：宿主拿当前内存内容直接推云端，绕开文件管理器的内容缓存，杜绝“传的是旧快照”
        _pushSystemToCloud:function(name){
            // 成绩文件先读云端合并再写，避免多端/多窗口并发时后写整表覆盖先写
            if(name==='系统-考试数据'&&!this._skipRecordsMerge){
                return this._pushRecordsMerged();
            }
            var self=this;
            if(!App.Login||!App.Login.isLoggedIn())return;
            var user=App.Login._username,pwd=App.Login._password;
            var st=App.Storage.getSettings();
            var map={
                '系统-学生信息':['EXAM_SYS_STUDENT_INFO',JSON.stringify(App.Storage.getStudents())],
                '系统-考试数据':['EXAM_SYS_RECORDS',JSON.stringify(App.Storage.getRecords())],
                '系统-等级设置':['EXAM_SYS_LEVELS',JSON.stringify(st.levels||[])]
            };
            var it=map[name];if(!it)return;
            var fid=it[0]+'__'+user,content=it[1];
            var idx=[];try{idx=JSON.parse(localStorage.getItem('exam_file_index')||'[]')}catch(e){}
            var f=idx.find(function(x){return x.id===fid});
            var s=f?(parseInt(f.s||0)||0):0,e=f?(parseInt(f.e||0)||0):0,isNew=f?!!f.isNewFile:true;
            if(e<=s)e=s+1;
            var dev='';try{dev=localStorage.getItem('exam_device_id')||('H'+Date.now().toString(36))}catch(e){}
            var now=new Date(),pad=function(n){return n<10?'0'+n:''+n};
            var ts=''+now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
            var folder='FOLDER_SYS__'+user;
            var data={'拥有者':user,'ID':fid,'文件名':name,'内容':content,'起点号':String(s),'终点号':String(e),'文件夹路径':folder,'最后上传发起时间':ts,'最后编辑时间':ts,'同步时间':ts,'MD5':'','内容字符数':String([...content].length),'创建日期':(f&&f.createTime)||'','文件JSON':JSON.stringify({id:fid,name:name,内容:content,起点号:s,终点号:e,拥有者:user,文件夹路径:folder,创建日期:(f&&f.createTime)||'',最后编辑时间:ts,内容字符数:[...content].length})};
            var call=function(argv){
                var body={webhookUrl:'https://www.kdocs.cn/api/v3/ide/file/519302387327/script/V2-6t4db1ZSsEPesqKsD7aj3/sync_task',message:{Context:{argv:argv}}};
                return fetch('https://1408347752-dxgsap4qrj.ap-guangzhou.tencentscf.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
                    .then(function(r){return r.json()}).then(function(j){return (j.data&&j.data.result)||j});
            };
            var unlock=function(){try{var p=call({表格名:'抽奖考试',操作:'解锁',用户名:user,密码:pwd,锁登记处:dev});if(p&&p.catch)p.catch(function(){})}catch(e){}};
            var done=function(v){
                try{
                    var ix=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                    var ff=ix.find(function(x){return x.id===fid});
                    if(ff){ff.s=v;ff.e=v;ff.isNewFile=false;ff.cloudOnly=false;ff.contentLength=[...content].length;ff.lastEditTime=ts}
                    localStorage.setItem('exam_file_index',JSON.stringify(ix));
                }catch(e){}
                console.log('[Sync] 系统文件已直传云端：'+name+' v'+v);
            };
            return call({表格名:'抽奖考试',操作:'同步提交',用户名:user,密码:pwd,锁登记处:dev,ID:fid,起点号:String(s),终点号:String(e),本地新文件标识:isNew?'true':'false',数据:data}).then(function(r){
                var jr=r&&r.判定结果;
                if(!r||r.status==='error'){unlock();return}
                if(jr==='无需上传'){unlock();return}
                var newS=parseInt(r.终点号||r.起点号||e)||e;
                if(jr==='全新接收'){done(newS);unlock();return}
                if(jr==='收为临时'){
                    return call({表格名:'抽奖考试',操作:'转正确认',用户名:user,密码:pwd,锁登记处:dev,ID:fid,起点号:String(newS)}).then(function(r2){
                        if(r2&&r2.status==='success')done(newS);
                        unlock();
                    });
                }
                unlock();
            }).catch(function(){unlock()});
        },
        // 读云端成绩内容（容忍分片/解析失败，读不到就当空，不阻断写入）
        _readCloudRecords:function(user,pwd,fid){
            var call=function(argv){
                var body={webhookUrl:'https://www.kdocs.cn/api/v3/ide/file/519302387327/script/V2-6t4db1ZSsEPesqKsD7aj3/sync_task',message:{Context:{argv:argv}}};
                return fetch('https://1408347752-dxgsap4qrj.ap-guangzhou.tencentscf.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
                    .then(function(r){return r.json()}).then(function(j){return (j.data&&j.data.result)||j});
            };
            return call({表格名:'抽奖考试',操作:'批量读取',用户名:user,密码:pwd,ID列表:[fid]}).then(function(rd){
                var rows=(rd&&rd.数据)||[];var row=null;
                for(var i=0;i<rows.length;i++){if(rows[i]&&rows[i].ID===fid){row=rows[i];break}}
                if(!row)return [];
                var txt='';
                try{var p=JSON.parse(row['文件JSON']||'');txt=(p&&p.内容)||''}catch(e){}
                if(!txt)txt=row['内容']||'';
                try{var arr=JSON.parse(txt);return Array.isArray(arr)?arr:[]}catch(e){return []}
            }).catch(function(){return []});
        },
        _mergeLocalRecords:function(cloud){
            var local=App.Storage.getRecords()||[];
            if(!Array.isArray(cloud)||!cloud.length)return local;
            var ids={};cloud.forEach(function(r){if(r&&r.id)ids[r.id]=1});
            var extra=local.filter(function(r){return r&&r.id&&!ids[r.id]});
            if(!extra.length)return local;
            var all=cloud.concat(extra).sort(function(a,b){return (a.date||0)-(b.date||0)});
            App.Storage._syncSilent=true;
            try{App.Storage.setRecords(all)}finally{App.Storage._syncSilent=false}
            return all;
        },
        // 成绩同步：读云端→按场次 id 并集→写回→回读校验，缺场次自动重试
        _pushRecordsMerged:function(){
            var self=this;
            if(!App.Login||!App.Login.isLoggedIn())return Promise.resolve();
            var user=App.Login._username,pwd=App.Login._password;
            var fid='EXAM_SYS_RECORDS__'+user;
            var run=function(attempt){
                return self._readCloudRecords(user,pwd,fid).then(function(cloud){
                    self._mergeLocalRecords(cloud);
                    return self._writeRecordsNow();
                }).then(function(){
                    return self._recordsAllInCloud(user,pwd,fid);
                }).then(function(ok){
                    if(!ok&&attempt<3){return new Promise(function(r){setTimeout(r,1500)}).then(function(){return run(attempt+1)})}
                });
            };
            this._recordsChain=(this._recordsChain||Promise.resolve()).then(function(){return run(0)}).catch(function(e){try{console.warn('[Sync] 成绩同步失败',e)}catch(_){}});
            return this._recordsChain;
        },
        _writeRecordsNow:function(){
            this._skipRecordsMerge=true;
            try{return this._pushSystemToCloud('系统-考试数据')||Promise.resolve()}
            finally{this._skipRecordsMerge=false}
        },
        _recordsAllInCloud:function(user,pwd,fid){
            return this._readCloudRecords(user,pwd,fid).then(function(cloud){
                var ids={};cloud.forEach(function(r){if(r&&r.id)ids[r.id]=1});
                var local=App.Storage.getRecords()||[];
                for(var i=0;i<local.length;i++){var r=local[i];if(r&&r.id&&!ids[r.id])return false}
                return true;
            });
        },
        syncNow:function(){
            if(App.Login && !App.Login.isLoggedIn()){
                App.Toast.show('请先登录后再同步','warning');
                App.Login.openModal();
                return;
            }
            this.postToFileManager({type:'syncAllFiles'});
        },
        syncAll:function(){
            if(App.Login && !App.Login.isLoggedIn()){
                App.Toast.show('请先登录后再同步','warning');
                App.Login.openModal();
                return;
            }
            this.postToFileManager({type:'syncAllFiles'});
        },
        updateConfig:function(config){
            this.postToFileManager({type:'initConfig',config:config});
        },
        deleteBank:function(bankKey){
            var banks=App.Storage.getBanks();
            var bank=banks.find(function(b){return b.id===bankKey||b.name===bankKey});
            var fileId=bank?bank.id:bankKey;
            var msg={type:'fileDeleted_local',fileId:fileId,name:bank?bank.name:'',
                     username:(App.Login&&App.Login._username)||localStorage.getItem('exam_auth_user')||'',
                     password:(App.Login&&App.Login._password)||localStorage.getItem('exam_auth_pass')||''};
            // 后台管理器帧未就绪时先排队，fmReady 后再发，避免消息发进空白帧丢掉
            if(!this._anyFrameReady){
                this._pendingBankDeletes=this._pendingBankDeletes||[];
                this._pendingBankDeletes.push(msg);
                return;
            }
            this.postToFileManager(msg);
        },
        openFileManager:function(){
            this._isFileManagerOpen=true;
            var modal=document.getElementById('file-modal');
            if(modal)modal.style.display='flex';
            var frame=document.getElementById('fileManagerFrame');
            if(frame){
                // 弹窗用 iframe 首次打开才加载，避免首屏重复初始化、重复打云函数
                if(!frame.getAttribute('src')){
                    frame.setAttribute('src',frame.getAttribute('data-src')||'文件管理.HTML');
                    frame.addEventListener('load',function once(){
                        frame.removeEventListener('load',once);
                        try{frame.contentWindow.postMessage({target:'fileManager',type:'open'},'*')}catch(e){}
                    });
                    return;
                }
                if(frame.contentWindow){
                    frame.contentWindow.postMessage({target:'fileManager',type:'open'},'*');
                }
            }
        },
        closeFileManager:function(){
            this._isFileManagerOpen=false;
            var modal=document.getElementById('file-modal');
            if(modal)modal.style.display='none';
        },
        pullAllCloudContent:function(){
            var prefix='exam';
            var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
            var self=this;
            // 题库文件不自动下载，只下载系统文件（学生信息、考试数据、等级设置）
            var needPull=fileIndex.filter(function(f){
                if(f.id&&f.id.startsWith('QB_'))return false;  // 题库按需下载，不自动拉取
                return f.cloudOnly||f.contentLength===0||f.isNewFile;
            });
            if(needPull.length===0)return;
            console.log('[Sync] 批量拉取系统文件内容：'+needPull.length+'个（一次webhook批取）');
            self._pulling=true;
            self.postToFileManager({type:'pullAllCloudFiles',ids:needPull.map(function(f){return f.id})});
        },
        migrateOldData:function(){
            try{
                var migrated=localStorage.getItem('exam_sync_migrated_v2');
                if(migrated)return;
                // 如果文件索引已存在（由syncAllFiles创建），说明已初始化，跳过
                var existingIndex=localStorage.getItem('exam_file_index');
                if(existingIndex){localStorage.setItem('exam_sync_migrated_v2','1');return}
                var banks=App.Storage.getBanks();
                var students=App.Storage.getStudents();
                var records=App.Storage.getRecords();
                var levels=App.Storage.getSettings().levels||[];
                // 检查是否有非默认的用户数据（有云端ID的题库说明是旧同步数据）
                var hasRealData=banks.some(function(b){return b.id&&b.id.indexOf('QB_')===0})||
                    students.some(function(s){return !s._demo})||
                    Object.keys(records).length>0;
                if(!hasRealData){
                    localStorage.setItem('exam_sync_migrated_v2','1');
                    console.log('[Sync] 无旧同步数据，跳过迁移，等待云端拉取');
                    return;
                }
                var fileIndex=[];
                var prefix='exam';
                banks.forEach(function(b){
                    var id=b.id||('QB_'+Math.floor(1000000000+Math.random()*9000000000));
                    var name=b.name||id;
                    var content=JSON.stringify(b);
                    var fileId=id;
                    fileIndex.push({name:name,id:fileId,version:1,lastSyncVersion:0,isNewFile:true,folder:'',owner:'',createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:[...content].length});
                    try{localStorage.setItem(prefix+'_file_id_'+fileId,JSON.stringify({data:content,view:null}))}catch(e){}
                });
                var aiConfig={aiApiUrl:App.Storage.getSettings().aiApiUrl||'',aiApiKey:App.Storage.getSettings().aiApiKey||'',aiModel:App.Storage.getSettings().aiModel||''};
                var sysFiles=[
                    {key:'EXAM_SYS_STUDENT_INFO',name:'系统-学生信息',content:JSON.stringify(students),folder:''},
                    {key:'EXAM_SYS_RECORDS',name:'系统-考试数据',content:JSON.stringify(records),folder:''},
                    {key:'EXAM_SYS_LEVELS',name:'系统-等级设置',content:JSON.stringify(levels),folder:''},
                    {key:'EXAM_SYS_AI_CONFIG',name:'系统-AI配置',content:JSON.stringify(aiConfig),folder:''}
                ];
                sysFiles.forEach(function(f){
                    fileIndex.push({name:f.name,id:f.key,version:1,lastSyncVersion:0,isNewFile:true,folder:f.folder,owner:'',createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:[...f.content].length,star:true});
                    try{localStorage.setItem(prefix+'_file_id_'+f.key,JSON.stringify({data:f.content,view:null}))}catch(e){}
                });
                try{localStorage.setItem(prefix+'_file_index',JSON.stringify(fileIndex))}catch(e){}
                localStorage.setItem('exam_sync_migrated_v2','1');
                console.log('[Sync] 旧数据迁移完成，共'+fileIndex.length+'个文件');
            }catch(e){console.error('[Sync] 迁移失败:',e)}
        },
        // 每个账号首次登录：自动建该系统账号专属的「系统」文件夹 + 4 个系统文件，并推送到云端
        ensureAccountSystemFiles:function(force,onlyKeys){
            try{
                var user='';try{user=localStorage.getItem('exam_auth_user')||''}catch(e){}
                if(!user)return false;
                var prefix='exam';
                var flag='exam_sys_init2__'+user;
                if(!force&&localStorage.getItem(flag)==='1')return false;
                var idx=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                var folderId='FOLDER_SYS__'+user;
                if(!idx.some(function(x){return x.id===folderId})){
                    idx.push({name:'系统',id:folderId,version:1,lastSyncVersion:0,isNewFile:false,folder:'',owner:user,createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:0,time:Date.now()});
                }
                var settings=App.Storage.getSettings();
                var ai={aiApiUrl:settings.aiApiUrl||'',aiApiKey:settings.aiApiKey||'',aiModel:settings.aiModel||''};
                var sys=[
                    ['students','EXAM_SYS_STUDENT_INFO','系统-学生信息',App.Storage.getStudents()],
                    ['records','EXAM_SYS_RECORDS','系统-考试数据',App.Storage.getRecords()],
                    ['levels','EXAM_SYS_LEVELS','系统-等级设置',settings.levels||[]],
                    ['aiConfig','EXAM_SYS_AI_CONFIG','系统-AI配置',ai]
                ];
                var onlyIds=(onlyKeys&&onlyKeys.length)?onlyKeys:null;
                sys.forEach(function(s){
                    if(onlyIds&&onlyIds.indexOf(s[1])<0)return;
                    // 全演示学生不推到云端，避免污染账号名单
                    if(s[0]==='students'&&Array.isArray(s[3])&&s[3].length&&s[3].every(function(x){return x&&x._demo}))return;
                    var id=s[1]+'__'+user;
                    var content=JSON.stringify(s[3]);
                    var e=idx.find(function(x){return x.id===id});
                    if(e){
                        e.folder=folderId;e.owner=user;e.cloudOnly=false;
                        if(force)e.isNewFile=true;
                    }else{
                        idx.push({name:s[2],id:id,version:1,lastSyncVersion:0,isNewFile:true,folder:folderId,owner:user,createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:[...content].length,time:Date.now(),star:true});
                    }
                    try{localStorage.setItem(prefix+'_file_id_'+id,JSON.stringify({data:content,view:null}))}catch(err){}
                });
                localStorage.setItem(prefix+'_file_index',JSON.stringify(idx));
                localStorage.setItem(flag,'1');
                var self=this;
                var sysIds=['EXAM_SYS_STUDENT_INFO','EXAM_SYS_RECORDS','EXAM_SYS_LEVELS'].map(function(k){return k+'__'+user});
                this.postToFileManager({type:'ensureFolder',folderId:folderId,name:'系统',fileIds:sysIds});
                setTimeout(function(){self.postToFileManager({type:'syncAllFiles'})},3000);
                console.log('[Sync] 已为账号 '+user+' 建系统文件夹与系统文件并提交同步');
                return true;
            }catch(e){console.error('[Sync] 系统文件补建失败:',e);return false}
        },
        _showGate:function(txt){
            var m=document.getElementById('gate-mask');var t=document.getElementById('gate-text');
            if(t&&txt)t.textContent=txt;
            if(m)m.style.display='flex';
        },
        _hideGate:function(){
            var m=document.getElementById('gate-mask');
            if(m)m.style.display='none';
        },
        // 登录门禁：一次「读取全部」→ 验证行 + 本账号全部系统文件（含内容与版本号）
        _applyLoginGate:function(msg){
            try{
                var rows=(msg&&msg.rows)||[];
                var user=(App.Login&&App.Login._username)||localStorage.getItem('exam_auth_user')||'';
                var verify=false;
                for(var i=0;i<rows.length;i++){if(String(rows[i].ID)==='999999999'){verify=true;break}}
                if(!msg||!msg.ok||!verify){
                    // 已放行后偶发读取失败：不再弹门禁/打断答题，等下一轮静默重试
                    if(App.Sync._gateDone){try{console.warn('[Gate] 验证行本轮读取失败，保持已放行状态')}catch(e){}return}
                    App.Sync._gateBlocked=true;
                    App.Sync._gateDone=false;
                    App.Sync._showGate('云端校验失败，正在重试…');
                    App.Toast.show('云端校验失败：读不到验证行，已阻止进入','error');
                    return;
                }
                var sysRows=[];
                for(var j=0;j<rows.length;j++){
                    var r=rows[j];
                    var nm=String(r.文件名||'');
                    var ow=String(r.拥有者||'').trim();
                    // 临时行(_TL)不是正牌，绝不参与门禁与内容对齐
                    if(/_TL$/.test(String(r.ID||'').trim()))continue;
                    if(nm.indexOf('系统-')===0&&(!ow||ow===user))sysRows.push(r);
                }
                var prefix='exam';
                var idx=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                var cloudNameMap={};
                sysRows.forEach(function(r){cloudNameMap[String(r.文件名||'')]=r});
                var std=[['EXAM_SYS_STUDENT_INFO','系统-学生信息'],['EXAM_SYS_RECORDS','系统-考试数据'],['EXAM_SYS_LEVELS','系统-等级设置']];
                var missing=std.filter(function(s){
                    var cr=cloudNameMap[s[1]];
                    if(!cr)return true;
                    // 云端行有“内容字符数”说明内容存在；此时读不到只是这次读取失败，绝不能拿本地覆盖
                    var cl=parseInt(cr.内容字符数||0)||0;
                    if(cl>0)return false;
                    var cc=(msg.contents&&msg.contents[String(cr.ID)])||'';
                    return !String(cc).trim();
                }).map(function(s){return s[0]});
                if(missing.length>0){
                    // 精确到单个文件：云端缺哪个系统文件，本地才补建哪个
                    App.Sync.ensureAccountSystemFiles(true,missing);
                    // 补建后若索引里仍缺（首次同步偶发被刷新覆盖），6 秒后再补一次
                    setTimeout(function(){
                        try{
                            var ix=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
                            var still=missing.filter(function(k){return !ix.some(function(x){return String(x.id||'').indexOf(k)===0})});
                            if(still.length){
                                console.log('[Gate] 系统文件补建重试：'+still.join(','));
                                App.Sync.ensureAccountSystemFiles(true,still);
                            }
                        }catch(e){}
                    },6000);
                }
                var _mismatch=false;
                if(sysRows.length>0){
                    var dtMap={'系统-学生信息':'students','系统-考试数据':'records','系统-等级设置':'levels'};
                    sysRows.forEach(function(r){
                        var fid=String(r.ID||'');
                        var nm=String(r.文件名||'');
                        // AI 配置不参与云端同步（2.052）：门禁也不碰它
                        if(nm==='系统-AI配置')return;
                        var cloudS=parseInt(r.起点号||0)||0;
                        var cloudE=parseInt(r.终点号||0)||0;
                        var content=(msg.contents&&msg.contents[fid])||'';
                        // 考试数据按“场次并集”合并：云端旧快照 + 本机未上传的新场次，避免刷新后被旧快照吞掉
                        var _merged=false;
                        if(nm==='系统-考试数据'&&String(content).trim()!==''){
                            try{
                                var _lr=JSON.parse(localStorage.getItem('exam_records')||'[]')||[];
                                var _cr=JSON.parse(content)||[];
                                if(Array.isArray(_lr)&&Array.isArray(_cr)){
                                    var _ids={};_cr.forEach(function(x){if(x&&x.id)_ids[x.id]=1});
                                    var _extra=_lr.filter(function(x){return x&&x.id&&!_ids[x.id]});
                                    if(_extra.length){
                                        var _all=_cr.concat(_extra).sort(function(a,b){return (a.date||0)-(b.date||0)});
                                        content=JSON.stringify(_all);_merged=true;
                                    }
                                }
                            }catch(e4){}
                        }
                        var e=idx.find(function(x){return x.id===fid});
                        if(!e){
                            idx.push({name:r.文件名,id:fid,version:1,lastSyncVersion:cloudS,isNewFile:false,folder:String(r.文件夹路径||''),owner:user,createTime:'',lastUploadTime:'',lastEditTime:App.Sync._formatTime(),contentLength:[...content].length,time:Date.now(),star:true,s:cloudS,e:cloudE});
                            try{localStorage.setItem(prefix+'_file_id_'+fid,JSON.stringify({data:content,view:null}))}catch(err){}
                        }else if(String(content).trim()!==''){
                            // 登录门禁：系统文件以云端为准（云端有内容就覆盖本地，保证进来就是完整数据）
                            e.s=cloudS;e.e=cloudE;e.isNewFile=false;e.cloudOnly=false;e.folder=String(r.文件夹路径||e.folder||'');
                            e.contentLength=[...content].length;
                            try{localStorage.setItem(prefix+'_file_id_'+fid,JSON.stringify({data:content,view:null}))}catch(err){}
                        }
                        // 合并过的成绩：本地标记为待上传，门禁会等它推上去再放行
                        if(_merged){
                            try{localStorage.setItem(prefix+'_file_id_'+fid,JSON.stringify({data:content,view:null}))}catch(e5){}
                            var _e3=idx.find(function(x){return x.id===fid});
                            if(_e3){_e3.s=cloudS;_e3.e=Math.max(cloudE,cloudS)+1;_e3.isNewFile=true;_e3.contentLength=[...content].length}
                        }
                        var t=dtMap[nm];
                        if(t&&content){
                            // 云端学生信息如果全是演示数据（_demo），绝不覆盖本机真实名单
                            var _okApply=true;
                            if(t==='students'){
                                try{var _sa=JSON.parse(content);if(Array.isArray(_sa)&&_sa.length&&_sa.every(function(x){return x&&x._demo}))_okApply=false}catch(e){}
                            }
                            if(_okApply){
                                App.Sync._applyContentToApp(t,content,true);
                                // 回读本地落盘内容，必须与云端一字不差
                                try{
                                    var _lk=localStorage.getItem(prefix+'_file_id_'+fid);
                                    var _lv=_lk?((JSON.parse(_lk)||{}).data||''):'';
                                    if(String(_lv)!==String(content))_mismatch=true;
                                }catch(e3){_mismatch=true}
                            }
                        }
                    });
                    localStorage.setItem(prefix+'_file_index',JSON.stringify(idx));
                    // 本地版本更高的，继续按常规同步推上去
                    App.Sync.postToFileManager({type:'syncAllFiles'});
                }
                // 云端明明有内容、这次却没读回来 → 不标记完成，让门禁定时器继续重试
                var missContent=sysRows.some(function(r){
                    var cl=parseInt(r.内容字符数||0)||0;
                    return cl>0 && !String((msg.contents&&msg.contents[String(r.ID)])||'').trim();
                });
                if(missContent){
                    if(!App.Sync._gateSoftReleased)App.Sync._showGate('正在读取云端系统文件…');
                    return;
                }
                if(_mismatch){
                    App.Sync._showGate('系统文件正在对齐本地…');
                    return;
                }
                App.Sync._gateBlocked=false;
                App.Sync._gateDone=true;
                // 系统文件若本地还有更高版本待上传，等同步完成再放行
                var pending=false;
                try{
                    var idx2=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                    pending=idx2.some(function(x){return String(x.id).indexOf('EXAM_SYS')===0&&((x.isNewFile)||((x.e||0)>(x.s||0)))});
                }catch(e){}
                if(pending&&!App.Sync._gateSoftReleased)App.Sync._showGate('系统文件正在对齐云端…');
                else App.Sync._hideGate();
                console.log('[Gate] 云端校验通过，系统文件 '+sysRows.length+' 个');
            }catch(e){console.error('[Gate] 校验异常:',e)}
        }
    };

    // ========== 登录系统模块 ==========
    App.Login = {
        _loggedIn: false,
        _username: '',
        _password: '',
        LOGIN_API_URL: 'https://1408347752-dxgsap4qrj.ap-guangzhou.tencentscf.com',
        LOGIN_WEBHOOK_URL: 'https://www.kdocs.cn/api/v3/ide/file/504393979179/script/V2-jCry7lblkwsPtTSmtjlWY/sync_task',

        init: function(){
            var self = this;
            // 从localStorage恢复登录状态
            var savedUser = '';
            var savedPwd = '';
            try{
                savedUser = localStorage.getItem('exam_auth_user') || '';
                savedPwd = localStorage.getItem('exam_auth_pass') || '';
            }catch(e){}
            if(savedUser && savedPwd){
                this._loggedIn = true;
                this._username = savedUser;
                this._password = savedPwd;
            }
            this.updateUI();

            // 未登录：只跳登录页；绝不清本地数据（清数据只发生在「退出登录」或「换账号登录」时）
            if(!this._loggedIn){
                this._redirectToLogin();
                return;
            }

            // 延迟：验证已有凭据。校验不到结果不等于账号失效，不能因此踢人
            setTimeout(function(){
                self.verifyCredentials(self._username, self._password, function(ok, info){
                    self._recordCheck(ok, info);
                    if(!ok){
                        // 只有服务器明确说账号/密码无效才走这里：隔 2.5 秒复核一次，两次都无效才引导重新登录，且不删数据
                        setTimeout(function(){
                            self.verifyCredentials(self._username, self._password, function(ok2, info2){
                                self._recordCheck(ok2, info2);
                                if(ok2)return;
                                App.Toast.show('登录状态已失效，请重新登录（本地数据已保留）','warning');
                                self._markLoginRequired();
                                self._redirectToLogin();
                            });
                        }, 2500);
                        return;
                    }
                    // 换账号：先清掉上一个账号的本地业务数据，避免 333 的题库/学生串到 444 名下
                    try{
                        var _lastAcc=localStorage.getItem('exam_last_account')||'';
                        if(_lastAcc&&_lastAcc!==self._username){
                            self._purgeAccountData();
                            if(App.Toast)App.Toast.show('检测到切换账号，已清理上一个账号的本地数据','info');
                        }
                        localStorage.setItem('exam_last_account',self._username);
                    }catch(e){}
                    // 登录门禁：云端系统文件必须完全对齐后才放行；题库只刷新最新索引，不下载内容
                    if(App.Sync&&App.Sync._showGate)App.Sync._showGate('正在同步云端系统文件…');
                    if(App.Sync&&App.Sync.postToFileManager){
                        var gateTries=0;
                        var gateTimer=setInterval(function(){
                            if(App.Sync._gateDone){clearInterval(gateTimer);return}
                            gateTries++;
                            var gt=document.getElementById('gate-text');
                            if(gt)gt.textContent='正在同步云端系统文件…（第'+gateTries+'次）';
                            App.Sync.postToFileManager({type:'loginGateReadAll'});
                        },3000);
                        App.Sync.postToFileManager({type:'loginGateReadAll'});
                    }
                });
            }, 2000);
        },

        // 记录最近一次登录校验结果，便于排查“明明登录了还被踢”
        _recordCheck:function(ok, info){
            try{
                localStorage.setItem('exam_login_lastcheck', JSON.stringify({t:Date.now(),ok:!!ok,code:(info&&info.code)||0,note:(info&&info.note)||''}));
            }catch(e){}
            try{ console.log('[Login] 校验'+(ok?'通过':'未通过'), info||''); }catch(e){}
        },

        // 换账号时只清“业务数据”，保留界面偏好与本机 AI 配置
        _purgeAccountData: function(){
            try{
                var exact=['exam_banks','exam_students','exam_records','exam_wrongSets','exam_absences','exam_examProgress','exam_file_index','exam_seed_new_modes_v1'];
                for(var i=0;i<exact.length;i++){try{localStorage.removeItem(exact[i])}catch(e){}}
                var del=[];
                for(var j=0;j<localStorage.length;j++){
                    var k=localStorage.key(j);
                    if(k&&k.indexOf('exam_file_id_')===0)del.push(k);
                }
                for(var m=0;m<del.length;m++){try{localStorage.removeItem(del[m])}catch(e){}}
                try{App.Storage._skipDemoRefill=false;}catch(e){}
            }catch(e){}
        },

        // 清空所有 exam_ 开头的本地缓存（保留设备标识）
        _clearAllCache: function(){
            try{
                var keysToRemove = [];
                for(var i = 0; i < localStorage.length; i++){
                    var key = localStorage.key(i);
                    if(key && key.indexOf('exam_') === 0 && key !== 'exam_device_id'){
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(function(k){ localStorage.removeItem(k); });
            }catch(e){}
            this._loggedIn = false;
            this._username = '';
            this._password = '';
        },

        // 标记“本次是服务端明确判定失效”：登录页据此在 10 分钟内不自动跳回，避免来回死循环
        _markLoginRequired: function(){
            try{ localStorage.setItem('exam_login_required', JSON.stringify({t:Date.now(), user:this._username||''})); }catch(e){}
        },

        // 跳转到登录页
        _redirectToLogin: function(){
            window.location.href = 'denglu.html';
        },

        verifyCredentials: function(username, password, callback){
            var self = this;
            var body = {
                webhookUrl: self.LOGIN_WEBHOOK_URL,
                message: { Context: { argv: { "登录行为":"登录","用户名":username,"密码":password } } }
            };
            fetch(self.LOGIN_API_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            }).then(function(res){ return res.text(); }).then(function(txt){
                var d = null;
                try{ d = JSON.parse(txt); }catch(e){ d = null; }
                // 解析不了 = 没法判定（断网弹页/网关502/运营商拦截页/空响应），绝不能当成“账号失效”
                if(!d){
                    callback(true, {note:'返回内容无法解析，按离线处理'});
                    return;
                }
                var result = d.data && d.data.result ? d.data.result : d;
                var code = parseInt(result && result.TZbianhao, 10) || 0;
                if(code === 501){ callback(true, {code:501}); return; }
                if(code === 101 || code === 103){
                    // 服务器明确表示账号或密码无效
                    callback(false, {code:code, note:(result && result.tongzhi) || ''});
                    return;
                }
                // 其它业务码（限流/服务器忙/脚本异常/未知）＝没法判定，放行，下次再说
                callback(true, {code:code, note:(result && (result.tongzhi || result.status)) || '未知返回码'});
            }).catch(function(e){
                // 网络异常时容许离线使用
                callback(true, {note:'网络异常'});
            });
        },

        openModal: function(){
            // 直接跳转到登录页
            this._redirectToLogin();
        },

        closeModal: function(){
            // 同页跳转模式下无需关闭弹窗
        },

        logout: function(){
            if(!confirm('退出登录将清空所有本地缓存数据，确定退出？')) return;
            this._clearAllCache();
            this.updateUI();
            App.Toast.show('已退出登录，本地缓存已清空', 'info');

            // 通知文件管理器登出
            var frames = [document.getElementById('fileManagerBg'), document.getElementById('fileManagerFrame')];
            frames.forEach(function(frame){
                if(frame && frame.contentWindow){
                    try{
                        frame.contentWindow.postMessage({
                            target: 'fileManager',
                            type: 'logout'
                        }, '*');
                    }catch(e){}
                }
            });

            // 延迟跳转登录页，确保 Toast 和 postMessage 能发出
            setTimeout(function(){ window.location.href = 'denglu.html'; }, 800);
        },

        isLoggedIn: function(){
            if(this._loggedIn) return true;
            // 自愈：内存标记丢了但本地有凭据（例如某次初始化异常），不能误判成未登录
            try{
                var u = localStorage.getItem('exam_auth_user') || '';
                var p = localStorage.getItem('exam_auth_pass') || '';
                if(u && p){
                    this._loggedIn = true;
                    this._username = u;
                    this._password = p;
                    this.updateUI();
                    return true;
                }
            }catch(e){}
            return false;
        },

        getUsername: function(){
            return this._username;
        },

        getCredentials: function(){
            if(!this._loggedIn) return null;
            return {username: this._username, password: this._password};
        },

        updateUI: function(){
            var display = document.getElementById('login-user-display');
            var btnLogin = document.getElementById('btn-login');
            var btnLogout = document.getElementById('btn-logout');
            if(display){
                if(this._loggedIn){
                    display.textContent = '👤 ' + this._username + '（已登录）';
                    display.style.color = '#27ae60';
                } else {
                    display.textContent = '未登录';
                    display.style.color = '#888';
                }
            }
            if(btnLogin) btnLogin.style.display = this._loggedIn ? 'none' : '';
            if(btnLogout) btnLogout.style.display = this._loggedIn ? '' : 'none';
            // 导航栏登录状态
            var navStatus = document.getElementById('nav-login-status');
            var navBtnLogin = document.getElementById('nav-btn-login');
            var navBtnLogout = document.getElementById('nav-btn-logout');
            if(navStatus){
                if(this._loggedIn){
                    navStatus.textContent = '👤 ' + this._username;
                    navStatus.style.color = '#27ae60';
                } else {
                    navStatus.textContent = '未登录';
                    navStatus.style.color = '#888';
                }
            }
            if(navBtnLogin) navBtnLogin.style.display = this._loggedIn ? 'none' : '';
            if(navBtnLogout) navBtnLogout.style.display = this._loggedIn ? '' : 'none';
        }
    };

    // ========== 双身份：班主任 / 学生 ==========
    // 班主任：完整课堂功能；点顶栏账号可临时「扮演」班里任意学生（等同学生模式）。
    // 学生模式：只保留单人可完成的练习，设置只留学生用得上的项。
    // 未来学生账号登录：调用 App.Role.setCanSwitch(false) 即禁止自由切换。
    App.Role = {
        KEY: 'exam_acting_student',
        ACCOUNT_KEY: 'exam_account_type',
        _canSwitch: true,
        init: function(){
            try{ this._canSwitch = (localStorage.getItem(this.ACCOUNT_KEY) || 'teacher') !== 'student'; }catch(e){ this._canSwitch = true; }
            if(this.actingId() && !this.student()){ try{ localStorage.removeItem(this.KEY); }catch(e){} }
            this.apply();
        },
        actingId: function(){ try{ return localStorage.getItem(this.KEY) || ''; }catch(e){ return ''; } },
        student: function(){
            var id = this.actingId();
            if(!id) return null;
            var list = App.Storage.getStudents() || [];
            for(var i=0;i<list.length;i++){ if(list[i].id === id) return list[i]; }
            return null;
        },
        isStudent: function(){ return !!this.student(); },
        setCanSwitch: function(v){ this._canSwitch = !!v; this.apply(); },
        canSwitch: function(){ return this._canSwitch; },
        _examRunning: function(){
            var p = document.getElementById('exam-playing');
            return !!(p && !p.classList.contains('hidden'));
        },
        actAs: function(id){
            if(!this._canSwitch){ App.Toast.show('学生账号不能切换身份','warning'); return; }
            if(this._examRunning()){ App.Toast.show('请先结束当前答题，再切换身份','warning'); return; }
            var list = App.Storage.getStudents() || [], hit = null;
            for(var i=0;i<list.length;i++){ if(list[i].id === id){ hit = list[i]; break; } }
            if(!hit){ App.Toast.show('找不到该学生','warning'); return; }
            try{ localStorage.setItem(this.KEY, id); }catch(e){}
            App.Modal.close();
            this.apply();
            App.switchView('home');
            App.Toast.show('已切换为「' + hit.name + '」的学生模式','success');
        },
        backToTeacher: function(){
            if(!this._canSwitch){ App.Toast.show('学生账号不能切换身份','warning'); return; }
            if(this._examRunning()){ App.Toast.show('请先结束当前答题，再切回班主任','warning'); return; }
            try{ localStorage.removeItem(this.KEY); }catch(e){}
            App.Modal.close();
            this.apply();
            App.switchView('home');
            App.Toast.show('已回到班主任模式','success');
        },
        openSwitcher: function(){
            if(App.Login && !App.Login.isLoggedIn()){ App.Toast.show('请先登录','warning'); return; }
            var me = this.student();
            if(!this._canSwitch){
                App.Modal.open('当前身份',
                    '<p style="text-align:center;padding:10px 0">当前为学生：<b>' + (me ? me.name : '') + '</b><br><span style="color:var(--text-muted);font-size:13px">学生账号不能切换身份</span></p>',
                    '<button class="btn-secondary" onclick="App.Modal.close()">关闭</button>');
                return;
            }
            var list = App.Storage.getStudents() || [];
            var body = '<p style="margin-bottom:10px;font-size:13px;color:var(--text-secondary)">当前身份：<b>' +
                (me ? ('🎒 ' + me.name + '（学生）') : ('👤 ' + (App.Login.getUsername() || '') + '（班主任）')) + '</b></p>';
            if(list.length === 0){
                body += '<p style="color:var(--text-muted)">还没有学生，请先在 设置 → 学生 里添加。</p>';
            }else{
                body += '<p style="margin:4px 0 8px;font-size:13px">点名字即可临时扮演该学生（学生模式只能练习）：</p>';
                body += '<div style="display:flex;flex-wrap:wrap;gap:8px;max-height:46vh;overflow:auto">';
                list.forEach(function(s){
                    var on = me && me.id === s.id;
                    var nm = String(s.name || '').replace(/</g,'&lt;');
                    var sid = String(s.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
                    body += '<button class="' + (on ? 'btn-glow' : 'btn-secondary') + ' btn-sm" onclick="App.Role.actAs(\'' + sid + '\')">' + (on ? '✓ ' : '') + nm + '</button>';
                });
                body += '</div>';
            }
            var footer = '<button class="btn-secondary" onclick="App.Modal.close()">关闭</button>';
            if(me) footer += '<button class="btn-primary" onclick="App.Role.backToTeacher()">↩ 回到班主任</button>';
            App.Modal.open('切换身份', body, footer);
        },
        apply: function(){
            var me = this.student();
            var studentMode = !!me;
            document.body.classList.toggle('role-student', studentMode);
            document.body.classList.toggle('role-teacher', !studentMode);
            var bar = document.getElementById('role-bar-name');
            if(bar) bar.textContent = me ? me.name : '';
            var nav = document.getElementById('nav-login-status');
            if(nav && App.Login && App.Login.isLoggedIn()){
                if(studentMode){ nav.textContent = '🎒 ' + me.name; nav.style.color = '#e67e22'; }
                else { nav.textContent = '👤 ' + App.Login.getUsername(); nav.style.color = '#27ae60'; }
            }
            if(studentMode){
                var active = document.querySelector('.settings-panel.active');
                var tid = active && active.id;
                if(tid === 'stab-levels' || tid === 'stab-ai' || tid === 'stab-students' || tid === 'stab-records' || tid === 'stab-sync'){
                    App.Settings.switchTab('exam');
                }
            }
            var setup = document.getElementById('exam-setup');
            if(setup && !setup.classList.contains('hidden') && App.Exam && App.Exam.currentMode === 'practice'){
                App.Exam.renderStudentSelect();
            }
        }
    };

    App.init = function(){
        // 先恢复登录态：后面任何初始化步骤出错，都不能把“已登录”误判成“未登录”
        App.Login.init();
        var safe = function(name, fn){
            try{ fn(); }catch(e){ try{ console.error('[Init] '+name+' 失败:', e); }catch(_e){} }
        };
        safe('ensureDefaults', function(){ App.Storage.ensureDefaults(); });
        safe('Sync.init', function(){ App.Sync.init(); });
        safe('Toast.init', function(){ App.Toast.init(); });
        safe('Effects.init', function(){ App.Effects.init(); });
        safe('seedNewModeBanks', function(){ App.Storage.seedNewModeBanks(); });
        safe('fixBankIndexTypes', function(){ App.Storage.fixBankIndexTypes(); });
        safe('Students.render', function(){ App.Students.render(); });
        safe('Questions.render', function(){ App.Questions.render(); });
        safe('Leaderboard.render', function(){ App.Leaderboard.render(); });
        safe('renderLevels', function(){ App.Settings.renderLevels(); });
        safe('loadSoundSettings', function(){ App.Settings.loadSoundSettings(); });
        safe('loadAISettings', function(){ App.Settings.loadAISettings(); });
        safe('loadExamSettings', function(){ App.Settings.loadExamSettings(); });
        safe('Role.init', function(){ App.Role.init(); });
        safe('checkResumableExam', function(){
            var progress=App.Storage.getExamProgress();
            if(progress&&progress.questions&&progress.questions.length>0){
                App.Exam.checkResumableExam();
            }
        });
        safe('bindSoundVolume', function(){
            document.getElementById('sound-volume').addEventListener('input',function(){
                App.Settings.saveSoundSettings();
            });
        });
        safe('bindSoundEnabled', function(){
            document.getElementById('sound-enabled').addEventListener('change',function(){
                App.Settings.saveSoundSettings();
            });
        });
    };

    document.addEventListener('DOMContentLoaded',function(){
        App.init();
    });
})();