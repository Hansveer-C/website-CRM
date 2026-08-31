import SignaturePad from 'signature_pad';

export interface QuoteSignatureAcceptanceResult {
  quoteId: string;
  signerName: string;
  agreedToTerms: boolean;
  hasSignature: boolean;
  signatureDataUrl: string | null;
  accessibleDeclaration: boolean;
  acceptedAt: string;
}

export interface QuotesSignatureOptions {
  quoteId?: string;
  editable?: boolean;
  onValidationChange?: (isValid: boolean, result: QuoteSignatureAcceptanceResult) => void;
  onSubmitAcceptance?: (result: QuoteSignatureAcceptanceResult) => void | Promise<void>;
}

export interface QuotesSignatureController {
  destroy: () => void;
  isDestroyed: () => boolean;
  clear: () => void;
  isEmpty: () => boolean;
  isValid: () => boolean;
  getResult: () => QuoteSignatureAcceptanceResult;
  resize: () => void;
}

const activeSignatureControllers = new WeakMap<HTMLElement, QuotesSignatureController>();

export function initQuotesSignature(
  root: HTMLElement,
  options: QuotesSignatureOptions = {}
): QuotesSignatureController {
  if (!root) {
    return {
      destroy: () => {},
      isDestroyed: () => true,
      clear: () => {},
      isEmpty: () => true,
      isValid: () => false,
      getResult: () => ({
        quoteId: options.quoteId || '',
        signerName: '',
        agreedToTerms: false,
        hasSignature: false,
        signatureDataUrl: null,
        accessibleDeclaration: false,
        acceptedAt: ''
      }),
      resize: () => {}
    };
  }

  // Duplicate-init protection: destroy existing controller if present on same root
  const existing = activeSignatureControllers.get(root);
  if (existing && !existing.isDestroyed()) {
    existing.destroy();
  }

  let isDestroyed = false;

  const signerNameInput = root.querySelector<HTMLInputElement>('.wo-quote-signer-name');
  const attestationCheckbox = root.querySelector<HTMLInputElement>('.wo-quote-attestation-checkbox');
  const accessibleCheckbox = root.querySelector<HTMLInputElement>('.wo-quote-accessible-sign-checkbox');
  const canvas = root.querySelector<HTMLCanvasElement>('.wo-quote-signature-canvas');
  const clearBtn = root.querySelector<HTMLButtonElement>('.wo-quote-signature-clear');
  const submitBtn = root.querySelector<HTMLButtonElement>('.wo-quote-accept-submit-btn');
  const statusEl = root.querySelector<HTMLElement>('.wo-quote-signature-status');

  let pad: SignaturePad | null = null;

  if (canvas) {
    try {
      pad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(15, 23, 42)',
        minWidth: 1.0,
        maxWidth: 2.5,
        throttle: 16
      });
    } catch (err) {
      console.warn('[QuotesSignature] SignaturePad failed to initialize:', err);
    }
  }

  function resizeCanvas(): void {
    if (!canvas || !pad || isDestroyed) return;
    try {
      const ratio = typeof window !== 'undefined'
        ? Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
        : 1;
      const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
      const displayWidth = (rect && rect.width > 0) ? rect.width : (canvas.clientWidth || 400);
      const displayHeight = (rect && rect.height > 0) ? rect.height : (canvas.clientHeight || 160);

      const targetWidth = Math.round(displayWidth * ratio);
      const targetHeight = Math.round(displayHeight * ratio);

      if (canvas.width === targetWidth && canvas.height === targetHeight) {
        return;
      }

      // Preserve existing stroke data across resize
      const existingData = pad.isEmpty() ? null : pad.toData();

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (ctx && typeof ctx.scale === 'function') {
        ctx.scale(ratio, ratio);
      }

      pad.clear();
      if (existingData && existingData.length > 0) {
        pad.fromData(existingData);
      }
    } catch {
      // Ignore in mock/headless environments
    }
  }

  // Initial DPI sizing
  resizeCanvas();

  function getSignerName(): string {
    return (signerNameInput?.value || '').trim();
  }

  function isAgreed(): boolean {
    return Boolean(attestationCheckbox?.checked);
  }

  function isAccessibleDeclared(): boolean {
    return Boolean(accessibleCheckbox?.checked);
  }

  function hasDrawnSignature(): boolean {
    if (!pad) return false;
    return !pad.isEmpty();
  }

  function isFormValid(): boolean {
    const nameValid = getSignerName().length > 0;
    const agreed = isAgreed();
    const signatureOrAccessible = hasDrawnSignature() || isAccessibleDeclared();
    return nameValid && agreed && signatureOrAccessible;
  }

  function getResult(includeSignatureData = true): QuoteSignatureAcceptanceResult {
    let signatureDataUrl: string | null = null;
    const hasSig = hasDrawnSignature();
    if (includeSignatureData && hasSig && pad) {
      try {
        signatureDataUrl = pad.toDataURL('image/png');
      } catch {
        signatureDataUrl = null;
      }
    }

    return {
      quoteId: options.quoteId || root.getAttribute('data-quote-id') || '',
      signerName: getSignerName(),
      agreedToTerms: isAgreed(),
      hasSignature: hasSig,
      signatureDataUrl,
      accessibleDeclaration: isAccessibleDeclared(),
      acceptedAt: new Date().toISOString()
    };
  }

  function updateValidationState(): void {
    if (isDestroyed) return;
    const valid = isFormValid();
    // Validation consumers need only metadata. Keep image serialization at the
    // explicit acceptance boundary so it is not retained or forwarded on every stroke.
    const result = getResult(false);

    if (submitBtn) {
      submitBtn.disabled = !valid;
    }

    if (statusEl) {
      if (valid) {
        statusEl.textContent = 'Ready to submit acceptance.';
        statusEl.className = 'wo-quote-signature-status wo-quote-signature-status--ready';
      } else {
        const missing: string[] = [];
        if (!result.signerName) missing.push('signer name');
        if (!result.hasSignature && !result.accessibleDeclaration) missing.push('signature or accessible sign');
        if (!result.agreedToTerms) missing.push('terms agreement');
        statusEl.textContent = missing.length > 0 ? `Required: ${missing.join(', ')}.` : '';
        statusEl.className = 'wo-quote-signature-status';
      }
    }

    if (typeof options.onValidationChange === 'function') {
      try {
        options.onValidationChange(valid, result);
      } catch (err) {
        console.error('[QuotesSignature] onValidationChange error:', err);
      }
    }
  }

  // Event handlers
  const handleInput = () => updateValidationState();
  const handleChange = () => updateValidationState();

  const handleClear = (event: MouseEvent) => {
    event.preventDefault();
    if (pad) {
      pad.clear();
    }
    updateValidationState();
  };

  const handleSubmit = (event: MouseEvent) => {
    event.preventDefault();
    if (!isFormValid()) {
      updateValidationState();
      return;
    }

    const result = getResult();
    if (typeof options.onSubmitAcceptance === 'function') {
      try {
        options.onSubmitAcceptance(result);
      } catch (err) {
        console.error('[QuotesSignature] onSubmitAcceptance error:', err);
      }
    }
  };

  const handleWindowResize = () => {
    resizeCanvas();
  };

  // Wire event listeners
  signerNameInput?.addEventListener('input', handleInput);
  attestationCheckbox?.addEventListener('change', handleChange);
  accessibleCheckbox?.addEventListener('change', handleChange);
  clearBtn?.addEventListener('click', handleClear);
  submitBtn?.addEventListener('click', handleSubmit);

  if (pad) {
    pad.addEventListener('endStroke', updateValidationState);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize);
  }

  // Initial validation check
  updateValidationState();

  const controller: QuotesSignatureController = {
    destroy: () => {
      if (isDestroyed) return;
      isDestroyed = true;

      signerNameInput?.removeEventListener('input', handleInput);
      attestationCheckbox?.removeEventListener('change', handleChange);
      accessibleCheckbox?.removeEventListener('change', handleChange);
      clearBtn?.removeEventListener('click', handleClear);
      submitBtn?.removeEventListener('click', handleSubmit);

      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowResize);
      }

      if (pad) {
        try {
          pad.off();
          pad.clear();
        } catch {
          // ignore
        }
        pad = null;
      }

      activeSignatureControllers.delete(root);
    },
    isDestroyed: () => isDestroyed,
    clear: () => {
      if (pad) {
        pad.clear();
      }
      updateValidationState();
    },
    isEmpty: () => {
      if (!pad) return true;
      return pad.isEmpty();
    },
    isValid: () => isFormValid(),
    getResult,
    resize: () => resizeCanvas()
  };

  activeSignatureControllers.set(root, controller);
  return controller;
}
