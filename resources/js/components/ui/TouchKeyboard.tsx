import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Mode = 'text' | 'number';

const TEXT_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function touchDevice() {
    return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
}

function isTextField(target: EventTarget | null): target is Field {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return false;
    }
    if (target.disabled || target.readOnly) {
        return false;
    }
    if (target instanceof HTMLTextAreaElement) {
        return true;
    }
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'submit', 'reset', 'image', 'date', 'time', 'datetime-local', 'month', 'week'].includes(target.type);
}

function wantsNumber(field: Field) {
    if (!(field instanceof HTMLInputElement)) {
        return false;
    }
    const mode = field.dataset.keyboardInputmode || field.getAttribute('inputmode') || '';
    return field.type === 'number' || field.type === 'tel' || mode === 'numeric' || mode === 'decimal' || mode === 'tel';
}

function arm(field: Field) {
    if (field.dataset.keyboardArmed === '1') {
        return;
    }
    field.dataset.keyboardInputmode = field.getAttribute('inputmode') ?? '';
    field.dataset.keyboardArmed = '1';
    field.setAttribute('inputmode', 'none');
}

function disarm(field: Field) {
    if (field.dataset.keyboardArmed !== '1') {
        return;
    }
    const previous = field.dataset.keyboardInputmode ?? '';
    if (previous) {
        field.setAttribute('inputmode', previous);
    } else {
        field.removeAttribute('inputmode');
    }
    delete field.dataset.keyboardArmed;
    delete field.dataset.keyboardInputmode;
}

function writeValue(field: Field, value: string) {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertAtCaret(field: Field, text: string) {
    if (field instanceof HTMLInputElement && field.type === 'number') {
        const next = `${field.value}${text}`.replace(/[^0-9.]/g, '');
        const [whole, fraction, extra] = next.split('.');
        writeValue(field, extra !== undefined ? `${whole}.${fraction}` : next);
        return;
    }
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const next = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
    writeValue(field, next);
    const caret = start + text.length;
    window.requestAnimationFrame(() => {
        if (field.isConnected) {
            field.setSelectionRange(caret, caret);
        }
    });
}

const SCROLL_REGIONS = '[data-app-scroll]';

function scrollPaddingTargets(): HTMLElement[] {
    return [...document.querySelectorAll(SCROLL_REGIONS)].filter((node): node is HTMLElement => node instanceof HTMLElement);
}

function clearKeyboardScrollPadding() {
    scrollPaddingTargets().forEach((region) => {
        region.style.removeProperty('padding-bottom');
        region.style.removeProperty('scroll-padding-bottom');
    });
}

function scrollableAncestor(node: HTMLElement | null): HTMLElement | null {
    let parent = node?.parentElement ?? null;
    while (parent) {
        const style = window.getComputedStyle(parent);
        const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1;
        if (scrollable) {
            return parent;
        }
        parent = parent.parentElement;
    }

    return null;
}

function ensureFieldAboveKeyboard(field: Field, keyboardTop: number) {
    const margin = 20;
    const limit = keyboardTop - margin;
    const rect = field.getBoundingClientRect();
    if (rect.bottom <= limit && rect.top >= margin) {
        return;
    }

    if (rect.bottom > limit) {
        const delta = rect.bottom - limit;
        const region = scrollableAncestor(field);
        if (region) {
            region.scrollBy({ top: delta, behavior: 'smooth' });
        } else {
            window.scrollBy({ top: delta, behavior: 'smooth' });
        }
    } else if (rect.top < margin) {
        const delta = rect.top - margin;
        const region = scrollableAncestor(field);
        if (region) {
            region.scrollBy({ top: delta, behavior: 'smooth' });
        } else {
            window.scrollBy({ top: delta, behavior: 'smooth' });
        }
    }

    window.requestAnimationFrame(() => {
        field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
}

function backspace(field: Field) {
    if (field instanceof HTMLInputElement && field.type === 'number') {
        writeValue(field, field.value.slice(0, -1));
        return;
    }
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    if (start === 0 && end === 0) {
        return;
    }
    const from = start === end ? start - 1 : start;
    const next = `${field.value.slice(0, Math.max(0, from))}${field.value.slice(end)}`;
    writeValue(field, next);
    const caret = Math.max(0, from);
    window.requestAnimationFrame(() => {
        if (field.isConnected) {
            field.setSelectionRange(caret, caret);
        }
    });
}

export default function TouchKeyboard() {
    const fieldRef = useRef<Field | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>('text');
    const [numberOnly, setNumberOnly] = useState(false);
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let active = touchDevice();
        setEnabled(active);

        const rememberTouch = () => {
            active = true;
            setEnabled(true);
        };

        const onPointerDown = (event: PointerEvent) => {
            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                rememberTouch();
            }
            const target = event.target;
            if (target instanceof Node && panelRef.current?.contains(target)) {
                event.preventDefault();
                return;
            }
            if (active && isTextField(target)) {
                arm(target);
            }
        };

        const onFocus = (event: FocusEvent) => {
            if (!active || !isTextField(event.target)) {
                return;
            }
            arm(event.target);
            fieldRef.current = event.target;
            const numeric = wantsNumber(event.target);
            setNumberOnly(numeric);
            setMode(numeric ? 'number' : 'text');
            setOpen(true);
        };

        const onFocusOut = (event: FocusEvent) => {
            const next = event.relatedTarget;
            if (next instanceof Node && panelRef.current?.contains(next)) {
                return;
            }
            if (isTextField(event.target)) {
                disarm(event.target);
            }
            if (fieldRef.current === event.target) {
                fieldRef.current = null;
                setOpen(false);
            }
        };

        window.addEventListener('touchstart', rememberTouch, { capture: true, passive: true });
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('focusin', onFocus);
        window.addEventListener('focusout', onFocusOut);
        return () => {
            window.removeEventListener('touchstart', rememberTouch, true);
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('focusin', onFocus);
            window.removeEventListener('focusout', onFocusOut);
        };
    }, []);

    useLayoutEffect(() => {
        if (!open) {
            clearKeyboardScrollPadding();
            return;
        }

        const field = fieldRef.current;
        const panel = panelRef.current;
        if (!field || !panel) {
            return;
        }

        const keyboardTop = panel.getBoundingClientRect().top;
        const reserve = window.innerHeight - keyboardTop + 12;

        scrollPaddingTargets().forEach((region) => {
            region.style.paddingBottom = `${reserve}px`;
            region.style.scrollPaddingBottom = `${reserve}px`;
        });

        ensureFieldAboveKeyboard(field, keyboardTop);
    }, [open, mode]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const field = fieldRef.current;
        const panel = panelRef.current;
        if (!field || !panel) {
            return;
        }

        const repeat = () => ensureFieldAboveKeyboard(field, panel.getBoundingClientRect().top);
        const timer = window.setTimeout(repeat, 120);
        const onResize = () => repeat();
        window.addEventListener('resize', onResize);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, [open, mode]);

    function press(key: string) {
        const field = fieldRef.current;
        if (!field || !field.isConnected) {
            setOpen(false);
            return;
        }
        field.focus();
        if (key === 'back') {
            backspace(field);
            return;
        }
        if (key === 'clear') {
            writeValue(field, '');
            return;
        }
        if (key === 'space') {
            insertAtCaret(field, ' ');
            return;
        }
        insertAtCaret(field, key);
    }

    function done() {
        const field = fieldRef.current;
        if (field) {
            disarm(field);
            field.blur();
        }
        fieldRef.current = null;
        setOpen(false);
    }

    if (!enabled || !open) {
        return null;
    }

    const keyClass = 'flex min-h-12 items-center justify-center rounded-xl bg-white text-lg font-semibold text-[#102b2b] shadow-sm active:bg-[#fff4ec]';
    const doneClass = 'flex min-h-12 items-center justify-center rounded-xl bg-[#d97745] text-sm font-semibold text-white shadow-sm';
    const clearClass = 'flex min-h-12 items-center justify-center rounded-xl bg-[#102b2b] text-sm font-semibold text-white shadow-sm';

    return (
        <div
            ref={panelRef}
            className="fixed inset-x-0 bottom-8 z-[85] border-t border-[#102b2b]/10 bg-[#e7eeea] px-2 py-2 shadow-[0_-8px_24px_rgba(16,43,43,0.12)]"
            role="group"
            aria-label="Touch keyboard"
        >
            {mode === 'number' ? (
                <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map(key => (
                        <button key={key} type="button" className={keyClass} onPointerDown={(event) => { event.preventDefault(); press(key === 'back' ? 'back' : key); }}>
                            {key === 'back' ? '⌫' : key}
                        </button>
                    ))}
                    {numberOnly ? null : (
                        <button type="button" className={`${keyClass} text-sm`} onPointerDown={(event) => { event.preventDefault(); setMode('text'); }}>
                            ABC
                        </button>
                    )}
                    <button type="button" className={`${clearClass} ${numberOnly ? 'col-span-2' : ''}`} onPointerDown={(event) => { event.preventDefault(); press('clear'); }}>
                        Clear
                    </button>
                    <button type="button" className={doneClass} onPointerDown={(event) => { event.preventDefault(); done(); }}>
                        Done
                    </button>
                </div>
            ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
                    {TEXT_ROWS.map(row => (
                        <div key={row} className="flex justify-center gap-1">
                            {row.split('').map(key => (
                                <button key={key} type="button" className={`${keyClass} w-9 flex-1 sm:w-11`} onPointerDown={(event) => { event.preventDefault(); press(key); }}>
                                    {key}
                                </button>
                            ))}
                            {row === 'zxcvbnm' ? (
                                <button type="button" className={`${keyClass} w-12 flex-none px-2`} onPointerDown={(event) => { event.preventDefault(); press('back'); }}>
                                    ⌫
                                </button>
                            ) : null}
                        </div>
                    ))}
                    <div className="flex gap-1">
                        <button type="button" className={`${keyClass} w-16 flex-none text-sm`} onPointerDown={(event) => { event.preventDefault(); setMode('number'); }}>
                            123
                        </button>
                        <button type="button" className={`${keyClass} flex-1 text-sm`} onPointerDown={(event) => { event.preventDefault(); press('space'); }}>
                            Space
                        </button>
                        <button type="button" className={`${keyClass} w-12 flex-none`} onPointerDown={(event) => { event.preventDefault(); press('@'); }}>
                            @
                        </button>
                        <button type="button" className={`${keyClass} w-12 flex-none`} onPointerDown={(event) => { event.preventDefault(); press('.'); }}>
                            .
                        </button>
                        <button type="button" className={`${doneClass} w-20 flex-none`} onPointerDown={(event) => { event.preventDefault(); done(); }}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
