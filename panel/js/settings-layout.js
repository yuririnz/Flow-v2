(function () {
  'use strict';

  var STORAGE_KEY = 'flow.settings.activeSection';
  var tabButtons = document.querySelectorAll('[data-settings-tab]');
  var sections = document.querySelectorAll('[data-settings-section]');
  var title = document.getElementById('settingsSectionTitle');
  var description = document.getElementById('settingsSectionDescription');
  var body = document.querySelector('.settings-body');

  if (!tabButtons.length || !sections.length) {
    return;
  }

  function hasSection(name) {
    for (var i = 0; i < sections.length; i += 1) {
      if (sections[i].getAttribute('data-settings-section') === name) {
        return true;
      }
    }

    return false;
  }

  function getStoredSection() {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function storeSection(name) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, name);
    } catch (error) {}
  }

  function activateSection(name, shouldFocus) {
    var activeSection = null;
    var firstMatchingButton = null;

    if (!hasSection(name)) {
      name = 'appearance';
    }

    for (var i = 0; i < sections.length; i += 1) {
      var sectionIsActive = sections[i].getAttribute('data-settings-section') === name;
      sections[i].classList.toggle('is-active', sectionIsActive);
      sections[i].setAttribute('aria-hidden', sectionIsActive ? 'false' : 'true');

      if (sectionIsActive) {
        activeSection = sections[i];
      }
    }

    for (var j = 0; j < tabButtons.length; j += 1) {
      var buttonIsActive = tabButtons[j].getAttribute('data-settings-tab') === name;
      tabButtons[j].classList.toggle('is-active', buttonIsActive);
      tabButtons[j].setAttribute('aria-selected', buttonIsActive ? 'true' : 'false');

      if (buttonIsActive && !firstMatchingButton) {
        firstMatchingButton = tabButtons[j];
      }
    }

    if (activeSection) {
      var nextTitle = activeSection.getAttribute('data-settings-title') || 'Settings';
      var nextDescription = activeSection.getAttribute('data-settings-description') || '';

      if (title) {
        title.textContent = nextTitle;
      }

      if (description) {
        description.textContent = nextDescription;
      }

      document.title = 'Flow Settings - ' + nextTitle;

      if (window.FlowSettingsI18n && typeof window.FlowSettingsI18n.refreshSection === 'function') {
        window.FlowSettingsI18n.refreshSection(name);
      }
    }

    if (body) {
      body.scrollTop = 0;
    }

    storeSection(name);

    if (shouldFocus && firstMatchingButton && typeof firstMatchingButton.focus === 'function') {
      firstMatchingButton.focus();
    }
  }

  for (var i = 0; i < tabButtons.length; i += 1) {
    tabButtons[i].setAttribute('role', 'tab');

    tabButtons[i].addEventListener('click', function (event) {
      activateSection(event.currentTarget.getAttribute('data-settings-tab'), false);
    });

    tabButtons[i].addEventListener('keydown', function (event) {
      var key = event.key || event.keyCode;
      var currentName = event.currentTarget.getAttribute('data-settings-tab');
      var order = ['appearance', 'background', 'handles', 'behavior', 'profile'];
      var currentIndex = order.indexOf(currentName);
      var nextIndex = currentIndex;

      if (key === 'ArrowDown' || key === 'ArrowRight' || key === 40 || key === 39) {
        nextIndex = (currentIndex + 1) % order.length;
      } else if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 38 || key === 37) {
        nextIndex = (currentIndex + order.length - 1) % order.length;
      } else {
        return;
      }

      event.preventDefault();
      activateSection(order[nextIndex], true);
    });
  }

  activateSection(getStoredSection() || 'appearance', false);
})();