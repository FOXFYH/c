/* 拼音题模块（按需加载）——原理参照 FOXFYH/pyin 的「简单」难度：声母→介母→韵母→声调，每步约5个候选 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    App.Pinyin = {
        initials:['b','c','ch','d','f','g','h','j','k','l','m','n','p','q','r','s','sh','t','w','x','y','z','zh'],
        medials:['i','u','ü'],
        FINAL_DECOMPOSE:{'ia':{m:'i',f:'a'},'ian':{m:'i',f:'an'},'iang':{m:'i',f:'ang'},'iao':{m:'i',f:'ao'},'iong':{m:'i',f:'ong'},'ua':{m:'u',f:'a'},'uai':{m:'u',f:'ai'},'uan':{m:'u',f:'an'},'uang':{m:'u',f:'ang'},'uo':{m:'u',f:'o'}},
        baseFinals:['a','ai','an','ang','ao','e','ei','en','eng','er','ie','i','in','ing','o','ong','ou','iu','u','un','ui','ü','üe','üan','ün'],
        wholeSyllables:['zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'],
        wholeGroups:[['zhi','chi','shi','ri','zi','ci','si'],['yi','yu','ye','yue','yuan','yin','yun','ying'],['wu']],
        tones:[{id:1,symbol:'ˉ',name:'一声'},{id:2,symbol:'ˊ',name:'二声'},{id:3,symbol:'ˇ',name:'三声'},{id:4,symbol:'ˋ',name:'四声'},{id:0,symbol:'·',name:'轻声'}],
        MAX_ROUND:10,
        BUILTIN:[
            {text:'春',char:'春',pinyin:'chūn'},{text:'夏',char:'夏',pinyin:'xià'},{text:'秋',char:'秋',pinyin:'qiū'},{text:'冬',char:'冬',pinyin:'dōng'},
            {text:'春天来了',char:'春',pinyin:'chūn'},{text:'夏天很热',char:'夏',pinyin:'xià'},{text:'秋天到了',char:'秋',pinyin:'qiū'},{text:'冬天很冷',char:'冬',pinyin:'dōng'},
            {text:'花园里的花开得真美',char:'花',pinyin:'huā'},{text:'小草绿了',char:'草',pinyin:'cǎo'},{text:'树上有一只小鸟',char:'树',pinyin:'shù'},{text:'小鸟在唱歌',char:'鸟',pinyin:'niǎo'},
            {text:'远处有一座高山',char:'山',pinyin:'shān'},{text:'小河里的水很清',char:'水',pinyin:'shuǐ'},{text:'火苗跳动着',char:'火',pinyin:'huǒ'},{text:'月亮挂在天上',char:'月',pinyin:'yuè'},
            {text:'日出东方',char:'日',pinyin:'rì'},{text:'今天天气很好',char:'天',pinyin:'tiān'},{text:'地上铺满了落叶',char:'地',pinyin:'dì'},{text:'公园里人很多',char:'人',pinyin:'rén'},
            {text:'大象的耳朵很大',char:'大',pinyin:'dà'},{text:'小狗跑得很快',char:'小',pinyin:'xiǎo'},{text:'桌子上放着一本书',char:'上',pinyin:'shàng'},{text:'树下很凉快',char:'下',pinyin:'xià'},
            {text:'中国是我的祖国',char:'中',pinyin:'zhōng'},{text:'国',char:'国',pinyin:'guó'},{text:'家',char:'家',pinyin:'jiā'},{text:'我们每天都要学习',char:'学',pinyin:'xué'},
            {text:'习',char:'习',pinyin:'xí'},{text:'书',char:'书',pinyin:'shū'},{text:'他正在写字',char:'写',pinyin:'xiě'},{text:'我喜欢读书',char:'读',pinyin:'dú'},
            {text:'认真听老师讲课',char:'听',pinyin:'tīng'},{text:'他说话很有礼貌',char:'说',pinyin:'shuō'},{text:'抬头看天上的星星',char:'看',pinyin:'kàn'},{text:'我们走路去学校',char:'走',pinyin:'zǒu'},
            {text:'同学们在操场上跑步',char:'跑',pinyin:'pǎo'},{text:'飞机在天上飞',char:'飞',pinyin:'fēi'},{text:'池塘里有很多小鱼',char:'鱼',pinyin:'yú'},{text:'小猫在晒太阳',char:'猫',pinyin:'māo'},
            {text:'狗',char:'狗',pinyin:'gǒu'},{text:'苹果是红色的',char:'红',pinyin:'hóng'},{text:'树叶变绿了',char:'绿',pinyin:'lǜ'},{text:'天空是蓝色的',char:'蓝',pinyin:'lán'},
            {text:'雪花是白色的',char:'白',pinyin:'bái'},{text:'黑',char:'黑',pinyin:'hēi'},{text:'爸爸带我去公园',char:'爸',pinyin:'bà'},{text:'妈妈做的饭很香',char:'妈',pinyin:'mā'},
            {text:'老师对我们很好',char:'老',pinyin:'lǎo'},{text:'师',char:'师',pinyin:'shī'},{text:'同学之间要互相帮助',char:'同',pinyin:'tóng'},{text:'我们是好朋友',char:'友',pinyin:'yǒu'},
            {text:'朋',char:'朋',pinyin:'péng'},{text:'他跑得真快',char:'快',pinyin:'kuài'},{text:'慢',char:'慢',pinyin:'màn'},{text:'这棵树很高',char:'高',pinyin:'gāo'},
            {text:'矮',char:'矮',pinyin:'ǎi'},{text:'花园里有很多花',char:'多',pinyin:'duō'},{text:'少',char:'少',pinyin:'shǎo'},{text:'早上好',char:'早',pinyin:'zǎo'},
            {text:'晚上要早点睡觉',char:'晚',pinyin:'wǎn'},{text:'书包里有铅笔',char:'里',pinyin:'lǐ'},{text:'门外有人在等',char:'外',pinyin:'wài'},{text:'前面就是学校',char:'前',pinyin:'qián'},
            {text:'后',char:'后',pinyin:'hòu'},{text:'她是女孩子',char:'女',pinyin:'nǚ'},{text:'白云在天上飘',char:'云',pinyin:'yún'},{text:'下雨了要带伞',char:'雨',pinyin:'yǔ'},
            {text:'星星眨着眼睛',char:'星',pinyin:'xīng'},{text:'心里很开心',char:'心',pinyin:'xīn'},{text:'熊猫',char:'熊',pinyin:'xióng'},{text:'雪花飘落下来',char:'雪',pinyin:'xuě'},
            {text:'窗外风景很美',char:'窗',pinyin:'chuāng'},{text:'床',char:'床',pinyin:'chuáng'},{text:'一',char:'一',pinyin:'yī'},{text:'二',char:'二',pinyin:'èr'},
            {text:'三',char:'三',pinyin:'sān'},{text:'四',char:'四',pinyin:'sì'},{text:'五',char:'五',pinyin:'wǔ'},{text:'六',char:'六',pinyin:'liù'},
            {text:'七',char:'七',pinyin:'qī'},{text:'八',char:'八',pinyin:'bā'},{text:'九',char:'九',pinyin:'jiǔ'},{text:'十',char:'十',pinyin:'shí'}
        ],
        _st:null,
        _shuffle:function(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a},
        _esc:function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
        parsePinyin:function(pinyin){
            var tone=0;
            var toneMap={'ā':1,'á':2,'ǎ':3,'à':4,'ō':1,'ó':2,'ǒ':3,'ò':4,'ē':1,'é':2,'ě':3,'è':4,'ī':1,'í':2,'ǐ':3,'ì':4,'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4};
            var baseMap={'ā':'a','á':'a','ǎ':'a','à':'a','ō':'o','ó':'o','ǒ':'o','ò':'o','ē':'e','é':'e','ě':'e','è':'e','ī':'i','í':'i','ǐ':'i','ì':'i','ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v'};
            var base='';
            for(var i=0;i<pinyin.length;i++){var ch=pinyin[i];if(toneMap[ch]){tone=toneMap[ch];base+=baseMap[ch]}else{base+=ch}}
            base=base.replace(/v/g,'ü');
            if(this.wholeSyllables.indexOf(base)>=0)return{initial:'',medial:'',final:base,tone:tone,isWhole:true,base:base};
            var initial='',final_=base;
            if(base.indexOf('zh')===0){initial='zh';final_=base.substring(2)}
            else if(base.indexOf('ch')===0){initial='ch';final_=base.substring(2)}
            else if(base.indexOf('sh')===0){initial='sh';final_=base.substring(2)}
            else if('bpmfdtnlgkhjqxrzcsyw'.indexOf(base[0])>=0){initial=base[0];final_=base.substring(1)}
            if(initial&&'jqxy'.indexOf(initial)>=0){
                if(final_==='ue')final_='üe';
                else if(final_==='uan')final_='üan';
                else if(final_==='u')final_='ü';
            }
            var medial='';
            var decomp=this.FINAL_DECOMPOSE[final_];
            if(decomp){medial=decomp.m;final_=decomp.f}
            return{initial:initial,medial:medial,final:final_,tone:tone,isWhole:false,base:base};
        },
        addTone:function(base,tone){
            if(!tone)return base;
            var tm={'a':['ā','á','ǎ','à'],'o':['ō','ó','ǒ','ò'],'e':['ē','é','ě','è'],'i':['ī','í','ǐ','ì'],'u':['ū','ú','ǔ','ù'],'ü':['ǖ','ǘ','ǚ','ǜ']};
            var r=base;
            var ai=r.indexOf('a');if(ai>=0)return r.substring(0,ai)+tm['a'][tone-1]+r.substring(ai+1);
            var oi=r.indexOf('o');if(oi>=0)return r.substring(0,oi)+tm['o'][tone-1]+r.substring(oi+1);
            var ei=r.indexOf('e');if(ei>=0)return r.substring(0,ei)+tm['e'][tone-1]+r.substring(ei+1);
            var iui=r.indexOf('iu');if(iui>=0)return r.substring(0,iui+1)+tm['u'][tone-1]+r.substring(iui+2);
            var uii=r.indexOf('ui');if(uii>=0)return r.substring(0,uii+1)+tm['i'][tone-1]+r.substring(uii+2);
            for(var i=r.length-1;i>=0;i--){var c=r[i];if(tm[c])return r.substring(0,i)+tm[c][tone-1]+r.substring(i+1)}
            return r;
        },
        formatFull:function(p){
            var base=p.isWhole?p.base:((p.medial||'')+p.final);
            var out=(p.initial||'')+this.addTone(base,p.tone||0);
            if(p.initial&&'jqxy'.indexOf(p.initial)>=0){out=out.replace(/ü/g,'u').replace(/ǖ/g,'ū').replace(/ǘ/g,'ú').replace(/ǚ/g,'ǔ').replace(/ǜ/g,'ù')}
            return out;
        },
        getPool:function(){
            var banks=App.Storage.getBanks()||[];
            var sel=App.Storage.getSettings()._lastPinyinBankIds||[];
            var pool=[],names=[];
            sel.forEach(function(id){
                var b=banks.find(function(x){return x.id===id&&x.type==='pinyin'});
                if(!b||!b.questions||!b.questions.length)return;
                b.questions.forEach(function(q){
                    if(q&&q.text&&q.char&&q.pinyin&&String(q.text).indexOf(q.char)>=0)pool.push(q);
                });
                if(names.indexOf(b.name)<0)names.push(b.name);
            });
            if(!pool.length){pool=this.BUILTIN.slice();names=['内置拼音字库']}
            pool=this._shuffle(pool.slice());
            if(pool.length>this.MAX_ROUND)pool=pool.slice(0,this.MAX_ROUND);
            return {questions:pool,names:names};
        },
        poolLabel:function(){
            var p=this.getPool();
            return p.names.join('、')+'（每轮 '+p.questions.length+' 字）';
        },
        renderQuestion:function(exam,q){
            var parsed=this.parsePinyin(q.pinyin);
            var valid=[parsed];
            if(q.altPinyin&&q.altPinyin.length){
                var self=this;
                q.altPinyin.forEach(function(ap){try{valid.push(self.parsePinyin(ap))}catch(e){}});
            }
            this._st={q:q,exam:exam,parsed:parsed,valid:valid,matching:valid.slice(),step:'initial',sel:{initial:null,medial:null,final:null,tone:null},done:false,correct:false};
            var ch=String(q.char||'');
            var esc=this._esc;
            var html=esc(String(q.text||''));
            if(ch)html=html.split(esc(ch)).join('<span class="pinyin-target">'+esc(ch)+'</span>');
            document.getElementById('question-text').innerHTML='<span class="pinyin-q">'+html+'</span>';
            document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 字 · 拼一拼';
            var nextBtn=document.getElementById('btn-next-question');if(nextBtn)nextBtn.style.display='none';
            var undo=document.getElementById('btn-undo-answer');if(undo)undo.style.display='none';
            var absent=document.getElementById('btn-absent');if(absent)absent.style.display='none';
            this.renderPanel();
            App.Exam.startTimer(q.text);
        },
        _displayText:function(){
            var st=this._st;
            if(!st)return '';
            if(st.done)return this.formatFull(st.parsed);
            var sel=st.sel||{};
            var init=(sel.initial==='整体认读'||sel.initial==='不用声母')?'':(sel.initial||'');
            return init+(sel.medial||'')+(sel.final||'');
        },
        renderPanel:function(){
            var st=this._st;if(!st)return;
            var box=document.getElementById('question-options');if(!box)return;
            var labels={initial:'① 选声母',whole:'② 选整体认读音节',medial:'② 选介母',final:'③ 选韵母',tone:'④ 选声调'};
            var txt=this._displayText();
            var html='<div class="pin-panel">';
            html+='<div class="pin-current">'+(txt?'<span class="pin-full">'+txt+'<span class="pin-dots">…</span></span>':'<span class="pin-ph">_ _ _</span>')+'</div>';
            if(st.done){
                html+='<div class="pin-hint '+(st.correct?'ok':'bad')+'">'+(st.correct?'✅ 拼对了！':'❌ 正确读音：<b>'+this.formatFull(st.parsed)+'</b>')+'</div>';
            }else{
                html+='<div class="pin-hint">'+labels[st.step]+'</div>';
            }
            html+='<div class="pin-grid" id="pin-grid"></div></div>';
            box.innerHTML=html;
            if(st.done)return;
            var grid=document.getElementById('pin-grid');
            var self=this;
            this._optionsForStep(st).forEach(function(k){
                var btn=document.createElement('button');
                btn.className='pin-key'+(k.cls?(' '+k.cls):'');
                btn.textContent=k.label;
                btn.onclick=function(){self._choose(k.value,btn)};
                grid.appendChild(btn);
            });
        },
        _pick:function(pool,correct,count){
            var others=pool.filter(function(x){return x!==correct});
            this._shuffle(others);
            var out;
            if(correct&&pool.indexOf(correct)>=0){out=others.slice(0,count-1);out.push(correct)}
            else{out=others.slice(0,count)}
            return this._shuffle(out);
        },
        _optionsForStep:function(st){
            var p=st.parsed,out=[];
            if(st.step==='initial'){
                this._pick(this.initials,p.initial||'',5).forEach(function(v){out.push({label:v,value:v})});
                out.push({label:'整体认读',value:'整体认读',cls:'special'});
                out.push({label:'不用声母',value:'不用声母',cls:'special'});
            }else if(st.step==='whole'){
                var correctWhole=st.matching[0]?st.matching[0].base:p.base;
                this._pick(this.wholeSyllables,correctWhole,5).forEach(function(v){out.push({label:v,value:v})});
            }else if(st.step==='medial'){
                ['i','u','ü'].forEach(function(v){out.push({label:v,value:v})});
                out.push({label:'无介母',value:'',cls:'special'});
            }else if(st.step==='final'){
                var pool=p.isWhole?this.wholeSyllables:this.baseFinals;
                var correct=p.isWhole?p.base:p.final;
                this._pick(pool,correct,5).forEach(function(v){out.push({label:v,value:v})});
            }else if(st.step==='tone'){
                this.tones.forEach(function(t){out.push({label:t.symbol+' '+t.name,value:t.id,cls:'tone'})});
            }
            return out;
        },
        _choose:function(v,btn){
            var st=this._st;if(!st||st.done)return;
            var step=st.step,matched=[];
            if(step==='initial'){
                if(v==='整体认读')matched=st.matching.filter(function(p){return p.isWhole});
                else if(v==='不用声母')matched=st.matching.filter(function(p){return !p.isWhole&&!p.initial});
                else matched=st.matching.filter(function(p){return !p.isWhole&&p.initial===v});
            }else if(step==='whole'){
                matched=st.matching.filter(function(p){return p.isWhole&&p.base===v});
            }else if(step==='medial'){
                matched=st.matching.filter(function(p){return (p.medial||'')===v});
            }else if(step==='final'){
                matched=st.matching.filter(function(p){return (p.isWhole?p.base:p.final)===v});
            }else if(step==='tone'){
                matched=st.matching.filter(function(p){return (p.tone||0)===v});
            }
            if(!matched.length){
                st.done=true;st.correct=false;this.renderPanel();
                if(btn)btn.classList.add('bad');
                this.finish(false);
                return;
            }
            st.matching=matched;
            if(step==='initial'){
                st.sel.initial=v;
                if(v==='整体认读')st.step='whole';
                else if(matched.some(function(p){return !!p.medial}))st.step='medial';
                else{st.sel.medial='';st.step='final'}
            }else if(step==='whole'){
                st.sel.initial='整体认读';st.sel.medial='';st.sel.final=v;st.step='tone';
            }else if(step==='medial'){
                st.sel.medial=v;st.step='final';
            }else if(step==='final'){
                st.sel.final=v;st.step='tone';
            }else if(step==='tone'){
                st.sel.tone=v;st.done=true;st.correct=true;this.renderPanel();this.finish(true);return;
            }
            this.renderPanel();
        },
        finish:function(correct,timedOut){
            var st=this._st;if(!st)return;
            var exam=st.exam;if(!exam||exam.answered)return;
            exam.answered=true;
            if(App.Exam.timerInterval){clearInterval(App.Exam.timerInterval);App.Exam.timerInterval=null}
            var q=st.q,sid=exam.currentStudent.id,pts=0;
            if(correct){
                pts=exam._pointsPerQ||10;
                exam.totalEarned+=pts;
                exam.playerScores[sid]=(exam.playerScores[sid]||0)+pts;
                App.Effects.playCorrect();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/2,40);
                App.Effects.showScorePopup(pts,true);
            }else{
                App.Effects.playWrong();
                App.Effects.showScorePopup(0,false);
            }
            exam.results.push({studentId:sid,questionId:q.id,correct:!!correct,pointsEarned:pts,selectedOption:timedOut?'超时':this._displayText()});
            var absence=App.Storage.getAbsence(sid);
            if(absence&&absence.consecutiveDays>0){
                var today=new Date();absence.attendedDate=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
                App.Storage.setAbsence(sid,absence);
            }
            var st2=App.getStudentStats(sid),tempPts=st2.totalPoints+pts,lv=App.getLevel(tempPts);
            var ptsEl=document.getElementById('exam-student-points');
            if(ptsEl)ptsEl.textContent='本场：'+(exam.playerScores[sid]||0)+'⭐  累计：'+tempPts+'⭐';
            var lvEl=document.getElementById('exam-student-level');if(lvEl)lvEl.textContent=lv.name;
            var cmEl=document.getElementById('exam-student-comment');if(cmEl)cmEl.textContent=lv.comment;
            App.Exam.renderWarReport(true);
            App.Exam.showNextButton();
            var ub=document.getElementById('btn-undo-answer');if(ub)ub.style.display='none';
            var ab=document.getElementById('btn-absent');if(ab)ab.style.display='none';
        },
        timeUp:function(){
            var st=this._st;if(!st||st.done)return;
            st.done=true;st.correct=false;
            this.renderPanel();
            this.finish(false,true);
            App.Effects.playTimeUp();
        },
        reset:function(){this._st=null}
    };
})();
