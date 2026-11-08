/* 题库类型注册表（常驻小模块）v2.030
   类型：single 单选题（旧题库默认） / pinyin 拼音题 / reading 课外阅读题
   各模式只能选到本模式允许的题库类型。 */
(function(){
    'use strict';
    var App=window.App=window.App||{};
    var TYPES={
        single:{id:'single',name:'单选题',icon:'📝',modes:['farm','challenge','pk','practice','smart'],desc:'A/B/C/D 四选一（旧题库自动归为单选）'},
        pinyin:{id:'pinyin',name:'拼音题',icon:'拼',modes:['pinyin'],desc:'给字/词/句，考察目标字的拼音拼写'},
        reading:{id:'reading',name:'课外阅读题',icon:'📖',modes:['reading'],desc:'先读文章，读完倒计时再答题'},
        fill:{id:'fill',name:'填空题',icon:'✍️',modes:['fill'],desc:'句子挖空，必须手写作答（禁键盘/语音）'}
    };
    var TONE={'ā':1,'á':2,'ǎ':3,'à':4,'ō':1,'ó':2,'ǒ':3,'ò':4,'ē':1,'é':2,'ě':3,'è':4,'ī':1,'í':2,'ǐ':3,'ì':4,'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4};
    var FINALS=['a','ai','an','ang','ao','e','ei','en','eng','er','ie','i','in','ing','o','ong','ou','iu','u','un','ui','ü','üe','üan','ün','zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'];
    App.BankTypes={
        TYPES:TYPES,
        ALL:['single','pinyin','reading','fill'],
        of:function(bank){var t=bank&&bank.type;if(TYPES[t])return t;return this.guess(bank)},
        // 题库文件名标签：名字.__题型.__科目.__年级（第一个标签固定是题型）
        TAG_SEP:'.__',
        cleanTag:function(s){
            return String(s||'').replace(/[.\\/\s]+/g,'_').replace(/^_+|_+$/g,'').slice(0,20);
        },
        tagsOfName:function(name){
            var parts=String(name||'').split('.__');
            if(parts.length<2)return [];
            var first=parts[1];
            if(!TYPES[first])return [];
            var tags=[first];
            for(var i=2;i<parts.length;i++){var x=this.cleanTag(parts[i]);if(x)tags.push(x)}
            return tags;
        },
        stripAllTags:function(name){
            return String(name||'').split('.__')[0]||String(name||'');
        },
        fileWithTags:function(name,tags){
            var self=this,base=this.stripAllTags(name);
            var arr=(tags||[]).map(function(x){return self.cleanTag(x)}).filter(function(x){return !!x});
            return base+(arr.length?'.__'+arr.join('.__'):'');
        },
        tagsOfBank:function(bank){
            if(!bank)return [];
            var self=this;
            var arr=(bank.tags||[]).map(function(x){return self.cleanTag(x)}).filter(function(x){return !!x});
            var ty=this.of(bank);
            if(!arr.length||!TYPES[arr[0]])arr=[ty];
            else if(arr[0]!==ty)arr[0]=ty;
            return arr;
        },
        suffixOf:function(type){return this.TYPES[type]?'.__'+type:''},
        stripSuffix:function(name){return this.stripAllTags(name)},
        fromFileName:function(name){var t=this.tagsOfName(name);return t.length?t[0]:''},
        withSuffix:function(name,type){return this.fileWithTags(name,[type])},
        // 科目猜测（用于给老题库补标签；猜不到归“未分类”）
        SUBJECTS:['语文','数学','道法','道德','科学','英语','音乐','美术','体育','信息','历史','地理','生物','物理','化学'],
        guessSubject:function(name,type){
            var s=String(name||'');
            var hit=this.SUBJECTS.filter(function(x){return s.indexOf(x)>=0})[0];
            if(!hit){
                // 阅读/拼音都是语文，猜不到科目时按语文归，避免掉进“未分类”
                if(type==='reading'||type==='pinyin')return '语文';
                return '未分类';
            }
            if(hit==='道德')return '道法';
            return hit;
        },
        // 老题库/云端旧文件可能没有 type：按内容兜底判断，避免“阅读题库跑到选择练习里”
        guess:function(bank){
            if(!bank)return 'single';
            if(bank.article&&String(bank.article).trim())return 'reading';
            var qs=bank.questions||[];
            if(qs.length){
                var q=qs[0]||{};
                if(q.char&&q.pinyin)return 'pinyin';
                if(q.answers||/_{2,}/.test(String(q.text||'')))return 'fill';
            }
            return 'single';
        },
        info:function(id){return TYPES[id]||TYPES.single},
        allowedForMode:function(mode){
            for(var k in TYPES){if(TYPES[k].modes.indexOf(mode)>=0)return k}
            return 'single';
        },
        filter:function(banks,mode){
            var t=this.allowedForMode(mode),self=this;
            return (banks||[]).filter(function(b){return self.of(b)===t});
        },
        labelOf:function(bank){return TYPES[this.of(bank)].name},
        // 模板文本（导出/复制/导入提示共用）
        template:function(type){
            if(type==='fill')return '我的填空题库\n春天来了，小草____了。|绿\n我们的祖国真____大。|伟';
            if(type==='pinyin')return '我的拼音题库\n春天来了|春|chūn\n月亮挂在天上|月|yuè\n小鸟在唱歌|鸟|niǎo';
            if(type==='reading')return '我的阅读题库\n【文章】\n春天来了，小草偷偷地从土里钻出来，嫩嫩的，绿绿的。花园里的花开了，红的、白的、黄的，真好看。小鸟在树上唱歌，蝴蝶在花丛中飞舞。\n【题目】\n文章写的是哪个季节？|春天|夏天|秋天|冬天|A|10\n小草是什么颜色的？|红的|绿的|黄的|白的|B|10';
            return '我的单选题库\n1+1=?|1|2|3|4|B|10\n中国的首都是?|上海|北京|广州|深圳|B|10';
        },
        templateHelp:function(type){
            if(type==='fill')return '第一行：题库名称（可不写）<br>之后每行：<code>题干|答案1|答案2…</code><br>题干里用至少两个下划线 <code>____</code> 表示一个空，空的数量要与答案数量一致；一个空填一个字/词。<br>例：<code>春天来了，小草____了。|绿</code>';
            if(type==='pinyin')return '第一行：题库名称（可不写）<br>之后每行：<code>题面|目标字|拼音</code><br>要求：目标字必须出现在题面里，拼音要带声调（ā á ǎ à）。';
            if(type==='reading')return '第一行：题库名称（可不写）<br>然后写 <code>【文章】</code>，下一行起是文章正文（可多行）<br>再写 <code>【题目】</code>，之后每行：<code>题目|A|B|C|D|正确答案|分值</code>';
            return '第一行：题库名称（可不写）<br>之后每行：<code>题目|选项A|选项B|选项C|选项D|正确答案|分值</code>';
        },
        parse:function(type,text){
            var out={name:'',article:'',questions:[],errors:[]};
            if(!text||!String(text).trim()){out.errors.push('内容为空');return out}
            var lines=String(text).replace(/\r/g,'').split('\n');
            var start=0;
            if(lines.length&&lines[0].trim()&&lines[0].indexOf('|')<0&&lines[0].indexOf('【')<0){out.name=lines[0].trim();start=1}
            if(type==='pinyin'){
                for(var i=start;i<lines.length;i++){
                    var line=lines[i].trim();if(!line)continue;
                    var p=line.split('|');
                    if(p.length<3){out.errors.push('第'+(i+1)+'行格式不对');continue}
                    var tx=p[0].trim(),ch=p[1].trim(),py=p[2].trim();
                    if(!tx||!ch||!py||tx.indexOf(ch)<0){out.errors.push('第'+(i+1)+'行目标字不在题面里');continue}
                    var hasTone=false,base='';
                    for(var k=0;k<py.length;k++){var c=py[k];if(TONE[c]){hasTone=true;base+='a'}else{base+=c}}
                    base=base.replace(/v/g,'ü');
                    if(!hasTone){out.errors.push('第'+(i+1)+'行拼音没带声调');continue}
                    out.questions.push({id:'p'+i,text:tx,char:ch,pinyin:py,points:10});
                }
                return out;
            }
            if(type==='fill'){
                for(var fi=start;fi<lines.length;fi++){
                    var fl=lines[fi].trim();if(!fl)continue;
                    var fp=fl.split('|');
                    if(fp.length<2){out.errors.push('第'+(fi+1)+'行格式不对');continue}
                    var ftx=fp[0].trim();
                    var fans=fp.slice(1).map(function(x){return x.trim()}).filter(function(x){return !!x});
                    var blanks=ftx.match(/_{2,}/g)||[];
                    if(!blanks.length){out.errors.push('第'+(fi+1)+'行题干没有 ____ 空位');continue}
                    if(blanks.length!==fans.length){out.errors.push('第'+(fi+1)+'行空位数('+blanks.length+')与答案数('+fans.length+')不一致');continue}
                    out.questions.push({id:'f'+fi,text:ftx,answers:fans,points:10});
                }
                return out;
            }
            if(type==='reading'){
                var mode='none',art=[];
                for(var j=start;j<lines.length;j++){
                    var l=lines[j],t=l.trim();
                    if(t==='【文章】'||t==='#文章'){mode='article';continue}
                    if(t==='【题目】'||t==='#题目'){mode='question';continue}
                    if(!t)continue;
                    if(mode==='article'){art.push(t);continue}
                    if(mode==='question'){
                        var q=l.split('|');
                        if(q.length<6){out.errors.push('第'+(j+1)+'行题目格式不对');continue}
                        out.questions.push({id:'r'+j,text:q[0].trim(),options:{A:q[1].trim(),B:q[2].trim(),C:q[3].trim(),D:q[4].trim()},answer:q[5].trim().toUpperCase(),points:parseInt(q[6])||10});
                    }
                }
                out.article=art.join('\n');
                if(!out.article)out.errors.push('缺少【文章】内容');
                if(!out.questions.length)out.errors.push('缺少【题目】');
                return out;
            }
            for(var m=start;m<lines.length;m++){
                var ln=lines[m].trim();if(!ln)continue;
                var a=ln.split('|');
                if(a.length<6){out.errors.push('第'+(m+1)+'行格式不对');continue}
                out.questions.push({id:'s'+m,text:a[0].trim(),options:{A:a[1].trim(),B:a[2].trim(),C:a[3].trim(),D:a[4].trim()},answer:a[5].trim().toUpperCase(),points:parseInt(a[6])||10});
            }
            return out;
        }
    };
})();
