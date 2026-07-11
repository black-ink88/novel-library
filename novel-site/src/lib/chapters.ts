import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const projectRoot = path.resolve(process.cwd(), "..");
const novelsRoot = path.join(projectRoot, "published");

export type Book = {
  title: string;
  slug: string;
  language: string;
  genre: string;
  status: string;
  current_chapter: number;
  active_volume?: string;
  cover?: string;
  description?: string;
};

export type Chapter = {
  number: number;
  slug: string;
  title: string;
  sourcePath: string;
  excerpt: string;
};

export type RenderedChapter = Chapter & {
  html: string;
};

marked.use({
  gfm: true,
  breaks: false
});

export async function getBooks(): Promise<Book[]> {
  const entries = await readdir(novelsRoot, { withFileTypes: true });
  const books = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await getBook(entry.name);
        } catch {
          return undefined;
        }
      })
  );

  return books.filter((book): book is Book => Boolean(book));
}

export async function getBook(slug = "ash-crown"): Promise<Book> {
  const bookPath = path.join(novelsRoot, slug, "book.json");
  const raw = await readFile(bookPath, "utf-8");
  return JSON.parse(raw) as Book;
}

export async function getChapters(bookSlug = "ash-crown"): Promise<Chapter[]> {
  const { root, files } = await findPublishedManuscripts(bookSlug);
  const chapterFiles = files
    .filter((file) => /^ch\d+_draft\.md$/.test(file))
    .sort((a, b) => a.localeCompare(b, "en"));

  return Promise.all(
    chapterFiles.map(async (file) => {
      const sourcePath = path.join(root, file);
      const raw = await readFile(sourcePath, "utf-8");
      const number = Number(file.match(/^ch(\d+)_draft\.md$/)?.[1] ?? 0);
      const title = extractTitle(raw) ?? `${number}장`;
      const body = raw.replace(/^# .+\n+/, "").trim();

      return {
        number,
        slug: String(number).padStart(2, "0"),
        title,
        sourcePath,
        excerpt: makeExcerpt(body)
      };
    })
  );
}

export async function getChapter(bookSlug: string, slug: string): Promise<RenderedChapter | undefined> {
  const chapters = await getChapters(bookSlug);
  const chapter = chapters.find((item) => item.slug === slug);

  if (!chapter) {
    return undefined;
  }

  const raw = await readFile(chapter.sourcePath, "utf-8");
  const body = raw.replace(/^# .+\n+/, "").trim();
  const html = await Promise.resolve(marked.parse(body));

  return {
    ...chapter,
    html
  };
}

async function findPublishedManuscripts(bookSlug: string): Promise<{ root: string; files: string[] }> {
  const bookRoot = path.join(novelsRoot, bookSlug);
  const volume = "volume_01";
  const manuscriptRoots = [
    path.join(bookRoot, "chapters"),
    path.join(bookRoot, "volumes", volume, "manuscript"),
    path.join(bookRoot, "volumes", volume, "revisions", "v2_fast_pacing_attempt"),
    path.join(bookRoot, "volumes", volume, "revisions", "v1_original")
  ];

  for (const root of manuscriptRoots) {
    try {
      const files = await readdir(root);
      if (files.some((file) => /^ch\d+_draft\.md$/.test(file))) {
        return { root, files };
      }
    } catch {
      continue;
    }
  }

  return { root: manuscriptRoots[0], files: [] };
}

function extractTitle(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function makeExcerpt(markdown: string): string {
  const firstParagraph =
    markdown
      .replace(/\*\s\*\s\*/g, "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "";

  return firstParagraph.length > 118 ? `${firstParagraph.slice(0, 118)}...` : firstParagraph;
}
