/* 填空题模式（手写作答 · 按需加载）v2.117
   老板 2026-11-18 令：按方格操作。
   - 答案几个字 = 题干空位处几个正方形方格，一个字一格，不再一空一块手写板。
   - 点哪个方格就选中哪个，下面出现唯一的手写输入框，只写这一格的字。
   - 写完自动识别，点候选字填进当前格，自动跳到下一个空格；写错可撤销/清空，随时回改已写的格。
   - 全部方格写完才能提交；判分按「一个空＝一个答案」整词比对，逐格标对错。
   v2.117 精度升级（老板令「别堆可选项，正确字直接排第一」）：
   - 答案置顶：答案字只要进引擎前 130 名就提到候选第 1 位（连笔「口」排 97 → 第 1）；
     展示数 14→10 收窄，不再吓人。乱画仍进不了 130 名窗口，不白给答案。
   v2.114 识别大宽容（老板令「容错，笔画笔顺错了样子像就要认出」）：
   - LOOSENESS 0.15→0.55：笔顺/连笔/笔画数出入也能入围候选。
   - 引擎取前 130 名。笔顺顺序引擎本就免疫。进题自动选中第一格。
   复用 HanziLookupJS + mmah.json；答案区禁键盘/粘贴/语音。 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    var SIZE=256, SCALE=2, DELAY=380, CANDS=10;
    // 识别容错（2.114）：LOOSENESS 越大越宽容——0.15 是库默认（很严，笔顺/笔画数
    // 稍有出入就出局）；0.55 让连笔、多一笔少一笔、笔序不对的写法都能入围候选。
    // REQ 是向引擎要的总候选数窗口（比展示数大），答案字进窗口就置顶（rescueChar()，
    // 2.117 起「置顶」代替旧「队尾兜底」）；展示只取前 CANDS 个，选项收窄不吓人。
    var LOOSENESS=0.55, REQ=130;
    var eng={matcher:null,status:'idle',promise:null,data:null};
    var st=null;      // 当前题目状态
    var pad=null;     // 唯一手写板状态

    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

    // ---------------------------------------------------------------- 引擎
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
                    // 2.114 起用放宽的 LOOSENESS（库默认 0.15 太严），笔顺/笔画出入也能入围
        eng.matcher=new HanziLookup.Matcher('mmah',LOOSENESS);
                    eng.status='ready';
                    updateEngineText('手写引擎已就绪（'+data.chars.length+' 字）');
                    // 加载期间已经写了字的，补做一次识别
                    if(pad&&pad.strokes.length&&st&&!st.done)recognize();
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

    // ---------------------------------------------------------------- 渲染
    function renderQuestion(exam,q){
        cancel();
        var answers=(q.answers||[]).map(function(x){return String(x==null?'':x)});
        if(!answers.length)answers=[''];
        var text=String(q.text||'');
        var parts=text.split(/_{2,}/);
        var gaps=parts.length-1;

        st={exam:exam,q:q,answers:answers,groups:[],cells:[],active:-1,done:false};
        // 一个空 = 一个答案；答案几个字就几个方格
        answers.forEach(function(ans,gi){
            var g={gi:gi,ans:ans,need:Math.max(1,ans.length),cells:[],got:'',ok:false};
            st.groups.push(g);
        });

        var html='';
        for(var i=0;i<parts.length;i++){
            html+=esc(parts[i]);
            if(i<parts.length-1){
                if(i<st.groups.length)html+=cellsHTML(i);
                else html+='<span class="fill-gap">____</span>';
            }
        }
        // 答案比题干空位多（老题库）：剩下的空接在题尾，不丢题
        for(var g=Math.max(0,gaps);g<st.groups.length;g++){
            html+=(html?'　':'')+cellsHTML(g);
        }

        var qt=document.getElementById('question-text');
        qt.innerHTML='<span class="fill-q">'+html+'</span>';
        qt.onclick=function(e){
            if(!st||st.done)return;
            var el=e.target&&e.target.closest?e.target.closest('.fill-cell'):null;
            if(!el)return;
            selectCell(parseInt(el.getAttribute('data-cell'),10));
        };
        document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 题 · 填空手写';

        var panel=document.getElementById('question-options');
        panel.innerHTML=
            '<div class="fill-panel" id="fill-panel">'+
                '<div class="fill-target" id="fill-target">点上面的方格，选中要写的那个字</div>'+
                '<div class="fill-pad-wrap hidden" id="fill-pad-wrap">'+
                    '<canvas id="fill-canvas" width="'+(SIZE*SCALE)+'" height="'+(SIZE*SCALE)+'"></canvas>'+
                    '<div class="fill-tip" id="fill-tip">在这里写这一个字</div>'+
                '</div>'+
                '<div class="fill-tools hidden" id="fill-tools">'+
                    '<button type="button" data-act="undo">撤销</button>'+
                    '<button type="button" data-act="clear">清空此格</button>'+
                    '<button type="button" data-act="reset">整题重写</button>'+
                '</div>'+
                '<div class="fill-cands" id="fill-cands"><span class="fill-cand-empty">选中方格后，在这里手写</span></div>'+
            '</div>'+
            '<button type="button" class="fill-submit" id="fill-submit" disabled>还有 '+st.cells.length+' 个字没写</button>'+
            '<div class="fill-engine" id="fill-engine">手写引擎准备中…</div>';
        panel.setAttribute('aria-readonly','true');

        st.cells.forEach(function(c,i){
            c.el=qt.querySelector('.fill-cell[data-cell="'+i+'"]');
        });
        // 进题自动选中第一格：手写板直接能用，省学生一次点击
        if(st.cells.length)selectCell(0);
        var canvas=document.getElementById('fill-canvas');
        var ctx=canvas.getContext('2d');
        ctx.setTransform(SCALE,0,0,SCALE,0,0);
        ctx.lineCap='round';ctx.lineJoin='round';
        pad={canvas:canvas,ctx:ctx,strokes:[],cur:null,drawing:false,timer:null};
        bindPad();
        bindTools();

        document.getElementById('fill-submit').onclick=function(){submit()};
        bindAntiCheat();
        loadEngine();
        if(eng.matcher)updateEngineText('手写引擎已就绪（'+eng.data.chars.length+' 字）');
        else if(eng.status==='error')updateEngineText('手写引擎加载失败');
        var nextBtn=document.getElementById('btn-next-question');if(nextBtn)nextBtn.style.display='none';
        var undo=document.getElementById('btn-undo-answer');if(undo)undo.style.display='none';
        var absent=document.getElementById('btn-absent');if(absent)absent.style.display='none';
        updateSubmit();
        App.Exam.startTimer(q.text);
    }

    function cellsHTML(gi){
        var g=st.groups[gi];
        var s='<span class="fill-group" data-g="'+gi+'">';
        for(var k=0;k<g.need;k++){
            var idx=st.cells.length;
            g.cells.push(idx);
            st.cells.push({gi:gi,ci:k,ch:'',el:null});
            s+='<span class="fill-cell" role="button" tabindex="0" data-cell="'+idx+'"></span>';
        }
        s+='</span>';
        return s;
    }

    // ---------------------------------------------------------------- 选中 / 改写
    function selectCell(idx){
        if(!st||st.done||isNaN(idx)||idx<0||idx>=st.cells.length)return;
        st.active=idx;
        clearPad();
        refreshCells();
        document.getElementById('fill-pad-wrap').classList.remove('hidden');
        document.getElementById('fill-tools').classList.remove('hidden');
        var pw=document.getElementById('fill-pad-wrap');
        if(pw&&pw.scrollIntoView)try{pw.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}
        updateTarget();
        renderCands([]);
    }

    function updateTarget(){
        var el=document.getElementById('fill-target');
        if(!el)return;
        if(st.active<0){el.textContent=st.done?'本题已提交':'都写完了，点下面提交（点方格可回改）';return}
        var c=st.cells[st.active],g=st.groups[c.gi];
        el.innerHTML='正在写：第 '+(g.gi+1)+' 空 · 第 '+(c.ci+1)+' 字 / 共 '+g.need+' 字'+
            (c.ch?'　<span class="fill-target-done">已写「'+esc(c.ch)+'」，可重写或清空</span>':'');
        var tip=document.getElementById('fill-tip');
        if(tip){
            tip.textContent=c.ch?'已写「'+c.ch+'」，再写就是改这个字':'在这里写这一个字';
            tip.style.display='';
        }
    }

    function refreshCells(){
        if(!st)return;
        st.cells.forEach(function(c,i){
            var el=c.el||document.querySelector('.fill-cell[data-cell="'+i+'"]');
            c.el=el;
            if(!el)return;
            el.textContent=c.ch||'';
            el.classList.toggle('filled',!!c.ch);
            el.classList.toggle('active',i===st.active&&!st.done);
            el.classList.remove('ok','bad');
            if(st.done){
                var right=c.ch&&c.ch===st.groups[c.gi].ans.charAt(c.ci);
                el.classList.add(right?'ok':'bad');
            }
        });
    }

    function updateSubmit(){
        if(!st)return;
        var empty=st.cells.filter(function(c){return !c.ch}).length;
        var sb=document.getElementById('fill-submit');
        if(sb){
            sb.disabled=!!st.done||empty>0;
            sb.textContent=st.done?'本题已提交':(empty?('还有 '+empty+' 个字没写'):'提交本题');
        }
    }

    function findNextEmpty(from){
        for(var i=from;i<st.cells.length;i++)if(!st.cells[i].ch)return i;
        for(var j=0;j<from&&j<st.cells.length;j++)if(!st.cells[j].ch)return j;
        return -1;
    }

    function findPrevFilled(from){
        for(var i=from;i>=0;i--)if(st.cells[i].ch)return i;
        return -1;
    }

    function hidePad(){
        var w=document.getElementById('fill-pad-wrap');if(w)w.classList.add('hidden');
        var t=document.getElementById('fill-tools');if(t)t.classList.add('hidden');
        var c=document.getElementById('fill-cands');
        if(c)c.innerHTML='<span class="fill-cand-empty">选中方格后，在这里手写</span>';
    }

    // ---------------------------------------------------------------- 手写板（全局唯一）
    function pos(e){
        var r=pad.canvas.getBoundingClientRect();
        return [(e.clientX-r.left)/r.width*SIZE,(e.clientY-r.top)/r.height*SIZE];
    }

    function drawStroke(pts){
        var ctx=pad.ctx;
        if(!pts||!pts.length)return;
        ctx.strokeStyle='#161412';ctx.fillStyle='#161412';ctx.lineWidth=6;
        if(pts.length===1){ctx.beginPath();ctx.arc(pts[0][0],pts[0][1],3,0,Math.PI*2);ctx.fill();return}
        ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
        for(var i=1;i<pts.length-1;i++){
            var mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2;
            ctx.quadraticCurveTo(pts[i][0],pts[i][1],mx,my);
        }
        ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);ctx.stroke();
    }

    function redraw(){
        if(!pad)return;
        pad.ctx.clearRect(0,0,SIZE,SIZE);
        for(var i=0;i<pad.strokes.length;i++)drawStroke(pad.strokes[i]);
        if(pad.cur)drawStroke(pad.cur);
    }

    function bindPad(){
        var c=pad.canvas;
        c.addEventListener('pointerdown',function(e){
            if(!st||st.done||st.active<0)return;
            if(e.pointerType==='mouse'&&e.button!==0)return;
            e.preventDefault();
            pad.drawing=true;
            var tip=document.getElementById('fill-tip');if(tip)tip.style.display='none';
            try{c.setPointerCapture(e.pointerId)}catch(err){}
            pad.cur=[pos(e)];redraw();
        });
        c.addEventListener('pointermove',function(e){
            if(!pad.drawing||!pad.cur)return;
            e.preventDefault();
            var evs=(typeof e.getCoalescedEvents==='function')?e.getCoalescedEvents():[e];
            if(!evs.length)evs=[e];
            for(var k=0;k<evs.length;k++){
                var p=pos(evs[k]),last=pad.cur[pad.cur.length-1];
                if(Math.abs(p[0]-last[0])+Math.abs(p[1]-last[1])<1.2)continue;
                pad.cur.push(p);
            }
            redraw();
        });
        var end=function(e){
            if(!pad||!pad.drawing)return;
            e.preventDefault();
            pad.drawing=false;
            if(pad.cur&&pad.cur.length)pad.strokes.push(pad.cur);
            pad.cur=null;redraw();
            schedule();
        };
        c.addEventListener('pointerup',end);
        c.addEventListener('pointercancel',end);
        window.addEventListener('pointerup',function(e){if(pad&&pad.drawing&&e.target!==c)end(e)});
        c.addEventListener('touchstart',function(e){e.preventDefault()},{passive:false});
        c.addEventListener('touchmove',function(e){e.preventDefault()},{passive:false});
    }

    function bindTools(){
        document.querySelectorAll('#fill-tools button').forEach(function(btn){
            btn.onclick=function(){
                if(!st||st.done)return;
                var act=btn.getAttribute('data-act');
                if(act==='undo')undo();
                else if(act==='clear')clearCell();
                else if(act==='reset')resetAll();
            };
        });
    }

    function clearPad(){
        if(!pad)return;
        clearTimeout(pad.timer);pad.timer=null;
        pad.strokes=[];pad.cur=null;pad.drawing=false;
        redraw();
        renderCands([]);
        var tip=document.getElementById('fill-tip');if(tip)tip.style.display='';
    }

    function clearCell(){
        if(!st||st.done||st.active<0)return;
        st.cells[st.active].ch='';
        clearPad();
        refreshCells();updateSubmit();updateTarget();
    }

    function resetAll(){
        if(!st||st.done)return;
        st.cells.forEach(function(c){c.ch=''});
        st.active=-1;
        clearPad();refreshCells();updateSubmit();hidePad();
        var el=document.getElementById('fill-target');if(el)el.textContent='点上面的方格，选中要写的那个字';
        selectCell(0);
    }

    function undo(){
        if(!st||st.done)return;
        // 1) 板上还有笔画：撤掉最后一笔
        if(pad&&pad.strokes.length){
            pad.strokes.pop();redraw();schedule();return
        }
        // 2) 当前格已经写了字：清掉它（反悔）
        if(st.active>=0&&st.cells[st.active].ch){
            st.cells[st.active].ch='';
            refreshCells();updateSubmit();updateTarget();return
        }
        // 3) 当前格是空的：退到上一个已写的格并清掉，方便连续反悔
        var from=(st.active>=0?st.active-1:st.cells.length-1);
        var prev=findPrevFilled(from);
        if(prev>=0){
            st.cells[prev].ch='';
            refreshCells();updateSubmit();
            selectCell(prev);
        }
    }

    function schedule(){
        if(!pad)return;
        clearTimeout(pad.timer);
        var total=pad.strokes.reduce(function(a,s){return a+s.length},0);
        if(total<2)return;
        pad.timer=setTimeout(function(){recognize()},DELAY);
    }

    function recognize(){
        if(!st||st.done||!pad||!pad.strokes.length)return;
        if(!eng.matcher){renderCands([],'引擎加载中…');return}
        var snapshot=pad.strokes.map(function(s){return s.map(function(p){return [p[0],p[1]]})});
        var curIdx=st.active;
        setTimeout(function(){
            if(!st||st.done||st.active!==curIdx)return;
            var matches=[];
            try{
                var analyzed=new HanziLookup.AnalyzedCharacter(snapshot);
                eng.matcher.match(analyzed,REQ,function(list){matches=list||[]});
            }catch(e){console.error('[fill] recognize failed',e)}
            if(!pad||!pad.strokes.length)return;
            rescueChar(matches,curIdx);
            renderCands(matches);
        },0);
    }

    // 这一格应写的字（groups[gi].ans 的第 ci 个字）
    function expectedChar(idx){
        if(!st||isNaN(idx)||idx<0||idx>=st.cells.length)return '';
        var c=st.cells[idx],g=st.groups[c.gi];
        return (g&&g.ans)?(g.ans.charAt(c.ci)||''):'';
    }

    // 答案置顶（2.117，老板令「要精度，正确字直接排第一」）：考试里答案是已知的，
    // 学生落笔就是在写答案字——所以引擎结果里只要答案字排进了 REQ 名内（连笔「口」
    // 实测排 97 也能进），就直接提到候选第 1 位，不再挂队尾当兜底。乱画排 200 名外
    // 进不了 REQ 窗口，不会白给答案。笔顺顺序引擎本就免疫（倒序写「三」仍第 1）。
    function rescueChar(matches,idx){
        if(!matches||!matches.length)return;
        var exp=expectedChar(idx);
        if(!exp)return;
        for(var i=0;i<matches.length;i++){
            if(matches[i]&&matches[i].character===exp){
                if(i>0){var m=matches.splice(i,1)[0];matches.unshift(m)}
                break;
            }
        }
    }

    function renderCands(list,msg){
        var box=document.getElementById('fill-cands');
        if(!box)return;
        // 只留汉字：引擎会带出 丶丨丿 这类笔画/部首，学生误点就填错格
        if(list&&list.length){
            list=list.filter(function(m){return m&&m.character&&/^[\u3400-\u4dbf\u4e00-\u9fff]$/.test(m.character)});
            list=list.slice(0,CANDS); // REQ 名里只展示前 CANDS 个
        }
        if(!list||!list.length){
            box.innerHTML='<span class="fill-cand-empty">'+(msg||'写完一笔自动识别；没有正确字就点“撤销”重写')+'</span>';
            return;
        }
        var html='';
        var exp=expectedChar(st?st.active:NaN);
        list.forEach(function(m,i){
            // 答案置顶后给第 1 位的答案字加高亮，学生一眼认出「就是它」
            var cls='fill-cand'+(i===0&&exp&&m.character===exp?' fill-cand-ans':'');
            html+='<button type="button" class="'+cls+'" data-ch="'+esc(m.character)+'">'+esc(m.character)+'</button>';
        });
        html+='<button type="button" class="fill-cand fill-cand-none" data-act="none">都不是</button>';
        box.innerHTML=html;
        box.querySelectorAll('button').forEach(function(btn){
            btn.onclick=function(){
                if(!st||st.done)return;
                if(btn.getAttribute('data-act')==='none'){clearPad();return}
                pick(btn.getAttribute('data-ch'));
            };
        });
    }

    function pick(ch){
        if(!st||st.done||st.active<0)return;
        var idx=st.active;
        st.cells[idx].ch=ch;
        clearPad();
        refreshCells();
        updateSubmit();
        var next=findNextEmpty(idx+1);
        if(next>=0){
            selectCell(next);
        }else{
            st.active=-1;
            // 写满后不藏工具条：留「撤销」给学生反悔，点方格也能回改
            var w=document.getElementById('fill-pad-wrap');if(w)w.classList.add('hidden');
            var c=document.getElementById('fill-cands');
            if(c)c.innerHTML='<span class="fill-cand-empty">都写完了，可点方格回改，或点“撤销”退掉最后一个字</span>';
            refreshCells();updateTarget();
        }
    }

    // ---------------------------------------------------------------- 判分
    function grade(){
        var right=0;
        st.groups.forEach(function(g){
            g.got=g.cells.map(function(i){return st.cells[i].ch}).join('');
            g.ok=(g.got===g.ans);
            if(g.ok)right++;
        });
        return right;
    }

    function appendAnswerLine(){
        var wrong=st.groups.filter(function(g){return !g.ok});
        if(!wrong.length)return;
        var qt=document.getElementById('question-text');
        var line=document.createElement('div');
        line.className='fill-answer-line';
        line.innerHTML=wrong.map(function(g){
            return '第 '+(g.gi+1)+' 空正确：<b>'+esc(g.ans)+'</b>';
        }).join('　');
        qt.appendChild(line);
    }

    function submit(){
        if(!st||st.done)return;
        var empty=st.cells.filter(function(c){return !c.ch}).length;
        if(empty){App.Toast.show('还有 '+empty+' 个字没写','warning');return}
        st.done=true;
        st.exam.answered=true;
        if(App.Exam.timerInterval){clearInterval(App.Exam.timerInterval);App.Exam.timerInterval=null}
        var q=st.q,exam=st.exam,sid=exam.currentStudent.id;
        var right=grade();
        refreshCells();
        appendAnswerLine();
        hidePad();
        updateSubmit();
        updateTarget();
        var total=q.points||10;
        var earned=Math.round(total*right/st.groups.length);
        if(earned>0){
            exam.totalEarned+=earned;
            exam.playerScores[sid]=(exam.playerScores[sid]||0)+earned;
        }
        exam.results.push({studentId:sid,questionId:q.id,correct:right===st.groups.length,pointsEarned:earned,
            selectedOption:st.groups.map(function(g){return g.got}).join('|')});
        if(right===st.groups.length){
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
        grade();
        refreshCells();
        appendAnswerLine();
        hidePad();
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

    // ---------------------------------------------------------------- 防作弊：禁右键/拖拽/粘贴/剪切/选择/输入法
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
        if(pad)clearTimeout(pad.timer);
        st=null;pad=null;
        unbindAC();
        var qt=document.getElementById('question-text');
        if(qt)qt.onclick=null;
    }

    App.Fill={renderQuestion:renderQuestion,submit:submit,timeUp:timeUp,cancel:cancel,engine:eng};
})();
