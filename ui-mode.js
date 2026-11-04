/* ============================================================
   ui-mode.js · 手机/电脑界面模式（纯展示层，不碰业务逻辑）
   1) 自动识别：UA 含 Mobile/Android/iPhone 或 屏宽 < 820 => mobile
   2) 手动切换：顶栏 #ui-mode-toggle 按钮，写 localStorage.exam_ui_mode
      有手动选择时永远优先；刷新后保持
   3) 给 <html> 打 data-ui="mobile" / "desktop"
   4) 同源 iframe（文件管理器）同步同一个 data-ui，便于 mobile.css 生效
   ============================================================ */
(function () {
    'use strict';

    var KEY = 'exam_ui_mode';
    var MOBILE_BREAKPOINT = 820;

    function readSaved() {
        try {
            var v = localStorage.getItem(KEY);
            if (v === 'mobile' || v === 'desktop') return v;
        } catch (e) { }
        return null;
    }

    function detect() {
        var ua = navigator.userAgent || navigator.vendor || '';
        if (/Mobile|Android|iPhone|iPod|iPad|HarmonyOS|Windows Phone/i.test(ua)) return 'mobile';
        var w = window.innerWidth || document.documentElement.clientWidth || 0;
        return (w > 0 && w < MOBILE_BREAKPOINT) ? 'mobile' : 'desktop';
    }

    function resolve() {
        return readSaved() || detect();
    }

    function syncIframes(mode) {
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
            try {
                var doc = frames[i].contentDocument;
                if (doc && doc.documentElement) {
                    doc.documentElement.setAttribute('data-ui', mode);
                }
            } catch (e) { /* 跨域/未加载：忽略 */ }
        }
    }

    function updateToggle(mode) {
        var btn = document.getElementById('ui-mode-toggle');
        if (!btn) return;
        var toDesktop = (mode === 'mobile');
        btn.textContent = toDesktop ? '🖥' : '📱';
        btn.title = toDesktop ? '切换到电脑版界面' : '切换到手机版界面';
    }

    function apply(mode) {
        document.documentElement.setAttribute('data-ui', mode);
        if (readSaved()) {
            document.documentElement.setAttribute('data-ui-manual', '1');
        } else {
            document.documentElement.removeAttribute('data-ui-manual');
        }
        syncIframes(mode);
        updateToggle(mode);
    }

    function setMode(mode) {
        try { localStorage.setItem(KEY, mode); } catch (e) { }
        apply(mode);
    }

    function bind() {
        var btn = document.getElementById('ui-mode-toggle');
        if (btn && !btn.__uiModeBound) {
            btn.__uiModeBound = true;
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                var cur = document.documentElement.getAttribute('data-ui');
                setMode(cur === 'mobile' ? 'desktop' : 'mobile');
            });
        }
        updateToggle(document.documentElement.getAttribute('data-ui') || 'desktop');
        // iframe 可能晚于首屏加载，补同步
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
            (function (f) {
                if (f.__uiModeBound) return;
                f.__uiModeBound = true;
                f.addEventListener('load', function () {
                    syncIframes(document.documentElement.getAttribute('data-ui') || 'desktop');
                });
            })(frames[i]);
        }
    }

    // 极早执行：<head> 同步打标，避免首屏闪动
    apply(resolve());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
    window.addEventListener('load', function () {
        bind();
        syncIframes(document.documentElement.getAttribute('data-ui') || 'desktop');
    });
})();
