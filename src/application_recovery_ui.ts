import { PasswordRecoveryController, readRecoveryRoute, type RecoveryClient } from './application_recovery';

/** Runs before the ordinary auth client/router. Recovery never hydrates the CRM. */
export function createPasswordRecoveryRouter(factory: () => Promise<RecoveryClient | null>) {
  let controller: PasswordRecoveryController | undefined;
  let root: HTMLElement | undefined;
  let active = false;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const node = document.createElement(tag); if (text) node.textContent = text; return node;
  };
  function paint() {
    if (!controller || !root?.isConnected) return;
    const current = controller;
    root.replaceChildren();
    const card = element('section'); card.className = 'application-auth-card';
    const heading = element('h1', ['ready', 'saving'].includes(current.phase) ? 'Set a new password' : 'Reset your password');
    card.append(heading);
    const status = element('p', current.message); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    card.append(status);
    const busy = ['requesting', 'checking', 'saving'].includes(current.phase);
    card.setAttribute('aria-busy', String(busy));
    if (current.phase === 'request' || current.phase === 'ready') {
      const form = element('form');
      function input(labelText: string, type: string, autocomplete: string) {
        const label = element('label', labelText), field = element('input');
        field.type = type; field.autocomplete = autocomplete as AutoFill;
        field.required = true; field.maxLength = type === 'email' ? 254 : 128;
        label.append(field); form.append(label); return field;
      }
      const updating = current.phase === 'ready';
      const first = input(updating ? 'New password' : 'Email', updating ? 'password' : 'email', updating ? 'new-password' : 'email');
      const second = updating ? input('Confirm new password', 'password', 'new-password') : undefined;
      if (updating) { first.minLength = 8; if (second) second.minLength = 8; }
      const submit = element('button', updating ? 'Update password' : 'Send reset instructions'); submit.type = 'submit'; submit.className = 'btn-primary'; form.append(submit);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const pending = updating ? current.update(first.value, second?.value ?? '') : current.request(first.value);
        first.value = ''; if (second) second.value = '';
        paint(); await pending;
        if (controller === current) paint();
      });
      card.append(form);
    } else if (busy) card.append(element('p', current.phase === 'checking' ? 'Checking recovery link…' : 'Please wait…'));
    else if (current.phase !== 'done') {
      const retry = element('button', 'Request a new link'); retry.type = 'button';
      retry.addEventListener('click', async () => {
        await current.cancel(); controller = new PasswordRecoveryController(factory, location.origin);
        history.replaceState({}, '', '/#/forgot-password'); active = false; paint();
      }); card.append(retry);
    }
    const back = element('a', 'Back to sign in'); back.href = '/#/login';
    back.addEventListener('click', () => { active = false; controller = undefined; void current.cancel(); });
    card.append(back); root.append(card);
    // Restore keyboard position after replacing the form/status during async work.
    (card.querySelector('input,button,a') as HTMLElement | null)?.focus();
  }
  const handle = async (app: HTMLElement): Promise<boolean> => {
    const route = readRecoveryRoute(location.href);
    if (!active && route.kind === 'none') { void controller?.cancel(); controller = undefined; root = undefined; return false; }
    if (!active || !controller) {
      void controller?.cancel();
      controller = new PasswordRecoveryController(factory, location.origin);
      active = route.kind !== 'request';
      if (active) {
        // Remove the entire callback, including provider errors, before loading SDK/network code.
        history.replaceState({}, '', '/#/reset-password');
        let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'referrer'; document.head.append(meta); }
        meta.content = 'no-referrer';
      }
      root = element('main'); root.className = 'application-auth-shell'; app.replaceChildren(root);
      if (active) { const pending = controller.start(route); paint(); await pending; paint(); return true; }
    }
    if (active && location.hash !== '#/reset-password') history.replaceState({}, '', '/#/reset-password');
    paint(); return true;
  };
  return Object.assign(handle, { isActive: () => active });
}
