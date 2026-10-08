const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function game() {
  const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  const start = source.indexOf('const GM2_PERSONALITIES=');
  const end = source.indexOf('async function gm2Start()', start);
  const buttons = ['sim', 'next-season'].map(action => ({
    dataset: { gm2Action: action },
    addEventListener(type, callback) { this[type] = callback; }
  }));
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: selector => selector === '[data-gm2-action]' ? buttons : []
    });
    return elements.get(selector);
  };
  const context = vm.createContext({
    document: { querySelector: element },
    $: element, $$: () => [], esc: String,
    window: {}, localStorage: { setItem() {} },
    arcade: { pool: [] }, confirm: () => true
  });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext(`gm2.roster = Array.from({length:10}, (_,i) => ({
    id:String(i), name:'Player '+i, team:'TEST', pos:GM2_SLOTS[i%5],
    slot:i<5?GM2_SLOTS[i]:null, backupSlot:GM2_SLOTS[i%5],
    starter:i<5, rating:80, health:100, fatigue:0, morale:70
  }));`, context);
  return { context, buttons };
}

test('GM render binds every action button and simulation survives rerender', () => {
  const { context, buttons } = game();
  assert.doesNotThrow(() => vm.runInContext('gm2Render()', context));
  buttons.forEach(button => assert.equal(typeof button.click, 'function'));
  assert.doesNotThrow(() => buttons[0].click());
  assert.equal(vm.runInContext('gm2.turn', context), 1);
  assert.ok(vm.runInContext('gm2.record.w + gm2.record.l', context) >= 6);
});

test('end-of-season action continues the same franchise and rebinds controls', () => {
  const { context, buttons } = game();
  vm.runInContext('gm2.turn=10; gm2.record={w:40,l:35}; gm2Render()', context);
  assert.doesNotThrow(() => buttons[1].click());
  assert.equal(vm.runInContext('gm2.season', context), 2);
  assert.equal(vm.runInContext('gm2.turn', context), 0);
  assert.equal(vm.runInContext('gm2.history[0].w', context), 40);
  assert.equal(vm.runInContext('gm2.roster.length', context), 10);
});
