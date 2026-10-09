'use strict';

// ===== 文件管理 6.0 - 专用同步脚本（S/E双号 · 两阶段提交 · 认证权限 · 表头防护 · 整JSON列主力） =====
// ★版本定稿(改脚本者必读): 自 v5.4 一次性定稿为 6.0，文件名统一为「文件管理6.0专用同步脚本.js」。
//   此后每次修改统一 +0.01（6.0→6.01→6.02…），不再沿用旧进位规则。
//   改完必须同步 文件管理6.0.HTML / 文件管理说明书6.0.HTML 三处产品版本号，保持一致。
// 表头：拥有者, ID, 文件名, 起点号, 终点号, 状态, 文件夹路径, 最后上传发起时间, 最后编辑时间, 同步时间, MD5, 内容字符数, 创建日期, 文件JSON, 锁登记处, 上锁时刻
//
// v5.1 核心改动（整JSON列版，从 v5.0 升级）：
// - 新增最右列「文件JSON」存放整个文件JSON字符串（含内容、S、E、文件名、路径、拥有者、时间戳等全部信息），作为云端主体
// - 「文件JSON」列右侧空白区为延伸/生长区；今后新增功能列只能加在文件JSON列左边，不能往右加
// - 其他列（文件名/路径/字符数/S/E/拥有者/状态等）仅为展示/索引列，由本地拆好字段传入，云端只照写、不再解析JSON
// - 云端精简点仅为「不再负责从JSON拆分字段」，其余职责（两阶段S/E、锁、冲突、读取、分片拼接）全部保留
//
// v5.0 核心改动（新型存储逻辑，从 v4.0 升级，加入表头防护）：
// - 版本机制由"单版本号三号制"改为"S起点/E终点双号随身携带"
//   · 凡存云端的正牌文件，起点号==终点号（两号一致）
//   · 本地编辑：起点号不变，终点号+1
//   · 同步触发判定：起点号≠终点号 即本地已修改
// - 上传走"两阶段提交"：
//   阶段1 同步提交：本地传"冻结副本(S,E)"，云端判定继承性，
//          合法则先收为【临时行】(ID加后缀，状态=临时，存待转正新内容)
//   阶段2 转正确认：本地已把起点号改成云端即将确认的新版号，再通知云端，
//          云端校验未被抢先则把临时行内容转录到正牌行并转正，删临时行
// - 全新文件：S=E=0，首次同步云端无ID则直接收为正牌
// - 临时行超时未转正（默认60s）自动删除
//
// v3.0 安全设计保留：
// - 身份认证：所有操作必须传用户名+密码，在"账号管理"表核对
// - 权限控制：用户只能读写自己拥有的文件，公共文件（无拥有者）所有人可读写
// - 写操作自动抢锁，防止并发冲突
// - 底层读写函数不对外暴露
// - 锁60秒自动过期，防止死锁

var argv = Context.argv || {};
var sheetName = argv["表格名"] || "";
var action = argv["操作"] || "";

if(!sheetName){
  return {status:"error", tongzhi:"缺少参数: 表格名"};
}

var sheet = Application.Sheets(sheetName);
if(!sheet){
  return {status:"error", tongzhi:"未找到表格: " + sheetName};
}

var maxRow = sheet.UsedRange.Row + sheet.UsedRange.Rows.Count - 1;
var maxCol = sheet.UsedRange.Column + sheet.UsedRange.Columns.Count - 1;

// ========== 身份认证 ==========

var currentUser = argv["用户名"] || "";
var currentPassword = argv["密码"] || "";
var isAuthenticated = false;

// 免认证操作（不需要登录）
var NO_AUTH_ACTIONS = ["版本"];

function authenticate(username, password){
  if(!username || !password){
    return {ok:false, msg:"缺少用户名或密码"};
  }
  // 查找"账号管理"表
  var authSheet = Application.Sheets("账号管理");
  if(!authSheet){
    return {ok:false, msg:"未找到账号管理表"};
  }
  var authMaxRow = authSheet.UsedRange.Row + authSheet.UsedRange.Rows.Count - 1;
  var authMaxCol = authSheet.UsedRange.Column + authSheet.UsedRange.Columns.Count - 1;

  // 读取表头，找到"账号"和"密码"列
  var accountCol = 0;
  var passwordCol = 0;
  for(var c=1;c<=authMaxCol;c++){
    var header = String(authSheet.Cells(1,c).Value2 || "").trim();
    if(header === "账号") accountCol = c;
    if(header === "密码") passwordCol = c;
  }
  if(!accountCol || !passwordCol){
    return {ok:false, msg:"账号管理表缺少账号或密码列"};
  }

  // 逐行核对
  for(var r=2;r<=authMaxRow;r++){
    var acc = String(authSheet.Cells(r, accountCol).Value2 || "").trim();
    var pwd = String(authSheet.Cells(r, passwordCol).Value2 || "").trim();
    if(acc === username && pwd === password){
      return {ok:true, msg:"认证成功"};
    }
  }
  return {ok:false, msg:"账号或密码错误"};
}

// 执行认证（版本操作除外）
if(NO_AUTH_ACTIONS.indexOf(action) === -1){
  var authResult = authenticate(currentUser, currentPassword);
  if(!authResult.ok){
    return {status:"error", tongzhi:"认证失败: " + authResult.msg, 需要认证:true};
  }
  isAuthenticated = true;
}

// ========== 权限检查辅助函数 ==========

// 检查用户是否有权访问某行数据
function canAccessRow(rowData, username){
  var owner = (rowData["拥有者"] || "").trim();
  // 无拥有者=公共文件，所有人可访问
  if(!owner) return true;
  // 拥有者本人可访问
  if(owner === username) return true;
  // 其他人的私有文件不可访问
  return false;
}

// 检查用户是否有权写入某行数据
function canWriteRow(rowData, username){
  return canAccessRow(rowData, username);
}

// 过滤数据：只返回用户有权访问的行
function filterByPermission(rows, username){
  var result = [];
  for(var i=0;i<rows.length;i++){
    if(canAccessRow(rows[i], username)){
      result.push(rows[i]);
    }
  }
  return result;
}

// ========== 内部工具函数（不对外暴露） ==========

function getColMap(){
  var map = {};
  for(var c=1;c<=maxCol;c++){
    var name = String(sheet.Cells(1,c).Value2 || "").trim();
    if(name) map[name] = c;
  }
  return map;
}

function getCellValue(r,c){
  var v = sheet.Cells(r,c).Value2;
  if(v === undefined || v === null) return "";
  return String(v).trim();
}

// 内部：按ID查找行号，返回0表示未找到
function findRowById(fileId){
  var colMap = getColMap();
  var idCol = colMap["ID"];
  if(!idCol) return 0;
  for(var r=2;r<=maxRow;r++){
    if(getCellValue(r, idCol) === fileId) return r;
  }
  return 0;
}

// 内部：读取指定行全部数据
function readRow(r){
  var colMap = getColMap();
  var row = {};
  for(var name in colMap){
    row[name] = getCellValue(r, colMap[name]);
  }
  return row;
}

// 内部：向指定行写入文件数据（只写表头内存在的列，自动写入拥有者）
function writeRowData(rowNum, fileData, username){
  var colMap = getColMap();
  var allowedCols = ["拥有者","ID","文件名","起点号","终点号","状态","文件夹路径","最后上传发起时间","最后编辑时间","同步时间","MD5","内容字符数","创建日期","文件JSON"];
  for(var i=0;i<allowedCols.length;i++){
    var name = allowedCols[i];
    // 拥有者：如果数据没传，自动填入当前用户
    if(name === "拥有者" && username){
      if(!fileData.hasOwnProperty("拥有者") || !fileData["拥有者"]){
        fileData["拥有者"] = username;
      }
    }
    if(fileData.hasOwnProperty(name) && colMap.hasOwnProperty(name)){
      sheet.Cells(rowNum, colMap[name]).NumberFormatLocal = "@";
      sheet.Cells(rowNum, colMap[name]).Value2 = String(fileData[name]);
    }
  }
}

// 内部：清空指定行
function clearRow(rowNum){
  for(var c=1;c<=maxCol;c++){
    sheet.Cells(rowNum,c).Value2 = "";
  }
}

// 内部：找到第一个空行号
function findEmptyRow(){
  var colMap = getColMap();
  var idCol = colMap["ID"];
  for(var r=2;r<=maxRow;r++){
    if(!getCellValue(r, idCol)) return r;
  }
  return maxRow + 1;
}

// 内部：读取全部数据
function readAllData(){
  var headers = [];
  for(var c=1;c<=maxCol;c++){
    headers.push(getCellValue(1,c));
  }
  var rows = [];
  for(var r=2;r<=maxRow;r++){
    var row = {};
    var hasData = false;
    for(var c=1;c<=maxCol;c++){
      var v = getCellValue(r,c);
      row[headers[c-1] || ("列"+c)] = v;
      if(v) hasData = true;
    }
    if(hasData) rows.push(row);
  }
  return {headers:headers, rows:rows};
}

// 内部：按列名查找
function findByColumn(colName, keyword){
  var colMap = getColMap();
  if(!colMap.hasOwnProperty(colName)){
    return {status:"error", tongzhi:"未找到列: " + colName};
  }
  var colIdx = colMap[colName];
  var results = [];
  for(var r=2;r<=maxRow;r++){
    if(getCellValue(r, colIdx) === keyword){
      var row = readRow(r);
      row._行号 = r;
      results.push(row);
    }
  }
  return results;
}

// 内部：模糊查找
function fuzzyFindByColumn(colName, keyword){
  var colMap = getColMap();
  if(!colMap.hasOwnProperty(colName)){
    return {status:"error", tongzhi:"未找到列: " + colName};
  }
  var colIdx = colMap[colName];
  var results = [];
  for(var r=2;r<=maxRow;r++){
    var v = getCellValue(r, colIdx);
    if(v.indexOf(keyword) !== -1){
      var row = readRow(r);
      row._行号 = r;
      results.push(row);
    }
  }
  return results;
}

// ========== 抢锁/解锁核心函数 ==========

var LOCK_EXPIRE_SECONDS = 60;
var LOCK_RENEW_THRESHOLD = 3;

function getNowTimestamp(){
  var d = new Date();
  var pad = function(n){return n<10?'0'+n:''+n;};
  return ''+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}

function parseLockTime(timeStr){
  if(!timeStr||timeStr.length<14) return null;
  var y=parseInt(timeStr.substr(0,4));
  var m=parseInt(timeStr.substr(4,2))-1;
  var d=parseInt(timeStr.substr(6,2));
  var h=parseInt(timeStr.substr(8,2));
  var mi=parseInt(timeStr.substr(10,2));
  var s=parseInt(timeStr.substr(12,2));
  return new Date(y,m,d,h,mi,s);
}

function getLockRemainingSeconds(lockTimeStr){
  var lockDate = parseLockTime(lockTimeStr);
  if(!lockDate) return 0;
  var now = new Date();
  var elapsed = (now.getTime()-lockDate.getTime())/1000;
  return Math.max(0, LOCK_EXPIRE_SECONDS - elapsed);
}

function tryAcquireLock(locker){
  var colMap = getColMap();
  var lockCol = colMap["锁登记处"];
  var timeCol = colMap["上锁时刻"];
  if(!lockCol||!timeCol){
    return {status:"error", tongzhi:"表头缺少锁登记处或上锁时刻列"};
  }

  var currentLocker = getCellValue(2, lockCol);
  var currentLockTime = getCellValue(2, timeCol);

  if(!currentLocker){
    return doAcquireLock(locker, colMap, lockCol, timeCol);
  }

  if(currentLocker === locker){
    var remaining = getLockRemainingSeconds(currentLockTime);
    if(remaining <= LOCK_RENEW_THRESHOLD){
      return doAcquireLock(locker, colMap, lockCol, timeCol);
    }
    var newTime = getNowTimestamp();
    sheet.Cells(2, timeCol).NumberFormatLocal = "@";
    sheet.Cells(2, timeCol).Value2 = newTime;
    return {status:"success", tongzhi:"续期成功", 锁登记处:locker, 上锁时刻:newTime, 剩余秒:LOCK_EXPIRE_SECONDS};
  }

  var remaining = getLockRemainingSeconds(currentLockTime);
  if(remaining <= 0){
    sheet.Cells(2, lockCol).Value2 = "";
    sheet.Cells(2, timeCol).Value2 = "";
    return doAcquireLock(locker, colMap, lockCol, timeCol);
  }
  return {status:"error", tongzhi:"锁被占用: "+currentLocker, 判定结果:"抢锁失败", 锁登记处:currentLocker, 上锁时刻:currentLockTime, 剩余秒:Math.ceil(remaining)};
}

function doAcquireLock(locker, colMap, lockCol, timeCol){
  var newTime = getNowTimestamp();
  sheet.Cells(2, timeCol).NumberFormatLocal = "@";
  sheet.Cells(2, timeCol).Value2 = newTime;
  sheet.Cells(2, lockCol).NumberFormatLocal = "@";
  sheet.Cells(2, lockCol).Value2 = locker;

  var verifyLocker = getCellValue(2, lockCol);
  if(verifyLocker === locker){
    return {status:"success", tongzhi:"抢锁成功", 锁登记处:locker, 上锁时刻:newTime, 剩余秒:LOCK_EXPIRE_SECONDS};
  }else{
    return {status:"error", tongzhi:"抢锁验证失败，被其他设备抢占", 判定结果:"抢锁失败", 锁登记处:verifyLocker};
  }
}

function tryReleaseLock(locker){
  var colMap = getColMap();
  var lockCol = colMap["锁登记处"];
  var timeCol = colMap["上锁时刻"];
  if(!lockCol||!timeCol){
    return {status:"error", tongzhi:"表头缺少锁登记处或上锁时刻列"};
  }

  var currentLocker = getCellValue(2, lockCol);
  if(!currentLocker){
    return {status:"success", tongzhi:"锁已为空，无需解锁"};
  }
  if(currentLocker !== locker){
    return {status:"error", tongzhi:"非锁持有者，无法解锁", 锁登记处:currentLocker};
  }

  sheet.Cells(2, lockCol).Value2 = "";
  sheet.Cells(2, timeCol).Value2 = "";
  return {status:"success", tongzhi:"解锁成功"};
}

// ========== 写操作自动抢锁 ==========

var WRITE_ACTIONS = ["同步提交","转正确认","清理临时","强制覆盖云端","删除行","批量写入"];
var isWriteAction = false;
for(var wi=0;wi<WRITE_ACTIONS.length;wi++){
  if(action === WRITE_ACTIONS[wi]){isWriteAction=true;break;}
}

if(isWriteAction){
  var deviceLocker = argv["锁登记处"] || argv["设备标识"] || "";
  if(!deviceLocker){
    return {status:"error", tongzhi:"写操作必须提供设备标识(锁登记处)", 判定结果:"抢锁失败"};
  }
  var lockResult = tryAcquireLock(deviceLocker);
  if(lockResult.status !== "success"){
    return {status:"error", tongzhi:"抢锁失败: "+lockResult.tongzhi, 判定结果:"抢锁失败", 锁登记处:lockResult.锁登记处||"", 剩余秒:lockResult.剩余秒||0};
  }
}

// ========== 对外业务操作 ==========

if(action === "版本"){
  return {status:"success", tongzhi:"文件管理6.0 专用同步脚本(认证权限版·S/E双号两阶段提交·表头防护·文件JSON列主力·批量同步·批量硬限制)", 版本号:"6.03", 操作列表:["读取全部","读取索引","查找","模糊查找","获取维度","获取表头","初始化表头","同步提交","转正确认","清理临时","智能下载","批量读取","强制覆盖云端","抢锁","解锁","删除行","批量写入","版本"]};
}

// 读取全部（只读，按权限过滤）— 包含内容，体积大
if(action === "读取全部"){
  var data = readAllData();
  var filteredRows = filterByPermission(data.rows, currentUser);
  return {
    status: "success",
    tongzhi: "读取完成(权限过滤后)",
    行数: filteredRows.length,
    列数: data.headers.length,
    表头: data.headers,
    数据: filteredRows
  };
}

// 读取索引（只读，按权限过滤）— 只返回轻量字段，不含内容，刷新列表用
if(action === "读取索引"){
  var colMap = getColMap();
  var lightCols = ["拥有者","ID","文件名","起点号","终点号","状态","文件夹路径","最后编辑时间","同步时间","内容字符数"];
  var rows = [];
  for(var r=2;r<=maxRow;r++){
    var idVal = colMap["ID"] ? getCellValue(r, colMap["ID"]) : "";
    if(!idVal || idVal.trim()==="") continue;
    var row = {};
    var hasData = false;
    for(var li=0;li<lightCols.length;li++){
      var cn = lightCols[li];
      if(colMap[cn]){
        var v = getCellValue(r, colMap[cn]);
        row[cn] = v;
        if(v) hasData = true;
      }
    }
    if(hasData && canAccessRow(row, currentUser)) rows.push(row);
  }
  return {
    status: "success",
    tongzhi: "索引读取完成(权限过滤后)",
    行数: rows.length,
    数据: rows
  };
}

// 查找（只读，按权限过滤）
if(action === "查找"){
  var colName = argv["列名"] || "";
  var keyword = argv["关键字"] || "";
  var results = findByColumn(colName, keyword);
  if(results.status === "error"){
    return {status:"error", tongzhi:results.tongzhi, 可用列:Object.keys(getColMap())};
  }
  var filtered = filterByPermission(results, currentUser);
  return {
    status: "success",
    tongzhi: filtered.length > 0 ? "找到"+filtered.length+"条" : "未找到(或无权限)",
    匹配数: filtered.length,
    数据: filtered
  };
}

// 模糊查找（只读，按权限过滤）
if(action === "模糊查找"){
  var colName = argv["列名"] || "";
  var keyword = argv["关键字"] || "";
  var results = fuzzyFindByColumn(colName, keyword);
  if(results.status === "error"){
    return {status:"error", tongzhi:results.tongzhi, 可用列:Object.keys(getColMap())};
  }
  var filtered = filterByPermission(results, currentUser);
  return {
    status: "success",
    tongzhi: filtered.length > 0 ? "找到"+filtered.length+"条" : "未找到(或无权限)",
    匹配数: filtered.length,
    数据: filtered
  };
}

// 获取维度（只读，安全）
if(action === "获取维度"){
  return {
    status: "success",
    tongzhi: "获取完成",
    最大行: maxRow,
    最大列: maxCol,
    表头: Object.keys(getColMap())
  };
}

// 获取表头（只读，安全）
if(action === "获取表头"){
  return {
    status: "success",
    tongzhi: "获取完成",
    表头: Object.keys(getColMap())
  };
}

// 初始化表头（仅首次使用，安全：只写第1行）
if(action === "初始化表头"){
  var headers = argv["表头"] || [];
  if(!headers || headers.length === 0){
    return {status:"error", tongzhi:"缺少参数: 表头(数组)"};
  }
  // 防呆保护：表头已存在时拒绝覆盖，防止任何客户端误写导致表头错乱（需强制请传 强制:true）
  var existingHeaders = Object.keys(getColMap());
  var forceInit = argv["强制"] === "true" || argv["强制"] === true;
  if(existingHeaders.length > 0 && !forceInit){
    return {status:"error", tongzhi:"表头已存在，已拒绝覆盖(如确需重写请传 强制:true)", 现有表头: existingHeaders};
  }
  for(var i=0;i<headers.length;i++){
    sheet.Cells(1, i+1).NumberFormatLocal = "@";
    sheet.Cells(1, i+1).Value2 = String(headers[i]);
  }
  return {
    status: "success",
    tongzhi: "表头初始化完成",
    表头: headers
  };
}

// ========== 核心业务操作（带安全约束+权限控制） ==========

// ========== S/E 两阶段提交·阶段1：同步提交（原"智能上传"改造，v5.3支持批量） ==========
// 核心思想（存储测试·新型存储逻辑）：
//   · 本地传的是"冻结副本"：副本S=本地旧起点号，副本E=本地当前终点号，两号固定不再变
//   · 云端判定继承性：
//       - 云端无此ID(且全新标识) → 全新文件，直接收为正牌行，S=E=上传的E
//       - 云端有此ID，且副本S == 云端正牌S → 根正苗红，可继承 → 先收为【临时行】
//       - 云端有此ID，且副本S != 云端正牌S → 非正统，宣布冲突
//   · 收为临时行后，把"即将确认的新版号"传回本地，让本地改起点号
//   · 批量：argv["文件列表"]=[{ID,起点号,终点号,本地新文件标识,数据},...] 时，逐项分别判定，汇总一条回执
//        单文件标量模式（argv.ID）仍然向前兼容，走同一判定
//   · 批量硬限制：同一批最多 MAX_BATCH_FILES 个；同一批内容总字符数最大 MAX_BATCH_CHARS。
//        超限云端一律拒绝执行（防外人恶意脚本一批海量冲击；正常客户端本地发起本就会遵守）
var MAX_BATCH_FILES = 200;        // 同一批最多文件数
var MAX_BATCH_CHARS = 10*1024*1024; // 同一批内容总字符数上限（10MB）

// 批量限制校验：通过返回 null，超限返回拒绝错误对象
function checkBatchLimits(batchList){
  if(batchList.length > MAX_BATCH_FILES){
    return {status:"error", tongzhi:"批量文件数超过上限(同一批最多"+MAX_BATCH_FILES+"个)，已拒绝", 拒绝原因:"批量文件数超限", 批量数:batchList.length, 上限:MAX_BATCH_FILES};
  }
  var totalChars = 0;
  for(var ci=0;ci<batchList.length;ci++){
    var item = batchList[ci] || {};
    var d = item["数据"];
    if(d && typeof d === "object"){
      totalChars += String(d["内容"]||"").length;
      totalChars += String(d["文件JSON"]||"").length;
      totalChars += String(d["内容字符数"]||"").length;
    } else {
      totalChars += String(item["文件JSON"]||"").length;
    }
  }
  if(totalChars > MAX_BATCH_CHARS){
    return {status:"error", tongzhi:"批量内容超过上限(同一批总字符数最大10MB)，已拒绝", 拒绝原因:"批量内容超限", 总字符数:totalChars, 上限:MAX_BATCH_CHARS};
  }
  return null;
}

function doSyncSubmitOne(item, username){
  var fileId = String(item["ID"] || "");
  var copyS = parseInt(item["起点号"]) || 0;      // 冻结副本的起点号
  var copyE = parseInt(item["终点号"]) || 0;      // 冻结副本的终点号
  var isNewFile = item["本地新文件标识"] === "true" || item["本地新文件标识"] === true;
  var fileData = item["数据"] || {};

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID", 判定结果:"标识错乱", ID:""};
  }

  var colMap = getColMap();
  var cloudRow = findRowById(fileId);
  var cloudData = null;
  var cloudS = 0;

  if(cloudRow > 0){
    cloudData = readRow(cloudRow);
    cloudS = parseInt(cloudData["起点号"]) || 0;
    if(!canWriteRow(cloudData, username)){
      return {status:"error", tongzhi:"无权修改此文件(拥有者: "+(cloudData["拥有者"]||"无")+")", 判定结果:"权限不足", ID:fileId};
    }
  }

  // ---- 全新文件（本地S=E=0，从未上云） ----
  if(isNewFile){
    var targetRow = cloudRow > 0 ? cloudRow : findEmptyRow();
    // 云端无此ID → 全新接收；有ID但仍打新标识 → 覆盖接收（导入/复制等场景）
    var finalVer = copyE;   // 全新文件：云端基线即本地上传副本的终点号
    fileData["ID"] = fileId;
    fileData["起点号"] = String(finalVer);
    fileData["终点号"] = String(finalVer);
    fileData["状态"] = "官方";
    writeRowData(targetRow, fileData, username);

    return {
      status: "success",
      tongzhi: "全新文件接收成功",
      判定结果: "全新接收",
      云端版本号: finalVer,
      起点号: finalVer,
      终点号: finalVer,
      行号: targetRow,
      ID: fileId
    };
  }

  // ---- 标识错乱保护 ----
  if(copyE === 0){
    return {status:"error", tongzhi:"此文件标识错乱，缺少终点号", 判定结果:"标识错乱", ID:fileId};
  }

  // ---- 已上云文件：判定继承性 ----
  if(cloudRow === 0){
    return {status:"error", tongzhi:"云端无此ID但本地非全新文件，数据异常", 判定结果:"标识错乱", ID:fileId};
  }

  // 本地未修改：副本S==副本E，无需上传（但云端若更新则走下载）
  if(copyS === copyE){
    return {
      status: "success",
      tongzhi: "本地两个号一致，未发生修改，无需上传",
      判定结果: "无需上传",
      云端版本号: cloudS,
      起点号: cloudS,
      ID: fileId
    };
  }

  // 本地已修改（copyE>copyS），判定是否正统继承
  if(copyS === cloudS){
    // 根正苗红 → 收为临时行（ID加后缀TL，状态=临时，存待转正新内容）
    var tmpId = fileId + "_TL";
    var tmpRow = findRowById(tmpId);
    if(tmpRow === 0) tmpRow = findEmptyRow();

    var finalVer = copyE;                          // 临时行 S:=E（小变大）
    fileData["ID"] = tmpId;
    fileData["文件名"] = fileData["文件名"] || (cloudData["文件名"]||"");
    fileData["起点号"] = String(finalVer);
    fileData["终点号"] = String(finalVer);
    fileData["状态"] = "临时";
    // 临时行也继承原拥有者与路径，便于转正时至少保留文件名等
    if(!fileData["文件夹路径"]) fileData["文件夹路径"] = cloudData["文件夹路径"]||"";
    if(!fileData["创建日期"]) fileData["创建日期"] = cloudData["创建日期"]||"";
    fileData["最后上传发起时间"] = getNowTimestamp();   // 临时行建立时刻，供超时清理判定
    writeRowData(tmpRow, fileData, username);

    return {
      status: "success",
      tongzhi: "已收为临时文件，请本地将起点号改为新版号后转正",
      判定结果: "收为临时",
      临时行号: tmpRow,
      临时ID: tmpId,
      云端版本号: finalVer,       // 传给本地：即将确认的新版号
      终点号: finalVer,
      超时秒: argv["临时超时秒"] || 60,
      ID: fileId
    };
  }

  // 副本S != 云端正牌S → 不是正统继承 → 冲突
  return {
    status: "conflict",
    tongzhi: "本地不是正统继承(本地起点号v"+copyS+"!=云端正牌v"+cloudS+")，宣布冲突版本",
    判定结果: "同步冲突",
    本地起点号: copyS,
    本地终点号: copyE,
    云端版本号: cloudS,
    阶数: 1,
    ID: fileId
  };
}

if(action === "同步提交"){
  // ---- 批量模式：一次回执返回全部文件判定 ----
  if(Array.isArray(argv["文件列表"])){
    var batchList = argv["文件列表"];
    // 批量硬限制：超限直接拒绝，不做任何写操作
    var limitErr = checkBatchLimits(batchList);
    if(limitErr) return limitErr;
    var batchRes = [];
    for(var bi=0;bi<batchList.length;bi++){
      batchRes.push(doSyncSubmitOne(batchList[bi], currentUser));
    }
    return {
      status: "success",
      tongzhi: "批量同步提交完成，共"+batchRes.length+"个",
      批次数: batchRes.length,
      结果: batchRes
    };
  }
  // ---- 标量模式（向前兼容） ----
  return doSyncSubmitOne(argv, currentUser);
}

// ========== S/E 两阶段提交·阶段2：转正确认（v5.3支持批量） ==========
// 本地收到"收为临时"后，已把本地起点号改为云端传回的新版号(finalVer)，
// 再通知云端"我已改好"。云端校验临时行仍在且未被抢先，则转正牌。
// 批量：argv["文件列表"]=[{ID,起点号},...] 时，逐项校验转正，汇总一条回执；标量模式仍兼容。
function doPromoteOne(item, username){
  var fileId = String(item["ID"] || "");
  var localS = parseInt(item["起点号"]) || 0;      // 本地已改好的起点号
  var tmpId = fileId + "_TL";

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID", 判定结果:"标识错乱", ID:""};
  }

  var tmpRow = findRowById(tmpId);
  if(tmpRow === 0){
    // 临时行已不存在（被抢先转正 / 超时清理）→ 本地已落后
    var cloudRow2 = findRowById(fileId);
    var cloudS2 = 0;
    if(cloudRow2 > 0){
      var cd2 = readRow(cloudRow2);
      cloudS2 = parseInt(cd2["起点号"]) || 0;
    }
    return {
      status: "conflict",
      tongzhi: "临时文件已失效，云端已被他人版本(或已清理)，本地需重新校验",
      判定结果: "转正失败·临时失效",
      云端版本号: cloudS2,
      ID: fileId
    };
  }

  var tmpData = readRow(tmpRow);
  var tmpVer = parseInt(tmpData["起点号"]) || 0;
  // 校验：临时行版本 == 本地已改好的起点号 → 未被抢先，可转正
  if(tmpVer !== localS){
    return {
      status: "conflict",
      tongzhi: "本地确认的起点号与云端临时版本不一致，转正失败",
      判定结果: "转正失败·版本不符",
      临时版本: tmpVer,
      本地起点号: localS,
      ID: fileId
    };
  }

  // 权限校验：临时行必须属于当前用户（或公共）
  if(!canWriteRow(tmpData, username)){
    return {status:"error", tongzhi:"无权转正此文件(拥有者: "+(tmpData["拥有者"]||"无")+")", 判定结果:"权限不足", ID:fileId};
  }

  // 转正：把临时行内容转录到正牌行（原ID），S=E=tmpVer，状态=官方，删临时行
  var mainRow = findRowById(fileId);
  if(mainRow === 0) mainRow = findEmptyRow();

  var fileData2 = {};
  fileData2["ID"] = fileId;
  fileData2["文件名"] = tmpData["文件名"]||"";
  fileData2["起点号"] = String(tmpVer);
  fileData2["终点号"] = String(tmpVer);
  fileData2["状态"] = "官方";
  fileData2["文件夹路径"] = tmpData["文件夹路径"]||"";
  fileData2["拥有者"] = tmpData["拥有者"]||"";
  fileData2["创建日期"] = tmpData["创建日期"]||"";
  fileData2["内容字符数"] = tmpData["内容字符数"]||"";
  fileData2["最后上传发起时间"] = tmpData["最后上传发起时间"]||"";
  fileData2["最后编辑时间"] = tmpData["最后编辑时间"]||"";
  fileData2["文件JSON"] = tmpData["文件JSON"]||"";
  writeRowData(mainRow, fileData2, username);
  clearRow(tmpRow);

  return {
    status: "success",
    tongzhi: "转正成功，临时文件已晋升为正牌",
    判定结果: "转正成功",
    云端版本号: tmpVer,
    起点号: tmpVer,
    终点号: tmpVer,
    行号: mainRow,
    ID: fileId
  };
}

if(action === "转正确认"){
  // ---- 批量模式：一次回执返回全部文件转正结果 ----
  if(Array.isArray(argv["文件列表"])){
    var batchList = argv["文件列表"];
    // 批量硬限制：超限直接拒绝（转正确认负载小，同批数量限制同样适用）
    var limitErr = checkBatchLimits(batchList);
    if(limitErr) return limitErr;
    var batchRes = [];
    for(var bi=0;bi<batchList.length;bi++){
      batchRes.push(doPromoteOne(batchList[bi], currentUser));
    }
    return {
      status: "success",
      tongzhi: "批量转正确认完成，共"+batchRes.length+"个",
      批次数: batchRes.length,
      结果: batchRes
    };
  }
  // ---- 标量模式（向前兼容） ----
  return doPromoteOne(argv, currentUser);
}

// ========== 临时文件超时清理 ==========
// 依靠临时行的"最后上传发起时间"（同步提交时写入的 getNowTimestamp）判定其建立时刻，
// 超过超时秒仍未转正 → 直接删除该临时行
if(action === "清理临时"){
  var idColTmp = getColMap()["ID"];
  if(!idColTmp) return {status:"error", tongzhi:"表头缺少ID列"};
  var timeoutSec = parseInt(argv["超时秒"]) || 60;
  var nowDate = new Date();
  var nowMs = nowDate.getTime();
  var cleared = 0;
  var kept = 0;

  for(var r=2;r<=maxRow;r++){
    var idVal = getCellValue(r, idColTmp) || "";
    if(idVal.indexOf("_TL") === -1) continue;   // 只处理临时行
    var rowData = readRow(r);
    if((rowData["状态"]||"") !== "临时") continue;
    var uploadTimeStr = String(rowData["最后上传发起时间"] || "").trim();
    var born = parseLockTime(uploadTimeStr);
    if(!born){
      kept++;   // 无时间戳的临时行不清除（保守处理）
      continue;
    }
    var ageSec = (nowMs - born.getTime())/1000;
    if(ageSec > timeoutSec){
      clearRow(r);
      cleared++;
    }else{
      kept++;
    }
  }
  return {status:"success", tongzhi:"临时清理完成", 清理数: cleared, 存活数: kept};
}

// 智能下载：客户端传入 id + 本地起点号 + 本地终点号（判断是否本地有修改）
// 核心：云端正牌 S==E==云端当前版；本地 S==E 表示本地未修改→可直接覆盖；
//       本地 S<E 表示本地有修改→冲突处置
if(action === "智能下载"){
  var fileId = argv["ID"] || "";
  var localS = parseInt(argv["本地起点号"]) || 0;
  var localE = parseInt(argv["本地终点号"]) || 0;
  var contentCharCount = argv["内容字符数"] || "";
  var isNewFile = argv["本地新文件标识"] === "true" || argv["本地新文件标识"] === true;

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID"};
  }

  if(isNewFile){
    return {status: "error", tongzhi: "本地新文件无需下载", 判定结果: "新文件跳过"};
  }

  var colMap = getColMap();
  var cloudRow = findRowById(fileId);
  var cloudData = null;
  var cloudVer = 0;

  if(cloudRow > 0){
    cloudData = readRow(cloudRow);
    cloudVer = parseInt(cloudData["起点号"]) || 0;   // 云端正牌 S=E=当前版本
    // 权限检查：下载也需要有读权限
    if(!canAccessRow(cloudData, currentUser)){
      return {status:"error", tongzhi:"无权读取此文件(拥有者: "+(cloudData["拥有者"]||"无")+")", 判定结果:"权限不足"};
    }
  }

  if(cloudRow === 0){
    if(!localE){
      return {status: "error", tongzhi: "云端文件已经删除，是本地显示落后", 判定结果: "本地滞后", 建议操作: "刷新云端"};
    }
    return {status: "success", tongzhi: "云端文件已经删除，删除本地文件", 判定结果: "云端已删除", 建议操作: "删除本地"};
  }

  // 本地未修改(S==E)且 S==云端版本 → 已同步，无需下载
  if(localS === localE && localS === cloudVer){
    return {status: "success", tongzhi: "本地已继承云端版本，无需下载", 判定结果: "无需下载", 云端版本号: cloudVer};
  }

  // 本地未修改(S==E)但 S<云端版本 → 可直接覆盖升级本地
  if(localS === localE && localS < cloudVer){
    // 查找拆分片段
    var fragments = [cloudData];
    var charCountStr = cloudData["内容字符数"] || "";
    var match = charCountStr.match(/^(\d+)-(\d+)\/(\d+)$/);
    if(match){
      var totalParts = parseInt(match[3]);
      if(totalParts > 1){
        for(var p=2;p<=totalParts;p++){
          var fragId = fileId + "-" + p;
          var fragRow = findRowById(fragId);
          if(fragRow > 0){
            var fragData = readRow(fragRow);
            fragData._行号 = fragRow;
            fragments.push(fragData);
          }
        }
      }
    }

    return {
      status: "success",
      tongzhi: "云端有版本未同步至本地，允许下载(可直接覆盖)",
      判定结果: "允许下载",
      下载判断: "可直接覆盖升级本地",
      云端版本号: cloudVer,
      本地起点号: localS,
      本地终点号: localE,
      云端数据: cloudData,
      片段数据: fragments.length > 1 ? fragments : null,
      行号: cloudRow
    };
  }

  // 本地有修改(S<E) 且云端也有新版本 → 冲突处置
  if(localS < localE){
    return {
      status: "success",
      tongzhi: "本地与云端均有新修改，需冲突处置",
      判定结果: "允许下载",
      下载判断: "冲突处置",
      云端版本号: cloudVer,
      本地起点号: localS,
      本地终点号: localE,
      云端数据: cloudData,
      片段数据: null,
      行号: cloudRow
    };
  }

  return {status:"error", tongzhi:"未知下载状态", 判定结果:"未知"};
}

// 批量读取：按 ID 列表一次取回多行完整数据（供客户端一次 webhook 批量拉取内容）
if(action === "批量读取"){
  var idList = argv["ID列表"] || [];
  if(!idList.length){
    return {status:"error", tongzhi:"缺少参数: ID列表"};
  }
  var batchRows = [];
  for(var bi=0; bi<idList.length; bi++){
    var rid = idList[bi];
    var rrow = findRowById(rid);
    if(rrow > 0){
      var rdata = readRow(rrow);
      if(canAccessRow(rdata, currentUser)){ batchRows.push(rdata); }
    }
  }
  return {status:"success", tongzhi:"批量读取完成", 行数: batchRows.length, 数据: batchRows};
}

// 强制覆盖云端：冲突处置——用户选择"本地覆盖云端"
// S/E 语义：本地胜出，云端正牌版本升为本地终点号(本地E)，写入后云端 S=E=该值
if(action === "强制覆盖云端"){
  var fileId = argv["ID"] || "";
  var fileData = argv["数据"] || {};
  var forceEnd = parseInt(argv["强制终点号"]) || parseInt(argv["终点号"]) || 0;

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID"};
  }
  if(!forceEnd){
    return {status:"error", tongzhi:"缺少参数: 强制终点号(本地终点号)"};
  }

  var cloudRow = findRowById(fileId);
  if(cloudRow === 0){
    return {status:"error", tongzhi:"云端未找到此ID"};
  }

  // 权限检查
  var existingData = readRow(cloudRow);
  if(!canWriteRow(existingData, currentUser)){
    return {status:"error", tongzhi:"无权修改此文件(拥有者: "+(existingData["拥有者"]||"无")+")"};
  }

  fileData["ID"] = fileId;
  fileData["起点号"] = String(forceEnd);
  fileData["终点号"] = String(forceEnd);
  fileData["状态"] = "官方";
  writeRowData(cloudRow, fileData, currentUser);

  return {
    status: "success",
    tongzhi: "强制覆盖云端成功",
    判定结果: "本地覆盖云端",
    云端版本号: forceEnd,
    起点号: forceEnd,
    终点号: forceEnd,
    行号: cloudRow
  };
}

// 抢锁
if(action === "抢锁"){
  var locker = argv["锁登记处"] || "";
  if(!locker) return {status:"error", tongzhi:"缺少参数: 锁登记处(设备标识)"};
  return tryAcquireLock(locker);
}

// 解锁
if(action === "解锁"){
  var locker = argv["锁登记处"] || "";
  if(!locker) return {status:"error", tongzhi:"缺少参数: 锁登记处(设备标识)"};
  return tryReleaseLock(locker);
}

// 删除行：按ID删除（只能删除自己知道的ID，不能指定行号）
if(action === "删除行"){
  var fileId = argv["ID"] || "";
  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID"};
  }

  var colMap = getColMap();
  var idCol = colMap["ID"];
  var deletedRows = [];
  var deniedRows = [];

  for(var r=maxRow;r>=2;r--){
    if(getCellValue(r, idCol) === fileId){
      var rowData = readRow(r);
      if(canWriteRow(rowData, currentUser)){
        clearRow(r);
        deletedRows.push(r);
      }else{
        deniedRows.push(r);
      }
    }
  }

  if(deletedRows.length > 0){
    return {
      status: "success",
      tongzhi: "已删除" + deletedRows.length + "行" + (deniedRows.length > 0 ? "，"+deniedRows.length+"行无权限" : ""),
      删除行号: deletedRows,
      无权限行号: deniedRows
    };
  }else{
    return {status:"error", tongzhi:"无权删除此文件(拥有者: "+(rowData?rowData["拥有者"]||"无":"无")+")"};
  }
}

// 批量写入：必须通过ID定位行，只写允许的列，自动写入拥有者
// 安全约束：不能直接指定行号，必须传ID；只写白名单内的列
if(action === "批量写入"){
  var fileId = argv["ID"] || "";
  var rowNum = parseInt(argv["行号"]) || 0;
  var data = argv["数据"] || {};

  // 安全检查：必须有ID或行号（行号仅用于内部调用兼容）
  if(!fileId && rowNum < 1){
    return {status:"error", tongzhi:"缺少参数: ID或行号"};
  }

  // 优先通过ID定位行号（安全）
  var targetRow = 0;
  var existingData = null;
  if(fileId){
    targetRow = findRowById(fileId);
    if(targetRow > 0){
      existingData = readRow(targetRow);
      // 权限检查：已有文件，验证拥有者
      if(!canWriteRow(existingData, currentUser)){
        return {status:"error", tongzhi:"无权修改此文件(拥有者: "+(existingData["拥有者"]||"无")+")"};
      }
    }
    if(targetRow === 0){
      // ID不存在，如果是新文件则找空行
      var isNew = argv["本地新文件标识"] === "true";
      if(isNew){
        targetRow = findEmptyRow();
      }else{
        return {status:"error", tongzhi:"云端未找到此ID"};
      }
    }
  }else{
    // 仅行号模式（内部兼容），限制行号范围
    if(rowNum < 2 || rowNum > maxRow){
      return {status:"error", tongzhi:"行号超出范围"};
    }
    targetRow = rowNum;
    existingData = readRow(targetRow);
    if(existingData && existingData["ID"]){
      if(!canWriteRow(existingData, currentUser)){
        return {status:"error", tongzhi:"无权修改此行(拥有者: "+(existingData["拥有者"]||"无")+")"};
      }
    }
  }

  // 只写白名单内的列，自动写入拥有者
  var written = [];
  var failed = [];
  writeRowData(targetRow, data, currentUser);

  // 检查哪些字段被写入、哪些不在白名单
  var allowedCols = ["拥有者","ID","文件名","起点号","终点号","状态","文件夹路径","最后上传发起时间","最后编辑时间","同步时间","MD5","内容字符数","创建日期","文件JSON"];
  for(var name in data){
    if(allowedCols.indexOf(name) !== -1){
      written.push(name);
    }else{
      failed.push(name);
    }
  }

  return {
    status: "success",
    tongzhi: "批量写入完成",
    行号: targetRow,
    已写入: written,
    未写入非业务列: failed
  };
}

// ========== 未知操作兜底 ==========
return {
  status: "error",
  tongzhi: "未知操作: " + action,
  可用操作: [
    "读取全部", "读取索引", "查找", "模糊查找", "获取维度", "获取表头",
    "初始化表头", "同步提交", "转正确认", "清理临时", "智能下载", "批量读取", "强制覆盖云端",
    "抢锁", "解锁", "删除行", "批量写入", "版本"
  ]
};
