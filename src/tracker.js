const createTracker = page => {
  const requests = new Set();
  const onStarted = request => requests.add(request);
  const onFinished = request => requests.delete(request);
  page.on('request', onStarted);
  page.on('requestfinished', onFinished);
  page.on('requestfailed', onFinished);
  return {
    urls: () => Array.from(requests).map(r => r.url()),
    dispose: () => {
      page.removeListener('request', onStarted);
      page.removeListener('requestfinished', onFinished);
      page.removeListener('requestfailed', onFinished);
    }
  };
};

module.exports = { createTracker };
