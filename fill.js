/* 填空题模式（手写作答 · 按需加载）v2.119
   老板 2026-11-18 令：按方格操作。
   - 答案几个字 = 题干空位处几个正方形方格，一个字一格，不再一空一块手写板。
   - 点哪个方格就选中哪个，下面出现唯一的手写输入框，只写这一格的字。
   - 写完自动识别，点候选字填进当前格，自动跳到下一个空格；写错可撤销/清空，随时回改已写的格。
   - 全部方格写完才能提交；判分按「一个空＝一个答案」整词比对，逐格标对错。
   v2.119 主引擎换神经网络版（老板令「上 GitHub 找免费更高级的实现」）：
   - 采用 @zh-keyboard/recognizer（Apache-2.0 开源，tfjs CNN 模型，训练自真实
     手写数据，GB2312 一级 3755 字，官方支持连笔/简写）。文件：
     lib/zhk_recognizer.bundle.js（esbuild 单文件，337KB）+
     data/zhk/{model.json,group1-shard1of1.bin,dict.txt}（约 1.26MB）。
   - 实测（临时测试\zhk评估\zhk_eval.py，合成笔迹 10 用例）：标准口/三/一/入/
     十/木 全第 1（老引擎「十」进不了前十），连笔口第 2（输给同形「四」），
     人第 2（八/人本就难分），王第 4；乱画 X 不给答案；纯 CPU 每字 250~360ms。
   - ZHK 为主引擎（异步 recognize）；老引擎（HanziLookup 修补版，2.118 的
     三表示合并+字频先验）整体保留作兜底——ZHK 加载失败时自动走老链路。
   v2.118 老引擎真算法升级（保留）：lib 修方向环绕 bug＋反向容差＋去转角惩罚；
     自建转角感知分析器；常用 3500 字字频先验（data/common3500.js）。
   v2.114 容错底盘：LOOSENESS 0.15→0.55；REQ=130 窗口；进题自动选中第一格。
   复用 HanziLookupJS + mmah.json；答案区禁键盘/粘贴/语音。 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    var SIZE=256, SCALE=2, DELAY=380, CANDS=10;
    // 识别容错（2.114）：LOOSENESS 越大越宽容——0.15 是库默认（很严，笔顺/笔画数
    // 稍有出入就出局）；0.55 让连笔、多一笔少一笔、笔序不对的写法都能入围候选。
    // REQ 是向引擎要的总候选数窗口（2.118 起三表示合并后按分排序再截取）。
    var LOOSENESS=0.55, REQ=130, FREQ_BOOST=1.0;
    var eng={matcher:null,status:'idle',promise:null,data:null};
    // v2.119 主引擎（ZHK 神经网络版）状态；r=recognizer 实例
    var zhk={r:null,status:'idle',promise:null};
    var st=null;      // 当前题目状态
    var pad=null;     // 唯一手写板状态

    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

    // ---------------------------------------------------------------- 引擎
    // v2.119：先加载 ZHK 神经网络主引擎；失败再走老引擎兜底
    function loadZHK(){
        if(zhk.r)return Promise.resolve(true);
        if(zhk.promise)return zhk.promise;
        zhk.status='loading';
        zhk.promise=new Promise(function(resolve){
            function boot(){
                if(typeof ZhkLib==='undefined'){zhk.promise=null;resolve(false);return}
                try{
                    console.log('[zhk-timing] bundle 就绪', Math.round(performance.now()));
                    var r=new ZhkLib.ZhkRecognizer({modelPath:'data/zhk/model.json',dictPath:'data/zhk/dict.txt',backend:'cpu'});
                    var __t0=performance.now();
                    r.initialize().then(function(ok){
                        console.log('[zhk-timing] initialize', Math.round(performance.now()-__t0)+'ms ok='+ok);
                        if(ok){zhk.r=r;zhk.status='ready';resolve(true)}
                        else{zhk.promise=null;resolve(false)}
                    }).catch(function(e){console.log('[zhk-timing] init失败',String(e));zhk.promise=null;resolve(false)});
                }catch(e){console.log('[zhk-timing] boot异常',String(e));zhk.promise=null;resolve(false)}
            }
            if(typeof ZhkLib!=='undefined'){boot();return}
            var s=document.createElement('script');
            s.src='lib/zhk_recognizer.bundle.js?v=2.119';
            s.onload=boot;
            s.onerror=function(){zhk.promise=null;resolve(false)};
            document.head.appendChild(s);
        });
        return zhk.promise;
    }
    function loadEngine(cb){
        if(zhk.r||eng.matcher){cb&&cb();return}
        if(zhk.status==='loading'&&zhk.promise){zhk.promise.then(function(ok){ok?(cb&&cb()):loadOld(cb)});return}
        updateEngineText('手写引擎加载中…');
        loadZHK().then(function(ok){
            if(ok){onZHKReady();cb&&cb()}
            else loadOld(cb);
        });
    }
    function onZHKReady(){
        updateEngineText('手写引擎已就绪（AI 模型 · 3755 字）');
        // 加载期间已经写了字的，补做一次识别
        if(pad&&pad.strokes.length&&st&&!st.done)recognize();
    }
    // 老引擎兜底（ZHK 加载失败才走）：HanziLookup 修补版 + mmah.json
    function loadOld(cb){
        if(eng.matcher){cb&&cb();return}
        if(eng.promise){eng.promise.then(function(){cb&&cb()});return}
        eng.status='loading';
        updateEngineText('AI 模型加载失败，切换基础引擎…');
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
                    updateEngineText('手写引擎已就绪（基础版 '+data.chars.length+' 字）');
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
            s.onload=function(){
                // 2.118 加载常用字表（字频先验用），失败不阻塞引擎（先验自动降级为 0）
                var c=document.createElement('script');
                c.src='data/common3500.js';
                c.onload=run;c.onerror=run;
                document.head.appendChild(c);
            };
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
        if(zhk.r)updateEngineText('手写引擎已就绪（AI 模型 · 3755 字）');
        else if(eng.matcher)updateEngineText('手写引擎已就绪（基础版 '+eng.data.chars.length+' 字）');
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
        var curIdx=st.active;
        var snapshot=pad.strokes.map(function(s){return s.map(function(p){return [p[0],p[1]]})});
        // v2.119 主路径：ZHK 神经网络引擎（异步，结果已按置信度排好序）
        if(zhk.r){
            var sd=[];
            snapshot.forEach(function(s){
                for(var i=0;i<s.length;i++)
                    sd.push(Math.round(s[i][0]),Math.round(s[i][1]),i===s.length-1?1:0);
            });
            zhk.r.recognize(sd).then(function(res){
                if(!st||st.done||st.active!==curIdx)return;
                if(!pad||!pad.strokes.length)return;
                renderCands((res||[]).map(function(ch){return {character:ch,score:1}}));
            }).catch(function(e){
                console.error('[fill] zhk recognize failed',e);
                if(!st||st.done||st.active!==curIdx)return;
                renderCands([],'识别出错，再写一笔试试');
            });
            return;
        }
        if(!eng.matcher){renderCands([],'引擎加载中…');return}
        setTimeout(function(){
            if(!st||st.done||st.active!==curIdx)return;
            var matches=[];
            try{matches=matchAll(snapshot)}
            catch(e){console.error('[fill] recognize failed',e)}
            if(!pad||!pad.strokes.length)return;
            renderCands(matches);
        },0);
    }

    // ---------------- 多表示匹配（2.118 真算法升级，不碰答案）----------------
    // 病根（探针实测两处引擎真缺陷）：
    // ① 库的 AnalyzedCharacter 只按「弧长/直线比」找切分点、不看转角——连笔字
    //    笔画不匀时被切成斜弦，方向全歪（连笔「口」因此排 97 名）；
    // ② 引擎方向比对缺 360° 环绕：0° 与 358° 只差 2° 却被当反方向（模板自身
    //    就把「横」有的存 255 有的存 4，同方向互打低分）——已在 lib 修一行。
    // 改法：自建「转角感知」分析器（弧长切分点之外补转角切分点），再加
    // 「笔画反向」变体；原生 / 转角 / 反向三个表示各跑一遍引擎，按字取最高分
    // 合并排序——识别能力本身提升，谁都不偏袒。
    function matchAll(snapshot){
        var best={};
        function feed(list){
            (list||[]).forEach(function(m){
                if(!m||!m.character)return;
                var c=best[m.character];
                if(!c||m.score>c.score)best[m.character]=m;
            });
        }
        eng.matcher.match(new HanziLookup.AnalyzedCharacter(snapshot),REQ,feed);
        eng.matcher.match(buildAnalyzed(snapshot,false),REQ,feed);
        eng.matcher.match(buildAnalyzed(snapshot,true),REQ,feed);
        var list=Object.keys(best).map(function(k){return best[k]});
        // 字频先验（2.118）：常用字加分、生僻字靠后——输入法通行做法。
        // 口/囗、十/丄、人/入 这类同形难分对，靠常用度分胜负（三级字表 3500 字）。
        var common=window.HANZI_COMMON3500||'';
        if(common)list.forEach(function(m){ if(common.indexOf(m.character)>=0)m.score+=FREQ_BOOST; });
        list.sort(function(a,b){return b.score-a.score});
        return list;
    }

    function pDist(a,b){var dx=a[0]-b[0],dy=a[1]-b[1];return Math.sqrt(dx*dx+dy*dy)}
    // 与库同款：取「反向向量」的量化方向（0..255），保证和模板同一口径
    // ★库源码 o(r,t) 里向量是 r-t（起点-终点＝反向），这里必须一致，差 180° 全盘皆输
    function dirOf(a,b){
        var ang=Math.PI-Math.atan2(a[1]-b[1],a[0]-b[0]);
        var v=Math.round(256*ang/Math.PI/2);if(v>=256)v=0;return v;
    }
    // 库同款弧长切分点（v=12.5, f=1.1, s=1.09），逐字复刻防口径漂移
    function arcPivots(pts){
        var keep=new Array(pts.length);
        for(var i=0;i<pts.length;i++)keep[i]=false;
        var o=0,u=0,e=1;keep[0]=true;
        var h=pDist(pts[u],pts[e]),acc=h;
        for(var a=2;a<pts.length;++a){
            var l=pDist(pts[e],pts[a]);
            h+=l;acc+=l;
            var E2=pDist(pts[o],pts[a]),c2=pDist(pts[u],pts[a]);
            if(h>1.1*E2||acc>1.09*c2){
                if(keep[o]&&pDist(pts[o],pts[e])<12.5)keep[o]=false;
                keep[e]=true;acc=l;u=e;
            }
            h=l;o=e;e=a;
        }
        keep[e]=true;
        if(keep[o]&&pDist(pts[o],pts[e])<12.5&&o!==0)keep[o]=false;
        var piv=[];for(var i=0;i<keep.length;i++)if(keep[i])piv.push(i);
        return piv;
    }
    // 转角切分点（2.118 新增）：滑窗弧长 W 内两弦夹角 ≥ 约 68° 判为转角
    function cornerPivots(pts,arcs){
        var n=pts.length,total=0,accArr=[0];
        for(var i=1;i<n;i++){total+=pDist(pts[i-1],pts[i]);accArr.push(total)}
        var out=[];
        if(total<40)return out;
        var W=Math.min(18,total/4);
        var s=0;
        for(var i=1;i<n-1;i++){
            if(accArr[i]-accArr[s]<W||total-accArr[i]<W)continue;
            var j=i+1;while(j<n-1&&accArr[j]-accArr[i]<W)j++;
            var d1=dirOf(pts[s],pts[i]),d2=dirOf(pts[i],pts[j]);
            var dr=Math.abs(d1-d2);if(dr>128)dr=256-dr;
            if(dr>=48){
                var dup=arcs.some(function(p){return Math.abs(p-i)<=2})||
                        out.some(function(p){return Math.abs(p-i)<=2});
                if(!dup)out.push(i);
                s=i;
            }
        }
        return out;
    }
    function makeSub(a,b,w,h2,E,M){
        var big=(w>h2?w*w:h2*h2),e=Math.sqrt(big+big);
        var d=pDist(a,b)/e;if(d>1)d=1;if(!(d>0))d=0;
        var mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,nx,ny;
        if(w>h2){nx=(mx-E)/w;ny=(my-M+(w-h2)/2)/w}
        else{nx=(mx-E+(h2-w)/2)/h2;ny=(my-M)/h2}
        nx=isNaN(nx)?0:(nx<0?0:(nx>1?1:nx));
        ny=isNaN(ny)?0:(ny<0?0:(ny>1?1:ny));
        return {direction:dirOf(a,b),length:Math.round(255*d),
                centerX:Math.round(15*nx),centerY:Math.round(15*ny)};
    }
    // 自建分析器：弧长切分＋转角切分；reverse=笔画反向变体
    function buildAnalyzed(strokes,reverse){
        var E=Infinity,c=-Infinity,M=Infinity,l=-Infinity;
        strokes.forEach(function(pts){pts.forEach(function(p){
            if(p[0]<E)E=p[0];if(p[0]>c)c=p[0];
            if(p[1]<M)M=p[1];if(p[1]>l)l=p[1];
        })});
        var w=Math.max(c-E,1),h2=Math.max(l-M,1);
        var analyzedStrokes=[],N=0;
        strokes.forEach(function(pts0){
            var pts=reverse?pts0.slice().reverse():pts0;
            if(pts.length<2)return;
            var arcs=arcPivots(pts);
            var corns=cornerPivots(pts,arcs);
            var piv=arcs.concat(corns).sort(function(a,b){return a-b});
            if(piv.length<2)return;
            var subs=[];
            for(var k=0;k<piv.length-1;k++){
                subs.push(makeSub(pts[piv[k]],pts[piv[k+1]],w,h2,E,M));
            }
            if(subs.length){analyzedStrokes.push({subStrokes:subs});N+=subs.length}
        });
        return {analyzedStrokes:analyzedStrokes,subStrokeCount:N};
    }

    // 这一格应写的字（groups[gi].ans 的第 ci 个字）——仅用于判分，识别不碰它
    function expectedChar(idx){
        if(!st||isNaN(idx)||idx<0||idx>=st.cells.length)return '';
        var c=st.cells[idx],g=st.groups[c.gi];
        return (g&&g.ans)?(g.ans.charAt(c.ci)||''):'';
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
        list.forEach(function(m){
            html+='<button type="button" class="fill-cand" data-ch="'+esc(m.character)+'">'+esc(m.character)+'</button>';
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
