(function () {
  'use strict';

  var ABOUT_EXTENSION_ID = 'com.rendertom.flow.v2.about';
  var ABOUT_MENU_ID = 'flow.aboutLicense';
  var MENU_EVENT = 'com.adobe.csxs.events.flyoutMenuClicked';

  function injectAboutMenuItem(menuXml) {
    if (typeof menuXml !== 'string' || menuXml.indexOf('Id="' + ABOUT_MENU_ID + '"') !== -1) {
      return menuXml;
    }

    var aboutItem = ' <MenuItem Id="' + ABOUT_MENU_ID + '" Label="About &amp; License..." Enabled="true" Checked="false" /> ';
    var refreshItem = /(<MenuItem\b(?=[^>]*\bLabel="Refresh[^"]*")[^>]*\/>)/i;
    var preferencesItem = /(<MenuItem\b(?=[^>]*\bId="aesp\.preferences")[^>]*\/>)/i;

    if (refreshItem.test(menuXml)) {
      return menuXml.replace(refreshItem, '$1' + aboutItem);
    }

    if (preferencesItem.test(menuXml)) {
      return menuXml.replace(preferencesItem, aboutItem + '$1');
    }

    return menuXml.replace(/<\/Menu>\s*$/i, aboutItem + '</Menu>');
  }

  function patchFlyoutMenuBuilder() {
    var cep = window.__adobe_cep__;

    if (!cep || typeof cep.invokeSync !== 'function' || cep.__flowAboutMenuPatched) {
      return false;
    }

    var originalInvokeSync = cep.invokeSync;
    cep.invokeSync = function () {
      var args = Array.prototype.slice.call(arguments);

      if (args[0] === 'setPanelFlyoutMenu') {
        args[1] = injectAboutMenuItem(args[1]);
      }

      return originalInvokeSync.apply(this, args);
    };
    cep.__flowAboutMenuPatched = true;
    return true;
  }

  function getMenuId(event) {
    var data = event && event.data;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return '';
      }
    }

    return data && data.menuId ? String(data.menuId) : '';
  }

  function openOriginalAboutWindow() {
    try {
      if (window.CSInterface) {
        new window.CSInterface().requestOpenExtension(ABOUT_EXTENSION_ID, '');
        return;
      }
    } catch (error) {
    }

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.requestOpenExtension === 'function') {
        window.__adobe_cep__.requestOpenExtension(ABOUT_EXTENSION_ID, '');
      }
    } catch (error) {
    }
  }

  function bindMenuClick() {
    var cep = window.__adobe_cep__;

    if (!cep || typeof cep.addEventListener !== 'function' || cep.__flowAboutMenuListenerBound) {
      return false;
    }

    cep.addEventListener(MENU_EVENT, function (event) {
      if (getMenuId(event) === ABOUT_MENU_ID) {
        openOriginalAboutWindow();
      }
    });
    cep.__flowAboutMenuListenerBound = true;
    return true;
  }

  patchFlyoutMenuBuilder();
  bindMenuClick();
})();