(function () {
  "use strict";

  function hide(id) {
    var element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  }

  function applyBranding() {
    var about = document.getElementById("about");
    if (about) {
      about.classList.remove("hidden");
    }

    var aboutNav = document.getElementById("about-nav");
    if (aboutNav) {
      aboutNav.textContent = "About";
    }

    hide("update-nav");
    hide("support-nav");
    hide("license-buttons");
    hide("license-help-button");
    hide("license-button");

    var versionSource = document.querySelector("#about > h3 .current-version");
    var versionTarget = document.getElementById("about-current-version");
    if (versionSource && versionTarget && versionSource.textContent) {
      var versionText = "v" + versionSource.textContent.replace(/^v/i, "");
      if (versionTarget.textContent !== versionText) {
        versionTarget.textContent = versionText;
      }
    }
  }

  function scheduleBranding() {
    applyBranding();
    setTimeout(applyBranding, 50);
    setTimeout(applyBranding, 250);
    setTimeout(applyBranding, 750);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBranding);
  } else {
    scheduleBranding();
  }

  window.addEventListener("load", scheduleBranding);

  var observer = new MutationObserver(applyBranding);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
