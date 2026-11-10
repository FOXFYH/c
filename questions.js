/* 题库模块（从 app.js 拆出，按功能区独立） */
(function(){
    "use strict";
    var App=window.App=window.App||{};
    App.Questions = {
        render:function(){var banks=App.Storage.getBanks();var _tf=(document.getElementById('bank-type-filter')||{}).value||'all';var _fpath=App.Questions._folderPath||[];if(_tf!=='all'&&_fpath[0]!==_tf){App.Questions._folderPath=[_tf];_fpath=App.Questions._folderPath}var _atRoot=_fpath.length===0;if(_atRoot){banks=[]}else{banks=banks.filter(function(b){var _t=App.BankTypes.tagsOfBank(b);if(_t.length!==_fpath.length)return false;for(var _i=0;_i<_fpath.length;_i++){if(_t[_i]!==_fpath[_i])return false}return true})}var grid=document.getElementById('bank-grid');var empty=document.getElementById('banks-empty');var compact=(function(){try{return localStorage.getItem('exam_bank_compact')==='1'}catch(e){return false}})();grid.className='bank-grid'+(compact?' compact':'');var cbx=document.getElementById('bank-compact');if(cbx)cbx.checked=compact;var fileIndex=JSON.parse(localStorage.getItem('exam_file_index')||'[]');var localBankIds=new Set(banks.map(function(b){return b.id||b.name}));var localBankNames=new Set(banks.map(function(b){return b.name}));var cloudOnlyBanks=fileIndex.filter(function(f){return f.cloudOnly&&f.id&&f.id.startsWith('QB_')&&!localBankIds.has(f.id)&&!localBankNames.has(App.BankTypes.stripSuffix(f.name))&&f.name});var _cloudHidden=0;
var _cloudAll=cloudOnlyBanks.length;var _cloudUntyped=cloudOnlyBanks.filter(function(f){return !App.Questions.cloudType(f)}).length;if(_tf!=='all'){var _allc=cloudOnlyBanks.length;cloudOnlyBanks=cloudOnlyBanks.filter(function(f){return App.Questions.cloudType(f)===_tf});_cloudHidden=_allc-cloudOnlyBanks.length}
if(_fpath.length){var _allp=cloudOnlyBanks.length;cloudOnlyBanks=cloudOnlyBanks.filter(function(f){var _t=App.BankTypes.tagsOfName(f.name);if(!_t.length)_t=['single'];if(_t.length!==_fpath.length)return false;for(var _i=0;_i<_fpath.length;_i++){if(_t[_i]!==_fpath[_i])return false}return true});_cloudHidden+=_allp-cloudOnlyBanks.length}if(_atRoot)cloudOnlyBanks=[];var _nat=function(x,y){return String(x.name||'').localeCompare(String(y.name||''),'zh-Hans-CN',{numeric:true})};banks.sort(_nat);cloudOnlyBanks.sort(_nat);if(banks.length===0&&cloudOnlyBanks.length===0&&!Object.keys(App.Questions._folderCounts()).length){grid.innerHTML='';empty.classList.add('show');return}empty.classList.remove('show');var html='';banks.forEach(function(b){if(App.BankTypes.of(b)==='pinyin'){html+=App.Questions.pinyinBankCardHTML(b);return}if(App.BankTypes.of(b)==='reading'){html+=App.Questions.readingBankCardHTML(b);return}if(App.BankTypes.of(b)==='fill'){html+=App.Questions.fillBankCardHTML(b);return}var hasContent=b.questions&&b.questions.length>0;var countText=hasContent?(b.questions.length+'道题'):'空题库';var demoBadge=b._demo?'<span style="margin-left:6px;font-size:11px;color:#b07d00;background:#fff7e0;border:1px solid #f0d090;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">测试·仅本地</span>':'';html+='<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-line" onclick="App.Questions.toggleBankCard(this)"><span class="bcl-name">'+b.name+'</span><span class="bcl-count">'+b.questions.length+' 题</span><span class="bcl-arrow">▸</span></div><div class="bc-header"><div><div class="bc-name">'+b.name+demoBadge+'<span class="bank-badge type">'+App.Questions.tagText(b)+'</span><span class="bank-badge local">📥 本地</span></div><div class="bc-count">('+countText+')</div></div></div><div class="bc-desc">'+(b.description||'暂无描述')+'</div><div class="bc-actions teacher-dim"><button onclick="App.Questions.openBankManager(\''+b.id+'\')">📋 编辑预览</button><button onclick="App.Questions.showAddQuestionDialog(\''+b.id+'\')">➕ 添加题目</button><button onclick="App.Questions.showImportQuestionsDialog(\''+b.id+'\')">📥 导入题目</button><button onclick="App.Questions.copyBank(\''+b.id+'\')">📄 复制题库</button><button class="btn-del" onclick="App.Questions.removeBank(\''+b.id+'\')">🗑️ 删除</button></div></div>'});cloudOnlyBanks.forEach(function(f){
            var _cn=App.BankTypes.stripSuffix(f.name);
            var _ct=App.Questions.cloudType(f);
            var _ctn=_ct?App.BankTypes.info(_ct):null;
            var _badge=_ctn?('<span class="bank-badge type">'+_ctn.icon+' '+_ctn.name+'</span>'):'<span class="bank-badge untyped">类型未标注</span>';
            var _n=(f.contentLength?f.contentLength+'字':'内容未缓存');
            var _me=(localStorage.getItem('exam_auth_user')||'');
            var _ow=String(f.owner||'');
            var _other=(_ow&&_me&&_ow!==_me);
            var _ob=_other?'<span style="margin-left:6px;font-size:11px;color:#8a4b00;background:#fff3e0;border:1px solid #f0c090;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">👤 属于 '+_ow+'</span>':'';
            var _del=_other?('App.Toast.show(\'该题库属于 '+_ow+'，请先用该账号登录后再删除\',\'error\')'):('App.Questions.removeBank(\''+f.id+'\')');
            html+='<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-line" onclick="App.Questions.toggleBankCard(this)"><span class="bcl-name">'+_cn+'</span><span class="bcl-count">'+_n+'</span><span class="bcl-arrow">▸</span></div><div class="bc-header"><div><div class="bc-name">'+_cn+'<span style="margin-left:6px;font-size:11px;color:#0b6fb3;background:#eef7ff;border:1px solid #b9dcf5;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">☁ 仅云端·未下载</span>'+_badge+_ob+'</div><div class="bc-count">（'+_n+'）</div></div></div><div class="bc-desc">'+(_other?('该题库属于账号 '+_ow+'，当前登录的是 '+_me+'，无权删除或编辑；请用该账号登录后再操作。'):'该题库只存在于云端，尚未缓存到本地；可直接在「开始比赛→题库」里选中，开考时会自动下载。')+'</div><div class="bc-actions"><button onclick="App.Questions.downloadCloudBank(\''+f.id+'\',\''+String(_cn).replace(/'/g,'')+'\')">☁️ 下载题库</button><button class="teacher-dim" onclick="App.Questions.editCloudBank(\''+f.id+'\',\''+String(_cn).replace(/'/g,'')+'\')">📋 编辑预览</button><button class="btn-del teacher-dim" onclick="'+_del+'">🗑️ 删除</button></div></div>'
        });
        if(_cloudHidden>0)html+='<div class="bank-modal-note" style="grid-column:1/-1">另有 '+_cloudHidden+' 个云端题库在当前筛选下不显示（云端共 '+_cloudAll+' 个，其中 '+_cloudUntyped+' 个类型未标注）；切到「全部题库」即可看到全部并下载，下载一次后会自动归类</div>';
        html=App.Questions.folderCardsHTML()+html;grid.innerHTML=html;App.Questions.renderFolderBar();App.Questions._injectCopyButtons()},
        // R1-06：四类题库卡统一补「复制题库」入口（拼音/阅读/填空卡也覆盖，免逐个改卡片模板）
        _injectCopyButtons:function(){
            var grid=document.getElementById('bank-grid');if(!grid)return;
            var cards=grid.querySelectorAll('.bank-card');
            for(var i=0;i<cards.length;i++){
                var acts=cards[i].querySelector('.bc-actions');if(!acts)continue;
                if(String(acts.textContent||'').indexOf('复制题库')>=0)continue;
                var m=(acts.innerHTML.match(/App\.Questions\.[A-Za-z]+\(\'([^\']+)\'/)||[])[1];
                if(!m)continue;
                var btn=document.createElement('button');
                btn.textContent='📄 复制题库';
                btn.setAttribute('onclick','App.Questions.copyBank(\''+m+'\')');
                var del=acts.querySelector('.btn-del');
                if(del)acts.insertBefore(btn,del);else acts.appendChild(btn);
            }
        },
        toggleBankCard:function(el){
            var card=el&&el.closest?el.closest('.bank-card'):null;
            var grid=document.getElementById('bank-grid');
            if(!card||!grid||!grid.classList.contains('compact'))return;
            card.classList.toggle('expanded');
            if(App.Effects&&App.Effects.playClick)App.Effects.playClick();
        },
        toggleBankCompact:function(cb){
            try{localStorage.setItem('exam_bank_compact',cb&&cb.checked?'1':'0')}catch(e){}
            this.render();
            if(App.Effects&&App.Effects.playClick)App.Effects.playClick();
        },
        renderBankSelect:function(){if(App.Exam&&App.Exam.currentMode==='pinyin'){this.renderPinyinBankInfo();return}if(App.Exam&&App.Exam.currentMode==='reading'){this.renderReadingBankInfo();return}if(App.Exam&&App.Exam.currentMode==='fill'){this.renderFillBankInfo();return}var banks=App.Storage.getBanks();if(App.BankTypes)banks=App.BankTypes.filter(banks,App.Exam.currentMode);var info=document.getElementById('exam-bank-info');if(!info)return;var _bar=document.getElementById('exam-bank-bar');var _lab=_bar?_bar.querySelector('.bank-bar-label'):null;if(_lab)_lab.textContent='📚 题库';var fileIndex=JSON.parse(localStorage.getItem('exam_file_index')||'[]');var localBankIds=new Set(banks.map(function(b){return b.id||b.name}));var localBankNames=new Set(banks.map(function(b){return b.name}));var cloudOnlyBanks=fileIndex.filter(function(f){return f.cloudOnly&&f.id&&f.id.startsWith('QB_')&&!localBankIds.has(f.id)&&!localBankNames.has(f.name)&&f.name});if(banks.length===0&&cloudOnlyBanks.length===0){info.textContent='暂无题库，请先创建';return}var lastIds=App.Storage.getSettings()._lastBankIds||[];var matched=banks.filter(function(b){return lastIds.indexOf(b.id)>=0});var cloudMatched=cloudOnlyBanks.filter(function(f){return lastIds.indexOf(f.id)>=0});if(matched.length>0||cloudMatched.length>0){var names=[];var totalQ=0;matched.forEach(function(b){names.push(b.name);totalQ+=b.questions.length});cloudMatched.forEach(function(f){names.push(f.name)});info.textContent=names.join('、')+'（'+totalQ+' 题）'}else{info.textContent='点击选择题库'}},
        _modalPath:null,
        showBankSelectModal:function(){
            var need=App.BankTypes.allowedForMode(App.Exam.currentMode);
            if(!this._modalPath||this._modalPath[0]!==need)this._modalPath=[need];
            this.renderBankModal();
        },
        modalFolderEnter:function(tag){
            // R1-10：题库弹层最多「题型→科目」两层，不允许再往下钻
            if((this._modalPath||[]).length>=2)return;
            this._modalPath=(this._modalPath||[]).concat([tag]);
            this.renderBankModal();
        },
        modalFolderTo:function(n){
            this._modalPath=(this._modalPath||[]).slice(0,n);
            if(!this._modalPath.length)this._modalPath=[App.BankTypes.allowedForMode(App.Exam.currentMode)];
            this.renderBankModal();
        },
        renderBankModal:function(){
            var mode=App.Exam.currentMode;
            var need=App.BankTypes.allowedForMode(mode);
            var path=(this._modalPath&&this._modalPath[0]===need)?this._modalPath:[need];
            var banks=App.Storage.getBanks()||[];
            var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
            var folders={},items=[];
            function under(tags){
                if(!tags||tags[0]!==need)return false;
                for(var i=0;i<path.length;i++){if(tags[i]!==path[i])return false}
                return true;
            }
            banks.forEach(function(b){
                var tags=App.BankTypes.tagsOfBank(b);
                if(!tags||tags[0]!==need)return;
                // R1-10：弹层固定「题型 → 科目」两级；没有科目标签的题库归入「未分类」科目文件夹
                if(tags.length<2)tags=[tags[0],'未分类'];
                tags=tags.slice(0,2);
                if(!under(tags))return;
                if(tags.length>path.length){folders[tags[path.length]]=(folders[tags[path.length]]||0)+1;return}
                items.push({kind:'bank',id:b.id,name:b.name});

            });
            var localIds={},localNames={};
            banks.forEach(function(b){localIds[b.id]=1;localNames[App.BankTypes.stripAllTags(b.name)]=1});
            fi.forEach(function(f){
                if(!f||!f.cloudOnly||!f.id||!/^QB_/.test(String(f.id)))return;
                if(localIds[f.id])return;
                var base=App.BankTypes.stripAllTags(f.name);
                if(localNames[base])return;
                var tags=App.BankTypes.tagsOfName(f.name);
                if(!tags.length)return;
                // R1-10：云端旧库同样归入科目层，无科目标签进「未分类」
                if(tags.length<2)tags=[tags[0],'未分类'];
                tags=tags.slice(0,2);
                if(!under(tags))return;
                if(tags.length>path.length){folders[tags[path.length]]=(folders[tags[path.length]]||0)+1;return}
                items.push({kind:'cloud',id:f.id,name:base});
            });
            items.sort(function(x,y){return String(x.name||'').localeCompare(String(y.name||''),'zh-Hans-CN',{numeric:true})});
            var ss=App.Storage.getSettings();
            var lastIds=(mode==='reading')?(ss._lastReadingBankIds||[]):((mode==='fill')?(ss._lastFillBankIds||[]):((mode==='pinyin')?(ss._lastPinyinBankIds||[]):(ss._lastBankIds||[])));
            var isPractice=(mode==='practice'||mode==='reading'||mode==='fill');
            var body='<div class="bank-folder-path"><span class="folder-crumb clickable" onclick="App.Questions.modalFolderTo(1)">'+App.BankTypes.info(need).name+'</span>';
            for(var i2=1;i2<path.length;i2++){
                body+='<span class="folder-sep">/</span><span class="folder-crumb clickable" onclick="App.Questions.modalFolderTo('+(i2+1)+')">'+path[i2]+'</span>';
            }
            body+='</div>';
            if(Object.keys(folders).length)body+='<div class="bank-modal-note" style="grid-column:1/-1">先点文件夹进入下一层；看到题库后点一下选中，再按「确定」</div>';
            body+='<div class="bank-modal-grid">';
            Object.keys(folders).sort().forEach(function(tag){
                body+='<div class="bank-modal-item folder-item" onclick="App.Questions.modalFolderEnter(\''+String(tag).replace(/'/g,'')+'\')"><span class="bank-modal-name">📁 '+tag+'</span><span class="bank-modal-count">'+folders[tag]+' 个</span><span class="bank-modal-arrow">▸</span></div>';
            });
            items.forEach(function(it){
                var sel=lastIds.indexOf(it.id)>=0?' selected':'';
                body+='<div class="bank-modal-item'+sel+'" data-bank-id="'+it.id+'" onclick="App.Questions.toggleModalBank(this,'+(isPractice?'true':'false')+')">';
                body+='<span class="bank-modal-check">'+(sel?'✓':'')+'</span>';
                body+='<span class="bank-modal-name">'+it.name+'</span>';
                body+='<span class="bank-modal-count">'+(it.kind==='cloud'?'☁ 未下载':'题库')+'</span>';
                if(App.Exam.participationType==='personal'&&it.kind==='bank')body+='<button type="button" class="bank-modal-stat" onclick="event.stopPropagation();App.Modal.close();App.Questions.bankUsage(\''+it.id+'\')">📊</button>';
                body+='</div>';
            });
            body+='</div>';
            if(!Object.keys(folders).length&&!items.length)body+='<p style="margin-top:8px;font-size:13px;color:var(--text-muted)">这个分类下还没有题库</p>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.confirmBankSelect()">确定</button>';
            App.Modal.open('📚 选择题库',body,footer);
        },
        toggleModalBank:function(el,single){if(single){document.querySelectorAll('.bank-modal-item.selected').forEach(function(item){if(item!==el){item.classList.remove('selected');item.querySelector('.bank-modal-check').textContent=''}})}el.classList.toggle('selected');el.querySelector('.bank-modal-check').textContent=el.classList.contains('selected')?'✓':'';App.Effects.playClick()},
        selectAllModalBanks:function(){var items=document.querySelectorAll('.bank-modal-item');var allSel=true;items.forEach(function(el){if(!el.classList.contains('selected'))allSel=false});items.forEach(function(el){if(allSel){el.classList.remove('selected');el.querySelector('.bank-modal-check').textContent=''}else{if(!el.classList.contains('selected')){el.classList.add('selected');el.querySelector('.bank-modal-check').textContent='✓'}}});App.Effects.playClick()},
        confirmBankSelect:function(){var ids=[];document.querySelectorAll('.bank-modal-item.selected').forEach(function(el){ids.push(el.dataset.bankId)});if(ids.length===0){App.Toast.show('请至少选择一个题库','warning');return}if((App.Exam.currentMode==='practice'||App.Exam.currentMode==='reading'||App.Exam.currentMode==='fill')&&ids.length>1){App.Toast.show('该模式只能选择1个题库','warning');return}var settings=App.Storage.getSettings();if(App.Exam.currentMode==='reading'){settings._lastReadingBankIds=ids}else if(App.Exam.currentMode==='pinyin'){settings._lastPinyinBankIds=ids}else if(App.Exam.currentMode==='fill'){settings._lastFillBankIds=ids}else{settings._lastBankIds=ids}App.Storage.setSettings(settings);App.Modal.close();this.renderBankSelect();if(App.Exam.currentMode==='reading'&&App.Exam.updateReadingPreview)App.Exam.updateReadingPreview();App.Effects.playClick()},
        // 云端题库类型：优先索引里的 bankType，其次文件名后缀
        cloudType:function(f){
            if(!f)return '';
            if(f.bankType&&App.BankTypes.TYPES[f.bankType])return f.bankType;
            return App.BankTypes.fromFileName(f.name)||'';
        },
        cloudBaseName:function(f){return App.BankTypes.stripSuffix(f&&f.name||'')},
        // 云端题库：先下载再打开编辑器
        editCloudBank:async function(id,name){
            var base=App.BankTypes.stripSuffix(name||'');
            var ok=await this.downloadCloudBank(id,base);
            if(!ok)return;
            App.Modal.close&&App.Modal.close();
            this.openBankManager(id);
        },
        getSelectedBankIds:function(){
            var lastIds=App.Storage.getSettings()._lastBankIds||[];
            var mode=App.Exam&&App.Exam.currentMode;
            if(mode&&App.BankTypes){
                var need=App.BankTypes.allowedForMode(mode);
                var banks=App.Storage.getBanks();
                var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                lastIds=lastIds.filter(function(id){
                    var b=banks.find(function(x){return x.id===id});
                    if(b)return App.BankTypes.of(b)===need;
                    // 仅云端、尚未下载的题库：按索引/文件名里的类型判断
                    var f=fi.find(function(x){return x.id===id});
                    if(!f)return false;
                    var ty=App.Questions.cloudType(f);
                    if(ty)return ty===need;
                    return need==='single';
                });
            }
            return lastIds;
        },
        // ===== 拼音题库（type:'pinyin'）=====
        openBankSelect:function(){
            if(App.Exam&&App.Exam.currentMode==='pinyin'){this.showPinyinBankSelectModal();return}
            this.showBankSelectModal();
        },
        renderPinyinBankInfo:function(){
            var info=document.getElementById('exam-bank-info');if(!info)return;
            info.textContent=App.Pinyin.poolLabel();
            var bar=document.getElementById('exam-bank-bar');
            var lab=bar?bar.querySelector('.bank-bar-label'):null;
            if(lab)lab.textContent='拼 字库';
        },
        renderReadingBankInfo:function(){
            var info=document.getElementById('exam-bank-info');if(!info)return;
            var bar=document.getElementById('exam-bank-bar');var lab=bar?bar.querySelector('.bank-bar-label'):null;
            if(lab)lab.textContent='📖 阅读题库';
            var b=App.Exam._readingBank?App.Exam._readingBank():null;
            if(!b){info.textContent='点击选择课外阅读题库';return}
            var n=(b.questions||[]).length,chars=String(b.article||'').replace(/\s/g,'').length;
            info.textContent=b.name+'（'+n+' 题 / 文章 '+chars+' 字）';
        },
        renderFillBankInfo:function(){
            var info=document.getElementById('exam-bank-info');if(!info)return;
            var bar=document.getElementById('exam-bank-bar');var lab=bar?bar.querySelector('.bank-bar-label'):null;
            if(lab)lab.textContent='✍️ 填空题库';
            var banks=App.Storage.getBanks(),ids=App.Storage.getSettings()._lastFillBankIds||[];
            var b=null;ids.forEach(function(id){var x=banks.find(function(y){return y.id===id&&App.BankTypes.of(y)==='fill'});if(x)b=x});
            if(!b){info.textContent='点击选择填空题题库';return}
            var n=(b.questions||[]).length;
            info.textContent=b.name+'（'+n+' 题·手写作答）';
        },
        fillBankCardHTML:function(b){
            var n=(b.questions||[]).length;
            return '<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-line"><span class="bcl-name">'+b.name+'</span><span class="bcl-count">'+n+' 题</span></div><div class="bc-header"><div><div class="bc-name">'+b.name+'<span style="margin-left:6px;font-size:11px;color:#8a5a00;background:#fff7e0;border:1px solid #f0d090;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">'+App.Questions.tagText(b)+'</span><span class="bank-badge local">📥 本地</span></div><div class="bc-count">（'+n+' 题 · 手写作答）</div></div></div><div class="bc-desc">'+(b.description||'填空题库')+'</div><div class="bc-actions teacher-dim"><button onclick="App.Questions.openFillBankManager(\''+b.id+'\')">📋 查看题目</button><button onclick="App.Questions.showAddFillBankDialog(\''+b.id+'\')">➕ 追加题目</button><button class="btn-del" onclick="App.Questions.removeBank(\''+b.id+'\')">🗑️ 删除</button></div></div>';
        },
        openFillBankManager:function(id){
            var b=App.Storage.getBanks().find(function(x){return x.id===id});if(!b)return;
            var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
            var body='<div class="question-preview-list">';
            (b.questions||[]).forEach(function(q,i){
                body+='<div class="qp-item"><div class="qp-text">'+(i+1)+'. '+esc(q.text)+'</div><div class="qp-answer">答案：'+esc((q.answers||[]).join(' / '))+'</div></div>';
            });
            body+='</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-primary" onclick="App.Modal.close();App.Questions.showAddFillBankDialog(\''+id+'\')">➕ 追加题目</button>';
            App.Modal.open('✍️ '+b.name+'（'+(b.questions||[]).length+' 题）',body,footer);
        },
        showAddFillBankDialog:function(bankId){
            var b=App.Storage.getBanks().find(function(x){return x.id===bankId});if(!b)return;
            var body='<div class="import-format-hint">'+App.BankTypes.templateHelp('fill')+'</div><div class="form-group"><label>题目数据</label><textarea id="inp-fill-data" rows="8" placeholder="春天来了，小草____了。|绿"></textarea></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doAddFillBank(\''+bankId+'\')">保存</button>';
            App.Modal.open('✍️ 追加填空题 · '+b.name,body,footer);
        },
        doAddFillBank:function(bankId){
            var text=document.getElementById('inp-fill-data').value;
            var r=App.BankTypes.parse('fill',text);
            if(!r.questions.length){App.Toast.show('没有有效题目'+(r.errors.length?('：'+r.errors[0]):''),'warning');return}
            r.questions.forEach(function(q){q.id=App.genId()});
            var banks=App.Storage.getBanks();
            var b=banks.find(function(x){return x.id===bankId});if(!b)return;
            b.questions=(b.questions||[]).concat(r.questions);
            App.Storage.setBanks(banks);App.Modal.close();this.render();this.openFillBankManager(bankId);
            App.Toast.show('已追加 '+r.questions.length+' 题'+(r.errors.length?('，跳过 '+r.errors.length+' 处'):''),'success');
        },
        // 个人模式题库详情：学生完成情况 / 使用痕迹
        bankUsage:function(bankId){
            var bank=App.Storage.getBanks().find(function(b){return b.id===bankId});
            if(!bank){App.Toast.show('找不到该题库','warning');return}
            var modes={farm:'🌾 打野',challenge:'🎯 挑战',pk:'⚔️ PK',practice:'📝 选择练习',smart:'🧠 智能抽查',pinyin:'拼 拼音练习',reading:'📖 阅读选择',fill:'✍️ 填空练习',lottery:'🎲 抽签'};
            var map={},sessions=[];
            App.Storage.getRecords().forEach(function(r){
                // 优先按稳定的题库ID关联（题库改名也不断链），老记录没有 bankIds 才退回按名字
                var hit=(r.bankIds&&r.bankIds.length)?(r.bankIds.indexOf(bankId)>=0):((r.bankNames||[]).indexOf(bank.name)>=0);
                if(!hit)return;
                var parts=[];
                Object.keys(r.studentResults||{}).forEach(function(sid){
                    var sr=r.studentResults[sid];
                    if(!sr||!sr.totalCount)return;
                    var o=map[sid];
                    if(!o){o=map[sid]={id:sid,name:sr.name||'',sessions:0,correct:0,total:0,points:0,last:0,rows:[]}}
                    o.sessions++;o.correct+=(sr.correctCount||0);o.total+=(sr.totalCount||0);o.points+=(sr.pointsEarned||0);
                    if(r.date>o.last)o.last=r.date;
                    o.rows.push({date:r.date,mode:r.mode,correct:sr.correctCount||0,total:sr.totalCount||0,points:sr.pointsEarned||0});
                    parts.push({name:sr.name||'',correct:sr.correctCount||0,total:sr.totalCount||0,points:sr.pointsEarned||0});
                });
                if(parts.length)sessions.push({id:r.id,date:r.date,mode:r.mode,parts:parts});
            });
            var me=App.Role&&App.Role.isStudent?App.Role.student():null;
            var ids=Object.keys(map);
            if(me)ids=ids.filter(function(id){return id===me.id});
            ids.sort(function(a,b){return (map[b].points||0)-(map[a].points||0)});
            var sum={sessions:0,correct:0,total:0,points:0};
            ids.forEach(function(id){var o=map[id];sum.sessions+=o.sessions;sum.correct+=o.correct;sum.total+=o.total;sum.points+=o.points});
            var pct=sum.total?Math.round(sum.correct/sum.total*100):0;
            var qn=(bank.questions||[]).length;
            var html='<div class="bank-usage-summary"><span>类型 <b>'+App.BankTypes.info(App.BankTypes.of(bank)).name+'</b></span><span>题库 <b>'+qn+' 题</b></span><span>场次 <b>'+sum.sessions+'</b></span><span>参与 <b>'+ids.length+' 人</b></span><span>正确率 <b>'+pct+'%</b></span><span>积分 <b>'+sum.points+'⭐</b></span></div>';
            if(!ids.length){
                html+='<p style="color:var(--text-muted);padding:12px 0">'+(me?'你还没有做过这个题库。':'还没有学生使用过这个题库。')+'</p>';
            }else{
                ids.forEach(function(id){
                    var o=map[id];var p=o.total?Math.round(o.correct/o.total*100):0;
                    html+='<div class="bank-usage-row">';
                    html+='<div class="bur-head" onclick="App.Questions._toggleUsageRow(this)"><b>'+o.name+'</b><span>'+o.sessions+' 场 · 答对 '+o.correct+'/'+o.total+'（'+p+'%）· '+o.points+'⭐</span><span class="bur-arrow">▾</span></div>';
                    html+='<div class="bur-body">';
                    o.rows.sort(function(a,b){return b.date-a.date}).forEach(function(x){
                        html+='<div class="bur-session"><span>'+new Date(x.date).toLocaleString('zh-CN')+'</span><span>'+(modes[x.mode]||x.mode)+'</span><span>'+x.correct+'/'+x.total+'</span><span>+'+x.points+'⭐</span></div>';
                    });
                    html+='</div></div>';
                });
            }
            // 按场次看：这一场是谁参加的、各得多少分（学生模式只显示自己）
            var visSess=sessions.map(function(s){
                var ps=(s.parts||[]).filter(function(p){return !me||p.name===me.name});
                return ps.length?{date:s.date,mode:s.mode,parts:ps}:null;
            }).filter(function(x){return !!x}).sort(function(a,b){return b.date-a.date});
            if(visSess.length){
                html+='<div class="bank-usage-sessions"><h4 style="margin:14px 0 6px;font-size:13px">按场次（谁参加）</h4>';
                visSess.forEach(function(s){
                    var txt=s.parts.map(function(p){return p.name+' '+p.correct+'/'+p.total+'（+'+p.points+'⭐）'}).join('；');
                    html+='<div class="bur-session"><span>'+new Date(s.date).toLocaleString('zh-CN')+'</span><span>'+(modes[s.mode]||s.mode)+'</span><span style="flex:1;text-align:left">'+txt+'</span></div>';
                });
                html+='</div>';
            }
            var title=me?('📊 '+bank.name+' · 我的完成情况'):('📊 '+bank.name+' · 学生完成情况');
            App.Modal.open(title,html,'<button class="btn-secondary" onclick="App.Modal.close()">关闭</button>');
        },
        // ===== 标签文件夹（标签顺序=层级） =====
        _folderPath:[],
        folderLabel:function(tag){var info=App.BankTypes.TYPES[tag];return info?(info.icon+' '+info.name):tag},
        folderEnter:function(tag){App.Questions._folderPath=(App.Questions._folderPath||[]).concat([tag]);App.Questions.render()},
        folderTo:function(n){App.Questions._folderPath=(App.Questions._folderPath||[]).slice(0,n);App.Questions.render()},
        _folderCounts:function(){
            var path=App.Questions._folderPath||[];
            var banks=App.Storage.getBanks()||[];
            var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
            var counts={};
            function bump(tags){
                for(var i=0;i<path.length;i++){if(tags[i]!==path[i])return}
                var next=tags[path.length];if(!next)return;
                counts[next]=(counts[next]||0)+1;
            }
            banks.forEach(function(b){bump(App.BankTypes.tagsOfBank(b))});
            fi.forEach(function(f){
                if(f&&f.cloudOnly&&f.id&&/^QB_/.test(String(f.id))&&f.name){
                    var t=App.BankTypes.tagsOfName(f.name);bump(t.length?t:['single']);
                }
            });
            return counts;
        },
        folderCardsHTML:function(){
            var counts=this._folderCounts();
            var compact=(function(){try{return localStorage.getItem('exam_bank_compact')==='1'}catch(e){return false}})();
            var html='';
            Object.keys(counts).sort().forEach(function(tag){
                var label=App.Questions.folderLabel(tag),n=counts[tag];
                if(compact){
                    html+='<div class="bank-card folder-card compact" onclick="App.Questions.folderEnter(\''+String(tag).replace(/'/g,'')+'\')"><div class="bc-line"><span class="bcl-name">📁 '+label+'</span><span class="bcl-count">'+n+' 个题库</span><span class="bcl-arrow">▸</span></div></div>';
                }else{
                    html+='<div class="bank-card folder-card" onclick="App.Questions.folderEnter(\''+String(tag).replace(/'/g,'')+'\')"><div class="bc-line"><span class="bcl-name">📁 '+label+'</span><span class="bcl-count">'+n+' 个题库</span><span class="bcl-arrow">▸</span></div><div class="bc-header"><div><div class="bc-name">📁 '+label+'<span class="bank-badge folder">文件夹</span></div><div class="bc-count">（'+n+' 个题库）</div></div></div><div class="bc-desc">点开进入下一层</div></div>';
                }
            });
            return html;
        },
        renderFolderBar:function(){
            var bar=document.getElementById('bank-folder-bar');if(!bar)return;
            var path=App.Questions._folderPath||[];
            var html='<div class="bank-folder-path"><span class="folder-crumb'+(path.length?' clickable':'')+'" onclick="App.Questions.folderTo(0)">全部题库</span>';
            path.forEach(function(t,i){html+='<span class="folder-sep">/</span><span class="folder-crumb clickable" onclick="App.Questions.folderTo('+(i+1)+')">'+App.Questions.folderLabel(t)+'</span>'});
            html+='</div>';
            bar.innerHTML=html;
        },
        // R1-06：复制题库——生成独立副本（题库名带「副本」，题目全新 id，与原库互不影响）
        copyBank:function(bankId){
            var banks=App.Storage.getBanks();
            var src=banks.find(function(x){return x.id===bankId||x.name===bankId});
            if(!src){App.Toast.show('找不到该题库','error');return}
            var copy=JSON.parse(JSON.stringify(src));
            copy.id='QB_'+Date.now().toString(36).toUpperCase()+Math.floor(Math.random()*1000);
            copy.name=(src.name||'题库')+' 副本';
            copy.createdAt=Date.now();copy._demo=false;
            (copy.questions||[]).forEach(function(q){q.id=App.genId?App.genId():('q'+Date.now().toString(36)+Math.floor(Math.random()*10000))});
            if(copy.article!==undefined)copy.article=copy.article||'';
            banks.push(copy);
            App.Storage.setBanks(banks);
            this.render();
            App.Toast.show('已复制为「'+copy.name+'」（共 '+((copy.questions||[]).length)+' 题）','success');
        },
        tagText:function(b){var a=App.BankTypes.tagsOfBank(b);return a.map(function(t,i){return i===0?App.BankTypes.info(t).name:t}).join(' / ')},
        autoTagNow:function(){
            App.Storage.fixBankIndexTypes();
            this.render();
            App.Toast.show('已为缺标签的题库补上题型与科目','success');
        },
        _toggleUsageRow:function(el){
            var row=el&&el.closest?el.closest('.bank-usage-row'):null;
            if(!row)return;
            var open=row.classList.contains('open');
            document.querySelectorAll('.bank-usage-row.open').forEach(function(r){r.classList.remove('open')});
            if(!open)row.classList.add('open');
        },
        showPinyinBankSelectModal:function(){
            var banks=(App.Storage.getBanks()||[]).filter(function(b){return App.BankTypes.of(b)==='pinyin'});
            var _fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
            var _lIds=new Set(banks.map(function(b){return b.id}));
            var _lNames=new Set(banks.map(function(b){return b.name}));
            var cloudPinyin=_fi.filter(function(f){return f.cloudOnly&&f.id&&/^QB_/.test(String(f.id))&&!_lIds.has(f.id)&&!_lNames.has(App.BankTypes.stripSuffix(f.name))&&App.Questions.cloudType(f)==='pinyin'});
            var sel=App.Storage.getSettings()._lastPinyinBankIds||[];
            var body='<div class="bank-modal-grid">';
            var bs=sel.length?'':' selected';
            body+='<div class="bank-modal-item'+bs+'" data-bank-id="" onclick="App.Questions.toggleModalBank(this,true)"><span class="bank-modal-check">'+(bs?'✓':'')+'</span><span class="bank-modal-name">内置拼音字库</span><span class="bank-modal-count">'+App.Pinyin.BUILTIN.length+' 字</span></div>';
            banks.forEach(function(b){
                var s=sel.indexOf(b.id)>=0?' selected':'';
                body+='<div class="bank-modal-item'+s+'" data-bank-id="'+b.id+'" onclick="App.Questions.toggleModalBank(this,true)"><span class="bank-modal-check">'+(s?'✓':'')+'</span><span class="bank-modal-name">'+b.name+'</span><span class="bank-modal-count">'+(b.questions?b.questions.length:0)+' 字</span><button type="button" class="bank-modal-stat" onclick="event.stopPropagation();App.Modal.close();App.Questions.bankUsage(\''+b.id+'\')">📊</button></div>';
            });
            cloudPinyin.forEach(function(f){
                var _cn=App.BankTypes.stripSuffix(f.name);
                var s=sel.indexOf(f.id)>=0?' selected':'';
                body+='<div class="bank-modal-item'+s+'" data-bank-id="'+f.id+'" onclick="App.Questions.toggleModalBank(this,true)"><span class="bank-modal-check">'+(s?'✓':'')+'</span><span class="bank-modal-name">'+_cn+'</span><span class="bank-modal-count">☁ 未下载</span></div>';
            });
            body+='</div>';
            if(!banks.length&&!cloudPinyin.length)body+='<p style="margin-top:8px;font-size:13px;color:var(--text-muted)">还没有自建拼音题库，可到「题库 → 拼 拼音题库」新建。</p>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.confirmPinyinBankSelect()">确定</button>';
            App.Modal.open('拼 选择拼音字库（仅限1个）',body,footer);
        },
        confirmPinyinBankSelect:function(){
            var el=document.querySelector('.bank-modal-item.selected');
            var id=el?el.dataset.bankId:'';
            var s=App.Storage.getSettings();
            s._lastPinyinBankIds=id?[id]:[];
            App.Storage.setSettings(s);
            App.Modal.close();
            this.renderPinyinBankInfo();
            App.Effects.playClick();
        },
        showAddPinyinBankDialog:function(bankId){
            var banks=App.Storage.getBanks();
            var b=bankId?banks.find(function(x){return x.id===bankId}):null;
            var body='<div class="import-format-hint">每行一个：<code>题面|目标字|拼音</code><br>例：<br><code>春天来了|春|chūn</code><br><code>月亮挂在天上|月|yuè</code><br>要求：目标字必须出现在题面里；拼音必须带声调（ā á ǎ à）。</div>';
            body+='<div class="form-group"><label>题库名称</label><input type="text" id="inp-pinyin-bank-name" value="'+(b?String(b.name).replace(/"/g,'&quot;'):'我的拼音题库')+'"></div>';
            body+='<div class="form-group"><label>字词数据</label><textarea id="inp-pinyin-bank-data" rows="8" placeholder="春天来了|春|chūn"></textarea></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doAddPinyinBank(\''+(bankId||'')+'\')">保存</button>';
            App.Modal.open(b?'拼 追加拼音字词':'拼 新建拼音题库',body,footer);
        },
        doAddPinyinBank:function(bankId){
            if(!App.Pinyin){App.Modules.load('pinyin',function(){App.Questions.doAddPinyinBank(bankId)});return}
            var name=document.getElementById('inp-pinyin-bank-name').value.trim();
            var raw=document.getElementById('inp-pinyin-bank-data').value;
            if(!name){App.Toast.show('请输入题库名称','warning');return}
            if(!raw||!raw.trim()){App.Toast.show('请输入字词数据','warning');return}
            var lines=raw.split('\n'),qs=[],bad=[];
            for(var i=0;i<lines.length;i++){
                var line=lines[i].trim();if(!line)continue;
                var p=line.split('|');
                if(p.length<3){bad.push(i+1);continue}
                var text=p[0].trim(),ch=p[1].trim(),py=p[2].trim();
                if(!text||!ch||!py||text.indexOf(ch)<0){bad.push(i+1);continue}
                var parsed;
                try{parsed=App.Pinyin.parsePinyin(py)}catch(e){bad.push(i+1);continue}
                if(!parsed||!parsed.tone||(!parsed.isWhole&&App.Pinyin.baseFinals.indexOf(parsed.final)<0)){bad.push(i+1);continue}
                qs.push({id:App.genId(),text:text,char:ch,pinyin:py,points:10});
            }
            if(!qs.length){App.Toast.show('没有识别到有效数据，请检查格式','warning');return}
            var banks=App.Storage.getBanks(),bank=null;
            if(bankId){bank=banks.find(function(x){return x.id===bankId})}
            if(bank&&App.BankTypes.of(bank)==='pinyin'){
                bank.name=name;bank.questions=(bank.questions||[]).concat(qs);
            }else{
                bank={id:App.genBankId(),name:name,description:'拼音题库',type:'pinyin',questions:qs,createdAt:Date.now(),_newFile:true};
                banks.push(bank);
            }
            App.Storage.setBanks(banks);
            App.Modal.close();this.render();
            App.Toast.show('拼音题库已保存：新增 '+qs.length+' 字'+(bad.length?('，跳过 '+bad.length+' 行（第 '+bad.join('、')+' 行）'):''),'success');
        },
        openPinyinBankManager:function(id){
            var banks=App.Storage.getBanks();
            var b=banks.find(function(x){return x.id===id});
            if(!b)return;
            var qs=b.questions||[];
            var body='<div class="question-preview-list">';
            if(!qs.length)body+='<p style="color:var(--text-muted)">这个拼音题库还没有字词。</p>';
            qs.forEach(function(q,i){
                body+='<div class="qp-item"><div class="qp-text">'+(i+1)+'. '+App.Pinyin._esc(q.text)+'</div><div class="qp-answer">考察字：<b>'+App.Pinyin._esc(q.char)+'</b> | 拼音：'+App.Pinyin._esc(q.pinyin)+'</div><div class="qp-actions"><button class="btn-sm btn-del" onclick="App.Questions.deletePinyinQuestion(\''+id+'\',\''+q.id+'\')">🗑️ 删除</button></div></div>';
            });
            body+='</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-primary" onclick="App.Modal.close();App.Questions.showAddPinyinBankDialog(\''+id+'\')">➕ 追加字词</button>';
            App.Modal.open('拼 '+b.name+'（'+qs.length+' 字）',body,footer);
        },
        deletePinyinQuestion:function(bankId,qid){
            if(!confirm('确定删除这个字吗？'))return;
            var banks=App.Storage.getBanks();
            var b=banks.find(function(x){return x.id===bankId});
            if(!b)return;
            b.questions=(b.questions||[]).filter(function(q){return q.id!==qid});
            App.Storage.setBanks(banks);
            this.openPinyinBankManager(bankId);
            App.Toast.show('已删除','info');
        },
        pinyinBankCardHTML:function(b){
            var n=(b.questions||[]).length;
            return '<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-line"><span class="bcl-name">'+b.name+'</span><span class="bcl-count">'+n+' 字</span></div><div class="bc-header"><div><div class="bc-name">'+b.name+'<span style="margin-left:6px;font-size:11px;color:#7a3ec8;background:#f3ecff;border:1px solid #d5c2f5;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">'+App.Questions.tagText(b)+'</span><span class="bank-badge local">📥 本地</span></div><div class="bc-count">（'+n+' 个考察字）</div></div></div><div class="bc-desc">'+(b.description||'拼音题库')+'</div><div class="bc-actions teacher-dim"><button onclick="App.Questions.openPinyinBankManager(\''+b.id+'\')">📋 查看字表</button><button onclick="App.Questions.showAddPinyinBankDialog(\''+b.id+'\')">➕ 追加字词</button><button class="btn-del" onclick="App.Questions.removeBank(\''+b.id+'\')">🗑️ 删除</button></div></div>';
        },
        toggleBankSelect:function(el){el.classList.toggle('selected');el.querySelector('.check-mark').textContent=el.classList.contains('selected')?'✓':'';App.Effects.playClick()},
        chooseBankType:function(action){
            var html='<p style="margin-bottom:10px;font-size:13px;color:var(--text-secondary)">请选择题库类型：</p><div style="display:flex;flex-direction:column;gap:10px">';
            App.BankTypes.ALL.forEach(function(t){var x=App.BankTypes.info(t);html+='<button class="btn-secondary" style="text-align:left;padding:12px 14px;line-height:1.5" onclick="App.Modal.close();App.Questions._bankTypeChosen(\''+action+'\',\''+t+'\')"><b>'+x.icon+' '+x.name+'</b><br><span style="font-size:12px;color:var(--text-muted)">'+x.desc+'</span></button>'});
            html+='</div>';
            App.Modal.open('选择题库类型',html,'<button class="btn-secondary" onclick="App.Modal.close()">取消</button>');
        },
        _bankTypeChosen:function(action,type){
            if(action==='add')this.showAddBankDialog(type);
            else if(action==='import')this.showImportBankDialog(type);
            else if(action==='export')this.exportTemplate(type);
            else if(action==='copy')this.copyTemplateForAI(type);
        },
        showAddBankDialog:function(type){
            type=type||'single';var ti=App.BankTypes.info(type);
            var body='<div class="form-group"><label>题库类型</label><div style="font-weight:700">'+ti.icon+' '+ti.name+'</div><div class="form-hint">'+ti.desc+'</div></div>';
            body+='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" placeholder="请输入题库名称"></div>';
            body+='<div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" placeholder="简要描述（可选）"></div>';body+='<div class="form-group"><label>标签（可选）</label><input type="text" id="inp-bank-tags" placeholder="如：语文, 五年级"><div class="form-hint">第一个标签固定是题型；后面按顺序作为文件夹层级，用逗号分隔</div></div>';
            if(type==='reading')body+='<div class="form-group"><label>阅读文章</label><textarea id="inp-bank-article" rows="8" placeholder="把要阅读的文章粘贴到这里"></textarea></div>';
            if(type!=='single')body+='<div class="import-format-hint">'+App.BankTypes.templateHelp(type)+'</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.addBank(\''+type+'\')">创建</button>';
            App.Modal.open('新建'+ti.name,body,footer);
        },
        addBank:function(type){
            type=type||'single';
            var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}
            var desc=document.getElementById('inp-bank-desc').value.trim();
            var _tagRaw=((document.getElementById('inp-bank-tags')||{}).value)||'';
            var _tags=[type].concat(String(_tagRaw).split(/[,，/]/).map(function(x){return App.BankTypes.cleanTag(x)}).filter(function(x){return !!x}));
            var banks=App.Storage.getBanks();
            // R1-22：同名题库（忽略类型/科目标签）直接拦截，避免建出一堆同名库
            var _baseName=App.BankTypes.stripAllTags(name);
            var _dup=banks.filter(function(b){return App.BankTypes.stripAllTags(b.name)===_baseName})[0];
            if(_dup){App.Toast.show('已存在同名题库「'+_baseName+'」，请换一个名字','error');return}
            var bank={id:App.genBankId(),name:name,description:desc,type:type,tags:_tags,questions:[],createdAt:Date.now(),_newFile:true};
            if(type==='reading'){var ta=document.getElementById('inp-bank-article');bank.article=ta?ta.value.trim():''}
            banks.push(bank);App.Storage.setBanks(banks);App.Modal.close();this.render();
            App.Toast.show(App.BankTypes.info(type).name+'「'+name+'」创建成功','success');
        },
        readingBankCardHTML:function(b){
            var n=(b.questions||[]).length,chars=String(b.article||'').replace(/\s/g,'').length;
            return '<div class="bank-card" style="animation:slide-up 0.3s ease both"><div class="bc-line"><span class="bcl-name">'+b.name+'</span><span class="bcl-count">'+n+' 题</span></div><div class="bc-header"><div><div class="bc-name">'+b.name+'<span style="margin-left:6px;font-size:11px;color:#1d6fb8;background:#eef7ff;border:1px solid #b9dcf5;border-radius:8px;padding:1px 6px;font-weight:400;white-space:nowrap">'+App.Questions.tagText(b)+'</span><span class="bank-badge local">📥 本地</span></div><div class="bc-count">（'+n+' 题 / 文章 '+chars+' 字）</div></div></div><div class="bc-desc">'+(b.description||'课外阅读题库')+'</div><div class="bc-actions teacher-dim"><button onclick="App.Questions.openReadingBankManager(\''+b.id+'\')">📖 文章与题目</button><button onclick="App.Questions.editReadingArticleDialog(\''+b.id+'\')">✏️ 编辑文章</button><button class="btn-del" onclick="App.Questions.removeBank(\''+b.id+'\')">🗑️ 删除</button></div></div>';
        },
        openReadingBankManager:function(id){
            var b=App.Storage.getBanks().find(function(x){return x.id===id});if(!b)return;
            var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
            var body='<div class="form-group"><label>文章标题</label><div style="font-weight:700">'+esc(b.title||b.name)+'</div></div>';
            body+='<div class="form-group"><label>阅读文章（约 '+String(b.article||'').replace(/\s/g,'').length+' 字）</label><div style="max-height:180px;overflow:auto;white-space:pre-wrap;line-height:1.7;background:var(--bg-hover);padding:10px;border-radius:8px">'+esc(b.article||'（还没有文章）')+'</div></div>';
            body+='<div class="question-preview-list">';
            (b.questions||[]).forEach(function(q,i){body+='<div class="qp-item"><div class="qp-text">'+(i+1)+'. '+esc(q.text)+'</div><div class="qp-answer">A.'+esc(q.options.A)+' B.'+esc(q.options.B)+' C.'+esc(q.options.C)+' D.'+esc(q.options.D)+' | 答案 '+q.answer+'</div></div>'});
            body+='</div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-primary" onclick="App.Modal.close();App.Questions.editReadingArticleDialog(\''+id+'\')">✏️ 编辑文章</button><button class="btn-primary" onclick="App.Modal.close();App.Questions.showAddQuestionDialog(\''+id+'\')">➕ 添加题目</button>';
            App.Modal.open('📖 '+b.name,body,footer);
        },
        editReadingArticleDialog:function(id){
            var b=App.Storage.getBanks().find(function(x){return x.id===id});if(!b)return;
            var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
            var body='<div class="form-group"><label>文章标题</label><input type="text" id="inp-reading-title" value="'+String(b.title||b.name||'').replace(/"/g,'&quot;')+'"></div>';
            body+='<div class="form-group"><label>阅读文章</label><textarea id="inp-reading-article" rows="12" style="line-height:1.7">'+esc(b.article||'')+'</textarea><div class="form-hint">阅读时长 = 文章字数 × 每字秒数（开始比赛前可调）</div></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.saveReadingArticle(\''+id+'\')">保存</button>';
            App.Modal.open('✏️ 编辑阅读文章',body,footer);
        },
        saveReadingArticle:function(id){
            var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;
            b.title=document.getElementById('inp-reading-title').value.trim();
            b.article=document.getElementById('inp-reading-article').value;
            App.Storage.setBanks(banks);App.Modal.close();this.render();
            if(App.Exam&&App.Exam.currentMode==='reading'&&App.Exam.updateReadingPreview)App.Exam.updateReadingPreview();
            App.Toast.show('文章已保存','success');
        },
        showEditBankDialog:function(id){var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;var _bt=App.BankTypes.tagsOfBank(b);var _tv=_bt.slice(1).join(', ');var body='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" value="'+b.name+'"></div><div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" value="'+(b.description||'')+'"></div>' +'<div class="form-group"><label>标签（可选）</label><input type="text" id="inp-bank-tags" value="'+String(_tv).replace(/"/g,'&quot;')+'"><div class="form-hint">第一个标签固定是题型；后面按顺序作为文件夹层级</div></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.updateBank(\''+id+'\')">保存</button>';App.Modal.open('编辑题库',body,footer)},
        updateBank:function(id){var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}var desc=document.getElementById('inp-bank-desc').value.trim();var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;var _tr=((document.getElementById('inp-bank-tags')||{}).value)||'';var _tg=[App.BankTypes.of(b)].concat(String(_tr).split(/[,，/]/).map(function(x){return App.BankTypes.cleanTag(x)}).filter(function(x){return !!x}));b.name=name;b.description=desc;b.tags=_tg;App.Storage.setBanks(banks);(function(){try{var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');var fe=fi.find(function(x){return x.id===id});if(fe){fe.name=App.BankTypes.fileWithTags(name,_tg);fe.bankTags=_tg;fe.isNewFile=true;localStorage.setItem('exam_file_index',JSON.stringify(fi))}}catch(e){}})();App.Modal.close();this.render();App.Toast.show('题库信息已更新（改名将在下次同步写入云端）','success')},
        removeBank:function(id){
            var banks=App.Storage.getBanks();
            var bank=banks.find(function(x){return x.id===id});
            // 测试题库只存在本地：只删本地存储，不发云端删除消息
            if(bank&&bank._demo){
                if(!confirm('确定要删除本地测试题库吗？（仅本地删除，云端无此条）'))return;
                App.Storage.set('banks',banks.filter(function(x){return x.id!==id}));
                // 本次渲染不自动补回，刷新页面后才重新出现
                App.Storage._skipDemoRefill=true;
                this.render();
                App.Storage._skipDemoRefill=false;
                App.Toast.show('已移除本地测试题库（云端无此条）','info');
                return;
            }
            if(!confirm('确定要删除该题库及其所有题目吗？（同时删除云端行，云端删除失败则题库保留）'))return;
            // 只在本机、云端没有对应行的题库（本机新建/测试库）：只删本地，不发云端删除，避免“云端找不到”
            var _fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
            var _fe=_fi.find(function(x){return x.id===id});
            var _cloudBacked=!!(_fe&&/^QB_/.test(String(id))&&!_fe.isNewFile);
            if(!_cloudBacked){
                App.Storage.set('banks',banks.filter(function(x){return x.id!==id}));
                try{
                    var _fi2=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
                    _fi2=_fi2.filter(function(x){return x.id!==id});
                    localStorage.setItem('exam_file_index',JSON.stringify(_fi2));
                }catch(e){}
                this.render();
                App.Toast.show('已删除本地题库「'+(bank?bank.name:id)+'」（云端无此条）','info');
                return;
            }
            if(App._bankDeleting){App.Toast.show('正在删除云端题库，请稍候…','warning');return}
            var name=bank?bank.name:(function(){var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');var f=fi.find(function(x){return x.id===id});return f&&f.name?f.name:id})();
            App._bankDeleting=id;
            App.Toast.show('正在删除云端题库「'+name+'」…','info');
            // 回执超时兜底：未收到 bankDeleted/bankDeleteFailed 就按失败处理，绝不先隐藏
            if(App._bankDeleteTimer)clearTimeout(App._bankDeleteTimer);
            App._bankDeleteTimer=setTimeout(function(){
                if(App._bankDeleting!==id)return;
                App._bankDeleting=null;
                App._bankDeleteTimer=null;
                App.Toast.show('删除超时：未收到云端删除回执，题库已保留，请检查网络后重试','error');
                if(App.Questions)App.Questions.render();
            },90000);
            App.Sync.deleteBank(id);
        },
        downloadCloudBank:async function(id,name){
            name=App.BankTypes.stripSuffix(name||'');
            App.Toast.show('正在从云端下载题库...','info');
            if(App.Sync&&(App.Sync.ready||App.Sync._anyFrameReady)){
                // R1-08：单次最多等 15 秒，没落地就重发一次（首帧消息丢失是常见原因），总计 30 秒
                for(var _try=0;_try<2;_try++){
                    if(_try>0)App.Toast.show('第 2 次尝试下载题库…','info');
                    App.Sync.postToFileManager({type:'downloadCloudFile',fileId:id});
                    var waitStart=Date.now();
                    while(Date.now()-waitStart<15000){
                        await new Promise(function(r){setTimeout(r,500)});
                        var freshBanks=App.Storage.getBanks();
                        var freshBank=freshBanks.find(function(x){return x.id===id});
                        if(freshBank&&freshBank.questions&&freshBank.questions.length>0){
                            App.Storage.fixBankIndexTypes();
                            App.Questions.render();
                            App.Toast.show('题库「'+name+'」下载完成','success');
                            return true;
                        }
                    }
                }
                App.Toast.show('题库「'+name+'」下载失败：30 秒内未落地，请检查网络后重试','error');
                try{localStorage.setItem('exam_sync_last_error',JSON.stringify({at:Date.now(),type:'bank_download_timeout',msg:'题库下载超时：'+id}))}catch(e){}
            }else{
                App.Toast.show('同步功能未就绪（文件管理器尚未握手），请稍后重试','warning');
            }
            return false;
        },
        removeCloudBankIndex:function(id){
            if(!confirm('确定要移除该云端题库索引吗？（云端数据不会删除）'))return;
            var prefix='exam';
            var fileIndex=JSON.parse(localStorage.getItem(prefix+'_file_index')||'[]');
            fileIndex=fileIndex.filter(function(f){return f.id!==id});
            try{localStorage.setItem(prefix+'_file_index',JSON.stringify(fileIndex))}catch(e){}
            this.render();
            App.Toast.show('已移除云端题库索引','info');
        },
        openBankManager:async function(id){
            var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;
            if(App.BankTypes.of(b)==='pinyin'){this.openPinyinBankManager(id);return}
            if(App.BankTypes.of(b)==='reading'){this.openReadingBankManager(id);return}
            if(App.BankTypes.of(b)==='fill'){this.openFillBankManager(id);return}
            // 题库内容为空（仅有索引），按需从云端下载
            if((!b.questions||b.questions.length===0)&&App.Sync&&App.Sync.ready){
                App.Toast.show('正在下载题库内容...','info');
                App.Sync.postToFileManager({type:'downloadCloudFile',fileId:b.id||b.name});
                var waitStart=Date.now();
                while(Date.now()-waitStart<10000){
                    await new Promise(function(r){setTimeout(r,500)});
                    var freshBanks=App.Storage.getBanks();
                    var freshBank=freshBanks.find(function(x){return x.id===id});
                    if(freshBank&&freshBank.questions&&freshBank.questions.length>0){b=freshBank;break}
                }
                if(!b.questions||b.questions.length===0){App.Toast.show('题库下载失败，请检查网络','warning');return}
            }
            var body='<div class="form-group"><label>题库名称</label><input type="text" id="inp-bank-name" value="'+b.name.replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>题库描述</label><input type="text" id="inp-bank-desc" value="'+(b.description||'').replace(/"/g,'&quot;')+'"></div><hr style="border-color:rgba(108,92,231,0.2);margin:12px 0"><div class="question-preview-list">';b.questions.forEach(function(q,i){body+='<div class="qp-item"><div class="qp-text">'+(i+1)+'. '+q.text+'</div><div class="qp-options">';['A','B','C','D'].forEach(function(l){if(q.options[l])body+='<span style="margin-right:12px">'+l+'. '+q.options[l]+'</span>'});body+='</div><div class="qp-answer">正确答案：'+q.answer+' | 分值：'+q.points+'分</div><div class="qp-actions"><button class="btn-sm" onclick="App.Questions.editQuestion(\''+id+'\',\''+q.id+'\')">✏️ 编辑</button><button class="btn-sm btn-del" onclick="App.Questions.deleteQuestion(\''+id+'\',\''+q.id+'\')">🗑️ 删除</button></div></div>'});body+='</div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">关闭</button><button class="btn-primary" onclick="App.Questions.updateBankFromManager(\''+id+'\')">💾 保存题库信息</button>';App.Modal.open('📋 '+b.name+' ('+b.questions.length+'道题)',body,footer)},
        updateBankFromManager:function(id){var name=document.getElementById('inp-bank-name').value.trim();if(!name){App.Toast.show('请输入题库名称','warning');return}var desc=document.getElementById('inp-bank-desc').value.trim();var banks=App.Storage.getBanks();var b=banks.find(function(x){return x.id===id});if(!b)return;b.name=name;b.description=desc;App.Storage.setBanks(banks);(function(){try{var fi=JSON.parse(localStorage.getItem('exam_file_index')||'[]');var fe=fi.find(function(x){return x.id===id});if(fe){fe.name=name;fe.isNewFile=true;localStorage.setItem('exam_file_index',JSON.stringify(fi))}}catch(e){}})();App.Modal.close();this.render();App.Toast.show('题库信息已更新（改名将在下次同步写入云端）','success')},
        editQuestion:function(bankId,qId){var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var q=bank.questions.find(function(x){return x.id===qId});if(!q)return;var body='<div class="form-group"><label>题目内容</label><textarea id="inp-eq-text" rows="3">'+q.text+'</textarea></div><div class="form-group"><label>选项A</label><input type="text" id="inp-eq-a" value="'+(q.options.A||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项B</label><input type="text" id="inp-eq-b" value="'+(q.options.B||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项C</label><input type="text" id="inp-eq-c" value="'+(q.options.C||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>选项D</label><input type="text" id="inp-eq-d" value="'+(q.options.D||'').replace(/"/g,'&quot;')+'"></div><div class="form-group"><label>正确答案</label><select id="inp-eq-answer"><option value="A"'+(q.answer==='A'?' selected':'')+'>A</option><option value="B"'+(q.answer==='B'?' selected':'')+'>B</option><option value="C"'+(q.answer==='C'?' selected':'')+'>C</option><option value="D"'+(q.answer==='D'?' selected':'')+'>D</option></select></div><div class="form-group"><label>分值</label><input type="number" id="inp-eq-points" value="'+q.points+'" min="1" max="100" style="width:80px"></div>';var footer='<button class="btn-secondary" onclick="App.Questions.openBankManager(\''+bankId+'\')">取消</button><button class="btn-primary" onclick="App.Questions.saveEditQuestion(\''+bankId+'\',\''+qId+'\')">保存</button>';App.Modal.open('✏️ 编辑题目',body,footer)},
        saveEditQuestion:function(bankId,qId){var text=document.getElementById('inp-eq-text').value.trim();if(!text){App.Toast.show('请输入题目内容','warning');return}var a=document.getElementById('inp-eq-a').value.trim();var b=document.getElementById('inp-eq-b').value.trim();if(!a||!b){App.Toast.show('至少填写选项A和B','warning');return}var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var q=bank.questions.find(function(x){return x.id===qId});if(!q)return;q.text=text;q.options={A:a,B:b,C:document.getElementById('inp-eq-c').value.trim(),D:document.getElementById('inp-eq-d').value.trim()};q.answer=document.getElementById('inp-eq-answer').value;q.points=parseInt(document.getElementById('inp-eq-points').value)||10;App.Storage.setBanks(banks);App.Modal.close();this.openBankManager(bankId);App.Toast.show('题目已更新','success')},
        deleteQuestion:function(bankId,qId){if(!confirm('确定要删除这道题目吗？'))return;var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;bank.questions=bank.questions.filter(function(q){return q.id!==qId});App.Storage.setBanks(banks);App.Modal.close();this.openBankManager(bankId);this.render();App.Toast.show('题目已删除','info')},
        showAddQuestionDialog:function(bankId){var _pb=App.Storage.getBanks().find(function(x){return x.id===bankId});if(_pb&&App.BankTypes.of(_pb)==='pinyin'){App.Toast.show('拼音题库请用「拼 拼音题库」维护','warning');return}if(_pb&&App.BankTypes.of(_pb)==='fill'){App.Toast.show('填空题请用题目卡的「追加题目」','warning');return}var body='<div class="form-group"><label>题目内容</label><textarea id="inp-q-text" placeholder="请输入题目内容" rows="3"></textarea></div><div class="form-group"><label>选项A</label><input type="text" id="inp-q-a" placeholder="选项A内容"></div><div class="form-group"><label>选项B</label><input type="text" id="inp-q-b" placeholder="选项B内容"></div><div class="form-group"><label>选项C</label><input type="text" id="inp-q-c" placeholder="选项C内容"></div><div class="form-group"><label>选项D</label><input type="text" id="inp-q-d" placeholder="选项D内容"></div><div class="form-group"><label>正确答案</label><select id="inp-q-answer"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div><div class="form-group"><label>分值</label><input type="number" id="inp-q-points" value="10" min="1" max="100" style="width:80px"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.addQuestion(\''+bankId+'\')">添加</button>';App.Modal.open('添加题目',body,footer)},
        addQuestion:function(bankId){var text=document.getElementById('inp-q-text').value.trim();if(!text){App.Toast.show('请输入题目内容','warning');return}var a=document.getElementById('inp-q-a').value.trim();var b=document.getElementById('inp-q-b').value.trim();var c=document.getElementById('inp-q-c').value.trim();var d=document.getElementById('inp-q-d').value.trim();if(!a||!b){App.Toast.show('至少填写选项A和B','warning');return}var answer=document.getElementById('inp-q-answer').value;var points=parseInt(document.getElementById('inp-q-points').value)||10;var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;bank.questions.push({id:App.genId(),text:text,options:{A:a,B:b,C:c||'',D:d||''},answer:answer,points:points});App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('题目添加成功','success')},
        showImportQuestionsDialog:function(bankId){var _pb2=App.Storage.getBanks().find(function(x){return x.id===bankId});if(_pb2&&App.BankTypes.of(_pb2)==='pinyin'){App.Toast.show('拼音题库请用「拼 拼音题库」维护','warning');return}if(_pb2&&App.BankTypes.of(_pb2)==='fill'){App.Toast.show('填空题请用题目卡的「追加题目」','warning');return}var body='<div class="import-format-hint">导入格式说明：第一行可为题库名（不含|则视为题库名），后续每行一道题<br>格式：<code>题库名称</code>（可选）<br>题目格式：<code>题目|选项A|选项B|选项C|选项D|正确答案|分值</code><br>示例：<br><code>数学基础</code><br><code>1+1=?|1|2|3|4|B|10</code><br><code>中国的首都是?|上海|北京|广州|深圳|B|10</code></div><div class="form-group"><label>粘贴题目数据</label><textarea id="inp-import-questions" placeholder="第一行：题库名称（可选）&#10;后续每行一道题" rows="8"></textarea></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doImportQuestions(\''+bankId+'\')">导入</button>';App.Modal.open('📥 导入题目',body,footer)},
        doImportQuestions:function(bankId){var text=document.getElementById('inp-import-questions').value.trim();if(!text){App.Toast.show('请输入题目数据','warning');return}var banks=App.Storage.getBanks();var bank=banks.find(function(x){return x.id===bankId});if(!bank)return;var lines=text.split('\n'),count=0,startIdx=0;if(lines.length>0&&lines[0].trim().indexOf('|')===-1&&lines[0].trim()){bank.name=lines[0].trim();startIdx=1}for(var i=startIdx;i<lines.length;i++){var line=lines[i].trim();if(!line)continue;var p=line.split('|');if(p.length>=6){bank.questions.push({id:App.genId(),text:p[0].trim(),options:{A:p[1].trim(),B:p[2].trim(),C:p[3].trim(),D:p[4].trim()},answer:p[5].trim().toUpperCase(),points:parseInt(p[6])||10});count++}}App.Storage.setBanks(banks);App.Modal.close();this.render();App.Toast.show('成功导入 '+count+' 道题目'+(startIdx===1?'，题库已重命名为「'+bank.name+'」':''),'success')},
        copyTemplateForAI:function(type){
            type=type||'single';
            var tpl=App.BankTypes.template(type)+'\n\n请按上面的格式继续出题，直接输出数据，不要其他解释。';
            if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(tpl).then(function(){App.Toast.show('模板已复制','success')}).catch(function(){App.Questions._fallbackCopy(tpl)})}
            else{this._fallbackCopy(tpl)}
        },
        _fallbackCopy:function(text){var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');App.Toast.show('模板已复制，粘贴给AI即可','success')}catch(e){App.Toast.show('复制失败，请手动复制','warning')}document.body.removeChild(ta)},
        showAIDialog:function(){var body='<div class="form-group"><label>题目主题/知识点</label><textarea id="inp-ai-topic" placeholder="请描述要生成的题目主题，越详细越好" rows="4" maxlength="2000"></textarea><div style="text-align:right;font-size:11px;color:#666;margin-top:2px"><span id="ai-topic-count">0</span>/2000</div></div><div class="form-group"><label>题目数量</label><input type="number" id="inp-ai-count" value="5" min="1" max="30" style="width:80px"> <span class="form-hint">1~30题</span></div><div class="form-group"><label>题库名称 <span style="color:#888;font-weight:normal">（留空则AI自动命名）</span></label><input type="text" id="inp-ai-bank-name" placeholder="AI将根据主题自动生成名称"></div><div id="ai-status" class="ai-status" style="display:none"></div>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" id="btn-ai-gen" onclick="App.Questions.generateAIQuestions()">🤖 生成</button>';App.Modal.open('🤖 AI生成题目',body,footer);var ta=document.getElementById('inp-ai-topic');if(ta){ta.addEventListener('input',function(){var c=document.getElementById('ai-topic-count');if(c)c.textContent=ta.value.length})}},
        generateAIQuestions:function(){var s=App.Storage.getSettings();if(!s.aiApiKey||!s.aiApiUrl){App.Toast.show('请先在设置中配置AI API','warning');return}var topic=document.getElementById('inp-ai-topic').value.trim();if(!topic){App.Toast.show('请输入题目主题','warning');return}var count=parseInt(document.getElementById('inp-ai-count').value)||5;if(count<1)count=1;if(count>30)count=30;var userBankName=document.getElementById('inp-ai-bank-name').value.trim();var statusEl=document.getElementById('ai-status');statusEl.style.display='block';statusEl.className='ai-status processing';statusEl.textContent='⏳ 正在生成题目，请稍候...';document.getElementById('btn-ai-gen').disabled=true;var prompt='你是一个专业的考试出题专家。请根据以下要求生成选择题：\n\n主题：'+topic+'\n数量：'+count+'道\n\n要求：\n1. 每道题必须有4个选项(A/B/C/D)，且只有一个正确答案\n2. 题目内容要准确、专业，选项要有迷惑性\n3. 分值默认10分，可根据难度调整(5/10/15/20)\n4. 如果用户没有指定题库名称，请根据主题生成一个简短贴切的题库名称\n\n请严格按照以下JSON格式返回，不要添加任何其他文字：\n{"bankName":"题库名称","questions":[{"text":"题目内容","options":{"A":"选项A","B":"选项B","C":"选项C","D":"选项D"},"answer":"B","points":10}]}\n\n注意：只返回这个JSON对象，不要返回任何解释或额外内容。';try{fetch(s.aiApiUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.aiApiKey},body:JSON.stringify({model:s.aiModel||'glm-4.7-flash',messages:[{role:'user',content:prompt}],temperature:0.7})}).then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json()}).then(function(data){var content='';if(data.choices&&data.choices[0]&&data.choices[0].message){content=data.choices[0].message.content||''}else if(data.output){content=data.output.text||data.output||''}else if(typeof data==='string'){content=data}content=content.trim();if(content.startsWith('```')){content=content.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')}var jsonMatch=content.match(/\{[\s\S]*\}/);if(!jsonMatch)throw new Error('AI返回内容无法解析为JSON');var result=JSON.parse(jsonMatch[0]);var questions=result.questions||result;var bankName=userBankName||result.bankName||'AI生成题库';if(!Array.isArray(questions))throw new Error('AI返回的题目格式不正确');var banks=App.Storage.getBanks();var newBank={id:App.genBankId(),name:bankName,description:'AI生成 - '+topic,questions:[],createdAt:Date.now(),_newFile:true};var validCount=0;questions.forEach(function(q){if(!q.text||!q.options||!q.answer)return;var opts={};if(typeof q.options==='object'){opts=q.options}else if(Array.isArray(q.options)){var keys=['A','B','C','D'];for(var oi=0;oi<Math.min(q.options.length,4);oi++){opts[keys[oi]]=String(q.options[oi])}}newBank.questions.push({id:App.genId(),text:q.text,options:opts,answer:String(q.answer).toUpperCase().charAt(0),points:parseInt(q.points)||10});validCount++});if(validCount===0)throw new Error('AI未生成有效题目');banks.push(newBank);App.Storage.setBanks(banks);App.Modal.close();App.Questions.render();App.Toast.show('成功生成 '+validCount+' 道题目 → '+bankName,'success')}).catch(function(err){statusEl.className='ai-status error';statusEl.textContent='❌ 生成失败：'+err.message;document.getElementById('btn-ai-gen').disabled=false})}catch(e){statusEl.className='ai-status error';statusEl.textContent='❌ 请求失败：'+e.message;document.getElementById('btn-ai-gen').disabled=false}},
        showImportBankDialog:function(type){
            type=type||'single';var ti=App.BankTypes.info(type);
            var body='<div class="import-format-hint">'+App.BankTypes.templateHelp(type)+'</div>';
            body+='<div class="form-group"><label>粘贴'+ti.name+'数据</label><textarea id="inp-import-bank" rows="10" placeholder="按上面的格式粘贴"></textarea></div>';
            var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="btn-primary" onclick="App.Questions.doImportBank(\''+type+'\')">导入</button>';
            App.Modal.open('📥 批量导入 · '+ti.name,body,footer);
        },
        doImportBank:function(type){
            type=type||'single';
            var text=document.getElementById('inp-import-bank').value;
            if(!text||!text.trim()){App.Toast.show('请输入题库数据','warning');return}
            var r=App.BankTypes.parse(type,text);
            if(!r.questions.length){App.Toast.show('没有识别到有效内容'+(r.errors.length?('：'+r.errors[0]):''),'warning');return}
            r.questions.forEach(function(q){q.id=App.genId()});
            var banks=App.Storage.getBanks();
            var bank={id:App.genBankId(),name:r.name||('导入'+App.BankTypes.info(type).name),description:'导入题库',type:type,questions:r.questions,createdAt:Date.now(),_newFile:true};
            if(type==='reading')bank.article=r.article;
            banks.push(bank);App.Storage.setBanks(banks);App.Modal.close();this.render();
            App.Toast.show('成功导入「'+bank.name+'」'+r.questions.length+' 题'+(r.errors.length?('，跳过 '+r.errors.length+' 处'):''),'success');
        },
        exportTemplate:function(type){
            type=type||'single';
            var template=App.BankTypes.template(type);
            var blob=new Blob([template],{type:'text/plain;charset=utf-8'});
            var url=URL.createObjectURL(blob);var a=document.createElement('a');
            a.href=url;a.download=App.BankTypes.info(type).name+'导入模板.txt';a.click();URL.revokeObjectURL(url);
            App.Toast.show('模板已导出','success');
        },
        importTemplateFile:function(){var input=document.getElementById('inp-template-file');if(input){input.value='';input.click()}},
        handleTemplateFile:function(input){if(!input.files||!input.files[0])return;var file=input.files[0];var reader=new FileReader();reader.onload=function(e){var text=e.target.result;if(!text||!text.trim()){App.Toast.show('文件内容为空','warning');return}var lines=text.trim().split('\n');var bankName='导入题库';var startIdx=0;if(lines.length>0&&lines[0].trim().indexOf('|')===-1&&lines[0].trim()){bankName=lines[0].trim();startIdx=1}var banks=App.Storage.getBanks();var newBank={id:App.genBankId(),name:bankName,description:'从文件导入',questions:[],createdAt:Date.now(),_newFile:true};var count=0;for(var i=startIdx;i<lines.length;i++){var line=lines[i].trim();if(!line)continue;var p=line.split('|');if(p.length>=6){newBank.questions.push({id:App.genId(),text:p[0].trim(),options:{A:p[1].trim(),B:p[2].trim(),C:p[3].trim(),D:p[4].trim()},answer:p[5].trim().toUpperCase(),points:parseInt(p[6])||10});count++}}if(count===0){App.Toast.show('未识别到有效题目，请检查文件格式','warning');return}banks.push(newBank);App.Storage.setBanks(banks);App.Questions.render();App.Toast.show('成功导入 '+count+' 道题目 → '+bankName,'success')};reader.readAsText(file,'utf-8')}
    };

})();
