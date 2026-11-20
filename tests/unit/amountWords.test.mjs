import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from '../../src/utils/amountWords.js';

test('amounts read in the Indian system', () => {
    assert.equal(amountInWords(0), 'Rupees Zero Only');
    assert.equal(amountInWords(15), 'Rupees Fifteen Only');
    assert.equal(amountInWords(25000), 'Rupees Twenty Five Thousand Only');
    assert.equal(amountInWords(115000), 'Rupees One Lakh Fifteen Thousand Only');
    assert.equal(amountInWords(1250000.5), 'Rupees Twelve Lakh Fifty Thousand and Fifty Paise Only');
    assert.equal(amountInWords(30001), 'Rupees Thirty Thousand One Only');
    assert.equal(amountInWords(12345678), 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
});
