import { animateDropdown } from './animations.js';
// Accessible custom dropdown: options stay in document flow and push rows down.
export class Dropdown {
  constructor(container, field, options, onChange) {
    this.container = container;
    this.field = field;
    this.options = options;
    this.onChange = onChange;
    this.value = '';
    this.active = 0;
    this.opened = false;

    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.id = `${field}-trigger`;
    this.trigger.className = 'dropdown-trigger';
    this.trigger.setAttribute('role', 'combobox');
    this.trigger.setAttribute('aria-labelledby', `${field}-label ${field}-value`);
    this.trigger.setAttribute('aria-controls', `${field}-options`);
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-required', 'true');
    this.label = document.createElement('span');
    this.label.id = `${field}-value`;
    this.label.className = 'dropdown-value';
    this.label.textContent = '\u00a0';
    const arrow = document.createElement('span');
    arrow.className = 'dropdown-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = './assets/icons/expand-indicator.svg';
    image.alt = '';
    image.width = 10;
    image.height = 6;
    arrow.append(image);
    this.trigger.append(this.label, arrow);
    this.list = document.createElement('ul');
    this.list.id = `${field}-options`;
    this.list.className = 'dropdown-options';
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-labelledby', `${field}-label`);
    this.list.hidden = true;
    this.items = options.map((option, index) => {
      const item = document.createElement('li');
      item.id = `${field}-option-${index}`;
      item.className = 'dropdown-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.textContent = option;
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', () => this.choose(index));
      item.addEventListener('pointermove', () => this.setActive(index));
      this.list.append(item);
      return item;
    });
    container.append(this.trigger, this.list);
    this.trigger.addEventListener('click', () => this.opened ? this.close() : this.open());
    this.trigger.addEventListener('keydown', event => this.keydown(event));
    document.addEventListener('pointerdown', event => {
      if (!container.contains(event.target)) this.close();
    });
    container.addEventListener('focusout', event => {
      if (!container.contains(event.relatedTarget)) this.close();
    });
  }
  open() {
    // One open dropdown at a time, including when opened with the keyboard.
    document.dispatchEvent(new CustomEvent('dropdown-opening', { detail: this.field }));
    this.opened = true;
    animateDropdown(this, true);
    this.trigger.setAttribute('aria-expanded', 'true');
    this.setActive(Math.max(0, this.options.indexOf(this.value)));
  }
  close(change = () => {}) {
    if (!this.opened) { change(); return; }
    this.opened = false;
    animateDropdown(this, false, change);
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');
  }
  setActive(index) {
    this.active = index;
    this.items.forEach((item, i) => item.classList.toggle('is-active', i === index));
    this.list.classList.add('has-active');
    this.trigger.setAttribute('aria-activedescendant', this.items[index].id);
  }
  choose(index) {
    this.value = this.options[index];
    this.label.textContent = this.value;
    this.items.forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
    this.close(() => {
      this.trigger.focus({ preventScroll: true });
      this.onChange(this.value);
    });
  }
  reset() {
    this.value = '';
    this.label.textContent = '\u00a0';
    this.items.forEach(item => item.setAttribute('aria-selected', 'false'));
    this.trigger.removeAttribute('aria-invalid');
    this.close();
  }
  keydown(event) {
    const key = event.key;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault();
      if (!this.opened) { this.open(); return; }
      if (key === 'Enter' || key === ' ') { this.choose(this.active); return; }
      const next = key === 'Home' ? 0 : key === 'End' ? this.options.length - 1 :
        (this.active + (key === 'ArrowUp' ? -1 : 1) + this.options.length) % this.options.length;
      this.setActive(next);
    } else if (key === 'Escape') {
      event.preventDefault(); this.close();
    } else if (key === 'Tab') {
      this.close();
    } else if (key.length === 1 && /[a-z0-9]/i.test(key)) {
      const matches = this.options.map((option, index) => ({ option, index }))
        .filter(({ option }) => option.toLowerCase().startsWith(key.toLowerCase()));
      if (matches.length) {
        event.preventDefault();
        if (!this.opened) this.open();
        this.setActive((matches.find(({ index }) => index > this.active) || matches[0]).index);
      }
    }
  }
}
