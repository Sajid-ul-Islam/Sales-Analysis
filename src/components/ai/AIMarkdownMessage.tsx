"use client";

import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface AIMarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

/**
 * Rich, responsive Markdown message formatter for DEEN Assistant.
 * Formats:
 * - H1, H2, H3, H4 headers with font-headline styling
 * - Tables with overflow-x-auto, styled borders, and header badges
 * - Fenced code blocks with language badge and 1-click Copy button
 * - Unordered bullet lists and numbered lists with custom bullet pills
 * - Blockquotes and alerts
 * - Bold (**bold**) and italic (*italic*) text
 * - Inline `code` badges
 * - Currency (৳) and percentage (%) highlights
 */
export function AIMarkdownMessage({ content, isUser = false }: AIMarkdownMessageProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed text-xs">{content}</div>;
  }

  // Parse markdown into blocks (headers, tables, code blocks, lists, paragraphs, quotes)
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-3 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlock(block, idx)}</React.Fragment>
      ))}
    </div>
  );
}

type BlockType =
  | { type: 'header'; level: number; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(rawText: string): BlockType[] {
  const lines = rawText.split('\n');
  const blocks: BlockType[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const language = line.trim().replace(/^```/, '').trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      i++;
      continue;
    }

    // 2. Horizontal rule: --- or ***
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 3. Headers: #, ##, ###, ####
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Blockquote: > text
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'quote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    // 5. Tables: | Header | Header | ...
    if (line.trim().startsWith('|') && line.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parsedTable = parseTable(tableLines);
      if (parsedTable) {
        blocks.push(parsedTable);
        continue;
      }
    }

    // 6. Unordered list: - item or * item
    if (/^(\s*)[-*+]\s+(.+)$/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^(\s*)[-*+]\s+(.+)$/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s+(.+)$/);
        if (m) listItems.push(m[2].trim());
        i++;
      }
      blocks.push({
        type: 'ul',
        items: listItems,
      });
      continue;
    }

    // 7. Ordered list: 1. item
    if (/^\s*\d+\.\s+(.+)$/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+(.+)$/.test(lines[i])) {
        const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
        if (m) listItems.push(m[1].trim());
        i++;
      }
      blocks.push({
        type: 'ol',
        items: listItems,
      });
      continue;
    }

    // 8. Normal paragraph or line
    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^(\s*)[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
    }
  }

  return blocks;
}

function parseTable(lines: string[]): { type: 'table'; headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const splitCells = (line: string) => {
    return line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
  };

  const headers = splitCells(lines[0]);
  // Line 1 is usually separator (|---|---|)
  const rows: string[][] = [];

  for (let idx = 1; idx < lines.length; idx++) {
    const l = lines[idx];
    if (/^\|(\s*[-:]+\s*\|)+$/.test(l)) {
      continue; // separator line
    }
    const cells = splitCells(l);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return { type: 'table', headers, rows };
}

function renderBlock(block: BlockType, _key: number) {
  switch (block.type) {
    case 'header': {
      if (block.level === 1) {
        return (
          <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-3 mb-1.5 font-headline border-b border-slate-200/80 dark:border-[#1F1F1F] pb-1">
            {formatInlineText(block.text)}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-2.5 mb-1 font-headline flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 bg-primary dark:bg-orange-500 rounded-full shrink-0" />
            <span>{formatInlineText(block.text)}</span>
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
            <span className="w-1 h-2.5 bg-[#EB5A19] dark:bg-orange-400 rounded-full shrink-0" />
            <span>{formatInlineText(block.text)}</span>
          </h3>
        );
      }
      return (
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1.5 mb-0.5">
          {formatInlineText(block.text)}
        </h4>
      );
    }

    case 'paragraph': {
      return (
        <p className="leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
          {formatInlineText(block.text)}
        </p>
      );
    }

    case 'ul': {
      return (
        <ul className="space-y-1.5 my-1.5 pl-0.5">
          {block.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-orange-500 shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">{formatInlineText(item)}</div>
            </li>
          ))}
        </ul>
      );
    }

    case 'ol': {
      return (
        <ol className="space-y-1.5 my-1.5 pl-0.5">
          {block.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 dark:border-[#262626]">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">{formatInlineText(item)}</div>
            </li>
          ))}
        </ol>
      );
    }

    case 'quote': {
      return (
        <div className="p-3 my-2 rounded-xl bg-orange-50/60 dark:bg-[#121212] border-l-3 border-[#EB5A19] dark:border-orange-500 text-slate-800 dark:text-orange-200 text-xs leading-relaxed shadow-2xs">
          {formatInlineText(block.text)}
        </div>
      );
    }

    case 'code': {
      return <CodeBlock language={block.language} code={block.code} />;
    }

    case 'table': {
      return (
        <div className="overflow-x-auto my-2 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xs bg-white dark:bg-[#0D0D0D]">
          <table className="min-w-full text-[11px] divide-y divide-slate-200 dark:divide-[#1F1F1F]">
            {block.headers.length > 0 && (
              <thead className="bg-slate-50 dark:bg-[#141414]">
                <tr>
                  {block.headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px]"
                    >
                      {formatInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F1F]">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-[#141414] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'hr': {
      return <hr className="my-2 border-slate-200 dark:border-[#1F1F1F]" />;
    }

    default:
      return null;
  }
}

/**
 * Code Block component with 1-click copy
 */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-inner text-[11px]">
      <div className="px-3 py-1.5 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5 uppercase font-semibold">
          <Terminal className="w-3 h-3 text-primary" />
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Formats inline elements:
 * - **bold**
 * - *italic*
 * - `code`
 * - [links](url)
 * - ৳ BDT currency highlights
 */
function formatInlineText(text: string): React.ReactNode {
  if (!text) return null;

  // Split by inline code first: `...`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 dark:bg-[#141414] text-slate-800 dark:text-orange-300 font-mono text-[11px] border border-slate-200/80 dark:border-[#262626] font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Split by links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const partsWithLinks: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        partsWithLinks.push(
          formatBoldItalics(part.substring(lastIndex, match.index), `${pIdx}-${lastIndex}`)
        );
      }
      const label = match[1];
      const url = match[2];
      partsWithLinks.push(
        <a
          key={`${pIdx}-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary dark:text-orange-400 hover:underline font-semibold inline-flex items-center gap-0.5"
        >
          <span>{label}</span>
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < part.length) {
      partsWithLinks.push(formatBoldItalics(part.substring(lastIndex), `${pIdx}-${lastIndex}`));
    }

    return <React.Fragment key={pIdx}>{partsWithLinks}</React.Fragment>;
  });
}

function formatBoldItalics(text: string, keyPrefix: string): React.ReactNode {
  // Split by bold: **...** or __...__
  const boldParts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);

  return boldParts.map((bPart, bIdx) => {
    if (
      (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) ||
      (bPart.startsWith('__') && bPart.endsWith('__') && bPart.length > 4)
    ) {
      const inner = bPart.slice(2, -2);
      return (
        <strong key={`${keyPrefix}-b-${bIdx}`} className="font-bold text-slate-900 dark:text-white">
          {formatItalics(inner, `${keyPrefix}-b-${bIdx}`)}
        </strong>
      );
    }

    return formatItalics(bPart, `${keyPrefix}-t-${bIdx}`);
  });
}

function formatItalics(text: string, keyPrefix: string): React.ReactNode {
  // Split by italics: *...* or _..._
  const italicParts = text.split(/(\*[^*]+\*|_[^_]+_)/g);

  return italicParts.map((iPart, iIdx) => {
    if (
      (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) ||
      (iPart.startsWith('_') && iPart.endsWith('_') && iPart.length > 2)
    ) {
      return (
        <em key={`${keyPrefix}-i-${iIdx}`} className="italic text-slate-800 dark:text-slate-200">
          {iPart.slice(1, -1)}
        </em>
      );
    }

    return iPart;
  });
}
