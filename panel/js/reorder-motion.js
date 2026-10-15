(function () {
  'use strict';

  var DURATION = 180;
  var EASING = 'cubic-bezier(0.77, 0, 0.175, 1)';

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function toArray(nodes) {
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      result.push(nodes[i]);
    }
    return result;
  }

  function animate(container, selector, mutate, excludedElement) {
    var elements = toArray(container.querySelectorAll(selector));
    var snapshots = [];
    var i;

    for (i = 0; i < elements.length; i++) {
      if (elements[i] === excludedElement) {
        continue;
      }

      snapshots.push({
        element: elements[i],
        rect: elements[i].getBoundingClientRect()
      });
    }

    for (i = 0; i < snapshots.length; i++) {
      if (snapshots[i].element._flowReorderAnimation) {
        snapshots[i].element._flowReorderAnimation.cancel();
        snapshots[i].element._flowReorderAnimation = null;
        snapshots[i].element.style.transformOrigin = '';
      }
    }

    mutate();

    if (prefersReducedMotion()) {
      return;
    }

    for (i = 0; i < snapshots.length; i++) {
      (function (snapshot) {
        var element = snapshot.element;
        var next = element.getBoundingClientRect();
        var deltaX = snapshot.rect.left - next.left;
        var deltaY = snapshot.rect.top - next.top;
        var scaleX = next.width ? snapshot.rect.width / next.width : 1;
        var scaleY = next.height ? snapshot.rect.height / next.height : 1;

        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(scaleX - 1) < 0.005 && Math.abs(scaleY - 1) < 0.005) {
          return;
        }

        if (typeof element.animate !== 'function') {
          return;
        }

        element.style.transformOrigin = '0 0';
        var animation = element.animate([
          { transform: 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(' + scaleX + ', ' + scaleY + ')' },
          { transform: 'translate(0, 0) scale(1, 1)' }
        ], {
          duration: DURATION,
          easing: EASING,
          fill: 'both'
        });

        element._flowReorderAnimation = animation;
        animation.onfinish = function () {
          if (element._flowReorderAnimation === animation) {
            element._flowReorderAnimation = null;
            element.style.transformOrigin = '';
            animation.cancel();
          }
        };
      })(snapshots[i]);
    }
  }

  function createDragGhost(event, element, className) {
    if (!event.dataTransfer || typeof event.dataTransfer.setDragImage !== 'function') {
      return;
    }

    var rect = element.getBoundingClientRect();
    var ghost = element.cloneNode(true);
    ghost.classList.add(className);
    ghost.style.height = rect.height + 'px';
    ghost.style.width = rect.width + 'px';
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);

    window.setTimeout(function () {
      if (ghost.parentNode) {
        ghost.parentNode.removeChild(ghost);
      }
    }, 0);
  }

  window.FlowReorderMotion = {
    animate: animate,
    createDragGhost: createDragGhost,
    prefersReducedMotion: prefersReducedMotion
  };
})();
