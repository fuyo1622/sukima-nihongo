declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    keepAllGlyphs?: boolean;
    noLayoutClosure?: boolean;
  }
  export default function subsetFont(buffer: Buffer, text: string | undefined, options?: SubsetFontOptions): Promise<Buffer>;
}
