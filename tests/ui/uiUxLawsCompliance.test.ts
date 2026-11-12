import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function walkTsxFiles(relDir: string): string[] {
  const fullDir = path.resolve(process.cwd(), relDir);
  const results: string[] = [];
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const abs = path.join(fullDir, entry.name);
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(rel));
    } else if (abs.endsWith('.tsx')) {
      results.push(rel);
    }
  }
  return results;
}

describe('Core UI Design Principles, UX Honeycomb & Psychological Laws Compliance', () => {
  it('verifies UI/UX Rule and Agent Skill files exist and are referenced in docs', () => {
    const ruleContent = readRepoFile('.agents/rules/ui_ux_laws_and_principles.md');
    const skillContent = readRepoFile('.agents/skills/ui-ux-audit-and-design/SKILL.md');

    expect(ruleContent).toContain('Visual Hierarchy');
    expect(ruleContent).toContain('UX Honeycomb');
    expect(ruleContent).toContain("Hick's Law");
    expect(ruleContent).toContain("Fitts's Law");
    expect(ruleContent).toContain("Jakob's Law");
    expect(ruleContent).toContain("Miller's Law");
    expect(ruleContent).toContain('Aesthetic-Usability Effect');

    expect(skillContent).toContain('name: ui-ux-audit-and-design');
    expect(skillContent).toContain('ui_ux_laws_and_principles.md');

    for (const docPath of ['AGENTS.md', 'docs/AGENTS.md', 'DESIGN.md', 'docs/DESIGN.md']) {
      expect(readRepoFile(docPath)).toContain('ui_ux_laws_and_principles.md');
    }
    for (const skillsDoc of ['SKILLS.md', 'docs/SKILLS.md']) {
      expect(readRepoFile(skillsDoc)).toContain('ui-ux-audit-and-design');
    }
  });

  it('enforces Jakob Law & Accessibility: all modals/drawers include role="dialog", aria-modal="true", and Escape handler', () => {
    const files = [...walkTsxFiles('src/components'), ...walkTsxFiles('src/app')];
    const failures: string[] = [];

    for (const file of files) {
      const content = readRepoFile(file);
      if (/(Modal|Drawer)\.tsx$/i.test(file) || /fixed inset-0/.test(content)) {
        const hasDialog = /role=["']dialog["']/.test(content);
        const hasAriaModal = /aria-modal=/.test(content);
        const hasEsc = /Escape/.test(content);
        if (!hasDialog || !hasAriaModal || !hasEsc) {
          failures.push(`${file} (dialog=${hasDialog}, ariaModal=${hasAriaModal}, esc=${hasEsc})`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('enforces Accessibility & Contrast: icon-only buttons define explicit aria-label across UI components', () => {
    const files = [...walkTsxFiles('src/components'), ...walkTsxFiles('src/app')];
    const missing: string[] = [];

    for (const file of files) {
      const content = readRepoFile(file);
      const btns = [...content.matchAll(/<button\b([^>]*(?:\n[^>]*)*?)>([\s\S]*?)<\/button>/g)];
      for (const m of btns) {
        const attrs = m[1];
        const inner = m[2];
        const strippedText = inner.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
        const hasSvgOrIcon = /<[A-Z]\w+|<svg/.test(inner);
        const nonTag = inner.replace(/<[^>]+>/g, '');
        const hasExpr = /\{[^}]*\}/.test(nonTag);
        if (hasSvgOrIcon && !strippedText && !hasExpr && !/aria-label=/.test(attrs)) {
          const lineNo = content.slice(0, m.index).split('\n').length;
          missing.push(`${file}:${lineNo}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('enforces Proximity & Layout Containment: all <table> elements sit inside overflow-x-auto wrappers', () => {
    const files = [...walkTsxFiles('src/components'), ...walkTsxFiles('src/app')];
    const unwrapped: string[] = [];

    for (const file of files) {
      const content = readRepoFile(file);
      for (const tm of content.matchAll(/<table\b/g)) {
        const idx = tm.index ?? 0;
        const beforeChunk = content.slice(Math.max(0, idx - 35000), idx);
        const wrapperMatches = [...beforeChunk.matchAll(/(?:overflow-x-auto|table-container-responsive)/g)];
        let hasOpenWrapper = false;
        for (let i = wrapperMatches.length - 1; i >= 0; i--) {
          const wIdx = wrapperMatches[i].index ?? 0;
          const afterWrapper = beforeChunk.slice(wIdx);
          const tagCloseOffset = afterWrapper.indexOf('>');
          if (tagCloseOffset !== -1) {
            const innerSlice = afterWrapper.slice(tagCloseOffset + 1);
            const opens = (innerSlice.match(/<div\b/g) || []).length;
            const closes = (innerSlice.match(/<\/div>/g) || []).length;
            if (opens >= closes || afterWrapper.length < 400) {
              hasOpenWrapper = true;
              break;
            }
          }
        }
        if (!hasOpenWrapper) {
          const lineNo = content.slice(0, idx).split('\n').length;
          unwrapped.push(`${file}:${lineNo}`);
        }
      }
    }

    expect(unwrapped).toEqual([]);
  });

  it('enforces Feedback & Accessibility on main dashboard shell (aria-live toast, skip link, keyboard KPI cards & dropzones)', () => {
    const pageContent = readRepoFile('src/app/page.tsx');
    expect(pageContent).toContain('href="#mainContent"');
    expect(pageContent).toContain('role="status"');
    expect(pageContent).toContain('aria-live="polite"');

    const kpiContent = readRepoFile('src/components/KpiOverview.tsx');
    const kpiButtonRoles = (kpiContent.match(/role="button"/g) || []).length;
    expect(kpiButtonRoles).toBeGreaterThanOrEqual(10);

    const dropzoneContent = readRepoFile('src/components/FileDropzone.tsx');
    const dropzoneRoles = (dropzoneContent.match(/role="button"/g) || []).length;
    expect(dropzoneRoles).toBeGreaterThanOrEqual(5);

    const sidebarContent = readRepoFile('src/components/Sidebar.tsx');
    expect(sidebarContent).toContain('aria-current={isActive ? \'page\' : undefined}');
  });
});
