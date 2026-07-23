import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, fillTemplate, detectPhoneColumn, createQueue, queueStats } from '../src/core.js';

test('normalizes Saudi local mobile numbers', () => assert.equal(normalizePhone('050 123 4567'), '966501234567'));
test('keeps international numbers', () => assert.equal(normalizePhone('+966501234567'), '966501234567'));
test('fills message variables', () => assert.equal(fillTemplate('هلا {name}', { name: 'احمد' }), 'هلا احمد'));
test('detects Arabic phone column', () => assert.equal(detectPhoneColumn(['الاسم','رقم الجوال']), 'رقم الجوال'));
test('creates deduplicated queue', () => {
  const queue = createQueue([{name:'ا',phone:'0500000000'},{name:'ب',phone:'0500000000'},{name:'ج',phone:'0550000000'}]);
  assert.equal(queue.length, 2);
});
test('calculates queue stats', () => {
  const stats = queueStats([{status:'sent'},{status:'opened'},{status:'waiting'}]);
  assert.deepEqual(stats, {total:3,sent:1,remaining:2});
});
