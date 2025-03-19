const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const archiver = require("archiver");
const stringify = require("json-stringify-pretty-compact");

const defaultOptions = {
  outDir: "dist",
  packDir: "package",
};

// CI only Helpers
const zipName = (manifest) => `${manifest.name}-v${manifest.version}.zip`;
const permaLink = (fileName) =>
  `${process.env.CI_API_V4_URL}/projects/${process.env.CI_PROJECT_ID}/jobs/artifacts/${process.env.CI_COMMIT_REF_NAME}/raw/${fileName}?job=${process.env.CI_JOB_NAME}`;
// Manifest should point to latest in branch, not itself.
const permaLinkLatest = (fileName) => {
  const branch = process.env.CI_COMMIT_BRANCH || "master";
  return `${process.env.CI_API_V4_URL}/projects/${process.env.CI_PROJECT_ID}/jobs/artifacts/${branch}/raw/${fileName}?job=${process.env.CI_JOB_NAME}`;
};

// Make a dirty or unstable version
function resolveVersion(packageVersion) {
  const isTaggedRelease = process.env.CI_COMMIT_TAG;
  const isCI = process.env.CI;

  // Is a new tagged release in CI, commit should have
  // package.json with real version
  if (isTaggedRelease) {
    return packageVersion;
  }

  // Is in CI, but not a tagged release
  if (isCI) {
    // There should be some ever-increasing number in CI env
    const ciSequenceNo = process.env.CI_PIPELINE_IID;
    if (process.env.CI_COMMIT_REF_SLUG == "develop") {
      return `${packageVersion}-unstable.${ciSequenceNo}`;
    }
    return `${packageVersion}-${ciSequenceNo}`;
  }
  // Probably all local builds
  return `${packageVersion}-dirty`;
}

// PackageTool is a heavily opinionated packaging tool
// Bakes manifests
// Packages for distribution
class PackageTool {
  options;
  manifest = null;
  constructor(options) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.manifestType = path.parse(options.manifest).base;
  }

  loadManifest = async () => {
    const sourceManifest = await fs.readJSON(this.options.manifest);
    const packJSON = await fs.readJSON("package.json");

    let newManifest = {
      ...sourceManifest,
      version: resolveVersion(packJSON.version),
      url: packJSON.homepage,
      readme: packJSON.homepage,
      bugs: packJSON.bugs.url,
      license: packJSON.license,
    };

    if (process.env.CI) {
      newManifest.manifest = permaLinkLatest(this.manifestType);
      newManifest.download = permaLink(zipName(newManifest));

      if (process.env.CI_COMMIT_REF_SLUG === "develop") {
        newManifest.title = newManifest.title + "(unstable branch)";
      }
    }

    return (this.manifest = newManifest);
  };

  buildManifest = async () => {
    await fs.ensureDir(this.options.outDir);
    const manifest = await this.loadManifest();
    return await fs.writeFile(
      path.join(this.options.outDir, this.manifestType),
      stringify(manifest),
      "utf8"
    );
  };

  package = async () => {
    await this.loadManifest();
    // Ensure there is a directory to hold all the packaged versions
    await fs.ensureDir(this.options.packDir);

    // Initialize the zip file
    const zipPath = path.join(this.options.packDir, zipName(this.manifest));
    const zipFile = fs.createWriteStream(zipPath);
    const zip = archiver("zip", { zlib: { level: 9 } });

    zipFile.on("close", () => {
      console.log(chalk.green(zip.pointer() + " total bytes"));
      console.log(chalk.green(`Zip file ${zipPath} has been written`));
      return Promise.resolve();
    });

    zip.on("error", (err) => {
      throw err;
    });

    zip.pipe(zipFile);

    // Add the directory with the final code
    zip.directory(this.options.outDir, this.manifest.name);
    await zip.finalize();
  };
}

module.exports = PackageTool;
