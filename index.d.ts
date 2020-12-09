export async function linkUserData(
  manifestPath: string,
  outDir: string
): Promise<void>;

export async function unlinkUserData(manifestPath: string): Promise<void>;

export class PackageTool {
  constructor(options: { manifest: string; outDir?: string; packDir?: string });
  buildManifest(): Promise<void>;
  package(): Promise<void>;
}
