import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const projectRoot = path.resolve(process.cwd(), "..");
const novelsRoot = path.join(projectRoot, "published");
const siteConfigPath = path.join(projectRoot, "site.json");

export type SiteConfig = {
  author: string;
  name: string;
  description: string;
};

export type Book = {
  title: string;
  slug: string;
  author?: string;
  language: string;
  genre: string;
  status: string;
  current_chapter: number;
  active_volume?: string;
  cover?: string;
  description?: string;
  synopsis?: string[];
  volumes?: Volume[];
};

export type Volume = {
  slug: string;
  label: string;
  title: string;
  description?: string;
  chapter_count?: number;
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

export async function getSite(): Promise<SiteConfig> {
  const raw = await readFile(siteConfigPath, "utf-8");
  return JSON.parse(raw) as SiteConfig;
}

export async function getBook(slug = "ash-crown"): Promise<Book> {
  const bookPath = path.join(novelsRoot, slug, "book.json");
  const raw = await readFile(bookPath, "utf-8");
  return JSON.parse(raw) as Book;
}

export async function getVolumes(bookSlug = "ash-crown"): Promise<Volume[]> {
  const book = await getBook(bookSlug);
  return book.volumes ?? [];
}

export async function getChapters(bookSlug = "ash-crown", volumeSlug?: string): Promise<Chapter[]> {
  const { root, files } = await findPublishedManuscripts(bookSlug, volumeSlug);
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

export async function getChapter(bookSlug: string, slug: string, volumeSlug?: string): Promise<RenderedChapter | undefined> {
  const chapters = await getChapters(bookSlug, volumeSlug);
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

async function findPublishedManuscripts(bookSlug: string, volumeSlug?: string): Promise<{ root: string; files: string[] }> {
  const bookRoot = path.join(novelsRoot, bookSlug);
  const root = volumeSlug
    ? path.join(bookRoot, "volumes", volumeSlug, "chapters")
    : path.join(bookRoot, "chapters");

  try {
    const files = await readdir(root);
    return { root, files };
  } catch {
    return { root, files: [] };
  }
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
