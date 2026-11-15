#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_SCHEMA_PATH,
  runCli,
  validateAuditReport,
} from '../skills/mbd-guidance/scripts/validate-audit-report.mjs';

export { DEFAULT_SCHEMA_PATH, runCli, validateAuditReport };

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;

if (isDirectExecution) {
  runCli();
}
