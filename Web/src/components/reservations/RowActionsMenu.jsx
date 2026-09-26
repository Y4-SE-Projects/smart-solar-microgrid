// File: RowActionsMenu.jsx
// Purpose: Compact "more actions" (⋯) menu for a table row. The list renders in a portal with fixed
//          positioning, so the table's horizontal scroll container can never clip it.
//
// items: [{ key, label, icon, onSelect, tone?: 'danger' }]

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 176;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

function measureMenu(trigger, itemCount) {
    const rect = trigger.getBoundingClientRect();
    const height = itemCount * 40 + 8;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < height && rect.top > spaceBelow;

    return {
        left: Math.max(
            VIEWPORT_MARGIN,
            Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN)
        ),
        top: openUp ? undefined : rect.bottom + MENU_GAP,
        bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
    };
}

export default function RowActionsMenu({ items, label = 'More actions' }) {
    const menuId = useId();
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const itemRefs = useRef([]);
    const [position, setPosition] = useState(null);

    const isOpen = position !== null;

    function open() {
        setPosition(measureMenu(triggerRef.current, items.length));
    }

    function close(refocus = false) {
        setPosition(null);
        if (refocus) triggerRef.current?.focus();
    }

    function handleSelect(item) {
        close();
        item.onSelect();
    }

    // Focus the first item when the menu opens
    useEffect(() => {
        if (isOpen) itemRefs.current[0]?.focus();
    }, [isOpen]);

    // Close on outside press, and on scroll or resize ( the fixed menu would otherwise drift from its row )
    useEffect(() => {
        if (!isOpen) return undefined;

        function handlePointerDown(event) {
            if (
                !menuRef.current?.contains(event.target) &&
                !triggerRef.current?.contains(event.target)
            ) {
                setPosition(null);
            }
        }

        function handleViewportChange() {
            setPosition(null);
        }

        document.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [isOpen]);

    function handleMenuKeyDown(event) {
        const current = itemRefs.current.indexOf(document.activeElement);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            itemRefs.current[(current + 1) % items.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            itemRefs.current[(current - 1 + items.length) % items.length]?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        } else if (event.key === 'Tab') {
            close();
        }
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                onClick={() => (isOpen ? close() : open())}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-high ${isOpen
                        ? 'border-secondary bg-surface-container-high'
                        : 'border-border-slate bg-canvas-bg'
                    }`}
            >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                    more_horiz
                </span>
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        id={menuId}
                        role="menu"
                        aria-label={label}
                        onKeyDown={handleMenuKeyDown}
                        style={{
                            left: position.left,
                            top: position.top,
                            bottom: position.bottom,
                            width: MENU_WIDTH,
                        }}
                        className="fixed z-110 flex flex-col gap-0.5 overflow-hidden rounded-xl border border-border-slate bg-surface-container-lowest p-1 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_4px_-2px_rgba(15,23,42,0.06)]"
                    >
                        {items.map((item, index) => (
                            <button
                                key={item.key}
                                ref={(element) => {
                                    itemRefs.current[index] = element;
                                }}
                                type="button"
                                role="menuitem"
                                onClick={() => handleSelect(item)}
                                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-body-sm font-semibold outline-none transition-colors focus-visible:bg-on-surface/6 ${item.tone === 'danger'
                                        ? 'text-alert-danger hover:bg-error-container focus-visible:bg-error-container'
                                        : 'text-on-surface hover:bg-on-surface/6'
                                    }`}
                            >
                                <span aria-hidden="true" className="material-symbols-outlined text-[17px]">
                                    {item.icon}
                                </span>
                                {item.label}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}
