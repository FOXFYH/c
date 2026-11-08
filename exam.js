/* 考试流程模块（从 app.js 拆出，按功能区独立） */
(function(){
    "use strict";
    var App=window.App=window.App||{};
    App.Exam = {
        currentMode:'draw',currentExam:null,timerInterval:null,timeLeft:0,
        renderOptionsHTML:function(question){
            var settings=App.Storage.getSettings();
            var labels=['A','B','C','D'];
            var items=[];
            labels.forEach(function(l){if(question.options[l])items.push({label:l,text:question.options[l]})});
            if(settings.shuffleOptions){
                var shuffled=App.shuffle(items);
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
            if(progress.mode==='practice')return false;
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
                groupScores:progress.groupScores||null,
                _pointsPerQ:progress._pointsPerQ||null,
                _isRetry:progress._isRetry||false,
                _smartProbMap:progress._smartProbMap||null
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
            App._autoFS();
            this.renderWarReport(false);
            this.showQuestion();
            App.Toast.show('已恢复上次比赛','success');
            return true;
        },
        enterMode:function(mode){
            if(mode==='pinyin'&&!App.Pinyin){App.Modules.load('pinyin',function(){App.Exam.enterMode('pinyin')});return}
            if(mode==='reading'&&!App.Reading){App.Modules.load('reading',function(){App.Exam.enterMode('reading')});return}
            if(mode==='fill'&&!App.Fill){App.Modules.load('fill',function(){App.Exam.enterMode('fill')});return}
            this.currentMode=mode;
            var settings=App.Storage.getSettings();
            var lastPT=settings.lastParticipationType||'personal';
            this.participationType=lastPT;
            var isLottery=mode==='lottery';
            // 抽签与练习都只能个人参与：即使上一次是小组，也强制切回个人，否则练习看不到学生列表
            if(isLottery||mode==='practice'||mode==='pinyin'||mode==='fill'||(mode==='reading'&&App.Role&&App.Role.isStudent())){this.participationType='personal';lastPT='personal'}
            document.getElementById('exam-mode-select').classList.add('hidden');
            document.getElementById('exam-setup').classList.remove('hidden');
            var titleEl=document.getElementById('setup-mode-title');
            var btnIcon=document.getElementById('btn-start-icon');
            var btnText=document.getElementById('btn-start-text');
            var groupArea=document.getElementById('exam-group-select-area');
            var studentArea=document.getElementById('exam-student-select-area');
            var rotationOpt=document.getElementById('opt-group-rotation');
            var ptabPersonal=document.getElementById('ptab-personal');
            var ptabGroup=document.getElementById('ptab-group');
            var isPractice=mode==='practice';
            var isSmart=mode==='smart';
            var isPinyin=mode==='pinyin';
            var isFill=mode==='fill';
            var soloOnly=isPractice||isLottery||isPinyin||isFill||(mode==='reading'&&App.Role&&App.Role.isStudent());
            if(lastPT==='group'){
                if(groupArea)groupArea.style.display='';
                if(studentArea)studentArea.style.display='none';
                if(rotationOpt)rotationOpt.style.display='';
                if(ptabPersonal)ptabPersonal.classList.remove('active');
                if(ptabGroup){ptabGroup.classList.add('active');ptabGroup.style.display=soloOnly?'none':''}
            }else{
                if(groupArea)groupArea.style.display='none';
                if(studentArea)studentArea.style.display='';
                if(rotationOpt)rotationOpt.style.display='none';
                if(ptabPersonal)ptabPersonal.classList.add('active');
                if(ptabGroup){ptabGroup.classList.remove('active');ptabGroup.style.display=soloOnly?'none':''}
            }
            this._updateModeTitle();
            btnText.textContent='开始';
            this.renderRulesPanel(mode,lastPT);
            if(lastPT==='group')this.renderGroupSelect();
            else this.renderStudentSelect();
            // 学生模式练习：进入即锁定本人，避免列表重绘后丢失选中
            if((isPractice||isPinyin||mode==='reading'||isFill)&&App.Role&&App.Role.isStudent()){
                [0,300,900].forEach(function(ms){
                    setTimeout(function(){
                        var _only=document.querySelector('.student-select-item');
                        if(_only&&!_only.classList.contains('selected')){
                            _only.classList.add('selected');
                            var _cm=_only.querySelector('.check-mark');if(_cm)_cm.textContent='✓';
                        }
                    },ms);
                });
            }
            App.Questions.renderBankSelect();
            var bankBar=document.getElementById('exam-bank-bar');
            if(bankBar)bankBar.style.display=isLottery?'none':'';
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput)baseInput.value=settings.baseTimeout!==undefined?settings.baseTimeout:30;
            if(charInput)charInput.value=settings.charTimeoutCompensation!==undefined?settings.charTimeoutCompensation:0.2;
            var playerOrderEl=document.getElementById('exam-player-order');
            var questionOrderEl=document.getElementById('exam-question-order');
            var avgQEl=document.getElementById('exam-avg-questions');
            var groupRotEl=document.getElementById('exam-group-rotation');
            if(playerOrderEl&&settings.lastPlayerOrder)playerOrderEl.value=settings.lastPlayerOrder;
            if(questionOrderEl&&settings.lastQuestionOrder)questionOrderEl.value=settings.lastQuestionOrder;
            if(avgQEl&&settings.lastAvgQuestions)avgQEl.value=settings.lastAvgQuestions;
            if(groupRotEl&&settings.lastGroupRotation)groupRotEl.value=settings.lastGroupRotation;
            var playerOrderGroup=playerOrderEl?playerOrderEl.closest('.option-group'):null;
            var questionOrderGroup=questionOrderEl?questionOrderEl.closest('.option-group'):null;
            var avgQGroup=avgQEl?avgQEl.closest('.option-group'):null;
            if(playerOrderGroup)playerOrderGroup.style.display=(isPractice||isSmart||isLottery||isPinyin||isFill)?'none':'';
            if(questionOrderGroup)questionOrderGroup.style.display=(isPractice||isLottery||isPinyin||isFill)?'none':'';
            if(avgQGroup)avgQGroup.style.display=(isPractice||isLottery||isPinyin||isFill)?'none':'';
            var timeoutGroup=document.getElementById('opt-group-timeout');
            if(timeoutGroup)timeoutGroup.style.display=isLottery?'none':'';
            var lotteryRandomGroup=document.getElementById('opt-group-lottery-random');
            if(lotteryRandomGroup)lotteryRandomGroup.style.display=isLottery?'':'none';
            if(isLottery&&lotteryRandomGroup){
                var savedLR=settings.lastLotteryRandom||'fairCycle';
                var lrSelect=document.getElementById('exam-lottery-random');
                if(lrSelect){for(var li=0;li<lrSelect.options.length;li++){if(lrSelect.options[li].value===savedLR){lrSelect.selectedIndex=li;break}}}
                if(playerOrderEl)playerOrderEl.value='random';
                this._updateLotteryWeightUI();
            }
            var smartGroup=document.getElementById('opt-group-smart');
            if(smartGroup)smartGroup.style.display=isSmart?'':'none';
            if(isSmart){
                if(playerOrderEl)playerOrderEl.value='smart';
                var intensityInput=document.getElementById('exam-smart-intensity');
                if(intensityInput)intensityInput.value=settings.smartIntensity||5;
                this._updateSmartPreview();
            }
            var readingGroup=document.getElementById('opt-group-reading');
            if(readingGroup)readingGroup.style.display=(mode==='reading')?'':'none';
            if(mode==='reading'){
                var rsp=document.getElementById('exam-reading-speed');
                if(rsp)rsp.value=settings.readingSecPerChar!==undefined?settings.readingSecPerChar:0.5;
                this.updateReadingPreview();
            }
            App.Effects.playClick();
        },
        switchParticipation:function(type){
            if((this.currentMode==='lottery'||this.currentMode==='pinyin')&&type==='group'){App.Toast.show('该模式仅支持个人','warning');return}
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
                var icons={farm:'🌾',challenge:'🎯',pk:'⚔️',practice:'📝',smart:'🧠',lottery:'🎲',pinyin:'拼',reading:'📖',fill:'✍️'};
                btnIcon.textContent=icons[mode]||'🎮';
            }
            if(pType==='personal'){
                var titles={farm:'👥 参与人员',challenge:'👥 参与人员',pk:'⚔️ PK参赛选手（请选择2-8名）',practice:'👤 选择练习学生（仅限1人）',smart:'👥 参与人员（智能抽查）',lottery:'👥 参与人员（抽签池）',pinyin:'👤 选择拼字学生（仅限1人）',reading:'👥 参与人员（先读文章再答题）',fill:'👤 选择答题学生（仅限1人）'};
                if(studentTitleEl)studentTitleEl.textContent=titles[mode]||'👥 参与人员';
            }
        },
        renderRulesPanel:function(mode,pType){
            var panel=document.getElementById('setup-rules-panel');
            if(!panel||!window.ModeRules)return;
            var rule=ModeRules[mode];
            if(!rule){panel.innerHTML='';return}
            var html='<div class="rules-card'+(this.rulesOpen?' expanded':'')+'">';
            html+='<h4 class="rules-title rules-toggle" onclick="App.Exam.toggleRulesCard(this)">'+rule.title+' 规则<span class="rules-arrow">▾</span></h4>';
            html+='<div class="rules-body">';
            html+='<ul class="rules-list">';
            rule.rules.forEach(function(r){html+='<li>'+r+'</li>'});
            if(pType==='group'&&rule.groupExtra){html+='<li class="rules-group-extra">🏆 '+rule.groupExtra+'</li>'}
            html+='</ul>';
            if(window.CommonRules&&mode!=='practice'&&mode!=='lottery'){
                html+='<h4 class="rules-title" style="margin-top:16px">通用规则</h4>';
                html+='<ul class="rules-list">';
                CommonRules.forEach(function(r){html+='<li>'+r+'</li>'});
                html+='</ul>';
            }
            html+='</div>';
            html+='</div>';
            panel.innerHTML=html;
        },
        toggleRulesCard:function(el){
            var card=el&&el.closest?el.closest('.rules-card'):null;
            if(!card)return;
            card.classList.toggle('expanded');
            this.rulesOpen=card.classList.contains('expanded');
        },
        backToModes:function(){
            document.getElementById('exam-mode-select').classList.remove('hidden');
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.add('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
            var ptabGroup=document.getElementById('ptab-group');if(ptabGroup)ptabGroup.style.display='';
            var playerOrderGroup=document.getElementById('exam-player-order').closest('.option-group');
            var questionOrderGroup=document.getElementById('exam-question-order').closest('.option-group');
            var avgQGroup=document.getElementById('exam-avg-questions').closest('.option-group');
            if(playerOrderGroup)playerOrderGroup.style.display='';
            if(questionOrderGroup)questionOrderGroup.style.display='';
            if(avgQGroup)avgQGroup.style.display='';
            var timeoutGroup=document.getElementById('opt-group-timeout');
            if(timeoutGroup)timeoutGroup.style.display='';
            var bankBar=document.getElementById('exam-bank-bar');
            if(bankBar)bankBar.style.display='';
            var smartGroup=document.getElementById('opt-group-smart');
            if(smartGroup)smartGroup.style.display='none';
            var lotteryRandomGroup=document.getElementById('opt-group-lottery-random');
            if(lotteryRandomGroup)lotteryRandomGroup.style.display='none';
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
        renderStudentSelect:function(){var students=App.Storage.getStudents();if(App.Role&&App.Role.isStudent()){var me=App.Role.student();students=me?[me]:[]}var list=document.getElementById('exam-student-list');if(students.length===0){list.innerHTML='<p style="color:var(--text-muted);text-align:center;">暂无学生，请先在设置→学生中添加</p>';return}var html='';students.forEach(function(s){html+='<div class="student-select-item" data-student-id="'+s.id+'" onclick="App.Exam.toggleStudentSelect(this)"><span>'+(s.avatar?'<img src="'+s.avatar+'" style="width:20px;height:20px;border-radius:50%;vertical-align:middle"> ':'')+' '+s.name+'</span><span class="check-mark"></span></div>'});list.innerHTML=html;if(App.Role&&App.Role.isStudent()){var only=list.querySelector('.student-select-item');if(only){only.classList.add('selected');var cm=only.querySelector('.check-mark');if(cm)cm.textContent='✓'}}},
        toggleStudentSelect:function(el){var mode=this.currentMode;if(mode==='practice'||mode==='pinyin'){if(el.classList.contains('selected')){el.classList.remove('selected');el.querySelector('.check-mark').textContent=''}else{document.querySelectorAll('.student-select-item.selected').forEach(function(other){if(other!==el){other.classList.remove('selected');other.querySelector('.check-mark').textContent=''}});el.classList.add('selected');el.querySelector('.check-mark').textContent='✓'}}else if(mode==='pk'){if(el.classList.contains('selected')){el.classList.remove('selected');el.querySelector('.check-mark').textContent=''}else{var count=document.querySelectorAll('.student-select-item.selected').length;if(count>=8){App.Toast.show('PK最多选择8名选手','warning');return}el.classList.add('selected');el.querySelector('.check-mark').textContent='✓'}}else{el.classList.toggle('selected');el.querySelector('.check-mark').textContent=el.classList.contains('selected')?'✓':''}App.Effects.playClick()},
        getSelectedStudentIds:function(){var ids=[];document.querySelectorAll('.student-select-item.selected').forEach(function(el){ids.push(el.dataset.studentId)});return ids},
        selectAllStudents:function(){var mode=this.currentMode;var items=document.querySelectorAll('.student-select-item');var allSelected=true;items.forEach(function(el){if(!el.classList.contains('selected'))allSelected=false});if(allSelected){items.forEach(function(el){el.classList.remove('selected');el.querySelector('.check-mark').textContent=''})}else if(mode==='practice'||mode==='pinyin'){App.Toast.show('该模式仅限选择1人','warning')}else if(mode==='pk'){var count=document.querySelectorAll('.student-select-item.selected').length;items.forEach(function(el){if(!el.classList.contains('selected')&&count<8){el.classList.add('selected');el.querySelector('.check-mark').textContent='✓';count++}})}else{items.forEach(function(el){if(!el.classList.contains('selected')){el.classList.add('selected');el.querySelector('.check-mark').textContent='✓'}})}App.Effects.playClick()},
        startExam:async function(){
            if(App.Login && !App.Login.isLoggedIn()){App.Toast.show('请先登录','warning');App.Login.openModal();return}
            if(this.currentMode==='pinyin'){this._startPinyinExam();return}
            if(this.currentMode==='reading'){this._startReadingExam();return}
            if(this.currentMode==='fill'){this._startFillExam();return}
            var bankIds=App.Questions.getSelectedBankIds();
            var isLottery=this.currentMode==='lottery';
            if(bankIds.length===0&&!isLottery){App.Toast.show('请至少选择一个题库','warning');return}
            var students=App.Storage.getStudents();
            if(students.length===0){App.Toast.show('请先添加学生','warning');return}
            var mode=this.currentMode;
            var pType=this.participationType;
            var selectedIds=this.getSelectedStudentIds();
            // 学生模式练习：即使界面选中态丢了，也默认锁定当前扮演的学生
            if(mode==='practice'&&App.Role&&App.Role.isStudent()&&selectedIds.length!==1){
                selectedIds=[App.Role.actingId()];
            }
            var groupNames=[];
            var examStudents;
            var isPractice=mode==='practice';
            var isSmart=mode==='smart';
            if(isLottery)pType='personal';
            if(isPractice){
                if(selectedIds.length!==1){App.Toast.show('选择练习模式请选择1名学生','warning');return}
                if(bankIds.length!==1){App.Toast.show('选择练习模式请选择1个题库','warning');return}
                var savedProgress=App.Storage.getExamProgress();
                if(savedProgress&&savedProgress.mode==='practice'&&savedProgress._bankIds&&savedProgress._bankIds.length>0){
                    var savedBankId=savedProgress._bankIds[0];
                    var savedStudentId=savedProgress.currentStudentId||(savedProgress.students&&savedProgress.students[0]?savedProgress.students[0].id:null);
                    if(savedBankId===bankIds[0]&&savedStudentId===selectedIds[0]){
                        var answered=savedProgress.results?savedProgress.results.length:0;
                        var total=savedProgress.questions?savedProgress.questions.length:0;
                        var body='<p style="text-align:center;font-size:1.1em;padding:12px 0">检测到上次未完成的练习进度<br>已完成 <b style="color:var(--accent-1)">'+answered+'/'+total+'</b> 题<br><span style="color:var(--text-muted);font-size:0.9em">是否继续上次进度？</span></p>';
                        var footer='<button class="btn-secondary" onclick="App.Modal.close();App.Exam._startFreshPractice()">重新开始</button><button class="btn-glow" onclick="App.Modal.close();App.Exam._resumePractice()">🔄 继续练习</button>';
                        App.Modal.open('📝 发现未完成进度',body,footer);
                        return;
                    }
                }
            }
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
                }else if(!isPractice){
                    if(selectedIds.length===0)selectedIds=students.map(function(s){return s.id});
                }
            }
            examStudents=students.filter(function(s){return selectedIds.indexOf(s.id)!==-1});
            var banks=App.Storage.getBanks(),allQ=[];
            if(mode!=='lottery'){
            // 检查所选题库是否缺少题目内容（仅有索引），按需从云端下载
            var missingBanks=[];
            var fileIndex=JSON.parse(localStorage.getItem('exam_file_index')||'[]');
            bankIds.forEach(function(bid){
                var b=banks.find(function(x){return x.id===bid});
                if(!b){
                    // 本地banks中无此题库，但文件索引中有（云端题库），需要下载
                    var fi=fileIndex.find(function(x){return x.id===bid&&x.id.startsWith('QB_')});
                    if(fi){
                        // 先在banks中创建空壳条目，以便下载后填充（静默，不增加版本号）
                        b={id:bid,name:fi.name,description:'',questions:[],createdAt:Date.now(),type:fi.bankType||''};
                        banks.push(b);
                        App.Storage._syncSilent=true;
                        try{App.Storage.setBanks(banks)}finally{App.Storage._syncSilent=false}
                        missingBanks.push(b);
                    }
                }else if(!b.questions||b.questions.length===0){
                    missingBanks.push(b);
                }
            });
            if(missingBanks.length>0&&App.Sync&&App.Sync.ready){
                App.Toast.show('正在下载题库内容（'+missingBanks.length+'个）...','info');
                for(var mi=0;mi<missingBanks.length;mi++){
                    var mb=missingBanks[mi];
                    var bankMetaKey=mb.id||mb.name;
                    // 串行下载，每个等待完成
                    App.Sync.postToFileManager({type:'downloadCloudFile',fileId:bankMetaKey});
                    // 等待题库内容下载到本地（轮询检查，最多等10秒）
                    var waitStart=Date.now();
                    while(Date.now()-waitStart<10000){
                        await new Promise(function(r){setTimeout(r,500)});
                        var freshBanks=App.Storage.getBanks();
                        var freshBank=freshBanks.find(function(x){return x.id===mb.id});
                        if(freshBank&&freshBank.questions&&freshBank.questions.length>0)break;
                    }
                }
                banks=App.Storage.getBanks();
            }
            bankIds.forEach(function(bid){var b=banks.find(function(x){return x.id===bid});if(b&&b.questions&&App.BankTypes.of(b)===App.BankTypes.allowedForMode(App.Exam.currentMode))allQ=allQ.concat(b.questions)});
            if(allQ.length===0){App.Toast.show('所选题库中没有题目','warning');return}
            }
            var timeLimit=0;
            var autoNext=App.Storage.getSettings().autoNext!==false;
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput||charInput){
                var s=App.Storage.getSettings();
                if(baseInput)s.baseTimeout=parseFloat(baseInput.value)||0;
                if(charInput)s.charTimeoutCompensation=parseFloat(charInput.value)||0;
                s.lastMode=mode;
                s.lastParticipationType=this.participationType;
                s.lastPlayerOrder=document.getElementById('exam-player-order').value;
                s.lastQuestionOrder=document.getElementById('exam-question-order').value;
                s.lastAvgQuestions=parseInt(document.getElementById('exam-avg-questions').value)||5;
                s.lastGroupRotation=document.getElementById('exam-group-rotation').value;
                App.Storage.setSettings(s);
            }
            var playerOrder=document.getElementById('exam-player-order').value;
            if(!isPractice&&!isSmart&&!isLottery){
                if(playerOrder==='fair'&&examStudents.length<3){App.Toast.show('公平随机至少需要3人','warning');return}
                if(playerOrder==='random'&&examStudents.length<2){App.Toast.show('真随机至少需要2人','warning');return}
            }
            var questionOrder=document.getElementById('exam-question-order').value;
            var avgQuestions=(isPractice||isLottery)?0:(parseInt(document.getElementById('exam-avg-questions').value)||5);
            var groupRotation=document.getElementById('exam-group-rotation').value;
            var LOTTERY_MAX_DRAWS=500;
            var totalQuestionsNeeded,questionPool;
            if(isPractice){
                questionPool=allQ.slice().sort(function(){return Math.random()-0.5});
                totalQuestionsNeeded=questionPool.length;
            }else if(isLottery){
                totalQuestionsNeeded=LOTTERY_MAX_DRAWS;
                questionPool=this._buildLotteryQuestionPool(LOTTERY_MAX_DRAWS);
            }else{
                totalQuestionsNeeded=avgQuestions*examStudents.length;
                questionPool=this._buildQuestionPool(allQ,totalQuestionsNeeded,questionOrder);
            }
            var playerQueue;
            // 过滤今日缺勤的学生（所有模式通用）
            var settings=App.Storage.getSettings();
            var absenceEnabled=settings.absenceCompensation!==false;
            var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
            var availableStudents=examStudents;
            if(absenceEnabled&&!isPractice){
                availableStudents=examStudents.filter(function(s){
                    var absence=App.Storage.getAbsence(s.id);
                    if(!absence)return true;
                    return absence.lastAbsentDate!==todayStr;
                });
                if(availableStudents.length===0)availableStudents=examStudents;  // 全部缺勤则不过滤
            }
            if(isPractice){
                playerQueue=[];
                for(var pi=0;pi<totalQuestionsNeeded;pi++)playerQueue.push(availableStudents[0]);
            }else if(isSmart){
                playerOrder='smart';
                playerQueue=this._buildSmartPlayerQueue(availableStudents,totalQuestionsNeeded);
            }else if(isLottery){
                var lrSel=document.getElementById('exam-lottery-random');
                var lotteryMode=lrSel?lrSel.value:'fairCycle';
                var st_lr=App.Storage.getSettings();st_lr.lastLotteryRandom=lotteryMode;App.Storage.setSettings(st_lr);
                playerOrder='random';
                if(lotteryMode==='fairCycle'){playerQueue=this._buildFairLotteryQueue(availableStudents,totalQuestionsNeeded);}
                else if(lotteryMode==='daily'){
                    playerQueue=this._buildDailyLotteryQueue(availableStudents,totalQuestionsNeeded);
                    if(playerQueue.length===0){App.Toast.show('今日名单已全部抽完，可点「重置今日名单」后再抽','warning');return;}
                }
                else if(lotteryMode==='weighted'){
                    playerQueue=this._buildWeightedLotteryQueue(availableStudents,totalQuestionsNeeded);
                    if(playerQueue.length===0){App.Toast.show('加权名单全部权重为 0，没有可抽的人；请把至少一人的权重调到 1 以上','warning');return;}
                }
                else{playerQueue=this._buildLotteryQueue(availableStudents,totalQuestionsNeeded);}
            }else{
                playerQueue=this._buildPlayerQueue(availableStudents,playerOrder,totalQuestionsNeeded,pType,groupNames,groupRotation);
            }
            var exam={mode:mode,participationType:pType,questions:questionPool,timeLimit:timeLimit,autoNext:autoNext,students:examStudents,currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:playerQueue,queueIndex:0,avgQuestions:avgQuestions,groupNames:groupNames,groupRotation:groupRotation,playerOrder:isPractice?'order':playerOrder,_pointsPerQ:isPractice?this._getInitialPointsPerQ(examStudents[0].id,bankIds[0]||''):0,_lotteryMode:isLottery?(lotteryMode||'fairCycle'):''};
            if(isSmart){
                exam._smartProbMap=this._calcSmartProbPoints(examStudents);
            }
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
            App._autoFS();
            this._nextPlayer();
        },
        _startPinyinExam:function(){
            var selectedIds=this.getSelectedStudentIds();
            if(App.Role&&App.Role.isStudent()&&selectedIds.length!==1){selectedIds=[App.Role.actingId()]}
            if(selectedIds.length!==1){App.Toast.show('拼音练习模式请选择1名学生','warning');return}
            var students=App.Storage.getStudents();
            var student=students.find(function(s){return s.id===selectedIds[0]});
            if(!student){App.Toast.show('找不到该学生','warning');return}
            var pool=App.Pinyin.getPool();
            if(!pool.questions.length){App.Toast.show('拼音字库为空','warning');return}
            var s=App.Storage.getSettings();
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput)s.baseTimeout=parseFloat(baseInput.value)||0;
            if(charInput)s.charTimeoutCompensation=parseFloat(charInput.value)||0;
            s.lastMode='pinyin';s.lastParticipationType='personal';App.Storage.setSettings(s);
            var exam={mode:'pinyin',participationType:'personal',questions:pool.questions,timeLimit:0,autoNext:false,students:[student],currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:[],queueIndex:0,avgQuestions:0,groupNames:[],groupRotation:'alternate',playerOrder:'order',_pointsPerQ:10,_bankNames:pool.names};
            exam.playerScores[student.id]=0;
            for(var i=0;i<pool.questions.length;i++)exam.playerQueue.push(student);
            this.currentExam=exam;
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            App._autoFS();
            this._nextPlayer();
        },
        updateReadingPreview:function(){
            var el=document.getElementById('exam-reading-preview');if(!el)return;
            var bank=this._readingBank();
            if(!bank){el.textContent='请先选择「课外阅读题」题库';return}
            if(!bank.article){el.textContent='该题库还没有文章，请到题库页维护';return}
            var chars=String(bank.article).replace(/\s/g,'').length;
            var sp=parseFloat((document.getElementById('exam-reading-speed')||{}).value)||0.5;
            el.textContent='文章《'+(bank.title||bank.name)+'》约 '+chars+' 字 × '+sp+' 秒 ≈ 阅读 '+Math.max(5,Math.round(chars*sp))+' 秒';
        },
        _readingBank:function(){
            var banks=App.Storage.getBanks(),ids=App.Storage.getSettings()._lastReadingBankIds||[];
            var hit=null;
            ids.forEach(function(id){var b=banks.find(function(x){return x.id===id});if(b&&App.BankTypes.of(b)==='reading')hit=b});
            return hit;
        },
        _startReadingExam:function(){
            var bank=this._readingBank();
            if(!bank){App.Toast.show('请选择1个课外阅读题库','warning');return}
            if(!bank.article){App.Toast.show('该题库没有阅读文章','warning');return}
            var qs=(bank.questions||[]).filter(function(q){return q&&q.options&&q.answer});
            if(!qs.length){App.Toast.show('该题库没有题目','warning');return}
            var students=App.Storage.getStudents();
            if(!students.length){App.Toast.show('请先添加学生','warning');return}
            var selectedIds=this.getSelectedStudentIds(),pType=this.participationType,groupNames=[];
            if(pType==='group'){
                groupNames=this.getSelectedGroupNames();
                if(!groupNames.length){App.Toast.show('请至少选择1个小组','warning');return}
                var gids=[];groupNames.forEach(function(gn){students.forEach(function(s){if(s.group===gn)gids.push(s.id)})});
                selectedIds=gids;
                if(!selectedIds.length){App.Toast.show('所选小组没有学生','warning');return}
            }else if(!selectedIds.length){selectedIds=students.map(function(s){return s.id})}
            var examStudents=students.filter(function(s){return selectedIds.indexOf(s.id)!==-1});
            var settings=App.Storage.getSettings();
            var sp=parseFloat((document.getElementById('exam-reading-speed')||{}).value)||0.5;
            sp=Math.max(0.1,Math.min(5,sp));
            settings.readingSecPerChar=sp;
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput)settings.baseTimeout=parseFloat(baseInput.value)||0;
            if(charInput)settings.charTimeoutCompensation=parseFloat(charInput.value)||0;
            settings.lastMode='reading';settings.lastParticipationType=pType;App.Storage.setSettings(settings);
            var playerOrder=document.getElementById('exam-player-order').value;
            var questionOrder=document.getElementById('exam-question-order').value;
            var groupRotation=document.getElementById('exam-group-rotation').value;
            var total=qs.length*examStudents.length;
            var pool=this._buildQuestionPool(qs,total,questionOrder);
            var playerQueue=this._buildPlayerQueue(examStudents,playerOrder,total,pType,groupNames,groupRotation);
            var exam={mode:'reading',participationType:pType,questions:pool,timeLimit:0,autoNext:settings.autoNext!==false,students:examStudents,currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:playerQueue,queueIndex:0,avgQuestions:qs.length,groupNames:groupNames,groupRotation:groupRotation,playerOrder:playerOrder,_pointsPerQ:0,_bankNames:[bank.name]};
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
            App._autoFS();
            var self=this;
            App.Reading.begin(bank.article,sp,function(){self._nextPlayer()},bank.title||bank.name);
        },
        _startFillExam:function(){
            var selectedIds=this.getSelectedStudentIds();
            if(App.Role&&App.Role.isStudent()&&selectedIds.length!==1)selectedIds=[App.Role.actingId()];
            if(selectedIds.length!==1){App.Toast.show('填空练习模式请选择1名学生','warning');return}
            var students=App.Storage.getStudents();
            var student=students.find(function(s){return s.id===selectedIds[0]});
            if(!student){App.Toast.show('找不到该学生','warning');return}
            var banks=App.Storage.getBanks(),ids=App.Storage.getSettings()._lastFillBankIds||[];
            var bank=null;
            ids.forEach(function(id){var b=banks.find(function(x){return x.id===id&&App.BankTypes.of(x)==='fill'});if(b)bank=b});
            if(!bank){App.Toast.show('请选择1个填空题题库','warning');return}
            var qs=(bank.questions||[]).filter(function(q){return q&&q.text&&q.answers&&q.answers.length});
            if(!qs.length){App.Toast.show('填空题题库没有题目','warning');return}
            var s=App.Storage.getSettings();
            var baseInput=document.getElementById('exam-base-timeout-inline');
            var charInput=document.getElementById('exam-char-timeout-inline');
            if(baseInput)s.baseTimeout=parseFloat(baseInput.value)||0;
            if(charInput)s.charTimeoutCompensation=parseFloat(charInput.value)||0;
            s.lastMode='fill';s.lastParticipationType='personal';App.Storage.setSettings(s);
            var pool=App.shuffle(qs.slice());
            var exam={mode:'fill',participationType:'personal',questions:pool,timeLimit:0,autoNext:false,students:[student],currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:[],queueIndex:0,avgQuestions:0,groupNames:[],groupRotation:'alternate',playerOrder:'order',_pointsPerQ:0,_bankNames:[bank.name]};
            exam.playerScores[student.id]=0;
            for(var i=0;i<pool.length;i++)exam.playerQueue.push(student);
            this.currentExam=exam;
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            App._autoFS();
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
        _buildLotteryQuestionPool:function(needed){
            var pool=[];
            for(var i=0;i<needed;i++){pool.push({id:App.genId(),text:'',options:{}})}
            return pool;
        },
        _buildLotteryQueue:function(students,needed){
            var queue=[];
            for(var i=0;i<needed;i++){queue.push(students[Math.floor(Math.random()*students.length)])}
            return queue;
        },
        _buildFairLotteryQueue:function(students,needed){
            var queue=[];var batch=[];var idx=0;
            for(var i=0;i<needed;i++){
                if(idx>=batch.length){
                    batch=students.slice().sort(function(){return Math.random()-0.5});
                    idx=0;
                }
                queue.push(batch[idx]);idx++;
            }
            return queue;
        },
        // ===== 今日随机：当天已抽中的人不再出现，按自然日 0 点重置 =====
        _todayStr:function(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()},
        getDailyLottery:function(){
            var d=App.Storage.get('lottery_daily',null);
            if(!d||d.date!==this._todayStr())return {date:this._todayStr(),ids:[]};
            return d;
        },
        recordDailyDraw:function(id){
            var d=this.getDailyLottery();
            if(d.ids.indexOf(id)<0)d.ids.push(id);
            App.Storage.set('lottery_daily',d);
        },
        // 队列预演：每次从「今日未抽中」的人里随机取；今日全部抽完就停（不重复抽已抽过的人）
        _buildDailyLotteryQueue:function(students,needed){
            var drawn=this.getDailyLottery().ids.slice();
            var pool=students.filter(function(s){return drawn.indexOf(s.id)<0});
            var queue=[];
            for(var i=0;i<needed;i++){
                if(pool.length===0)break;
                var pick=pool[Math.floor(Math.random()*pool.length)];
                queue.push(pick);
                pool=pool.filter(function(s){return s.id!==pick.id});
            }
            return queue;
        },
        // 权重明确规则：未设置=100；0=排除（概率 0，永不出现）；负数/非数字=排除；上限 9999
        getLotteryWeight:function(studentId){
            var raw=(App.Storage.getSettings().lotteryWeights||{})[studentId];
            if(raw===undefined||raw===null||raw==='')return 100;
            var v=Number(raw);
            if(!isFinite(v)||v<0)return 0;
            return Math.min(9999,Math.floor(v));
        },
        _buildWeightedLotteryQueue:function(students,needed){
            var queue=[];
            if(students.length===0)return queue;
            var self=this;
            var weights=students.map(function(s){return self.getLotteryWeight(s.id)});
            var total=0;for(var t=0;t<weights.length;t++)total+=weights[t];
            if(total<=0)return queue;   // 全员权重为 0：一个都不抽
            for(var i=0;i<needed;i++){
                var r=Math.random()*total,acc=0,pick=null;
                for(var k=0;k<weights.length;k++){
                    if(weights[k]<=0)continue;   // 0 权重根本不进抽样区间
                    acc+=weights[k];
                    if(r<acc){pick=students[k];break}
                }
                if(!pick)break;
                queue.push(pick);
            }
            return queue;
        },
        _onLotteryModeChange:function(){
            var sel=document.getElementById('exam-lottery-random');
            if(sel){var s=App.Storage.getSettings();s.lastLotteryRandom=sel.value;App.Storage.setSettings(s);}
            this._updateLotteryWeightUI();
        },
        _updateLotteryWeightUI:function(){
            var sel=document.getElementById('exam-lottery-random');
            var box=document.getElementById('lottery-weight-editor');
            var hint=document.getElementById('lottery-daily-hint');
            var mode=sel?sel.value:'';
            if(box)box.style.display=(mode==='weighted')?'':'none';
            if(hint){
                if(mode==='daily'){
                    var d=this.getDailyLottery();
                    var names=[];
                    var students=App.Storage.getStudents();
                    d.ids.forEach(function(id){var st=students.find(function(s){return s.id===id});if(st)names.push(st.name)});
                    hint.style.display='';
                    hint.innerHTML='今日已抽 '+d.ids.length+' 人'+(names.length?'：'+names.join('、'):'')+'　<button class="btn-secondary btn-sm" onclick="App.Exam.resetDailyLottery()">重置今日名单</button>';
                }else{
                    hint.style.display='none';
                }
            }
            if(mode==='weighted')this.renderLotteryWeightEditor();
        },
        resetDailyLottery:function(){
            App.Storage.set('lottery_daily',null);
            this._updateLotteryWeightUI();
            App.Toast.show('今日已抽名单已清空','info');
        },
        renderLotteryWeightEditor:function(){
            var list=document.getElementById('lottery-weight-list');
            if(!list)return;
            var self=this;
            var students=App.Storage.getStudents();
            var html='';
            students.forEach(function(s){
                var name=(s.name||'').replace(/</g,'&lt;');
                html+='<div class="weight-row" style="display:flex;align-items:center;gap:8px;padding:3px 0">'
                    +'<span style="flex:1">'+name+'</span>'
                    +'<input type="number" min="0" max="9999" step="1" data-wid="'+s.id+'" value="'+self.getLotteryWeight(s.id)+'" style="width:80px" oninput="App.Exam.saveLotteryWeight(this)">'
                    +'</div>';
            });
            list.innerHTML=html;
        },
        saveLotteryWeight:function(el){
            var id=el.getAttribute('data-wid');
            if(!id)return;
            var s=App.Storage.getSettings();
            s.lotteryWeights=s.lotteryWeights||{};
            var raw=String(el.value==null?'':el.value).trim();
            if(raw===''){delete s.lotteryWeights[id];}   // 清空=恢复默认 100
            else{
                var v=Math.floor(Number(raw));
                if(!isFinite(v)||v<0)v=0;   // 负数/非数字一律按 0 排除
                if(v>9999)v=9999;
                s.lotteryWeights[id]=v;
            }
            App.Storage.setSettings(s);
        },
        _calcSmartProbPoints:function(students){
            var settings=App.Storage.getSettings();
            var intensity=settings.smartIntensity||5;
            var absenceEnabled=settings.absenceCompensation!==false;
            var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
            var yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
            var yesterdayStr=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate();
            var statsArr=[];
            students.forEach(function(s){
                var st=App.getStudentStats(s.id);
                statsArr.push({id:s.id,accuracy:st.accuracy,totalCount:st.totalCount});
            });
            statsArr.sort(function(a,b){
                if(a.totalCount===0&&b.totalCount===0)return 0;
                if(a.totalCount===0)return 1;
                if(b.totalCount===0)return -1;
                return b.accuracy-a.accuracy;
            });
            var rankMap={};
            for(var i=0;i<statsArr.length;i++){
                rankMap[statsArr[i].id]=i+1;
            }
            var probMap={};
            students.forEach(function(s){
                var rank=rankMap[s.id]||students.length;
                var baseProb=100+(rank-1)*intensity;
                // 缺勤补偿：昨日缺勤的学生概率翻倍（线性增长）
                if(absenceEnabled){
                    var absence=App.Storage.getAbsence(s.id);
                    if(absence&&absence.consecutiveDays>0){
                        var lastDate=absence.lastAbsentDate||'';
                        var attendedDate=absence.attendedDate||'';
                        if(lastDate===todayStr){
                            // 今日缺勤，后面会被过滤，不调整概率
                        }else if(attendedDate===todayStr){
                            // 今日已出勤，当日维持高概率
                            baseProb=baseProb*(absence.consecutiveDays||1);
                        }else if(lastDate===yesterdayStr){
                            // 昨日缺勤，今日首次抽取必中 + 概率倍增
                            baseProb=baseProb*(absence.consecutiveDays||1);
                        }
                        // 其他情况（缺勤更早且今日未出勤）→ 正常概率
                    }
                }
                probMap[s.id]=baseProb;
            }.bind(this));
            return probMap;
        },
        _buildSmartPlayerQueue:function(students,needed){
            var settings=App.Storage.getSettings();
            var absenceEnabled=settings.absenceCompensation!==false;
            var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
            var yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
            var yesterdayStr=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate();
            // 过滤今日缺勤的学生
            var availableStudents=students;
            if(absenceEnabled){
                availableStudents=students.filter(function(s){
                    var absence=App.Storage.getAbsence(s.id);
                    if(!absence)return true;
                    return absence.lastAbsentDate!==todayStr;
                });
                if(availableStudents.length===0)availableStudents=students;  // 全部缺勤则不过滤
            }
            var probMap=this._calcSmartProbPoints(availableStudents);
            // 检查是否有昨日缺勤的学生需要"首次必中"
            var mustPick=null;
            if(absenceEnabled){
                for(var i=0;i<availableStudents.length;i++){
                    var s=availableStudents[i];
                    var absence=App.Storage.getAbsence(s.id);
                    if(absence&&absence.lastAbsentDate===yesterdayStr){
                        // 检查今日是否已被抽取过（非缺勤）
                        var todayAnswered=this.currentExam?this.currentExam.results.filter(function(r){return r.studentId===s.id&&!r.isAbsent}):[];
                        if(todayAnswered.length===0){
                            mustPick=s;break;  // 首个昨日缺勤且今日未答题的学生必中
                        }
                    }
                }
            }
            var queue=[];
            if(mustPick){
                queue.push(mustPick);
                needed--;
            }
            var totalProb=0;
            availableStudents.forEach(function(s){totalProb+=probMap[s.id]||100});
            for(var i=0;i<needed;i++){
                var rand=Math.random()*totalProb;
                var cum=0;
                for(var j=0;j<availableStudents.length;j++){
                    cum+=probMap[availableStudents[j].id]||100;
                    if(rand<=cum){queue.push(availableStudents[j]);break}
                }
                if(queue.length<=i+ (mustPick?1:0))queue.push(availableStudents[availableStudents.length-1]);
            }
            return queue;
        },
        _getSmartPointsPerQ:function(studentId){
            var exam=this.currentExam;
            if(!exam)return 1;
            var students=exam.students;
            var probMap=exam._smartProbMap||this._calcSmartProbPoints(students);
            var probPoints=probMap[studentId]||100;
            var basePoints=10;
            return Math.max(1,Math.floor(basePoints/probPoints*100));
        },
        _updateSmartPreview:function(){
            var intensityInput=document.getElementById('exam-smart-intensity');
            var previewEl=document.getElementById('smart-preview');
            var valueEl=document.getElementById('smart-intensity-value');
            if(!intensityInput||!previewEl)return;
            var intensity=parseInt(intensityInput.value)||5;
            if(valueEl)valueEl.textContent=intensity;
            var students=App.Storage.getStudents();
            var lastProb=100+(students.length-1)*intensity;
            previewEl.textContent='末名概率点数：'+lastProb+'（'+students.length+'人）';
            var settings=App.Storage.getSettings();
            settings.smartIntensity=intensity;
            App.Storage.setSettings(settings);
        },
        _nextPlayer:function(){
            var exam=this.currentExam;
            if(exam.queueIndex>=exam.playerQueue.length||exam.currentIndex>=exam.questions.length){
                this.showResult();return;
            }
            var student=exam.playerQueue[exam.queueIndex];
            exam.currentStudent=student;
            exam.queueIndex++;
            // 今日随机：真正抽到才记入今日已抽名单（不是预演时提前记）
            if(exam.mode==='lottery'&&exam._lotteryMode==='daily')this.recordDailyDraw(student.id);
            exam.answered=false;
            if(exam.mode==='lottery'){exam.playerScores[student.id]=(exam.playerScores[student.id]||0)+1}
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
        startDrawing:function(){var students=this.currentExam.students;if(students.length===0)return;var settings=App.Storage.getSettings();var drawDuration=(settings.drawDuration||3)*1000;var card=document.getElementById('drawing-card');var avatar=document.getElementById('drawing-avatar');var nameEl=document.getElementById('drawing-name');var avMap=App.buildAvatarCharMap(students);card.classList.add('spinning');card.classList.remove('revealed');App.Effects.playDrumRoll();var self=this,startTime=Date.now(),stopped=false;var finalStudent=this.currentExam.currentStudent;function animate(){var rs=students[Math.floor(Math.random()*students.length)];nameEl.textContent=rs.name;if(rs.avatar){avatar.innerHTML='<img src="'+rs.avatar+'">'}else{avatar.innerHTML='';avatar.textContent=avMap[rs.id]||rs.name.charAt(0)}var elapsed=Date.now()-startTime;var progress=Math.min(elapsed/drawDuration,1);if(progress>=1||stopped){setTimeout(function(){card.classList.remove('spinning');card.classList.add('revealed');nameEl.textContent=finalStudent.name;if(finalStudent.avatar){avatar.innerHTML='<img src="'+finalStudent.avatar+'">'}else{avatar.innerHTML='';avatar.textContent=avMap[finalStudent.id]||finalStudent.name.charAt(0)}App.Effects.playFanfare();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/3,80);setTimeout(function(){self.showQuestion()},1800)},300);return}var delay=50+progress*200;setTimeout(animate,delay)}animate();this._drawingStop=function(){stopped=true}},
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
            var student=exam.currentStudent;var question=exam.questions[exam.currentIndex];var st=App.getStudentStats(student.id);var level=App.getLevel(st.totalPoints);var avMap=App.buildAvatarCharMap(exam.students);
            document.getElementById('exam-avatar').innerHTML=student.avatar?'<img src="'+student.avatar+'">':(avMap[student.id]||student.name.charAt(0));
            document.getElementById('exam-student-name').textContent=student.name;
            document.getElementById('exam-student-group').textContent=student.group?'('+student.group+')':'';
            document.getElementById('exam-student-level').textContent=level.name;
            document.getElementById('exam-student-comment').textContent=level.comment;
            document.getElementById('exam-student-points').textContent=exam.mode==='practice'?'待结算：'+(exam.playerScores[student.id]||0)+'⭐':exam.mode==='smart'?'本场：'+(exam.playerScores[student.id]||0)+'⭐  累计：'+st.totalPoints+'⭐  概率：'+(exam._smartProbMap?exam._smartProbMap[student.id]:100)+'  分值：'+this._getSmartPointsPerQ(student.id):'本场：'+(exam.playerScores[student.id]||0)+'⭐  累计：'+st.totalPoints+'⭐';
            document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 题 · 人均 '+(Math.round(exam.results.length/exam.students.length*10)/10)+'/'+exam.avgQuestions;
            document.getElementById('question-text').textContent=question.text;
            if(exam.mode==='pinyin'){App.Pinyin.renderQuestion(exam,question);return}
            if(exam.mode==='fill'){App.Fill.renderQuestion(exam,question);return}
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
            if(exam.mode==='lottery'){
                document.getElementById('exam-student-points').textContent='本场已抽 '+(exam.playerScores[student.id]||0)+' 次';
                document.getElementById('exam-progress-text').textContent='第 '+(exam.currentIndex+1)+'/'+exam.questions.length+' 签 · 已抽 '+(exam.results.length)+' 人';
                document.getElementById('timer-bar').style.display='none';
                document.getElementById('exam-timer').style.display='none';
                document.getElementById('question-text').textContent='📣 请老师现场口头出题（与题库无关）';
                document.getElementById('question-options').innerHTML='<div class="lottery-hint">抽签结果已定格，学生作答后点击下方「下一签 →」继续</div>';
                var undoBtnL=document.getElementById('btn-undo-answer');if(undoBtnL)undoBtnL.style.display='none';
                var absentBtnL=document.getElementById('btn-absent');if(absentBtnL&&exam.students.length>1)absentBtnL.style.display='';
                var nextBtnL=document.getElementById('btn-next-question');
                nextBtnL.style.display='';nextBtnL.textContent='下一签 →';
                nextBtnL.onclick=function(){App.Exam.nextQuestion()};
                return;
            }
            document.getElementById('btn-next-question').style.display='none';
            var undoBtn2=document.getElementById('btn-undo-answer');if(undoBtn2)undoBtn2.style.display='none';
            var absentBtn2=document.getElementById('btn-absent');if(absentBtn2&&exam.students.length>1)absentBtn2.style.display='';
            this.startTimer(question.text);
        },
        toggleFullscreen:function(){
            App.toggleFullscreen();
        },
        renderWarReport:function(expandCurrentGroup){
            var exam=this.currentExam;
            var container=document.getElementById('war-report-list');
            var sidebarTitle=document.getElementById('sidebar-title');
            if(!container)return;
            var settings=App.Storage.getSettings();
            var wrFs=settings.warReportFontSize||12;
            container.style.fontSize=wrFs+'px';
            if(exam.mode==='lottery'){
                sidebarTitle.textContent='📊 抽签记录';
                var lStudents=exam.students.slice().sort(function(a,b){return(exam.playerScores[b.id]||0)-(exam.playerScores[a.id]||0)});
                var lHtml='';
                lStudents.forEach(function(s){
                    var lCount=exam.playerScores[s.id]||0;
                    var lIsCurrent=exam.currentStudent&&s.id===exam.currentStudent.id;
                    lHtml+='<div class="war-report-personal-item'+(lIsCurrent?' current-player':'')+'">';
                    lHtml+='<span class="rp-name">'+(s.avatar?'<img src="'+s.avatar+'" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">':'')+s.name+'</span>';
                    lHtml+='<span class="rp-correct">'+lCount+' 次</span>';
                    lHtml+='</div>';
                });
                container.innerHTML=lHtml;
                return;
            }
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
            var tbEl=document.getElementById('timer-bar');if(tbEl)tbEl.style.display='';
            var tEl2=document.getElementById('exam-timer');if(tEl2)tEl2.style.display='';
            var fill=document.getElementById('timer-fill'),timerEl=document.getElementById('exam-timer');
            if(this.timerInterval)clearInterval(this.timerInterval);
            var timeLimit=this.calcTimeout(questionText);
            if(timeLimit<=0){fill.style.width='100%';fill.classList.remove('warning');timerEl.textContent='不限时';return}
            this.timeLeft=timeLimit;var totalTime=timeLimit;
            fill.style.width='100%';fill.classList.remove('warning');timerEl.textContent=this.timeLeft+'s';
            this.timerInterval=setInterval(function(){self.timeLeft--;var pct=(self.timeLeft/totalTime)*100;fill.style.width=pct+'%';timerEl.textContent=self.timeLeft+'s';if(self.timeLeft<=5){fill.classList.add('warning');App.Effects.playCountdown()}if(self.timeLeft<=0){clearInterval(self.timerInterval);self.timeUp()}},1000);
        },
        timeUp:function(){var exam=this.currentExam;if(exam.answered)return;if(exam.mode==='pinyin'){App.Pinyin.timeUp();return}if(exam.mode==='fill'){App.Fill.timeUp();return}var question=exam.questions[exam.currentIndex];exam.answered=true;var correctAnswer=this.getEffectiveAnswer(question);document.querySelectorAll('.option-btn').forEach(function(btn){btn.classList.add('disabled');if(btn.dataset.option===correctAnswer)btn.classList.add('correct')});exam.results.push({studentId:exam.currentStudent.id,questionId:question.id,correct:false,pointsEarned:0,selectedOption:'超时'});App.Effects.playTimeUp();App.Effects.showScorePopup(0,false);this.renderWarReport(true);this._saveProgress();this.showNextButton()},
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
                if(exam.mode==='practice'){
                    pointsEarned=exam._pointsPerQ||10;
                }else if(exam.mode==='smart'){
                    pointsEarned=this._getSmartPointsPerQ(exam.currentStudent.id);
                }else{
                    pointsEarned=this._calcBasePoints(exam.mode);
                }
                exam.totalEarned+=pointsEarned;
                exam.playerScores[exam.currentStudent.id]=(exam.playerScores[exam.currentStudent.id]||0)+pointsEarned;
                if(exam.participationType==='group'){var g=exam.currentStudent.group||'未分组';exam.groupScores[g]=(exam.groupScores[g]||0)+pointsEarned}
                App.Effects.playCorrect();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/2,40);
                if(exam.mode==='practice'){
                    App.Effects.showScorePopup(pointsEarned,true,'待结算');
                    document.getElementById('exam-student-points').textContent='待结算：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐';
                }else if(exam.mode==='smart'){
                    App.Effects.showScorePopup(pointsEarned,true);
                    var st=App.getStudentStats(exam.currentStudent.id);var tempPts=st.totalPoints+pointsEarned;var lv=App.getLevel(tempPts);document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐  累计：'+tempPts+'⭐  概率：'+(exam._smartProbMap?exam._smartProbMap[exam.currentStudent.id]:100)+'  分值：'+pointsEarned;document.getElementById('exam-student-level').textContent=lv.name;document.getElementById('exam-student-comment').textContent=lv.comment
                }else{
                    App.Effects.showScorePopup(pointsEarned,true);
                    var st=App.getStudentStats(exam.currentStudent.id);var tempPts=st.totalPoints+pointsEarned;var lv=App.getLevel(tempPts);document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐  累计：'+tempPts+'⭐';document.getElementById('exam-student-level').textContent=lv.name;document.getElementById('exam-student-comment').textContent=lv.comment
                }
            }else{App.Effects.playWrong();App.Effects.showScorePopup(0,false)}
            exam.results.push({studentId:exam.currentStudent.id,questionId:question.id,correct:isCorrect,pointsEarned:pointsEarned,selectedOption:option});
            // 学生出勤答题，清除缺勤连续计数（次日恢复正常概率）
            var absence=App.Storage.getAbsence(exam.currentStudent.id);
            if(absence&&absence.consecutiveDays>0){
                var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
                absence.attendedDate=todayStr;  // 标记今日已出勤
                App.Storage.setAbsence(exam.currentStudent.id,absence);
            }
            // 智能模式：每5人答题后更新概率映射
            if(exam.mode==='smart'&&exam._smartProbMap&&exam.results.length%5===0){
                exam._smartProbMap=this._calcSmartProbPoints(exam.students);
            }
            this.renderWarReport(true);this._saveProgress();this.showNextButton();
        },
        _getInitialPointsPerQ:function(studentId,bankId){
            var DEFAULT_PPQ=10;
            var wrongSet=App.Storage.getWrongSet(studentId,bankId);
            if(wrongSet&&wrongSet.lastInitialPPQ){
                return Math.max(1,Math.floor(wrongSet.lastInitialPPQ/2));
            }
            return DEFAULT_PPQ;
        },
        _calcBasePoints:function(mode){
            if(mode==='farm')return 10;
            if(mode==='challenge')return 5;
            if(mode==='reading')return 5;
            if(mode==='pk')return 5;
            if(mode==='practice')return 10;
            if(mode==='smart')return 10;
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
            var bankIds=App.Questions.getSelectedBankIds();
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
                _pointsPerQ:exam._pointsPerQ||null,
                _isRetry:exam._isRetry||false,
                _bankIds:bankIds,
                _smartProbMap:exam._smartProbMap||null,
                savedAt:Date.now()
            };
            App.Storage.setExamProgress(progress);
        },
        showNextButton:function(){var exam=this.currentExam;var btn=document.getElementById('btn-next-question');var undoBtn=document.getElementById('btn-undo-answer');var absentBtn=document.getElementById('btn-absent');btn.style.display='';undoBtn.style.display='';if(absentBtn&&exam.students.length>1)absentBtn.style.display='';var isLast=exam.currentIndex>=exam.questions.length-1;btn.textContent=isLast?'查看结果 →':'下一题 →';btn.onclick=isLast?function(){App.Exam.showResult()}:function(){App.Exam.nextQuestion()};if(exam.autoNext){var delay=(App.Storage.getSettings().autoNextDelay||3)*1000;exam._autoNextTimer=setTimeout(isLast?function(){App.Exam.showResult()}:function(){App.Exam.nextQuestion()},delay)}},
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
            // 撤销出勤标记
            if(!lastResult.isAbsent){
                var absence=App.Storage.getAbsence(lastResult.studentId);
                if(absence&&absence.attendedDate){
                    var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
                    if(absence.attendedDate===todayStr)delete absence.attendedDate;
                    App.Storage.setAbsence(lastResult.studentId,absence);
                }
            }
            exam.answered=false;
            document.querySelectorAll('.option-btn').forEach(function(btn){btn.classList.remove('disabled','correct','wrong')});
            var undoBtn=document.getElementById('btn-undo-answer');undoBtn.style.display='none';
            var absentBtn=document.getElementById('btn-absent');if(absentBtn)absentBtn.style.display='none';
            var nextBtn=document.getElementById('btn-next-question');nextBtn.style.display='none';
            if(exam.mode==='practice'){
                document.getElementById('exam-student-points').textContent='待结算：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐';
            }else{
                var st=App.getStudentStats(exam.currentStudent.id);var lv=App.getLevel(st.totalPoints);
                document.getElementById('exam-student-points').textContent='本场：'+(exam.playerScores[exam.currentStudent.id]||0)+'⭐  累计：'+st.totalPoints+'⭐';
                document.getElementById('exam-student-level').textContent=lv.name;
                document.getElementById('exam-student-comment').textContent=lv.comment;
            }
            this.renderWarReport(false);this._saveProgress();
            var question=exam.questions[exam.currentIndex];
            this.startTimer(question.text);
            App.Toast.show('已撤销，请重新作答','info');
        },
        markAbsent:function(){
            var exam=this.currentExam;if(!exam||!exam.currentStudent)return;
            if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}
            if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null}
            var student=exam.currentStudent;
            var settings=App.Storage.getSettings();
            if(settings.absenceCompensation===false){
                App.Toast.show('缺勤补偿未启用','warning');return;
            }
            // 隐藏按钮
            var absentBtn=document.getElementById('btn-absent');if(absentBtn)absentBtn.style.display='none';
            var undoBtn=document.getElementById('btn-undo-answer');if(undoBtn)undoBtn.style.display='none';
            var nextBtn=document.getElementById('btn-next-question');if(nextBtn)nextBtn.style.display='none';
            // 记录缺勤
            var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
            var absence=App.Storage.getAbsence(student.id);
            // 如果今日已出勤答题，不允许再标记缺勤
            if(absence&&absence.attendedDate===todayStr){
                App.Toast.show(student.name+' 今日已出勤，无法标记缺勤','warning');return;
            }
            if(absence){
                var lastDate=absence.lastAbsentDate||'';
                // 判断是否连续缺勤（上次缺勤是昨天）
                var yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
                var yesterdayStr=yesterday.getFullYear()+'-'+(yesterday.getMonth()+1)+'-'+yesterday.getDate();
                if(lastDate===yesterdayStr){
                    absence.consecutiveDays=(absence.consecutiveDays||1)+1;
                }else if(lastDate!==todayStr){
                    absence.consecutiveDays=1;
                }
                absence.lastAbsentDate=todayStr;
                absence.absentDates=absence.absentDates||[];
                if(absence.absentDates.indexOf(todayStr)===-1)absence.absentDates.push(todayStr);
            }else{
                absence={lastAbsentDate:todayStr,consecutiveDays:1,absentDates:[todayStr]};
            }
            App.Storage.setAbsence(student.id,absence);
            // 记录缺勤结果（0分，不计入正确率）
            exam.results.push({studentId:student.id,questionId:exam.questions[exam.currentIndex]?exam.questions[exam.currentIndex].id:'',correct:false,pointsEarned:0,selectedOption:'缺勤',isAbsent:true});
            this.renderWarReport(true);this._saveProgress();
            App.Toast.show(student.name+' 已标记缺勤（连续'+absence.consecutiveDays+'天）','warning');
            // 跳到下一题
            exam.currentIndex++;
            if(exam.currentIndex>=exam.questions.length){this.showResult();return}
            this._nextPlayer();
        },
        nextQuestion:function(){
            var exam=this.currentExam;if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}exam.currentIndex++;
            if(exam.currentIndex>=exam.questions.length){this.showResult();return}
            this._nextPlayer();
        },
        endExam:function(){var exam=this.currentExam;var isPractice=exam&&exam.mode==='practice';var answered=exam?exam.results.length:0;var total=exam?exam.questions.length:0;var isMidway=isPractice&&answered<total;var msg=isMidway?'确定要暂停练习吗？进度将自动保存，下次可继续！':'确定要结束本次挑战吗？';var body='<p style="text-align:center;font-size:1.1em;padding:12px 0">'+msg+'</p>';var footer='<button class="btn-secondary" onclick="App.Modal.close()">取消</button><button class="'+(isMidway?'btn-primary':'btn-danger')+'" onclick="App.Modal.close();App.Exam._doEndExam()">'+(isMidway?'💾 保存并退出':'⏹ 结束挑战')+'</button>';App.Modal.open(isMidway?'💾 暂停练习':'⏹ 结束挑战',body,footer)},
        _doEndExam:function(){
            if(this.timerInterval)clearInterval(this.timerInterval);
            var navMode=document.getElementById('nav-exam-mode');if(navMode)navMode.classList.add('hidden');
            var navEnd=document.getElementById('nav-exam-end');if(navEnd)navEnd.classList.add('hidden');
            var exam=this.currentExam;
            if(exam&&exam.mode==='practice'){
                var answered=exam.results.length;
                var total=exam.questions.length;
                if(answered<total){
                    this._saveProgress();
                    var body='<p style="text-align:center;font-size:1.1em;padding:12px 0">练习进度已保存！<br>已完成 <b style="color:var(--accent-1)">'+answered+'/'+total+'</b> 题<br><span style="color:var(--text-muted);font-size:0.9em">下次进入可继续完成剩余题目</span></p>';
                    var footer='<button class="btn-primary" onclick="App.Modal.close();App.Exam._exitToHome()">确定</button>';
                    App.Modal.open('📝 选择练习已保存',body,footer);
                    return;
                }
            }
            this.showResult();
        },
        _exitToHome:function(){
            var exam=this.currentExam;
            if(exam)exam._ended=true;
            if(App.Reading&&App.Reading.cancel)App.Reading.cancel();
            if(App.Fill&&App.Fill.cancel)App.Fill.cancel();
            if(this.timerInterval)clearInterval(this.timerInterval);
            if(document.fullscreenElement)document.exitFullscreen().catch(function(){});
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
            this.currentExam=null;
        },
        _resumePractice:function(){
            var progress=App.Storage.getExamProgress();
            if(!progress||progress.mode!=='practice')return;
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
                groupScores:progress.groupScores||null,
                _pointsPerQ:progress._pointsPerQ||null,
                _isRetry:progress._isRetry||false,
                _smartProbMap:progress._smartProbMap||null
            };
            if(progress.currentStudentId){
                var cs=exam.students.find(function(s){return s.id===progress.currentStudentId});
                if(cs)exam.currentStudent=cs;
            }
            this.currentExam=exam;
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.remove('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.add('in-exam');
            var labels=window.ParticipationLabels||{};
            var label=(labels[exam.participationType]&&labels[exam.participationType][exam.mode])||exam.mode;
            var navMode=document.getElementById('nav-exam-mode');if(navMode){navMode.textContent=label;navMode.classList.remove('hidden')}
            var navEnd=document.getElementById('nav-exam-end');if(navEnd)navEnd.classList.remove('hidden');
            App._autoFS();
            this.renderWarReport(false);
            this.showQuestion();
            App.Toast.show('已恢复练习进度','success');
        },
        _startFreshPractice:function(){
            App.Storage.clearExamProgress();
            this.startExam();
        },
        _startPracticeRetry:function(){
            var record=this._lastPracticeRecord;
            if(!record||!record.studentResults)return;
            var sid=Object.keys(record.studentResults)[0];
            var student=App.Storage.getStudents().find(function(s){return s.id===sid});
            if(!student){App.Toast.show('学生不存在','warning');return}
            var bankIds=App.Questions.getSelectedBankIds();
            if(bankIds.length===0){App.Toast.show('题库未选择','warning');return}
            var banks=App.Storage.getBanks(),allQ=[];
            bankIds.forEach(function(bid){var b=banks.find(function(x){return x.id===bid});if(b&&b.questions&&App.BankTypes.of(b)===App.BankTypes.allowedForMode(App.Exam.currentMode))allQ=allQ.concat(b.questions)});
            if(allQ.length===0){App.Toast.show('题库中没有题目','warning');return}
            var bankId=bankIds[0]||'';
            var wrongSet=App.Storage.getWrongSet(sid,bankId);
            var questionPool;
            if(wrongSet&&wrongSet.wrongQuestionIds&&wrongSet.wrongQuestionIds.length>0){
                var wrongIds=wrongSet.wrongQuestionIds;
                var wrongQs=allQ.filter(function(q){return wrongIds.indexOf(q.id)!==-1});
                var correctQs=allQ.filter(function(q){return wrongIds.indexOf(q.id)===-1});
                var shuffledCorrect=correctQs.sort(function(){return Math.random()-0.5});
                var distractors=shuffledCorrect.slice(0,Math.min(wrongQs.length,correctQs.length));
                questionPool=wrongQs.concat(distractors).sort(function(){return Math.random()-0.5});
            }else{
                questionPool=allQ.slice().sort(function(){return Math.random()-0.5});
            }
            var nextPointsPerQ=wrongSet?wrongSet.nextPointsPerQ||5:5;
            var examStudents=[student];
            var retryQueue=[];for(var ri=0;ri<questionPool.length;ri++)retryQueue.push(examStudents[0]);
            var exam={mode:'practice',participationType:'personal',questions:questionPool,timeLimit:0,autoNext:App.Storage.getSettings().autoNext!==false,students:examStudents,currentIndex:0,results:[],playerScores:{},totalEarned:0,playerQueue:retryQueue,queueIndex:0,avgQuestions:0,groupNames:[],groupRotation:'alternate',playerOrder:'order',_isRetry:true,_pointsPerQ:nextPointsPerQ};
            examStudents.forEach(function(s){exam.playerScores[s.id]=0});
            this.currentExam=exam;
            document.getElementById('exam-setup').classList.add('hidden');
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.remove('hidden');
            App._autoFS();
            this._nextPlayer();
        },
        showResult:function(){
            var exam=this.currentExam;if(!exam||exam._ended)return;exam._ended=true;
            if(App.Reading&&App.Reading.cancel)App.Reading.cancel();
            if(App.Fill&&App.Fill.cancel)App.Fill.cancel();
            if(this.timerInterval)clearInterval(this.timerInterval);
            if(exam._autoNextTimer){clearTimeout(exam._autoNextTimer);exam._autoNextTimer=null}
            document.getElementById('exam-drawing').classList.add('hidden');
            document.getElementById('exam-playing').classList.add('hidden');
            document.getElementById('exam-play-sidebar').classList.add('hidden');
            var hc=document.querySelector('.home-container');if(hc)hc.classList.remove('in-exam');
            if(exam.mode==='lottery'){
                this.currentExam=null;
                App.Storage.clearExamProgress();
                var totalDraws=0;for(var lk in exam.playerScores){totalDraws+=exam.playerScores[lk]||0}
                var navModeL=document.getElementById('nav-exam-mode');if(navModeL)navModeL.classList.add('hidden');
                var navEndL=document.getElementById('nav-exam-end');if(navEndL)navEndL.classList.add('hidden');
                if(document.fullscreenElement)document.exitFullscreen().catch(function(){});
                App.switchView('home');
                var modeSelL=document.getElementById('exam-mode-select');if(modeSelL)modeSelL.classList.remove('hidden');
                App.Toast.show('抽签结束，共 '+totalDraws+' 签','info');
                return;
            }
            var exam=this.currentExam;var correct=exam.results.filter(function(r){return r.correct}).length;
            var banks=App.Storage.getBanks();var bankNames=(exam._bankNames||[]).slice();var bankIds=App.Questions.getSelectedBankIds();
            if(!bankNames.length)bankIds.forEach(function(bid){var b=banks.find(function(x){return x.id===bid});if(b)bankNames.push(b.name)});
            var studentResults={};
            exam.students.forEach(function(s){studentResults[s.id]={id:s.id,name:s.name,avatar:s.avatar,group:s.group||'',correctCount:0,totalCount:0,pointsEarned:0}});
            exam.results.forEach(function(r){if(studentResults[r.studentId]&&!r.isAbsent){var sr=studentResults[r.studentId];sr.totalCount++;if(r.correct)sr.correctCount++;sr.pointsEarned+=(r.pointsEarned||0)}});
            // 判断是否全员参与：个人模式下所有学生都参与，或小组模式下所有小组都参与
            var allParticipants=false;
            if(exam.participationType!=='group'){
                var allStudents=App.Storage.getStudents();
                if(exam.students.length===allStudents.length)allParticipants=true;
            }else if(exam.groupNames&&exam.groupNames.length>0){
                var allGroups=App.Storage.getGroups();
                if(exam.groupNames.length===allGroups.length)allParticipants=true;
            }
            // 全员参与时，移除未答题（totalCount===0）的人的数据，节省存储
            if(allParticipants){
                var sids=Object.keys(studentResults);
                for(var ri=0;ri<sids.length;ri++){
                    if(studentResults[sids[ri]].totalCount===0)delete studentResults[sids[ri]];
                }
            }
            if(exam.mode==='practice'){
                var allCorrect=correct===exam.questions.length;
                var sid=exam.students[0].id;
                var bid=bankIds[0]||'';
                var ppq=exam._pointsPerQ||10;
                var pendingPoints=correct*ppq;
                var currentWrongSet=App.Storage.getWrongSet(sid,bid);
                var originalPending=currentWrongSet?currentWrongSet.pendingPoints||0:0;
                var currentInitialPPQ=exam._isRetry?(currentWrongSet&&currentWrongSet.lastInitialPPQ?currentWrongSet.lastInitialPPQ:ppq):ppq;
                if(allCorrect){
                    var totalPending=originalPending+pendingPoints;
                    exam.results.forEach(function(r){r.pointsEarned=r.correct?ppq:0});
                    studentResults[sid].pointsEarned=totalPending;
                    exam.playerScores[sid]=totalPending;
                    exam.totalEarned=totalPending;
                    App.Storage.setWrongSet(sid,bid,{wrongQuestionIds:[],lastAttempt:Date.now(),bankId:bid,pendingPoints:0,nextPointsPerQ:0,lastInitialPPQ:currentInitialPPQ});
                }else{
                    exam.results.forEach(function(r){r.pointsEarned=0});
                    studentResults[sid].pointsEarned=0;
                    exam.playerScores[sid]=0;
                    exam.totalEarned=0;
                    var wrongIds=[];
                    exam.results.forEach(function(r){if(!r.correct&&r.questionId)wrongIds.push(r.questionId)});
                    var nextPPQ=Math.max(1,Math.floor(ppq/2));
                    App.Storage.setWrongSet(sid,bid,{wrongQuestionIds:wrongIds,lastAttempt:Date.now(),bankId:bid,pendingPoints:originalPending+pendingPoints,nextPointsPerQ:nextPPQ,lastInitialPPQ:currentInitialPPQ});
                }
                var record={id:App.genId(),date:Date.now(),mode:exam.mode,participationType:exam.participationType||'personal',bankNames:bankNames,totalQuestions:exam.questions.length,totalCorrect:correct,totalEarned:exam.totalEarned,studentResults:studentResults,practicePassed:allCorrect,allParticipants:allParticipants||undefined};
                var records=App.Storage.getRecords();
                records.push(record);App.Storage.setRecords(records);
                if(allCorrect)App.Sync.syncNow();
                this.currentExam=null;
                App.Storage.clearExamProgress();
                if(allCorrect){
                    App.Effects.playVictory();App.Effects.spawnConfetti(window.innerWidth/2,window.innerHeight/3,80);
                    if(exam._isRetry){
                        App.Toast.show('补考通过！获得 '+exam.totalEarned+'⭐','success');
                    }
                    App.Exam.showRoundLeaderboard(record);
                }else{
                    App.Effects.playWrong();
                    var wrongCount=exam.questions.length-correct;
                    var wrongSet3=App.Storage.getWrongSet(sid,bid);
                    var totalPendingPts=wrongSet3?wrongSet3.pendingPoints||pendingPoints:pendingPoints;
                    var body='<p style="text-align:center;font-size:1.1em;padding:12px 0">答对 <b style="color:var(--success)">'+correct+'</b>/'+exam.questions.length+' 题<br>待结算积分：<b style="color:var(--accent-1)">'+totalPendingPts+'⭐</b>（暂不计入）<br><br>补考全对即可拿回 <b>'+totalPendingPts+'⭐</b><br><span style="color:var(--text-muted);font-size:0.9em">补考将重做错题并混入等量已答对题目</span></p>';
                    var footer='<button class="btn-secondary" onclick="App.Modal.close();App.Exam.showRoundLeaderboard(App.Exam._lastPracticeRecord)">查看详情</button><button class="btn-glow" onclick="App.Modal.close();App.Exam._startPracticeRetry()">🔄 立即补考</button>';
                    App.Exam._lastPracticeRecord=record;
                    App.Modal.open('📝 选择练习未通过',body,footer);
                }
                return;
            }
            if(exam.mode==='challenge'||exam.mode==='reading'){
                var sIds=Object.keys(studentResults);
                sIds.forEach(function(sid){
                    var sr=studentResults[sid];
                    if(sr.totalCount>0){
                        // 用真实比率判定分档，避免四舍五入把 99.5%→100、84.5%→85 造成错档
                        var ratio=sr.correctCount/sr.totalCount;
                        var bonusPerQ=0;
                        if(ratio===1)bonusPerQ=15;
                        else if(ratio>=0.95)bonusPerQ=12;
                        else if(ratio>=0.90)bonusPerQ=9;
                        else if(ratio>=0.85)bonusPerQ=6;
                        if(bonusPerQ>0){
                            var bonus=bonusPerQ*sr.correctCount;
                            sr.pointsEarned+=bonus;
                            exam.playerScores[sid]=(exam.playerScores[sid]||0)+bonus;
                            exam.totalEarned+=bonus;
                        }
                    }
                });
            }
            if(exam.mode==='pk'){
                var pScores=exam.playerScores||{};
                var pkIds=Object.keys(studentResults).filter(function(sid){return pScores[sid]!==undefined});
                if(pkIds.length>0){
                    var topId=pkIds.sort(function(a,b){return(pScores[b]||0)-(pScores[a]||0)})[0];
                    var pkBonus=studentResults[topId].correctCount*10;
                    if(pkBonus>0){
                        studentResults[topId].pointsEarned+=pkBonus;
                        exam.playerScores[topId]=(exam.playerScores[topId]||0)+pkBonus;
                        exam.totalEarned+=pkBonus;
                    }
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
                        if(bonus>0){sr.pointsEarned+=bonus;exam.playerScores[sid]=(exam.playerScores[sid]||0)+bonus;exam.totalEarned+=bonus}
                    });
                }
            }
            var record={id:App.genId(),date:Date.now(),mode:exam.mode,participationType:exam.participationType||'personal',bankNames:bankNames,totalQuestions:exam.questions.length,totalCorrect:correct,totalEarned:exam.totalEarned,studentResults:studentResults,allParticipants:allParticipants||undefined};
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
            var srs=record.studentResults||{};
            var gScores={};
            Object.keys(srs).forEach(function(sid){var sr=srs[sid];if(sr.group){gScores[sr.group]=(gScores[sr.group]||0)+(sr.pointsEarned||0)}});
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
            var srs=record.studentResults||{};
            var gScores={};
            Object.keys(srs).forEach(function(sid){var sr=srs[sid];if(sr.group){gScores[sr.group]=(gScores[sr.group]||0)+(sr.pointsEarned||0)}});
            var gNames=Object.keys(gScores);
            if(gNames.length===0){podium.innerHTML='';list.innerHTML='';return}
            var topGroup=gNames.sort(function(a,b){return gScores[b]-gScores[a]})[0];
            var groupMembers=Object.keys(srs).filter(function(sid){return srs[sid].group===topGroup}).map(function(k){return srs[k]}).sort(function(a,b){
                return(b.pointsEarned||0)-(a.pointsEarned||0);
            });
            var avMap=App.buildAvatarCharMap(groupMembers);
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
                if(topN[ri].pointsEarned===topN[ri-1].pointsEarned){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var s=topN[idx];
                var h=idx<rankHeights.length?rankHeights[idx]:35;
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                var pts=s.pointsEarned||0;
                podiumHTML+='<div class="podium-slot rank-'+rank+'">';
                podiumHTML+='<div class="podium-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div>';
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
                    var pts=s.pointsEarned||0;
                    listHTML+='<div class="flb-item"><div class="flb-rank">#'+rank+'</div><div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div><div class="flb-name">'+s.name+'</div><div class="flb-level">'+topGroup+'</div><div class="flb-pts">⭐ '+pts+'</div></div>';
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
            var sorted=Object.keys(srs).map(function(k){return srs[k]}).sort(function(a,b){
                return(b.pointsEarned||0)-(a.pointsEarned||0);
            });
            var avMap=App.buildAvatarCharMap(sorted);
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
                if(topN[ri].pointsEarned===topN[ri-1].pointsEarned){rankHeights[ri]=rankHeights[ri-1]}
            }
            var podiumHeights=[];
            for(var pi=0;pi<7;pi++){var ridx=podiumOrder[pi];podiumHeights.push(ridx<rankHeights.length?rankHeights[ridx]:0)}
            var podiumHTML='<div class="podium-stage">';
            for(var p=0;p<7;p++){
                var idx=podiumOrder[p];
                if(idx>=topN.length)continue;
                var s=topN[idx];
                var score=s.pointsEarned||0;
                var h=podiumHeights[p];
                var rank=idx+1;
                var rankLabel=idx<3?medals[idx]:'#'+rank;
                podiumHTML+='<div class="podium-slot rank-'+rank+'">';
                podiumHTML+='<div class="podium-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div>';
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
                    var score=s.pointsEarned||0;
                    var rank=podiumCount+i+1;
                    listHTML+='<div class="flb-item"><div class="flb-rank">#'+rank+'</div><div class="flb-avatar">'+(s.avatar?'<img src="'+s.avatar+'">':(avMap[s.id]||s.name.charAt(0)))+'</div><div class="flb-name">'+s.name+'</div><div class="flb-level">'+(s.group||'')+'</div><div class="flb-pts">⭐ '+score+'</div></div>';
                });
                listHTML+='</div></div>';
            }
            listHTML+='<div class="round-leaderboard-hint" onclick="App.Exam._showTotalLeaderboard()">👆 点击查看总积分榜（5秒后自动跳转）</div>';
            list.innerHTML=listHTML;
        }
    };

})();
