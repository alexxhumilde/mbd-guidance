#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getGuideById } from '../src/catalog.mjs';

const VALID_ECOSYSTEMS = new Set(['gateway', 'http-interactions', 'hybrid']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_STATUSES = new Set(['confirmed', 'needs_validation', 'rejected']);
const VALID_CATEGORIES = new Set([
  'security',
  'ui-components',
  'legacy-migration',
  'architecture',
  'web-integration',
]);

function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Validate an audit findings report object against the MBD Guidance contract.
 * @param {unknown} report
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAuditReport(report) {
  const errors = [];

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { valid: false, errors: ['Report root must be a JSON object.'] };
  }

  if (report.schemaVersion !== '1.0.0') {
    errors.push('schemaVersion must equal "1.0.0".');
  }
  if (!isNonEmptyString(report.botName)) {
    errors.push('botName must be a non-empty string.');
  }
  if (!VALID_ECOSYSTEMS.has(report.ecosystem)) {
    errors.push(`ecosystem must be one of: ${Array.from(VALID_ECOSYSTEMS).join(', ')}.`);
  }
  if (!isNonEmptyString(report.auditedAt) || Number.isNaN(Date.parse(report.auditedAt))) {
    errors.push('auditedAt must be a valid ISO-8601 date-time string.');
  }
  if (!Array.isArray(report.coverage) || report.coverage.length === 0) {
    errors.push('coverage must be a non-empty array of reviewed coverage units.');
  } else {
    report.coverage.forEach((unit, idx) => {
      if (!isNonEmptyString(unit)) {
        errors.push(`coverage[${idx}] must be a non-empty string.`);
      }
    });
  }

  if (!Array.isArray(report.findings)) {
    errors.push('findings must be an array.');
    return { valid: false, errors };
  }

  const seenIds = new Set();
  report.findings.forEach((finding, idx) => {
    const prefix = `findings[${idx}]`;
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    if (!isNonEmptyString(finding.id) || !/^F-[0-9]{3,}$/.test(finding.id)) {
      errors.push(`${prefix}.id must match pattern ^F-[0-9]{3,}$ (e.g. "F-001").`);
    } else if (seenIds.has(finding.id)) {
      errors.push(`${prefix}.id "${finding.id}" is duplicated.`);
    } else {
      seenIds.add(finding.id);
    }

    if (!VALID_SEVERITIES.has(finding.severity)) {
      errors.push(`${prefix}.severity must be one of: ${Array.from(VALID_SEVERITIES).join(', ')}.`);
    }
    if (!VALID_STATUSES.has(finding.status)) {
      errors.push(`${prefix}.status must be one of: ${Array.from(VALID_STATUSES).join(', ')}.`);
    }
    if (!VALID_CATEGORIES.has(finding.category)) {
      errors.push(`${prefix}.category must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}.`);
    }
    if (!isNonEmptyString(finding.title) || finding.title.trim().length < 5) {
      errors.push(`${prefix}.title must be at least 5 characters long.`);
    }
    if (!isNonEmptyString(finding.trustBoundary) || finding.trustBoundary.trim().length < 5) {
      errors.push(`${prefix}.trustBoundary must describe the crossed trust boundary.`);
    }

    if (!finding.evidence || typeof finding.evidence !== 'object' || Array.isArray(finding.evidence)) {
      errors.push(`${prefix}.evidence must be an object with file, line, and snippet.`);
    } else {
      if (!isNonEmptyString(finding.evidence.file)) {
        errors.push(`${prefix}.evidence.file must be a non-empty string.`);
      }
      if (!Number.isInteger(finding.evidence.line) || finding.evidence.line < 1) {
        errors.push(`${prefix}.evidence.line must be an integer >= 1.`);
      }
      if (!isNonEmptyString(finding.evidence.snippet)) {
        errors.push(`${prefix}.evidence.snippet must be a non-empty string.`);
      }
    }

    if (!isNonEmptyString(finding.remediation) || finding.remediation.trim().length < 5) {
      errors.push(`${prefix}.remediation must be at least 5 characters long.`);
    }

    if (!isNonEmptyString(finding.guideId)) {
      errors.push(`${prefix}.guideId must be a non-empty guide identifier.`);
    } else if (!getGuideById(finding.guideId)) {
      errors.push(`${prefix}.guideId "${finding.guideId}" does not exist in the mbd-guidance catalog.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function runCli() {
  const filePath = process.argv[2];
  if (!filePath || filePath === '--help' || filePath === '-h') {
    console.log('Usage: node ./scripts/validate-audit-report.mjs <path-to-findings.json>');
    process.exit(filePath ? 0 : 1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    console.error(`Error: invalid JSON in ${filePath}: ${err.message}`);
    process.exit(1);
  }

  const result = validateAuditReport(parsed);
  if (!result.valid) {
    console.error(`Audit report validation failed (${result.errors.length} error(s)):`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Audit report valid: ${parsed.findings.length} finding(s) verified against schema and guide catalog.`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli();
}
