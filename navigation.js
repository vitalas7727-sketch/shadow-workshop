
'use strict';

(() => {
  const swForwardHistory = [];
  const swOriginalGoTo = goTo;

  function swUpdateForwardButton() {
    const button = document.getElementById('forwardShortcut');

    if (!button) return;

    const canGoForward = swForwardHistory.length > 0;

    button.disabled = !canGoForward;
    button.setAttribute('aria-disabled', String(!canGoForward));
    button.title = canGoForward
      ? 'Вперёд'
      : 'Нет следующих разделов';
  }

  goTo = function (view, addToHistory = true) {
    if (addToHistory && view !== currentView) {
      swForwardHistory.length = 0;
    }

    const result = swOriginalGoTo(view, addToHistory);
    swUpdateForwardButton();

    return result;
  };

  const backButton = document.getElementById('backShortcut');

  if (backButton) {
    backButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (viewHistory.length > 0) {
        swForwardHistory.push(currentView);

        const previousView = viewHistory.pop();
        goTo(previousView, false);
      } else if (currentView !== 'home') {
        swForwardHistory.push(currentView);
        goTo('home', false);
      } else {
        showToast('Ты уже на главной странице.');
      }

      swUpdateForwardButton();
    }, true);
  }

  const forwardButton = document.getElementById('forwardShortcut');

  if (forwardButton) {
    forwardButton.addEventListener('click', event => {
      event.preventDefault();

      if (swForwardHistory.length === 0) {
        showToast('Нет следующих разделов для перехода.');
        return;
      }

      const nextView = swForwardHistory.pop();

      if (nextView !== currentView) {
        viewHistory.push(currentView);
        goTo(nextView, false);
      }

      swUpdateForwardButton();
    });
  }

  const homeButton = document.getElementById('homeShortcut');

  if (homeButton) {
    homeButton.addEventListener('click', () => {
      swForwardHistory.length = 0;
      swUpdateForwardButton();
    });
  }

  swUpdateForwardButton();
})();
