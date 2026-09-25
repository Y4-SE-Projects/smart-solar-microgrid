// File: Dropdown.jsx
// Purpose: The app's one dropdown, used in place of native <select> everywhere.
//          Follows the WAI-ARIA select-only combobox pattern: focus stays on the trigger and
//          the arrow keys move a highlight through the list. The list renders in a portal with
//          fixed positioning, so a scrolling modal or table can never clip it.
//          With `searchable`, the list opens with a filter box on top that takes focus instead,
//          and typing on the closed trigger opens it with that text already filtered.
//
// options: [{ value, label, description?, tone?: 'danger', hint?, disabled? }]
//   description: muted text on the right, e.g. a duration
//   tone 'danger': red tint, e.g. a deactivated station; pair it with a `hint` such as
//                  'deactivated' so the meaning isn't carried by colour alone

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LIST_GAP = 4;
const VIEWPORT_MARGIN = 8;
const MAX_LIST_HEIGHT = 288;
const MIN_LIST_WIDTH = 192;

const TRIGGER_SIZE = {
  field: 'h-9 w-full rounded-lg pl-3 pr-2 text-body-md',
  pill: 'h-10 rounded-full pl-4 pr-3 text-xs font-medium',
};

const TRIGGER_BACKGROUND = {
  field: 'bg-surface-container-lowest',
  pill: 'bg-canvas-bg',
};

const OPTION_TEXT = {
  field: 'text-body-md',
  pill: 'text-body-sm',
};

// Places the list under the trigger, or above it when there is clearly more room there
function measureList(trigger) {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - LIST_GAP - VIEWPORT_MARGIN;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const width = Math.max(rect.width, MIN_LIST_WIDTH);

  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)),
    width,
    top: openUp ? undefined : rect.bottom + LIST_GAP,
    bottom: openUp ? window.innerHeight - rect.top + LIST_GAP : undefined,
    maxHeight: Math.max(120, Math.min(MAX_LIST_HEIGHT, openUp ? spaceAbove : spaceBelow)),
  };
}

// Options whose label, description or hint contain every word of the query
function filterOptions(options, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const text = [option.label, option.description, option.hint].filter(Boolean).join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// First option that isn't disabled, searching from `from` in the direction of `step`
function findEnabled(list, from, step) {
  for (let i = from; i >= 0 && i < list.length; i += step) {
    if (!list[i].disabled) return i;
  }
  return -1;
}

export default function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  variant = 'field',
  className = '',
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
}) {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index) => `${id}-option-${index}`;

  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typeahead = useRef({ text: '', timer: 0 });
  const centerOnOpen = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);
  const [query, setQuery] = useState('');

  // Indexes below point into `visible`, which is `options` unless a search is narrowing it
  const visible = searchable ? filterOptions(options, query) : options;
  const selected = options.find((option) => option.value === value) ?? null;
  const selectedIndex = visible.findIndex((option) => option.value === value);
  const isDisabled = disabled || options.length === 0;
  const isDanger = selected?.tone === 'danger';

  function open(initialQuery = '') {
    if (isDisabled) return;
    const list = searchable ? filterOptions(options, initialQuery) : options;
    const selectedInList = list.findIndex((option) => option.value === value);
    centerOnOpen.current = true;
    setQuery(initialQuery);
    setActiveIndex(selectedInList >= 0 && !initialQuery ? selectedInList : findEnabled(list, 0, 1));
    setPosition(measureList(triggerRef.current));
    setIsOpen(true);
  }

  // refocus: hand focus back to the trigger, since with a search box it moved into the list
  function close(refocus = false) {
    setIsOpen(false);
    setQuery('');
    if (refocus && searchable) triggerRef.current?.focus();
  }

  function choose(index) {
    const option = visible[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close(true);
  }

  function move(step) {
    setActiveIndex((current) => {
      const next = findEnabled(visible, current + step, step);
      return next === -1 ? current : next;
    });
  }

  function handleSearchChange(event) {
    const text = event.target.value;
    setQuery(text);
    setActiveIndex(findEnabled(filterOptions(options, text), 0, 1));
  }

  // Type-to-find: collects keystrokes for a moment and matches the start of an option label
  function matchTypeahead(character) {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.text += character.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.text = '';
    }, 600);

    const from = isOpen ? activeIndex : selectedIndex;
    const offset = state.text.length === 1 ? 1 : 0; // a fresh single key moves past the current match
    for (let i = 0; i < options.length; i++) {
      const index = (from + offset + i + options.length) % options.length;
      const option = options[index];
      if (!option.disabled && option.label.toLowerCase().startsWith(state.text)) return index;
    }
    return -1;
  }

  // Keys shared by the trigger (select-only mode) and the search box (searchable mode)
  function handleListKeys(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return true;
      case 'Enter':
        event.preventDefault();
        choose(activeIndex);
        return true;
      case 'Escape':
        // Handled here so an enclosing modal doesn't also close
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return true;
      default:
        return false;
    }
  }

  function handleTriggerKeyDown(event) {
    const { key } = event;
    const isCharacter = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const isTyping = typeahead.current.text.length > 0;

    if (!isOpen) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || (key === ' ' && !isTyping)) {
        event.preventDefault();
        open();
      } else if (isCharacter && searchable) {
        event.preventDefault();
        open(key);
      } else if (isCharacter) {
        const match = matchTypeahead(key);
        if (match >= 0) choose(match);
      }
      return;
    }

    if (handleListKeys(event)) return;

    switch (key) {
      case 'Home':
        event.preventDefault();
        setActiveIndex(findEnabled(visible, 0, 1));
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(findEnabled(visible, visible.length - 1, -1));
        break;
      case 'Tab':
        close();
        break;
      default:
        if (key === ' ' && !isTyping) {
          event.preventDefault();
          choose(activeIndex);
        } else if (isCharacter) {
          const match = matchTypeahead(key);
          if (match >= 0) setActiveIndex(match);
        }
    }
  }

  function handleSearchKeyDown(event) {
    if (handleListKeys(event)) return;
    if (event.key === 'Tab') {
      // The list lives at the end of the page, so Tab goes back to the trigger instead of off the page
      event.preventDefault();
      close(true);
    }
  }

  // Closes when focus leaves both the trigger and the list, e.g. a click elsewhere on the page
  function handleBlur(event) {
    const next = event.relatedTarget;
    if (next && (next === triggerRef.current || popupRef.current?.contains(next))) return;
    close();
  }

  // Moves focus into the search box as the list opens
  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus();
  }, [isOpen, searchable]);

  // Keeps the list attached to the trigger while the page or a scrolling container moves
  useEffect(() => {
    if (!isOpen) return;
    const reposition = (event) => {
      if (event?.target instanceof Node && popupRef.current?.contains(event.target)) return;
      setPosition(measureList(triggerRef.current));
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen]);

  // Scrolls the highlighted option into view; centres the selected one when the list opens
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const list = listRef.current;
    const item = list?.querySelector(`[data-index="${activeIndex}"]`);
    if (!list || !item) return;

    if (centerOnOpen.current) {
      list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
      centerOnOpen.current = false;
    } else if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop;
    } else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [isOpen, activeIndex, query]);

  const triggerTone = isDanger
    ? 'border-error-container bg-error-container/45 text-alert-danger hover:border-alert-danger/30 focus-visible:ring-alert-danger/15'
    : `border-border-slate ${TRIGGER_BACKGROUND[variant]} text-on-surface hover:border-outline-variant focus-visible:border-secondary focus-visible:ring-secondary/20`;
  const openRing = isOpen ? (isDanger ? 'ring-2 ring-alert-danger/15' : 'border-secondary ring-2 ring-secondary/20') : '';
  const activeDescendant = isOpen && activeIndex >= 0 && visible[activeIndex] ? optionId(activeIndex) : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role={searchable ? undefined : 'combobox'}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={searchable ? undefined : activeDescendant}
        disabled={isDisabled}
        onClick={() => (isOpen ? close(true) : open())}
        onMouseDown={(event) => {
          // Keeps focus in the search box, so this click closes the list rather than blurring it first
          if (isOpen && searchable) event.preventDefault();
        }}
        onKeyDown={handleTriggerKeyDown}
        onBlur={handleBlur}
        className={`flex items-center gap-2 border text-left outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${TRIGGER_SIZE[variant]} ${triggerTone} ${openRing} ${className}`}
      >
        {isDanger && <span className="size-1.5 shrink-0 rounded-full bg-alert-danger" aria-hidden="true" />}
        <span className={`min-w-0 flex-1 truncate tabular-nums ${selected ? '' : 'text-on-surface-variant'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && <span className="sr-only">, {selected.hint}</span>}
        {selected?.description && (
          <span className="shrink-0 tabular-nums text-on-surface-variant">{selected.description}</span>
        )}
        <span
          aria-hidden="true"
          className={`material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            onMouseDown={(event) => {
              // Clicking an option must not steal focus from the trigger or search box
              if (event.target !== searchRef.current) event.preventDefault();
            }}
            style={{
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-110 flex flex-col overflow-hidden rounded-xl border border-border-slate bg-surface-container-lowest shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_4px_-2px_rgba(15,23,42,0.06)] animate-fade-in motion-reduce:animate-none"
          >
            {searchable && (
              <div className="shrink-0 border-b border-border-slate p-1.5">
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
                  >
                    search
                  </span>
                  <input
                    ref={searchRef}
                    type="text"
                    role="combobox"
                    aria-label={`${label}: ${searchPlaceholder}`}
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeDescendant}
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onChange={handleSearchChange}
                    onKeyDown={handleSearchKeyDown}
                    onBlur={handleBlur}
                    placeholder={searchPlaceholder}
                    className="h-8 w-full rounded-lg bg-canvas-bg pl-8 pr-2 text-body-sm text-on-surface outline-none ring-1 ring-inset ring-border-slate placeholder:text-on-surface-variant focus:ring-secondary"
                  />
                </div>
              </div>
            )}

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={-1}
              className={`relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain outline-none ${
                visible.length > 0 ? 'p-1' : ''
              }`}
            >
              {visible.map((option, index) => {
                const isActive = index === activeIndex;
                const isSelected = index === selectedIndex;
                const danger = option.tone === 'danger';

                let tone;
                if (danger) tone = isActive ? 'bg-error-container text-alert-danger' : 'bg-error-container/40 text-alert-danger';
                else if (isSelected) tone = isActive ? 'bg-on-surface/6 text-primary font-semibold' : 'text-primary font-semibold';
                else tone = isActive ? 'bg-on-surface/6 text-on-surface' : 'text-on-surface';

                return (
                  <li
                    key={String(option.value)}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    data-index={index}
                    onClick={() => choose(index)}
                    onMouseMove={() => {
                      if (!isActive && !option.disabled) setActiveIndex(index);
                    }}
                    className={`flex select-none items-center gap-2 rounded-lg px-2.5 py-2 ${OPTION_TEXT[variant]} ${tone} ${
                      option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                    }`}
                  >
                    {danger && <span className="size-1.5 shrink-0 rounded-full bg-alert-danger" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate tabular-nums">{option.label}</span>
                    {option.hint && <span className="sr-only">, {option.hint}</span>}
                    {option.description && (
                      <span className="shrink-0 font-normal tabular-nums text-on-surface-variant">{option.description}</span>
                    )}
                    <span
                      aria-hidden="true"
                      className={`material-symbols-outlined shrink-0 text-[16px] ${isSelected ? '' : 'invisible'}`}
                    >
                      check
                    </span>
                  </li>
                );
              })}
            </ul>

            {visible.length === 0 && (
              <p role="status" className="px-3.5 pb-3 pt-1 text-body-sm text-on-surface-variant">
                {emptyText}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
