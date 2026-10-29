// Install the current worker before rendering images. A previously installed
// worker may still carry an old CSP, even after the media configuration changes.
export async function prepareServiceWorker(scriptURL: string) {
  try {
    const registration = await navigator.serviceWorker.register(scriptURL, {
      scope: '/',
      type: 'module',
      updateViaCache: 'none',
    });
    const worker = registration.installing ?? registration.waiting;
    if (
      worker &&
      worker.state !== 'activated' &&
      worker.state !== 'redundant'
    ) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timeout);
          worker.removeEventListener('statechange', changed);
          resolve();
        };
        const changed = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            finish();
          }
        };
        // Keep the app usable when offline or worker installation fails.
        const timeout = setTimeout(finish, 5000);
        worker.addEventListener('statechange', changed);
        changed();
      });
    }
  } catch (error) {
    console.warn('Service worker update failed', error);
  }
}
