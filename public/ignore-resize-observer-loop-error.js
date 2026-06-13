/* global window */

(function () {
  var ignoredMessages = {
    'ResizeObserver loop completed with undelivered notifications.': true,
    'ResizeObserver loop limit exceeded': true,
  };

  function isIgnoredResizeObserverError(message) {
    return typeof message === 'string' && ignoredMessages[message] === true;
  }

  window.addEventListener(
    'error',
    function (event) {
      if (isIgnoredResizeObserverError(event.message)) {
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : null;

    if (isIgnoredResizeObserverError(message)) {
      event.preventDefault();
    }
  });
})();
