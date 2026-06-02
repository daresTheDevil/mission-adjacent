/**
 * Wire @typescript-eslint/rule-tester to Vitest's lifecycle hooks. RuleTester
 * calls these statics; without this binding it throws at construction.
 */
import * as vitest from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;
