// File: CustomSelect.jsx
// Purpose: Reusable, keyboard-accessible single-choice dropdown.

import { useEffect, useId, useRef, useState } from 'react';

export default function CustomSelect({
    id,
    value,
    options = [],
    onChange,
    getOptionValue,
    getOptionLabel,
    placeholder = 'Select an option',
    disabled = false,
    required = false,
}) {
    const generatedId = useId();
    const triggerId = id || `custom-select-${generatedId}`;
    const listboxId = `${triggerId}-options`;
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const optionRefs = useRef([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const selectedIndex = options.findIndex(
        (option) => getOptionValue(option) === value
    );
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
    const isDisabled = disabled || options.length === 0;

    useEffect(() => {
        if (!isOpen) return undefined;

        function handleOutsidePointer(event) {
            if (!rootRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('pointerdown', handleOutsidePointer);
        return () => document.removeEventListener('pointerdown', handleOutsidePointer);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) optionRefs.current[activeIndex]?.focus();
    }, [isOpen, activeIndex]);

    function openAt(index) {
        if (isDisabled) return;
        setActiveIndex(index);
        setIsOpen(true);
    }

    function closeAndFocusTrigger() {
        setIsOpen(false);
        triggerRef.current?.focus();
    }

    function selectOption(option) {
        onChange(getOptionValue(option));
        closeAndFocusTrigger();
    }

    function moveActive(index) {
        setActiveIndex(index);
        optionRefs.current[index]?.focus();
    }

    function handleTriggerKeyDown(event) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            openAt(selectedIndex >= 0 ? selectedIndex : 0);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAt(selectedIndex >= 0 ? selectedIndex : options.length - 1);
        }
    }

    function handleListKeyDown(event) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActive((activeIndex + 1) % options.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActive((activeIndex - 1 + options.length) % options.length);
        } else if (event.key === 'Home') {
            event.preventDefault();
            moveActive(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            moveActive(options.length - 1);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectOption(options[activeIndex]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeAndFocusTrigger();
        }
    }

    return (
        <div
            ref={rootRef}
            className="relative w-full"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsOpen(false);
                }
            }}
        >
            <button
                ref={triggerRef}
                id={triggerId}
                type="button"
                disabled={isDisabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-required={required}
                onClick={() => {
                    if (isOpen) {
                        setIsOpen(false);
                    } else {
                        openAt(selectedIndex >= 0 ? selectedIndex : 0);
                    }
                }}
                onKeyDown={handleTriggerKeyDown}
                className="w-full h-10 px-space-md flex items-center justify-between gap-2 text-left bg-canvas-bg text-body-md text-on-surface rounded-xl border border-border-slate focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
                <span className={`min-w-0 truncate ${selectedOption ? '' : 'text-outline'}`}>
                    {selectedOption ? getOptionLabel(selectedOption) : placeholder}
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-labelledby={triggerId}
                    onKeyDown={handleListKeyDown}
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border-slate bg-surface-container-lowest shadow-sm"
                >
                    {options.map((option, index) => {
                        const optionValue = getOptionValue(option);
                        const isSelected = optionValue === value;

                        return (
                            <div
                                key={String(optionValue)}
                                ref={(element) => {
                                    optionRefs.current[index] = element;
                                }}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={index === activeIndex ? 0 : -1}
                                onClick={() => selectOption(option)}
                                className={`px-space-md py-2 text-body-md cursor-pointer outline-none ${isSelected
                                        ? 'bg-mint-surface text-primary font-semibold'
                                        : 'text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low'
                                    }`}
                            >
                                {getOptionLabel(option)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}