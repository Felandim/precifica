/* Precifica activation signals: same-site, no data, no third-party requests. */
(function () {
  "use strict";
  window.precificaActivation = function (tool, kind) {
    var frame = document.createElement("iframe");
    frame.title = "";
    frame.setAttribute("aria-hidden", "true");
    frame.width = "1";
    frame.height = "1";
    frame.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    frame.src = "a/" + tool + "-" + kind + ".html";
    (document.body || document.documentElement).appendChild(frame);
    window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 60000);
  };
})();
