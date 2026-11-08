/* 课外阅读模块（按需加载）v2.030
   流程：开始比赛 → 先展示阅读材料（记事本纸面、可滚动）→ 倒计时到点自动进入答题，
   也可点「结束阅读，开始答题」提前进入；阅读时长 = 文章字数 × 每字秒数。 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    App.Reading={
        _timer:null,
        _ov:null,
        _onDone:null,
        _esc:function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
        // article=正文, secPerChar=每字秒数, onDone=读完后的回调
        begin:function(article,secPerChar,onDone,title){
            this.cancel();
            var esc=this._esc;
            var text=String(article||'').replace(/\r/g,'');
            var chars=text.replace(/\s/g,'').length;
            var total=Math.max(5,Math.round(chars*(parseFloat(secPerChar)||0.5)));
            var paras=text.split('\n').map(function(x){return x.trim()}).filter(function(x){return !!x});
            if(!paras.length)paras=[text];
            var ov=document.createElement('div');
            ov.id='reading-overlay';ov.className='reading-overlay';
            var html='<div class="reading-sheet">';
            html+='<div class="reading-head"><span class="reading-title">📖 '+(title?esc(title):'课外阅读')+'</span><span class="reading-timer" id="reading-timer">--</span></div>';
            html+='<div class="reading-meta">全文约 '+chars+' 字 · 阅读时限 '+total+' 秒</div>';
            html+='<div class="reading-body" id="reading-body">'+paras.map(function(p){return '<p>'+esc(p)+'</p>'}).join('')+'</div>';
            html+='<div class="reading-bar"><div class="reading-progress"><div class="reading-progress-fill" id="reading-fill"></div></div><button class="reading-btn" id="reading-finish">结束阅读，开始答题 →</button></div>';
            html+='</div>';
            ov.innerHTML=html;
            document.body.appendChild(ov);
            document.body.classList.add('reading-open');
            this._ov=ov;this._onDone=onDone;
            var timerEl=ov.querySelector('#reading-timer');
            var fill=ov.querySelector('#reading-fill');
            var left=total;
            var done=false;
            var finish=(function(){
                if(done)return;done=true;
                if(App.Reading._timer){clearInterval(App.Reading._timer);App.Reading._timer=null}
                if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
                document.body.classList.remove('reading-open');
                App.Reading._ov=null;
                var cb=App.Reading._onDone;App.Reading._onDone=null;
                if(cb)cb();
            });
            this._finish=finish;
            function render(){
                var m=Math.floor(left/60),s=left%60;
                timerEl.textContent='剩余 '+(m>0?(m+':'+(s<10?'0':'')+s):(s+' 秒'));
                timerEl.classList.toggle('warn',left<=10);
                if(fill)fill.style.width=Math.min(100,((total-left)/total)*100)+'%';
            }
            render();
            ov.querySelector('#reading-finish').onclick=finish;
            this._timer=setInterval(function(){
                left--;
                if(left<=0){render();finish();return}
                render();
            },1000);
        },
        // 退出比赛时强制收掉阅读层（不触发开始答题）
        cancel:function(){
            if(this._timer){clearInterval(this._timer);this._timer=null}
            if(this._ov&&this._ov.parentNode)this._ov.parentNode.removeChild(this._ov);
            this._ov=null;this._onDone=null;this._finish=null;
            document.body.classList.remove('reading-open');
        }
    };
})();
