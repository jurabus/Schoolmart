// Startup watchdog: if the app fails to start, show the reason instead of an endless spinner.
(function () {
  var lastError = '';
  window.addEventListener('error', function (e) {
    lastError = (e.message || 'Script error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '');
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    lastError = 'Promise: ' + ((e.reason && (e.reason.message || e.reason)) || 'rejected');
  });
  setTimeout(function () {
    if (window.__appStarted) return;
    var box = document.querySelector('.loading');
    if (!box) return;
    var div = document.createElement('div');
    div.className = 'empty-page';
    var p1 = document.createElement('p');
    p1.textContent = 'The page could not finish loading. Please check your connection and refresh.';
    var p2 = document.createElement('p');
    p2.className = 'muted small';
    p2.textContent = lastError || 'No error reported (the database did not respond in time).';
    div.appendChild(p1); div.appendChild(p2);
    box.replaceWith(div);
  }, 12000);
})();
