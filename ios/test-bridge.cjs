const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
class Element {
    constructor() { this.children = []; this.events = {}; this.style = {}; }
    set innerHTML(_) { this.button = new Element(); this.status = new Element(); this.list = new Element(); }
    querySelector(selector) { return selector === 'button' ? this.button : this.status; }
    get lastElementChild() { return this.list; }
    append(...items) { this.children.push(...items); }
    replaceChildren() { this.children = []; }
    addEventListener(event, callback) { this.events[event] = callback; }
    closest() { return this; }
    after(panel) { this.panel = panel; }
}
(async () => {
    const date = new Element(); date.value = '2026-09-14';
    const header = new Element();
    const workout = {id: '11111111-1111-1111-1111-111111111111', date: date.value,
        name: '<운동>', durationMinutes: 42, calories: 100};
    let response = [workout, workout, {...workout, id: 'invalid'}];
    const records = [];
    const window = {webkit: {messageHandlers: {health: {postMessage: async () => response}}}};
    runInNewContext(readFileSync(__dirname + '/EverydayCheckup/health-bridge.js', 'utf8'), {
        window, allRecordsCache: records,
        document: {addEventListener: () => {}, createElement: () => new Element(), createTextNode: text => text,
            getElementById: id => id === 'dateInput' ? date : header}
    });
    const panel = header.panel;
    await panel.button.events.click();
    assert.equal(panel.list.children.length, 1, 'deduplicates and rejects invalid payloads');
    let checkbox = panel.list.children[0].children[0];
    checkbox.checked = true; checkbox.events.change();
    assert.equal(window.checkupHealth.forDate(date.value).length, 1);
    assert.equal(window.checkupHealth.forDate('2026-09-13').length, 0);
    assert.ok(window.checkupHealth.summary([workout]).includes('&lt;운동&gt;'), 'escapes history HTML');
    checkbox.checked = false; checkbox.events.change();
    assert.equal(window.checkupHealth.forDate(date.value).length, 0, 'deselection');
    checkbox.checked = true; checkbox.events.change();
    records.push({healthWorkouts: [workout]});
    assert.equal(window.checkupHealth.forDate(date.value).length, 0, 'saved UUID not imported twice');
    await panel.button.events.click();
    assert.equal(panel.list.children[0].children[0].disabled, true);
    date.value = '2026-09-13'; date.events.change();
    assert.equal(panel.list.children.length, 0);
    response = null; await panel.button.events.click();
    assert.equal(panel.button.disabled, false, 'button restored after failure');
    assert.ok(panel.status.textContent.includes('가져오지 못했습니다'));
    window.checkupHealth.clear();
    assert.equal(panel.list.children.length, 0);
    console.log('PASS: validation, deduplication, date filtering, selection, escaping, saved UUID, error recovery, reset');
})().catch(error => { console.error(error); process.exitCode = 1; });
