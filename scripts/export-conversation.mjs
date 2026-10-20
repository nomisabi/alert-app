#!/usr/bin/env node
/**
 * Exports the latest Claude Code conversation as a readable Markdown file:
 * the developer's messages, Claude's replies, and one line per action.
 * Personal data (git name/email, OS username, session IDs) is redacted.
 *
 * Usage (from the repo root):
 *   node scripts/export-conversation.mjs --name 1-data-model_conversations --title "Phase 1: Data model"
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((arg) => {
      const [key, ...rest] = arg.split(' ');
      return [key, rest.join(' ').replace(/^"|"$/g, '')];
    }),
);
if (!args.name) {
  console.error('Usage: node scripts/export-conversation.mjs --name <file> [--title <text>]');
  process.exit(1);
}

// Newest alert-app transcript in ~/.claude/projects
const projectsDir = path.join(os.homedir(), '.claude', 'projects');
const transcriptPath = fs
  .readdirSync(projectsDir)
  .filter((dir) => dir.toLowerCase().includes('alert-app'))
  .flatMap((dir) =>
    fs
      .readdirSync(path.join(projectsDir, dir))
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => path.join(projectsDir, dir, file)),
  )
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

const entries = fs
  .readFileSync(transcriptPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((e) => (e.type === 'user' || e.type === 'assistant') && !e.isSidechain && !e.isMeta);

// ---------- redaction ----------

const gitConfig = (key) => {
  try {
    return execSync(`git config ${key}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};
const gitName = gitConfig('user.name');
const gitEmail = gitConfig('user.email');
const username = os.userInfo().username;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const redactions = [
  [gitEmail, '<your-email>'],
  [gitName, '<your-name>'],
  [username, '<user>'],
  // Windows' short (8.3) form of the user folder in temp paths, e.g. "C:/Users/JOHNDO~1/AppData"
  [`${username.replace(/\s/g, '').slice(0, 6)}~1`, '<user>'],
  ...gitName.split(/\s+/).map((part) => [part, '<your-name>']),
  ...[...new Set(entries.map((e) => e.sessionId))].map((id) => [id, '<session-id>']),
]
  .filter(([text]) => text && text.length >= 3)
  .sort((a, b) => b[0].length - a[0].length);

function redact(text) {
  return (
    redactions
      .reduce(
        (out, [value, replacement]) =>
          out.replace(new RegExp(escapeRegExp(value), 'gi'), replacement),
        text,
      )
      .replace(/(\bUsers(?:\\+|\/+))(?!<user>)[^\\/\s"'`<>]+/gi, '$1<user>')
      // Windows short (8.3) form of the username in temp paths, e.g. "JOHN-S~1"
      .replace(new RegExp(`${escapeRegExp(username.slice(0, 6))}~\\d+`, 'gi'), '<user>')
  );
}

// ---------- rendering ----------

const relativePath = (filePath = '') =>
  path.relative(repoRoot, path.resolve(filePath)).replaceAll('\\', '/');

function summarizeToolCall({ name, input }) {
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return `🔧 ${input.description ?? 'Ran a command'}`;
    case 'Write':
      return `📝 Wrote \`${relativePath(input.file_path)}\``;
    case 'Edit':
      return `✏️ Edited \`${relativePath(input.file_path)}\``;
    case 'Read':
      return `📖 Read \`${relativePath(input.file_path)}\``;
    case 'Grep':
    case 'Glob':
      return `🔍 Searched for \`${input.pattern}\``;
    case 'WebSearch':
      return `🌐 Web search: "${input.query}"`;
    case 'ToolSearch':
      return null;
    default:
      return `🔧 ${name}`;
  }
}

const out = [];
let speaker = null;
let actions = [];
const flush = () => {
  if (actions.length) out.push(actions.map((line) => `- ${line}`).join('\n'));
  actions = [];
};
const switchTo = (who) => {
  if (speaker === who) return;
  flush();
  out.push(who === 'user' ? '---\n\n## 👤 Developer' : '## 🤖 Claude');
  speaker = who;
};

for (const entry of entries) {
  const content = entry.message.content;
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  for (const block of blocks) {
    if (entry.type === 'user' && block.type === 'text') {
      const text = block.text
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, '')
        .trim();
      if (!text) continue;
      switchTo('user');
      out.push(text.startsWith('[Request interrupted') ? '> _(interrupted Claude)_' : text);
    } else if (entry.type === 'assistant' && block.type === 'text' && block.text.trim()) {
      switchTo('claude');
      flush();
      out.push(block.text.trim());
    } else if (entry.type === 'assistant' && block.type === 'tool_use') {
      const summary = summarizeToolCall(block);
      if (!summary) continue;
      switchTo('claude');
      actions.push(summary);
    }
  }
}
flush();

const header = `# ${args.title || args.name}\n\nExported from Claude Code with \`scripts/export-conversation.mjs\`. Personal data is redacted.`;
const outPath = path.join(repoRoot, 'docs', 'claude-conversations', `${args.name}.md`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, redact(`${header}\n\n${out.join('\n\n')}\n`));
console.log(`Written: ${relativePath(outPath)}`);
