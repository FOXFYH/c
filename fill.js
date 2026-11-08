/* 填空题模式（手写作答 · 按需加载）v2.034
   复用 HanziLookupJS + mmah.json；答案区全是只读 div，禁键盘/粘贴/语音。
   每题可多个空，每个空一块手写板；写完自动识别，点候选字上屏；全部填完才能提交。 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    var SIZE=256, SCALE=2, DELAY=380, CANDS=14;
    var eng={matcher:null,status:'idle',promise:null,data:null};
    var st=null;

    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

    function loadEngine(cb){
        if(eng.matcher){cb&&cb();return}
        if(eng.promise){eng.promise.then(function(){cb&&cb()});return}
        eng.status='loading';
        updateEngineText('手写引擎加载中…');
        eng.promise=new Promise(function(resolve){
            var run=function(){
                if(typeof HanziLookup==='undefined'){eng.status='error';updateEngineText('手写引擎加载失败');resolve();return}
                fetch('data/mmah.json').then(function(r){return r.text()}).then(function(txt){
                    var data=JSON.parse(txt);
                    if(!data||!data.chars||!data.substrokes)throw new Error('数据格式异常');
                    data.substrokes=HanziLookup.decodeCompact(data.substrokes);
                    HanziLookup.data.mmah=data;
                    eng.data=data;
                    eng.matcher=new HanziLookup.Matcher('mmah',HanziLookup.DEFAULT_LOOSENESS);
                    eng.status='ready';
                    updateEngineText('手写引擎已就绪（'+data.chars.length+' 字）');
                    // 加载期间已经写了的，补做一次识别
                    if(st&&!st.done){
                        st.blanks.forEach(function(b,i){if(b.strokes.length&&!b.picked)recognize(i)});
                    }
                    resolve();
                    cb&&cb();
                }).catch(function(e){
                    eng.status='error';
                    updateEngineText('手写数据加载失败：'+(e&&e.message?e.message:e));
                    resolve();
                });
            };
            if(typeof HanziLookup!=='undefined'){run();return}
            var s=document.createElement('script');
            s.src='lib/hanzilookup.min.js';
            s.onload=run;
            s.onerror=function(){eng.status='error';updateEngineText('手写引擎脚本加载失败');resolve()};
            document.head.appendChild(s);
        });
    }

    function updateEngineText(t){
        var el=document.getElementById('fill-engine');
        if(el)el.textContent=t;
        var box=document.getElementById('fill-panel');
        if(box)box.classList.toggle('engine-error',eng.status==='error');
    }

    function renderQuestion(exam,q){
        cancel();
        var text=String(q.text||'');
        var answers=(q.answers||[]).slice();
        var parts=text.split(/_{2,}/);
        var n=Math.max(answers.length,parts.length-1);
        if(!n)n=1;
        var html='';
        for(var i=0;i<parts.length;i++){
            html+=esc(parts[i]);
            if(i<parts.length-1)html+='<span class="fill-blank" data-i="'+i+'">?</span>';
        }
        document.getElementById('question-text').innerHTML='<span class="fill-q">'+html+'</span>';
        document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 题 · 填空手写';

        var panel=document.getElementById('question-options');
        var body='<div class="fill-panel" id="fill-panel"><div class="fill-engine" id="fill-engine">手写引擎准备中…</div><div class="fill-blanks" id="fill-blanks"></div><button type="button" class="fill-submit" id="fill-submit" disabled>全部填完才能提交</button></div>';
        panel.innerHTML=body;
        panel.setAttribute('aria-readonly','true');

        st={exam:exam,q:q,answers:answers,blanks:[],done:false};

        var wrap=document.getElementById('fill-blanks');
        for(var k=0;k<n;k++){
            var item=document.createElement('div');
            item.className='fill-item';item.dataset.i=String(k);
            item.innerHTML='<div class="fill-item-head">第 '+(k+1)+' 空 <span class="fill-picked">（未写）</span></div>'+
                '<div class="fill-pad-wrap"><canvas width="'+(SIZE*SCALE)+'" height="'+(SIZE*SCALE)+'"></canvas><div class="fill-tip">在此手写</div></div>'+
                '<div class="fill-tools"><button type="button" data-act="undo">撤销一笔</button><button type="button" data-act="clear">清空</button><button type="button" data-act="redo">重写</button></div>'+
                '<div class="fill-cands" aria-label="候选字"></div>';
            wrap.appendChild(item);
            var canvas=item.querySelector('canvas');
            var ctx=canvas.getContext('2d');
            ctx.setTransform(SCALE,0,0,SCALE,0,0);
            ctx.lineCap='round';ctx.lineJoin='round';
            var b={strokes:[],cur:null,drawing:false,timer:null,cands:[],picked:'',canvas:canvas,ctx:ctx,item:item};
            st.blanks.push(b);
            bindPad(k);
            bindTools(k);
        }
        document.getElementById('fill-submit').onclick=function(){submit()};
        bindAntiCheat();
        loadEngine();
        var nextBtn=document.getElementById('btn-next-question');if(nextBtn)nextBtn.style.display='none';
        var undo=document.getElementById('btn-undo-answer');if(undo)undo.style.display='none';
        var absent=document.getElementById('btn-absent');if(absent)absent.style.display='none';
        App.Exam.startTimer(q.text);
    }

    function pos(b,e){
        var r=b.canvas.getBoundingClientRect();
        return [(e.clientX-r.left)/r.width*SIZE,(e.clientY-r.top)/r.height*SIZE];
    }

    function drawStroke(b,pts){
        if(!pts||!pts.length)return;
        var ctx=b.ctx;
        ctx.strokeStyle='#161412';ctx.fillStyle='#161412';ctx.lineWidth=6;
        if(pts.length===1){ctx.beginPath();ctx.arc(pts[0][0],pts[0][1],3,0,Math.PI*2);ctx.fill();return}
        ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
        for(var i=1;i<pts.length-1;i++){
            var mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2;
            ctx.quadraticCurveTo(pts[i][0],pts[i][1],mx,my);
        }
        ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);ctx.stroke();
    }

    function redraw(b){
        b.ctx.clearRect(0,0,SIZE,SIZE);
        for(var i=0;i<b.strokes.length;i++)drawStroke(b,b.strokes[i]);
        if(b.cur)drawStroke(b,b.cur);
    }

    function bindPad(i){
        var b=st.blanks[i];
        var c=b.canvas;
        c.addEventListener('pointerdown',function(e){
            if(st.done)return;
            if(e.pointerType==='mouse'&&e.button!==0)return;
            e.preventDefault();
            b.drawing=true;b.item.classList.add('drawing');
            var tip=b.item.querySelector('.fill-tip');if(tip)tip.style.display='none';
            try{c.setPointerCapture(e.pointerId)}catch(err){}
            b.cur=[pos(b,e)];redraw(b);
        });
        c.addEventListener('pointermove',function(e){
            if(!b.drawing||!b.cur)return;
            e.preventDefault();
            var evs=(typeof e.getCoalescedEvents==='function')?e.getCoalescedEvents():[e];
            if(!evs.length)evs=[e];
            for(var k=0;k<evs.length;k++){
                var p=pos(b,evs[k]),last=b.cur[b.cur.length-1];
                if(Math.abs(p[0]-last[0])+Math.abs(p[1]-last[1])<1.2)continue;
                b.cur.push(p);
            }
            redraw(b);
        });
        var end=function(e){
            if(!b.drawing)return;
            e.preventDefault();
            b.drawing=false;b.item.classList.remove('drawing');
            if(b.cur&&b.cur.length)b.strokes.push(b.cur);
            b.cur=null;redraw(b);
            schedule(i);
        };
        c.addEventListener('pointerup',end);
        c.addEventListener('pointercancel',end);
        window.addEventListener('pointerup',function(e){if(b.drawing&&e.target!==c)end(e)});
        c.addEventListener('touchstart',function(e){e.preventDefault()},{passive:false});
        c.addEventListener('touchmove',function(e){e.preventDefault()},{passive:false});
    }

    function bindTools(i){
        var b=st.blanks[i];
        b.item.querySelectorAll('.fill-tools button').forEach(function(btn){
            btn.onclick=function(){
                if(st.done)return;
                var act=btn.dataset.act;
                if(act==='undo'){b.strokes.pop();redraw(b);schedule(i);return}
                if(act==='clear'){clearPad(i);return}
                if(act==='redo'){clearPad(i);b.picked='';updatePicked(i);renderCands(i,[])}
            };
        });
    }

    function clearPad(i,keepPicked){
        var b=st.blanks[i];
        clearTimeout(b.timer);b.timer=null;
        b.strokes=[];b.cur=null;b.drawing=false;
        redraw(b);b.cands=[];renderCands(i,[]);
        var tip=b.item.querySelector('.fill-tip');if(tip)tip.style.display='';
        if(!keepPicked&&b.picked){b.picked='';updatePicked(i)}
    }

    function schedule(i){
        var b=st.blanks[i];
        clearTimeout(b.timer);
        var total=b.strokes.reduce(function(a,s){return a+s.length},0);
        if(total<2)return;
        b.timer=setTimeout(function(){recognize(i)},DELAY);
    }

    function recognize(i){
        var b=st.blanks[i];
        if(st.done||!b.strokes.length)return;
        if(!eng.matcher){renderCands(i,[],'引擎加载中…');return}
        var snapshot=b.strokes.map(function(s){return s.map(function(p){return [p[0],p[1]]})});
        setTimeout(function(){
            if(st.done)return;
            var matches=[];
            try{
                var analyzed=new HanziLookup.AnalyzedCharacter(snapshot);
                eng.matcher.match(analyzed,CANDS,function(list){matches=list||[]});
            }catch(e){console.error('[fill] recognize failed',e)}
            if(!b.strokes.length)return;
            b.cands=matches;
            renderCands(i,matches);
        },0);
    }

    function renderCands(i,list,msg){
        var b=st.blanks[i];
        var box=b.item.querySelector('.fill-cands');
        if(!box)return;
        if(!list||!list.length){
            box.innerHTML='<span class="fill-cand-empty">'+(msg||'写完一笔自动识别；没有正确字就点“重写”')+'</span>';
            return;
        }
        var html='';
        list.forEach(function(m){
            html+='<button type="button" class="fill-cand" data-ch="'+esc(m.character)+'">'+esc(m.character)+'</button>';
        });
        html+='<button type="button" class="fill-cand fill-cand-none" data-act="none">都不是/重写</button>';
        box.innerHTML=html;
        box.querySelectorAll('button').forEach(function(btn){
            btn.onclick=function(){
                if(st.done)return;
                if(btn.dataset.act==='none'){clearPad(i);return}
                pick(i,btn.dataset.ch);
            };
        });
    }

    function pick(i,ch){
        var b=st.blanks[i];
        b.picked=ch;
        clearPad(i,true);
        updatePicked(i);
        // 自动跳到下一个未填的空
        for(var k=0;k<st.blanks.length;k++){
            var idx=(i+1+k)%st.blanks.length;
            if(!st.blanks[idx].picked){
                var it=st.blanks[idx].item;
                if(it&&it.scrollIntoView)try{it.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}
                break;
            }
        }
        var all=st.blanks.every(function(x){return !!x.picked});
        var sb=document.getElementById('fill-submit');
        if(sb){sb.disabled=!all;sb.textContent=all?'提交本题':'还差 '+(st.blanks.filter(function(x){return !x.picked}).length)+' 个空'}
    }

    function updatePicked(i){
        var b=st.blanks[i];
        var head=b.item.querySelector('.fill-picked');
        if(head)head.textContent=b.picked||'（未写）';
        var blank=document.querySelector('.fill-blank[data-i="'+i+'"]');
        if(blank){
            blank.textContent=b.picked||'?';
            blank.classList.toggle('filled',!!b.picked);
        }
    }

    function submit(){
        if(!st||st.done)return;
        var all=st.blanks.every(function(b){return !!b.picked});
        if(!all){App.Toast.show('还有空没填完','warning');return}
        st.done=true;
        st.exam.answered=true;
        if(App.Exam.timerInterval){clearInterval(App.Exam.timerInterval);App.Exam.timerInterval=null}
        var q=st.q,exam=st.exam,sid=exam.currentStudent.id;
        var right=0;
        st.blanks.forEach(function(b,i){
            var ok=b.picked===st.answers[i];
            if(ok)right++;
            b.item.classList.add(ok?'ok':'bad');
            var head=b.item.querySelector('.fill-item-head');
            if(head)head.innerHTML='第 '+(i+1)+' 空 <span class="fill-picked '+(ok?'ok':'bad')+'">写的：'+esc(b.picked)+' '+(ok?'✓':'✗')+'</span>'+(ok?'':' <span class="fill-answer">正确：'+esc(st.answers[i])+'</span>');
        });
        var total=q.points||10;
        var earned=Math.round(total*right/st.blanks.length);
        var full=right===st.blanks.length;
        if(earned>0){
            exam.totalEarned+=earned;
            exam.playerScores[sid]=(exam.playerScores[sid]||0)+earned;
        }
        exam.results.push({studentId:sid,questionId:q.id,correct:full,pointsEarned:earned,selectedOption:st.blanks.map(function(b){return b.picked}).join('|')});
        if(full){
            App.Effects.playCorrect();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/2,40);
            App.Effects.showScorePopup(earned,true);
        }else{
            App.Effects.playWrong();App.Effects.showScorePopup(earned,earned>0);
        }
        var st2=App.getStudentStats(sid),tempPts=st2.totalPoints+earned,lv=App.getLevel(tempPts);
        var ptsEl=document.getElementById('exam-student-points');
        if(ptsEl)ptsEl.textContent='本场：'+(exam.playerScores[sid]||0)+'⭐  累计：'+tempPts+'⭐';
        var lvEl=document.getElementById('exam-student-level');if(lvEl)lvEl.textContent=lv.name;
        var cmEl=document.getElementById('exam-student-comment');if(cmEl)cmEl.textContent=lv.comment;
        var sb=document.getElementById('fill-submit');if(sb){sb.disabled=true;sb.textContent='本题得分 '+earned+'/'+total}
        unbindAC();
        App.Exam.renderWarReport(true);
        App.Exam.showNextButton();
        var ub=document.getElementById('btn-undo-answer');if(ub)ub.style.display='none';
        var ab=document.getElementById('btn-absent');if(ab)ab.style.display='none';
    }

    function timeUp(){
        if(!st||st.done)return;
        st.done=true;
        st.exam.answered=true;
        if(App.Exam.timerInterval){clearInterval(App.Exam.timerInterval);App.Exam.timerInterval=null}
        st.blanks.forEach(function(b,i){
            b.item.classList.add(b.picked&&b.picked===st.answers[i]?'ok':'bad');
            var head=b.item.querySelector('.fill-item-head');
            if(head)head.innerHTML='第 '+(i+1)+' 空 <span class="fill-answer">正确：'+esc(st.answers[i])+'</span>';
        });
        var exam=st.exam,sid=exam.currentStudent.id;
        exam.results.push({studentId:sid,questionId:st.q.id,correct:false,pointsEarned:0,selectedOption:'超时'});
        var sb=document.getElementById('fill-submit');if(sb){sb.disabled=true;sb.textContent='超时未提交'}
        unbindAC();
        App.Effects.playTimeUp();App.Effects.showScorePopup(0,false);
        App.Exam.renderWarReport(true);
        App.Exam.showNextButton();
        var ub=document.getElementById('btn-undo-answer');if(ub)ub.style.display='none';
        var ab=document.getElementById('btn-absent');if(ab)ab.style.display='none';
    }

    // ===== 防作弊：禁右键/拖拽/粘贴/剪切/选择/输入法 =====
    var AC=null;
    function block(e){e.preventDefault();return false}
    function bindAntiCheat(){
        unbindAC();
        AC={
            contextmenu:block,dragstart:block,dragover:block,drop:block,paste:block,cut:block,copy:block,
            beforeinput:function(e){e.preventDefault()},
            keydown:function(e){var k=(e.key||'').toLowerCase();if((e.ctrlKey||e.metaKey)&&(k==='v'||k==='x'))e.preventDefault()}
        };
        for(var k in AC)document.addEventListener(k,AC[k],true);
    }
    function unbindAC(){
        if(!AC)return;
        for(var k in AC)document.removeEventListener(k,AC[k],true);
        AC=null;
    }

    function cancel(){
        if(!st)return;
        st.blanks.forEach(function(b){clearTimeout(b.timer)});
        if(st.exam&&st.exam.answered){/* 已判分，保留画面 */}
        st=null;
        unbindAC();
    }

    App.Fill={renderQuestion:renderQuestion,submit:submit,timeUp:timeUp,cancel:cancel,engine:eng};
})();
