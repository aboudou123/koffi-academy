(function () {
  "use strict";

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(area);
    }
  }

  document.querySelectorAll(".copy-code").forEach(function (button) {
    button.addEventListener("click", function () {
      var card = button.closest(".code-card");
      var code = card && card.querySelector("code");
      if (!code) return;

      var original = button.innerHTML;
      var done = function () {
        button.innerHTML = '<i class="fa-solid fa-check"></i> Kopiert';
        window.setTimeout(function () {
          button.innerHTML = original;
        }, 1600);
      };
      var text = code.innerText;

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          fallbackCopy(text);
          done();
        });
      } else {
        fallbackCopy(text);
        done();
      }
    });
  });
})();
