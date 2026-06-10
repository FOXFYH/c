'use strict';

// ===== 通用文件同步管理器 - 云端判断版 WPS脚本 v2.1（安全版） =====
// 表头：拥有者, ID, 文件名, 内容, 版本号, 文件夹路径, 最后上传发起时间, 最后编辑时间, 同步时间, MD5, 内容字符数, 创建日期, 锁登记处, 上锁时刻
// 
// 安全设计：
// - 用户只能通过业务操作（智能上传/下载/强制覆盖/抢锁/解锁/删除行）修改表格
// - 底层读写函数不对外暴露，防止任意位置读写
// - 写操作自动抢锁，防止并发冲突
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

// 内部：向指定行写入文件数据（只写表头内存在的列）
function writeRowData(rowNum, fileData){
  var colMap = getColMap();
  var allowedCols = ["拥有者","ID","文件名","内容","版本号","文件夹路径","最后上传发起时间","最后编辑时间","同步时间","MD5","内容字符数","创建日期"];
  for(var i=0;i<allowedCols.length;i++){
    var name = allowedCols[i];
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

var WRITE_ACTIONS = ["智能上传","强制覆盖云端","删除行","批量写入"];
var isWriteAction = false;
for(var wi=0;wi<WRITE_ACTIONS.length;wi++){
  if(action === WRITE_ACTIONS[wi]){isWriteAction=true;break;}
}

if(isWriteAction){
  var deviceLocker = argv["锁登记处"] || argv["设备标识"] || "";
  if(deviceLocker){
    var lockResult = tryAcquireLock(deviceLocker);
    if(lockResult.status !== "success"){
      return {status:"error", tongzhi:"抢锁失败: "+lockResult.tongzhi, 判定结果:"抢锁失败", 锁登记处:lockResult.锁登记处||"", 剩余秒:lockResult.剩余秒||0};
    }
  }
}

// ========== 对外业务操作 ==========

if(action === "版本"){
  return {status:"success", tongzhi:"云端判断版v2.2(安全版)", 版本号:"2.2", 操作列表:["读取全部","读取索引","查找","模糊查找","获取维度","获取表头","初始化表头","智能上传","智能下载","强制覆盖云端","抢锁","解锁","删除行","批量写入","版本"]};
}

// 读取全部（只读，安全）— 包含内容，体积大
if(action === "读取全部"){
  var data = readAllData();
  return {
    status: "success",
    tongzhi: "读取完成",
    行数: data.rows.length,
    列数: data.headers.length,
    表头: data.headers,
    数据: data.rows
  };
}

// 读取索引（只读，安全）— 只返回轻量字段，不含内容，刷新列表用
if(action === "读取索引"){
  var colMap = getColMap();
  var lightCols = ["ID","文件名","版本号","文件夹路径","最后编辑时间","同步时间","内容字符数"];
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
    if(hasData) rows.push(row);
  }
  return {
    status: "success",
    tongzhi: "索引读取完成",
    行数: rows.length,
    数据: rows
  };
}

// 查找（只读，安全）
if(action === "查找"){
  var colName = argv["列名"] || "";
  var keyword = argv["关键字"] || "";
  var results = findByColumn(colName, keyword);
  if(results.status === "error"){
    return {status:"error", tongzhi:results.tongzhi, 可用列:Object.keys(getColMap())};
  }
  return {
    status: "success",
    tongzhi: results.length > 0 ? "找到"+results.length+"条" : "未找到",
    匹配数: results.length,
    数据: results
  };
}

// 模糊查找（只读，安全）
if(action === "模糊查找"){
  var colName = argv["列名"] || "";
  var keyword = argv["关键字"] || "";
  var results = fuzzyFindByColumn(colName, keyword);
  if(results.status === "error"){
    return {status:"error", tongzhi:results.tongzhi, 可用列:Object.keys(getColMap())};
  }
  return {
    status: "success",
    tongzhi: results.length > 0 ? "找到"+results.length+"条" : "未找到",
    匹配数: results.length,
    数据: results
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

// ========== 核心业务操作（带安全约束） ==========

// 智能上传：客户端传入 id + 本地版本号 + 近同号 + 文件数据
if(action === "智能上传"){
  var fileId = argv["ID"] || "";
  var localVersion = parseInt(argv["本地版本号"]) || 0;
  var lastSyncVersion = parseInt(argv["近同号"]) || 0;
  var isNewFile = argv["本地新文件标识"] === "true" || argv["本地新文件标识"] === true;
  var fileData = argv["数据"] || {};

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID"};
  }

  var colMap = getColMap();
  var cloudRow = findRowById(fileId);
  var cloudData = null;
  var cloudVersion = 0;

  if(cloudRow > 0){
    cloudData = readRow(cloudRow);
    cloudVersion = parseInt(cloudData["版本号"]) || 0;
  }

  // ---- 有本地新文件标识：直接上传 ----
  if(isNewFile){
    var targetRow = cloudRow > 0 ? cloudRow : findEmptyRow();

    // 确保ID写入
    fileData["ID"] = fileId;
    writeRowData(targetRow, fileData);

    return {
      status: "success",
      tongzhi: "新文件上传成功",
      判定结果: "新建上传",
      云端版本号: parseInt(fileData["版本号"]) || localVersion,
      近同号: parseInt(fileData["版本号"]) || localVersion,
      行号: targetRow
    };
  }

  // ---- 无本地新文件标识：智能上传 ----
  if(!lastSyncVersion && !localVersion){
    return {status:"error", tongzhi:"此文件标识错乱，缺少版本号和近同号", 判定结果:"标识错乱"};
  }

  if(localVersion < lastSyncVersion){
    return {
      status: "error",
      tongzhi: "本地版本异常降级(本地v" + localVersion + "<近同号v" + lastSyncVersion + ")，禁止上传",
      判定结果: "本地异常降级",
      本地版本号: localVersion,
      近同号: lastSyncVersion
    };
  }

  if(localVersion === lastSyncVersion){
    return {
      status: "success",
      tongzhi: "此云文件未被修改，无需上传",
      判定结果: "无需上传",
      云端版本号: cloudVersion,
      近同号: lastSyncVersion
    };
  }

  if(localVersion > lastSyncVersion){
    if(cloudRow === 0){
      return {status:"error", tongzhi:"云端无此ID但本地无新文件标识，数据异常", 判定结果:"标识错乱"};
    }

    if(lastSyncVersion === cloudVersion){
      fileData["ID"] = fileId;
      writeRowData(cloudRow, fileData);

      return {
        status: "success",
        tongzhi: "上传升级成功",
        判定结果: "覆盖升级",
        云端版本号: parseInt(fileData["版本号"]) || localVersion,
        近同号: parseInt(fileData["版本号"]) || localVersion,
        行号: cloudRow
      };
    }

    if(lastSyncVersion < cloudVersion){
      return {
        status: "conflict",
        tongzhi: "本地不是基于云端最新版修改，请选择冲突处置方式",
        判定结果: "上传冲突",
        本地版本号: localVersion,
        云端版本号: cloudVersion,
        近同号: lastSyncVersion,
        云端数据: cloudData,
        行号: cloudRow
      };
    }

    if(lastSyncVersion > cloudVersion){
      return {
        status: "error",
        tongzhi: "本地版本异常升级(近同号v" + lastSyncVersion + ">云端版本v" + cloudVersion + ")，不上传",
        判定结果: "异常升级",
        本地版本号: localVersion,
        云端版本号: cloudVersion,
        近同号: lastSyncVersion
      };
    }
  }

  return {status:"error", tongzhi:"此文件标识错乱，请联系管理员", 判定结果:"标识错乱"};
}

// 智能下载：客户端传入 id + 本地版本号 + 近同号 + 内容字符数
if(action === "智能下载"){
  var fileId = argv["ID"] || "";
  var localVersion = parseInt(argv["本地版本号"]) || 0;
  var lastSyncVersion = parseInt(argv["近同号"]) || 0;
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
  var cloudVersion = 0;

  if(cloudRow > 0){
    cloudData = readRow(cloudRow);
    cloudVersion = parseInt(cloudData["版本号"]) || 0;
  }

  if(cloudRow === 0){
    if(!localVersion){
      return {status: "error", tongzhi: "云端文件已经删除，是本地显示落后", 判定结果: "本地滞后", 建议操作: "刷新云端"};
    }
    return {status: "success", tongzhi: "云端文件已经删除，删除本地文件", 判定结果: "云端已删除", 建议操作: "删除本地"};
  }

  if(cloudVersion === lastSyncVersion){
    return {status: "success", tongzhi: "本地已继承云端版本，无需下载", 判定结果: "无需下载", 云端版本号: cloudVersion, 近同号: lastSyncVersion};
  }

  if(cloudVersion < lastSyncVersion){
    return {status: "error", tongzhi: "云端版本异常降级(云端v" + cloudVersion + "<近同号v" + lastSyncVersion + ")，禁止下载", 判定结果: "云端异常降级", 云端版本号: cloudVersion, 近同号: lastSyncVersion};
  }

  if(cloudVersion > lastSyncVersion){
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

    var judgeResult = "";
    if(localVersion === lastSyncVersion){
      judgeResult = "可直接覆盖升级本地";
    }else if(localVersion > lastSyncVersion){
      judgeResult = "冲突处置";
    }else{
      judgeResult = "本地版本异常降级";
    }

    return {
      status: "success",
      tongzhi: "云端有版本未同步至本地，允许下载",
      判定结果: "允许下载",
      下载判断: judgeResult,
      云端版本号: cloudVersion,
      近同号: lastSyncVersion,
      本地版本号: localVersion,
      云端数据: cloudData,
      片段数据: fragments.length > 1 ? fragments : null,
      行号: cloudRow
    };
  }

  return {status:"error", tongzhi:"未知下载状态", 判定结果:"未知"};
}

// 强制覆盖云端：冲突时用户选择强制覆盖
if(action === "强制覆盖云端"){
  var fileId = argv["ID"] || "";
  var fileData = argv["数据"] || {};
  var forceVersion = parseInt(argv["强制版本号"]) || 0;

  if(!fileId){
    return {status:"error", tongzhi:"缺少参数: ID"};
  }

  var cloudRow = findRowById(fileId);
  if(cloudRow === 0){
    return {status:"error", tongzhi:"云端未找到此ID"};
  }

  var colMap = getColMap();
  var currentCloudVer = parseInt(getCellValue(cloudRow, colMap["版本号"])) || 0;
  var finalVersion = forceVersion > currentCloudVer ? forceVersion : currentCloudVer;

  fileData["ID"] = fileId;
  fileData["版本号"] = String(finalVersion);
  writeRowData(cloudRow, fileData);

  return {
    status: "success",
    tongzhi: "强制覆盖云端成功",
    云端版本号: finalVersion,
    近同号: finalVersion,
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

  for(var r=maxRow;r>=2;r--){
    if(getCellValue(r, idCol) === fileId){
      clearRow(r);
      deletedRows.push(r);
    }
  }

  return {
    status: "success",
    tongzhi: "已删除" + deletedRows.length + "行",
    删除行号: deletedRows
  };
}

// 批量写入：必须通过ID定位行，只写允许的列
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
  if(fileId){
    targetRow = findRowById(fileId);
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
  }

  // 只写白名单内的列
  var written = [];
  var failed = [];
  writeRowData(targetRow, data);
  
  // 检查哪些字段被写入、哪些不在白名单
  var allowedCols = ["拥有者","ID","文件名","内容","版本号","文件夹路径","最后上传发起时间","最后编辑时间","同步时间","MD5","内容字符数","创建日期"];
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
    "初始化表头", "智能上传", "智能下载", "强制覆盖云端",
    "抢锁", "解锁", "删除行", "批量写入", "版本"
  ]
};
