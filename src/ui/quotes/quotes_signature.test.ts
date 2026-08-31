import { describe, expect, it, vi } from 'vitest';
import { initQuotesSignature, type QuoteSignatureAcceptanceResult } from './quotes_signature';

class MockContext2D {
  scale = vi.fn();
  clearRect = vi.fn();
  fillRect = vi.fn();
  beginPath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  stroke = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  closePath = vi.fn();
  fillStyle = '#ffffff';
  strokeStyle = '#000000';
  lineWidth = 1;
}

if (typeof (globalThis as any).navigator === 'undefined') {
  (globalThis as any).navigator = { maxTouchPoints: 0, userAgent: 'test-agent' };
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    devicePixelRatio: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
}

function createMockCanvas(options: { width?: number; height?: number } = {}): HTMLCanvasElement {
  const listeners: Record<string, Function[]> = {};
  const context = new MockContext2D();

  const canvas = {
    style: { touchAction: '' },
    width: options.width ?? 400,
    height: options.height ?? 160,
    clientWidth: options.width ?? 400,
    clientHeight: options.height ?? 160,
    getContext: vi.fn((type: string) => (type === '2d' ? context : null)),
    getBoundingClientRect: vi.fn(() => ({
      width: options.width ?? 400,
      height: options.height ?? 160,
      top: 0,
      left: 0,
      right: options.width ?? 400,
      bottom: options.height ?? 160,
      x: 0,
      y: 0,
      toJSON: () => {}
    })),
    toDataURL: vi.fn((type = 'image/png') => `data:${type};base64,mocksignaturedata`),
    addEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const handlers = listeners[event.type] || [];
      handlers.forEach(h => h(event));
      return true;
    })
  } as unknown as HTMLCanvasElement;

  return canvas;
}

function createMockAcceptanceDom(quoteId = 'q-101') {
  const canvas = createMockCanvas();

  const signerNameInput = {
    value: '',
    addEventListener: vi.fn((evt: string, handler: Function) => {
      signerListeners[evt] = signerListeners[evt] || [];
      signerListeners[evt].push(handler);
    }),
    removeEventListener: vi.fn((evt: string, handler: Function) => {
      if (signerListeners[evt]) signerListeners[evt] = signerListeners[evt].filter(h => h !== handler);
    })
  } as unknown as HTMLInputElement;
  const signerListeners: Record<string, Function[]> = {};

  const attestationCheckbox = {
    checked: false,
    addEventListener: vi.fn((evt: string, handler: Function) => {
      attestListeners[evt] = attestListeners[evt] || [];
      attestListeners[evt].push(handler);
    }),
    removeEventListener: vi.fn((evt: string, handler: Function) => {
      if (attestListeners[evt]) attestListeners[evt] = attestListeners[evt].filter(h => h !== handler);
    })
  } as unknown as HTMLInputElement;
  const attestListeners: Record<string, Function[]> = {};

  const accessibleCheckbox = {
    checked: false,
    addEventListener: vi.fn((evt: string, handler: Function) => {
      accessibleListeners[evt] = accessibleListeners[evt] || [];
      accessibleListeners[evt].push(handler);
    }),
    removeEventListener: vi.fn((evt: string, handler: Function) => {
      if (accessibleListeners[evt]) accessibleListeners[evt] = accessibleListeners[evt].filter(h => h !== handler);
    })
  } as unknown as HTMLInputElement;
  const accessibleListeners: Record<string, Function[]> = {};

  const clearBtn = {
    addEventListener: vi.fn((evt: string, handler: Function) => {
      clearListeners[evt] = clearListeners[evt] || [];
      clearListeners[evt].push(handler);
    }),
    removeEventListener: vi.fn((evt: string, handler: Function) => {
      if (clearListeners[evt]) clearListeners[evt] = clearListeners[evt].filter(h => h !== handler);
    })
  } as unknown as HTMLButtonElement;
  const clearListeners: Record<string, Function[]> = {};

  const submitBtn = {
    disabled: true,
    addEventListener: vi.fn((evt: string, handler: Function) => {
      submitListeners[evt] = submitListeners[evt] || [];
      submitListeners[evt].push(handler);
    }),
    removeEventListener: vi.fn((evt: string, handler: Function) => {
      if (submitListeners[evt]) submitListeners[evt] = submitListeners[evt].filter(h => h !== handler);
    })
  } as unknown as HTMLButtonElement;
  const submitListeners: Record<string, Function[]> = {};

  const statusEl = {
    textContent: '',
    className: ''
  } as unknown as HTMLElement;

  const root = {
    getAttribute: vi.fn((attr: string) => (attr === 'data-quote-id' ? quoteId : null)),
    querySelector: vi.fn((selector: string) => {
      if (selector === '.wo-quote-signer-name') return signerNameInput;
      if (selector === '.wo-quote-attestation-checkbox') return attestationCheckbox;
      if (selector === '.wo-quote-accessible-sign-checkbox') return accessibleCheckbox;
      if (selector === '.wo-quote-signature-canvas') return canvas;
      if (selector === '.wo-quote-signature-clear') return clearBtn;
      if (selector === '.wo-quote-accept-submit-btn') return submitBtn;
      if (selector === '.wo-quote-signature-status') return statusEl;
      return null;
    })
  } as unknown as HTMLElement;

  return {
    root,
    canvas,
    signerNameInput,
    signerListeners,
    attestationCheckbox,
    attestListeners,
    accessibleCheckbox,
    accessibleListeners,
    clearBtn,
    clearListeners,
    submitBtn,
    submitListeners,
    statusEl
  };
}

describe('QuotesSignatureController', () => {
  it('handles null or missing root safely', () => {
    const controller = initQuotesSignature(null as any);
    expect(controller.isDestroyed()).toBe(true);
    expect(controller.isEmpty()).toBe(true);
    expect(controller.isValid()).toBe(false);
    expect(controller.getResult().hasSignature).toBe(false);
    expect(() => controller.clear()).not.toThrow();
    expect(() => controller.resize()).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
  });

  it('initializes on expected DOM surface and evaluates initial invalid state', () => {
    const dom = createMockAcceptanceDom('quote-test-1');
    const onValidationChange = vi.fn();
    const controller = initQuotesSignature(dom.root, {
      quoteId: 'quote-test-1',
      editable: true,
      onValidationChange
    });

    expect(controller.isDestroyed()).toBe(false);
    expect(controller.isEmpty()).toBe(true);
    expect(controller.isValid()).toBe(false);
    expect(dom.submitBtn.disabled).toBe(true);
    expect(dom.statusEl.textContent).toContain('Required');
    expect(onValidationChange).toHaveBeenCalledWith(false, expect.objectContaining({
      quoteId: 'quote-test-1',
      signerName: '',
      agreedToTerms: false,
      hasSignature: false
    }));

    controller.destroy();
  });

  it('prevents double-initialization on the same root by cleaning previous instance', () => {
    const dom = createMockAcceptanceDom('quote-dup-1');
    const controller1 = initQuotesSignature(dom.root, { quoteId: 'quote-dup-1' });
    expect(controller1.isDestroyed()).toBe(false);

    const controller2 = initQuotesSignature(dom.root, { quoteId: 'quote-dup-1' });
    expect(controller1.isDestroyed()).toBe(true);
    expect(controller2.isDestroyed()).toBe(false);

    controller2.destroy();
    expect(controller2.isDestroyed()).toBe(true);
  });

  it('validates and enables submission via the accessible non-pointer signing path', () => {
    const dom = createMockAcceptanceDom('quote-access-1');
    const onSubmitAcceptance = vi.fn();
    const onValidationChange = vi.fn();

    const controller = initQuotesSignature(dom.root, {
      quoteId: 'quote-access-1',
      onSubmitAcceptance,
      onValidationChange
    });

    // 1. Enter signer name
    dom.signerNameInput.value = 'Morgan Taylor';
    dom.signerListeners['input']?.forEach(fn => fn());
    expect(controller.isValid()).toBe(false);
    expect(dom.submitBtn.disabled).toBe(true);

    // 2. Check terms attestation
    dom.attestationCheckbox.checked = true;
    dom.attestListeners['change']?.forEach(fn => fn());
    // Still needs signature or accessible declaration
    expect(controller.isValid()).toBe(false);
    expect(dom.submitBtn.disabled).toBe(true);

    // 3. Check accessible non-pointer declaration
    dom.accessibleCheckbox.checked = true;
    dom.accessibleListeners['change']?.forEach(fn => fn());

    expect(controller.isValid()).toBe(true);
    expect(dom.submitBtn.disabled).toBe(false);
    expect(dom.statusEl.textContent).toContain('Ready to submit');

    // 4. Click submit
    const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
    dom.submitListeners['click']?.forEach(fn => fn(mockEvent));

    expect(onSubmitAcceptance).toHaveBeenCalledWith(expect.objectContaining({
      quoteId: 'quote-access-1',
      signerName: 'Morgan Taylor',
      agreedToTerms: true,
      hasSignature: false,
      accessibleDeclaration: true
    }));

    controller.destroy();
  });

  it('clears signature and recalculates validation when clear button is clicked', () => {
    const dom = createMockAcceptanceDom('quote-clear-1');
    const controller = initQuotesSignature(dom.root, { quoteId: 'quote-clear-1' });

    dom.signerNameInput.value = 'Chris Pine';
    dom.attestationCheckbox.checked = true;

    // Simulate clicking clear button
    const mockClick = { preventDefault: vi.fn() } as unknown as MouseEvent;
    dom.clearListeners['click']?.forEach(fn => fn(mockClick));

    expect(mockClick.preventDefault).toHaveBeenCalled();
    expect(controller.isEmpty()).toBe(true);
    expect(controller.isValid()).toBe(false);

    controller.destroy();
  });

  it('performs canvas DPI scaling and safe resize', () => {
    const dom = createMockAcceptanceDom('quote-dpi-1');
    const controller = initQuotesSignature(dom.root, { quoteId: 'quote-dpi-1' });

    // Initial resize is executed during initialization
    expect(dom.canvas.getContext).toHaveBeenCalledWith('2d', expect.anything());

    // Trigger explicit resize
    expect(() => controller.resize()).not.toThrow();

    controller.destroy();
  });

  it('caps high-DPI canvas sizing to a bounded ratio', () => {
    const previousRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 8 });
    const dom = createMockAcceptanceDom('quote-dpi-cap-1');
    const controller = initQuotesSignature(dom.root, { quoteId: 'quote-dpi-cap-1' });

    expect(dom.canvas.width).toBe(1200);
    expect(dom.canvas.height).toBe(480);

    controller.destroy();
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: previousRatio });
  });

  it('keeps validation callback results free of signature image data', () => {
    const dom = createMockAcceptanceDom('quote-validation-data-1');
    const onValidationChange = vi.fn();
    const controller = initQuotesSignature(dom.root, { quoteId: 'quote-validation-data-1', onValidationChange });

    const latestResult = onValidationChange.mock.calls.at(-1)?.[1] as QuoteSignatureAcceptanceResult;
    expect(latestResult.signatureDataUrl).toBeNull();

    controller.destroy();
  });

  it('removes all event listeners on destroy and disables subsequent calls', () => {
    const dom = createMockAcceptanceDom('quote-destroy-1');
    const controller = initQuotesSignature(dom.root, { quoteId: 'quote-destroy-1' });

    expect(controller.isDestroyed()).toBe(false);
    controller.destroy();
    expect(controller.isDestroyed()).toBe(true);

    expect(dom.signerNameInput.removeEventListener).toHaveBeenCalled();
    expect(dom.attestationCheckbox.removeEventListener).toHaveBeenCalled();
    expect(dom.accessibleCheckbox.removeEventListener).toHaveBeenCalled();
    expect(dom.clearBtn.removeEventListener).toHaveBeenCalled();
    expect(dom.submitBtn.removeEventListener).toHaveBeenCalled();
  });
});
