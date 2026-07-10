import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('NosDicenGeeks'),
    image: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
    draft: z.boolean().default(false),
    slug: z.string().optional(),
    heroLabel: z.string().optional(),
    heroTitle: z.string().optional(),
    heroCopy: z.string().optional(),
    heroLabelColor: z.string().optional(),
    heroTitleColor: z.string().optional(),
    heroCopyColor: z.string().optional(),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string().optional(),
    twitter: z.string().optional(),
    github: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: z.object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string(),
    og_title: z.string().optional().default(''),
    og_description: z.string().optional().default(''),
    og_image: z.string().optional().default(''),
    twitter_card: z.string().optional().default('summary_large_image'),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
    slug: z.string().optional(),
  }),
});

export const collections = { blog, authors, pages };
