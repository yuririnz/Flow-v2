(function () {
  'use strict';

  var nativeSelect = document.getElementById('ddLibraries');

  if (!nativeSelect || nativeSelect.getAttribute('data-flow-custom-dropdown') === 'true') {
    return;
  }

  nativeSelect.setAttribute('data-flow-custom-dropdown', 'true');
  nativeSelect.setAttribute('aria-hidden', 'true');
  nativeSelect.setAttribute('tabindex', '-1');

  var wrapper = document.createElement('div');
  wrapper.className = 'flow-library-dropdown';
  nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
  wrapper.appendChild(nativeSelect);

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'flow-library-dropdown__trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  var label = document.createElement('span');
  label.className = 'flow-library-dropdown__label';
  trigger.appendChild(label);

  var chevron = document.createElement('span');
  chevron.className = 'flow-library-dropdown__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '';
  trigger.appendChild(chevron);

  var menu = document.createElement('div');
  menu.className = 'flow-library-dropdown__menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('tabindex', '-1');
  menu.id = 'flow-library-dropdown-menu';
  trigger.setAttribute('aria-controls', menu.id);

  wrapper.insertBefore(trigger, nativeSelect);
  wrapper.appendChild(menu);

  var open = false;
  var optionCount = -1;
  var selectedIndex = -1;
  var optionSignature = '';

  function closeMenu() {
    open = false;
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!nativeSelect.options.length) {
      return;
    }

    open = true;
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
  }

  function syncOptions() {
    var options = nativeSelect.options;
    var currentIndex = nativeSelect.selectedIndex;
    var signatureParts = [];

    for (var signatureIndex = 0; signatureIndex < options.length; signatureIndex += 1) {
      signatureParts.push(options[signatureIndex].value + '\u0000' + options[signatureIndex].textContent);
    }

    var signature = signatureParts.join('\u0001');

    if (optionCount === options.length && selectedIndex === currentIndex && optionSignature === signature && menu.childElementCount === options.length) {
      label.textContent = options[currentIndex] ? options[currentIndex].textContent : 'default';
      return;
    }

    optionCount = options.length;
    selectedIndex = currentIndex;
    optionSignature = signature;
    menu.textContent = '';

    for (var index = 0; index < options.length; index += 1) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'flow-library-dropdown__option';
      option.setAttribute('role', 'option');
      option.setAttribute('data-index', String(index));
      option.textContent = options[index].textContent || options[index].value || 'default';
      option.setAttribute('aria-selected', index === currentIndex ? 'true' : 'false');

      if (index === currentIndex) {
        option.classList.add('is-selected');
      }

      menu.appendChild(option);
    }

    label.textContent = options[currentIndex] ? options[currentIndex].textContent : 'default';
  }

  function getOptionButton(target) {
    while (target && target !== menu) {
      if (target.classList && target.classList.contains('flow-library-dropdown__option')) {
        return target;
      }
      target = target.parentNode;
    }
    return null;
  }

  trigger.addEventListener('click', function () {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  trigger.addEventListener('keydown', function (event) {
    var key = event.key || event.keyCode;

    if (key === 'ArrowDown' || key === 40) {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        selectIndex(Math.min(nativeSelect.options.length - 1, nativeSelect.selectedIndex + 1));
      }
    } else if (key === 'ArrowUp' || key === 38) {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        selectIndex(Math.max(0, nativeSelect.selectedIndex - 1));
      }
    } else if (key === 'Enter' || key === ' ' || key === 32) {
      event.preventDefault();
      if (open) {
        closeMenu();
      } else {
        openMenu();
      }
    } else if (key === 'Escape' || key === 27) {
      closeMenu();
    }
  });

  menu.addEventListener('click', function (event) {
    var option = getOptionButton(event.target);

    if (option) {
      selectIndex(Number(option.getAttribute('data-index')));
    }
  });

  document.addEventListener('mousedown', function (event) {
    if (open && !wrapper.contains(event.target)) {
      closeMenu();
    }
  });

  nativeSelect.addEventListener('change', syncOptions);

  if (window.MutationObserver) {
    var observer = new MutationObserver(syncOptions);
    observer.observe(nativeSelect, { childList: true, subtree: true, attributes: true });
  }

  window.setInterval(syncOptions, 650);
  syncOptions();
})();
