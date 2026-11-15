import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_GUIDES_DIR = path.resolve(__dirname, '../skills/mbd-guidance/guides');

/**
 * Strip surrounding single or double quotes from a YAML scalar string.
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse a lightweight subset of YAML frontmatter (scalars, inline arrays, bullet lists).
 * @param {string} markdown
 * @returns {{ meta: Record<string, string | string[]>, body: string }}
 */
export function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { meta: {}, body: normalized.trim() };
  }

  const endIdx = normalized.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { meta: {}, body: normalized.trim() };
  }

  const rawFrontmatter = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + 5).trim();
  const meta = {};
  let currentListKey = null;

  for (const line of rawFrontmatter.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('- ') && currentListKey) {
      if (!Array.isArray(meta[currentListKey])) {
        meta[currentListKey] = [];
      }
      meta[currentListKey].push(unquote(trimmed.slice(2)));
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      currentListKey = null;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (!rawValue) {
      meta[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = null;
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1).trim();
      meta[key] = inner
        ? inner.split(',').map((item) => unquote(item)).filter(Boolean)
        : [];
    } else {
      meta[key] = unquote(rawValue);
    }
  }

  return { meta, body };
}

/**
 * Recursively collect all Markdown files inside a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load all guides from disk with parsed metadata and body content.
 * @param {string} [guidesDir]
 * @returns {Array<{
 *   id: string,
 *   title: string,
 *   category: string,
 *   description: string,
 *   tags: string[],
 *   apiVersion: string,
 *   ecosystems: string[],
 *   filePath: string,
 *   relativePath: string,
 *   body: string
 * }>}
 */
export function loadCatalog(guidesDir = DEFAULT_GUIDES_DIR) {
  const files = walkMarkdownFiles(guidesDir);
  const guides = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const relativePath = path.relative(guidesDir, filePath).replaceAll('\\', '/');
    const pathSegments = relativePath.split('/');
    const fallbackCategory = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : 'general';
    const fallbackId = path.basename(filePath, '.md');

    return {
      id: typeof meta.id === 'string' && meta.id ? meta.id : fallbackId,
      title: typeof meta.title === 'string' && meta.title ? meta.title : fallbackId,
      category: typeof meta.category === 'string' && meta.category ? meta.category : fallbackCategory,
      description: typeof meta.description === 'string' ? meta.description : '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      apiVersion: typeof meta.apiVersion === 'string' ? meta.apiVersion : 'v10',
      ecosystems: Array.isArray(meta.ecosystems) ? meta.ecosystems : ['discord.js v14+', 'Discord API v10'],
      filePath,
      relativePath,
      body,
    };
  });

  guides.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  return guides;
}

/**
 * Retrieve a single guide by its id or category/id slug.
 * @param {string} idOrSlug
 * @param {string} [guidesDir]
 */
export function getGuideById(idOrSlug, guidesDir = DEFAULT_GUIDES_DIR) {
  const needle = idOrSlug.trim().toLowerCase().replace(/\.md$/, '');
  const catalog = loadCatalog(guidesDir);

  return (
    catalog.find((guide) => guide.id.toLowerCase() === needle) ||
    catalog.find((guide) => `${guide.category}/${guide.id}`.toLowerCase() === needle) ||
    null
  );
}

/**
 * List guide metadata, optionally filtered by category.
 * @param {{ category?: string, guidesDir?: string }} [options]
 */
export function listGuides(options = {}) {
  const { category, guidesDir = DEFAULT_GUIDES_DIR } = options;
  const catalog = loadCatalog(guidesDir);
  const normalizedCategory = category ? category.trim().toLowerCase() : '';

  return catalog
    .filter((guide) => !normalizedCategory || guide.category.toLowerCase() === normalizedCategory)
    .map(({ id, category: cat, title, description, apiVersion, ecosystems }) => ({
      id,
      category: cat,
      title,
      description,
      apiVersion,
      ecosystems,
    }));
}
