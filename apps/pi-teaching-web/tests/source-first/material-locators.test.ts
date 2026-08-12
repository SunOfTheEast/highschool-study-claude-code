import { expect, test } from 'bun:test';
import {
  formatMaterialLocatorValue,
  parseMaterialLocator,
} from '../../src/study/material-locators';

test('parses and formats the one canonical material locator grammar', () => {
  expect(parseMaterialLocator(null)).toEqual({ kind: 'whole' });
  expect(parseMaterialLocator('whole')).toEqual({ kind: 'whole' });
  expect(parseMaterialLocator('lines-2-8')).toEqual({ kind: 'lines', start: 2, end: 8 });
  expect(parseMaterialLocator('page-0062')).toEqual({ kind: 'pages', start: 62, end: 62 });
  expect(parseMaterialLocator('pages-0062-0065')).toEqual({ kind: 'pages', start: 62, end: 65 });

  expect(formatMaterialLocatorValue({ kind: 'whole' })).toBeNull();
  expect(formatMaterialLocatorValue({ kind: 'lines', start: 2, end: 8 })).toBe('lines-2-8');
  expect(formatMaterialLocatorValue({ kind: 'pages', start: 62, end: 62 })).toBe('page-0062');
  expect(formatMaterialLocatorValue({ kind: 'pages', start: 62, end: 65 }))
    .toBe('pages-0062-0065');
});

test('rejects malformed, reversed, unpadded, zero, and out-of-book page ranges', () => {
  for (const value of [
    '',
    'page-0',
    'page-0000',
    'page-62',
    'pages-0065-0062',
    'pages-0000-0001',
    'pages-0062-62',
    'lines-8-2',
    'lines-0-2',
  ]) {
    expect(() => parseMaterialLocator(value)).toThrow('MATERIAL_LOCATOR_INVALID');
  }
  expect(() => parseMaterialLocator('pages-0062-0065', { pageCount: 64 }))
    .toThrow('MATERIAL_LOCATOR_NOT_FOUND');
  expect(parseMaterialLocator('pages-0062-0065', { pageCount: 65 }))
    .toEqual({ kind: 'pages', start: 62, end: 65 });
});
