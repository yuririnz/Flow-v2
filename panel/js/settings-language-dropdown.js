(function () {
  'use strict';

  function createDropdown(selectId, menuId, fallbackLabel) {
    var nativeSelect = document.getElementById(selectId);

    if (!nativeSelect || nativeSelect.getAttribute('data-flow-custom-dropdown') === 'true') {
      return;
    }

    nativeSelect.setAttribute('data-flow-custom-dropdown', 'true');
    nativeSelect.setAttribute('aria-hidden', 'true');
    nativeSelect.setAttribute('tabindex', '-1');

    var wrapper = document.createElement('div');
    wrapper.className = 'settings-language-dropdown';
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'settings-language-dropdown__trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    var label = document.createElement('span');
    label.className = 'settings-language-dropdown__label';
    trigger.appendChild(label);

    var chevron = document.createElement('span');
    chevron.className = 'settings-language-dropdown__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.appendChild(chevron);

    var menu = document.createElement('div');
    menu.className = 'settings-language-dropdown__menu';
    menu.id = menuId;
    menu.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-controls', menu.id);

    wrapper.insertBefore(trigger, nativeSelect);
    wrapper.appendChild(menu);

    var isOpen = false;

    function closeMenu() {
      isOpen = false;
      menu.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      syncOptions();
      isOpen = true;
      menu.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function dispatchNativeChange() {
      var event;

      try {
        event = new Event('change', { bubbles: true });
      } catch (error) {
        event = document.createEvent('Event');
        event.initEvent('change', true, true);
      }

      nativeSelect.dispatchEvent(event);
    }

    function selectIndex(index) {
      if (index < 0 || index >= nativeSelect.options.length) {
        return;
      }

      nativeSelect.selectedIndex = index;
      dispatchNativeChange();
      syncOptions();
      closeMenu();
      trigger.focus();
    }

    function syncOptions() {
      var options = nativeSelect.options;
      var selectedIndex = nativeSelect.selectedIndex;

      trigger.setAttribute('aria-label', nativeSelect.getAttribute('aria-label') || fallbackLabel);
      menu.textContent = '';

      for (var index = 0; index < options.length; index += 1) {
        var option = document.createElement('button');
        option.type = 'button';
        option.className = 'settings-language-dropdown__option';
        option.setAttribute('role', 'option');
        option.setAttribute('data-index', String(index));
        option.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
        option.textContent = options[index].textContent || options[index].value;

        if (index === selectedIndex) {
          option.classList.add('is-selected');
        }

        menu.appendChild(option);
      }

      label.textContent = options[selectedIndex] ? options[selectedIndex].textContent : '';
    }

    function getOption(target) {
      while (target && target !== menu) {
        if (target.classList && target.classList.contains('settings-language-dropdown__option')) {
          return target;
        }
        target = target.parentNode;
      }

      return null;
    }

    trigger.addEventListener('click', function () {
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    trigger.addEventListener('keydown', function (event) {
      var key = event.key || event.keyCode;

      if (key === 'ArrowDown' || key === 40) {
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          selectIndex(Math.min(nativeSelect.options.length - 1, nativeSelect.selectedIndex + 1));
        }
      } else if (key === 'ArrowUp' || key === 38) {
        event.preventDefault();
        if (!isOpen) {
          openMenu();
        } else {
          selectIndex(Math.max(0, nativeSelect.selectedIndex - 1));
        }
      } else if (key === 'Enter' || key === ' ' || key === 32) {
        event.preventDefault();
        if (isOpen) {
          closeMenu();
        } else {
          openMenu();
        }
      } else if (key === 'Escape' || key === 27) {
        closeMenu();
      }
    });

    menu.addEventListener('click', function (event) {
      var option = getOption(event.target);

      if (option) {
        selectIndex(Number(option.getAttribute('data-index')));
      }
    });

    document.addEventListener('mousedown', function (event) {
      if (isOpen && !wrapper.contains(event.target)) {
        closeMenu();
      }
    });

    nativeSelect.addEventListener('change', syncOptions);

    if (window.MutationObserver) {
      var observer = new MutationObserver(syncOptions);
      observer.observe(nativeSelect, { childList: true, subtree: true, attributes: true });
    }

    syncOptions();
  }

  createDropdown('settingsLanguage', 'settings-language-dropdown-menu', 'Language');
  createDropdown('settingsBackgroundEffect', 'settings-background-effect-dropdown-menu', 'Background Effect');
})();